"""
ingest_ais_data.py - Ingest real AIS vessel data into ais_pings table
======================================================================
Uses ALL Layer 2 components as designed in the plan:

    CSV row
        ↓
    models.AISPing       — Pydantic validation (9-digit MMSI, lat/lon range, UTC ts)
        ↓
    h3_utils.encode_point — H3 hex cell encoding
        ↓
    repository.insert_ais_batch — SQL INSERT with ON CONFLICT DO NOTHING
        (uses db.get_pool() internally — asyncpg connection pool)
        ↓
    config.settings      — DATABASE_URL, H3_RESOLUTION from .env

Place this file inside layer_2_new/ so it can import the other modules.

Run from layer_2_new/:
    python ingest_ais_data.py

Or from project root:
    python layer_2_new/ingest_ais_data.py
"""

import asyncio
import os
import sys

import pandas as pd
from pydantic import ValidationError

# ── Layer 2 imports (all five components) ────────────────────────────────────
# This file lives inside layer_2_new/, so these are sibling imports.
from config import settings          # DATABASE_URL, H3_RESOLUTION, etc.
from db import init_pool, close_pool # asyncpg connection pool lifecycle
from h3_utils import encode_point    # lat/lon → H3 cell (int)
from models import AISPing           # Pydantic validation model
from repository import insert_ais_batch  # SQL INSERT with ON CONFLICT DO NOTHING
# ─────────────────────────────────────────────────────────────────────────────

# CSV file is in Data/Demo 1/ relative to project root
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))   # layer_2_new/
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
CSV_FILE     = os.path.join(PROJECT_ROOT, "Data", "Demo 1", "ennore_ais_2017_massive.csv")

# CSV column names
COL_MMSI    = "MMSI"
COL_LAT     = "Latitude"
COL_LON     = "Longitude"
COL_SPEED   = "Speed_Knots"
COL_HEADING = "Heading"
COL_TS      = "Timestamp"

BATCH_SIZE = settings.batch_max_size   # from config (default 100)


async def ingest_ais():
    print("=" * 60)
    print("  Ingest AIS Vessel Data -> DB")
    print("  Using: config + db + models + h3_utils + repository")
    print("=" * 60)

    if not os.path.exists(CSV_FILE):
        print(f"ERROR: CSV not found at {CSV_FILE}")
        return

    print(f"\nReading: {CSV_FILE}")
    df = pd.read_csv(CSV_FILE)
    print(f"Loaded {len(df)} rows from CSV")

    # Step 1: validate + encode
    rows = []
    validation_errors = 0
    parse_errors = 0

    for _, row in df.iterrows():
        try:
            # models.AISPing — validates MMSI range, lat/lon bounds, UTC ts
            ping = AISPing(
                mmsi=int(row[COL_MMSI]),
                lat=float(row[COL_LAT]),
                lon=float(row[COL_LON]),
                speed_kn=float(row[COL_SPEED])   if pd.notna(row[COL_SPEED])   else None,
                heading_deg=float(row[COL_HEADING]) if pd.notna(row[COL_HEADING]) else None,
                ts=pd.to_datetime(row[COL_TS]).isoformat(),
            )

            # h3_utils.encode_point — H3 hex cell (uses settings.h3_resolution)
            h3_index = encode_point(ping.lat, ping.lon)

            rows.append({
                "mmsi":        ping.mmsi,
                "lat":         ping.lat,
                "lon":         ping.lon,
                "speed_kn":    ping.speed_kn,
                "heading_deg": ping.heading_deg,
                "h3_index":    h3_index,
                "ts":          ping.ts,
            })
        except ValidationError:
            validation_errors += 1
        except Exception:
            parse_errors += 1

    print(f"Valid: {len(rows)} | Validation errors: {validation_errors} | Parse errors: {parse_errors}")

    # Step 2: init connection pool (db.py)
    await init_pool()

    # Step 3: batch insert via repository.insert_ais_batch
    print(f"Inserting in batches of {BATCH_SIZE}...")
    total_inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        count = await insert_ais_batch(batch)
        total_inserted += count
        print(f"  Inserted: {total_inserted}/{len(rows)}", end="\r")

    # Step 4: close pool (db.py)
    await close_pool()

    print(f"\n\nDone! {total_inserted} AIS pings inserted into ais_pings")
    print(f"DB: {settings.database_url.split('@')[1]}")   # host/db only, no password


if __name__ == "__main__":
    asyncio.run(ingest_ais())