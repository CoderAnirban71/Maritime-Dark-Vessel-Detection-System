"""
ingest_env_data.py - Ingest ocean current + wind data into ocean_readings
=========================================================================
Uses ALL Layer 2 components as designed in the plan:

    .nc file (NetCDF)
        ↓
    models.OceanReading / models.WindReading  — Pydantic validation
        ↓
    h3_utils.encode_point   — H3 hex cell encoding
        ↓
    repository.insert_ocean_batch — SQL UPSERT with ON CONFLICT DO UPDATE
        (uses db.get_pool() internally — asyncpg connection pool)
        ↓
    config.settings         — DATABASE_URL, H3_RESOLUTION from .env

Place this file inside layer_2_new/ so it can import the other modules.

Run from layer_2_new/:
    python ingest_env_data.py

Or from project root:
    python layer_2_new/ingest_env_data.py
"""

import asyncio
import math
import os

import numpy as np
import xarray as xr
from pydantic import ValidationError

# ── Layer 2 imports (all five components) ────────────────────────────────────
from config import settings
from db import init_pool, close_pool
from h3_utils import encode_point
from models import OceanReading, WindReading
from repository import insert_ocean_batch
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))   # layer_2_new/
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
OCEAN_NC = os.path.join(PROJECT_ROOT, "Data", "Demo 1",
                         "cmems_mod_glo_phy_my_0.083deg_P1D-m_1787602924183.nc")
WIND_NC  = os.path.join(PROJECT_ROOT, "Data", "Demo 1",
                         "7410704ea21710183b11f17c9bf25383.nc")

BATCH_SIZE = settings.batch_max_size   # from config (default 100)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _speed_dir(u: float, v: float):
    """Convert raw u,v vector components to speed (m/s) and direction (degrees)."""
    speed     = float(np.hypot(u, v))
    direction = float((90 - math.degrees(math.atan2(v, u))) % 360)
    return speed, direction


# ── Ocean current (CMEMS) ────────────────────────────────────────────────────

async def ingest_ocean():
    if not os.path.exists(OCEAN_NC):
        print(f"  ERROR: ocean file not found at {OCEAN_NC}")
        return 0

    print(f"  Reading: {os.path.basename(OCEAN_NC)}")
    ds = xr.open_dataset(OCEAN_NC)
    if "depth" in ds.dims:
        ds = ds.isel(depth=0)

    df = ds.to_dataframe().reset_index()
    df = df.dropna(subset=["uo", "vo"])
    print(f"  Loaded {len(df)} valid ocean current readings")

    rows = []
    validation_errors = 0

    for _, row in df.iterrows():
        try:
            speed, direction = _speed_dir(float(row["uo"]), float(row["vo"]))

            # models.OceanReading — validates lat/lon bounds, speed range
            reading = OceanReading(
                lat=float(row["latitude"]),
                lon=float(row["longitude"]),
                current_speed_ms=round(speed, 3),
                current_dir_deg=round(direction, 1),
                wind_speed_ms=None,
                wind_dir_deg=None,
                ts=row["time"].to_pydatetime().isoformat(),
            )

            # h3_utils.encode_point — H3 hex cell
            h3_index = encode_point(reading.lat, reading.lon)

            rows.append({
                "lat":              reading.lat,
                "lon":              reading.lon,
                "current_speed_ms": reading.current_speed_ms,
                "current_dir_deg":  reading.current_dir_deg,
                "wind_speed_ms":    None,
                "wind_dir_deg":     None,
                "h3_index":         h3_index,
                "ts":               reading.ts,
            })
        except ValidationError:
            validation_errors += 1
        except Exception:
            validation_errors += 1

    print(f"  Valid: {len(rows)} | Errors: {validation_errors}")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        count = await insert_ocean_batch(rows[i:i + BATCH_SIZE])
        inserted += count
        print(f"  Inserted: {inserted}/{len(rows)}", end="\r")

    print(f"\n  Done: {inserted} ocean current rows")
    return inserted


# ── Wind (ERA5 / ECMWF) ──────────────────────────────────────────────────────

async def ingest_wind():
    if not os.path.exists(WIND_NC):
        print(f"  ERROR: wind file not found at {WIND_NC}")
        return 0

    print(f"  Reading: {os.path.basename(WIND_NC)}")
    ds = xr.open_dataset(WIND_NC)

    lat_col = next((c for c in ds.coords if c.lower() in ["latitude", "lat", "y"]), "latitude")
    lon_col = next((c for c in ds.coords if c.lower() in ["longitude", "lon", "x"]), "longitude")

    df = ds.to_dataframe().reset_index()

    u_col = "u10" if "u10" in df.columns else next(
        (c for c in df.columns if "wind_u" in c.lower() or c.lower() == "u"), None)
    v_col = "v10" if "v10" in df.columns else next(
        (c for c in df.columns if "wind_v" in c.lower() or c.lower() == "v"), None)

    if not u_col or not v_col:
        print(f"  ERROR: u/v wind columns not found in {WIND_NC}")
        return 0

    df = df.dropna(subset=[u_col, v_col])
    print(f"  Loaded {len(df)} valid wind readings")

    rows = []
    validation_errors = 0

    for _, row in df.iterrows():
        try:
            speed, direction = _speed_dir(float(row[u_col]), float(row[v_col]))

            # models.WindReading — validates lat/lon bounds, wind speed range
            reading = WindReading(
                lat=float(row[lat_col]),
                lon=float(row[lon_col]),
                wind_speed_ms=round(speed, 3),
                wind_dir_deg=round(direction, 1),
                ts=(row.get("valid_time") or row.get("time")).to_pydatetime().isoformat(),
            )

            # h3_utils.encode_point — H3 hex cell
            h3_index = encode_point(reading.lat, reading.lon)

            rows.append({
                "lat":              reading.lat,
                "lon":              reading.lon,
                "current_speed_ms": None,
                "current_dir_deg":  None,
                "wind_speed_ms":    reading.wind_speed_ms,
                "wind_dir_deg":     reading.wind_dir_deg,
                "h3_index":         h3_index,
                "ts":               reading.ts,
            })
        except ValidationError:
            validation_errors += 1
        except Exception:
            validation_errors += 1

    print(f"  Valid: {len(rows)} | Errors: {validation_errors}")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        count = await insert_ocean_batch(rows[i:i + BATCH_SIZE])
        inserted += count
        print(f"  Inserted: {inserted}/{len(rows)}", end="\r")

    print(f"\n  Done: {inserted} wind rows")
    return inserted


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  Ingest Environment Data (Ocean Current + Wind) -> DB")
    print("  Using: config + db + models + h3_utils + repository")
    print("=" * 60)

    await init_pool()

    print("\n[1/2] Ocean current data (CMEMS):")
    ocean_count = await ingest_ocean()

    print("\n[2/2] Wind data (ERA5/ECMWF):")
    wind_count = await ingest_wind()

    await close_pool()

    print(f"\n{'='*60}")
    print(f"  Ocean current rows : {ocean_count}")
    print(f"  Wind rows          : {wind_count}")
    print(f"  DB                 : {settings.database_url.split('@')[1]}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())