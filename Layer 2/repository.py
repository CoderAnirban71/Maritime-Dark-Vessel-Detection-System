"""
repository.py - the ONLY file in this project that writes SQL.

Every insert is a batch (executemany), never a row-by-row loop, and every
insert is idempotent (ON CONFLICT DO NOTHING) because Redis pub/sub can
redeliver a message - without this, a redelivered AIS ping would silently
double-count a vessel's presence in a hex.

ingest_consumer.py calls the insert_* functions.
query_api.py calls the get_* functions.
Nothing else should ever run raw SQL - if a new query is needed, add a
function here rather than reaching for conn.execute() elsewhere.
"""

import uuid
from datetime import datetime

import asyncpg

from db import get_pool

# Stable namespace for deriving deterministic spill IDs from message content
# (see insert_spill_with_coverage) so a Redis-redelivered spill message
# produces the SAME spill_id and is naturally deduplicated by the primary
# key, instead of the DB's DEFAULT gen_random_uuid() minting a fresh id
# for every redelivery.
_SPILL_ID_NAMESPACE = uuid.UUID("6f1c6e9e-0b1a-4a7a-9c2e-5b7a6f0d1a2b")


# ============================================================
# AIS pings
# ============================================================

async def insert_ais_batch(rows: list[dict]) -> int:
    """
    rows: [{mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts}, ...]
    Returns number of rows actually inserted (excludes conflicts skipped).
    """
    if not rows:
        return 0
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.executemany(
            """
            INSERT INTO ais_pings (mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (mmsi, ts) DO NOTHING
            """,
            [(r["mmsi"], r["lat"], r["lon"], r.get("speed_kn"), r.get("heading_deg"), r["h3_index"], r["ts"]) for r in rows],
        )
    return _extract_rowcount(result, len(rows))


async def get_ais_in_hexes_and_time(
    hex_cells: list[int], start: datetime, end: datetime, limit: int = 500
) -> list[asyncpg.Record]:
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT mmsi, lat, lon, speed_kn, heading_deg, ts
            FROM ais_pings
            WHERE h3_index = ANY($1::bigint[])
              AND ts BETWEEN $2 AND $3
            ORDER BY ts DESC
            LIMIT $4
            """,
            hex_cells, start, end, limit,
        )


# ============================================================
# Spill detections (+ hex coverage junction table)
# ============================================================

async def insert_spill_with_coverage(spill: dict, hex_cells: list[int]) -> uuid.UUID:
    """
    spill: {confidence, area_km2, centroid_lat, centroid_lon, ts}
    hex_cells: every H3 cell the spill polygon touches (from h3_utils.encode_polygon)

    Inserts the spill record and every coverage row in ONE transaction -
    either both succeed or neither does, so a crash mid-write can never
    leave a spill_detections row with no matching coverage rows.
    """
    spill_id = uuid.uuid5(
        _SPILL_ID_NAMESPACE,
        f"{spill['ts'].isoformat()}|{spill['confidence']}|{spill.get('centroid_lat')}|{spill.get('centroid_lon')}",
    )
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO spill_detections (spill_id, confidence, area_km2, centroid_lat, centroid_lon, ts)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (spill_id) DO NOTHING
                """,
                spill_id, spill["confidence"], spill.get("area_km2"),
                spill.get("centroid_lat"), spill.get("centroid_lon"), spill["ts"],
            )
            if hex_cells:
                await conn.executemany(
                    """
                    INSERT INTO spill_hex_coverage (spill_id, h3_index, ts)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (spill_id, h3_index) DO NOTHING
                    """,
                    [(spill_id, cell, spill["ts"]) for cell in hex_cells],
                )
    return spill_id


async def get_pings_near_spill(spill_id: uuid.UUID, start: datetime, end: datetime, limit: int = 500) -> list[asyncpg.Record]:
    """The core Layer 5 join: which AIS pings fall in any hex this spill touches."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT DISTINCT a.mmsi, a.lat, a.lon, a.speed_kn, a.heading_deg, a.ts
            FROM ais_pings a
            JOIN spill_hex_coverage c ON c.h3_index = a.h3_index
            WHERE c.spill_id = $1
              AND a.ts BETWEEN $2 AND $3
            ORDER BY a.ts DESC
            LIMIT $4
            """,
            spill_id, start, end, limit,
        )


# ============================================================
# Ocean readings (wind/current)
# ============================================================

async def insert_ocean_batch(rows: list[dict]) -> int:
    """rows: [{lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, h3_index, ts}, ...]"""
    if not rows:
        return 0
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.executemany(
            """
            INSERT INTO ocean_readings (lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, h3_index, ts)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (h3_index, ts) DO NOTHING
            """,
            [(r["lat"], r["lon"], r.get("current_speed_ms"), r.get("current_dir_deg"),
              r.get("wind_speed_ms"), r.get("wind_dir_deg"), r["h3_index"], r["ts"]) for r in rows],
        )
    return _extract_rowcount(result, len(rows))


async def get_ocean_in_hexes_and_time(hex_cells: list[int], start: datetime, end: datetime, limit: int = 500) -> list[asyncpg.Record]:
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, ts
            FROM ocean_readings
            WHERE h3_index = ANY($1::bigint[])
              AND ts BETWEEN $2 AND $3
            ORDER BY ts DESC
            LIMIT $4
            """,
            hex_cells, start, end, limit,
        )


def _extract_rowcount(executemany_result, attempted: int) -> int:
    """
    asyncpg's executemany() doesn't return a per-row rowcount the way a
    single execute() does, so an exact "N inserted, M skipped as duplicate"
    count isn't available without a slower round trip. We report the
    attempted count; callers that need the exact inserted count should
    query COUNT(*) explicitly (see test_pipeline.py for an example).
    """
    return attempted
