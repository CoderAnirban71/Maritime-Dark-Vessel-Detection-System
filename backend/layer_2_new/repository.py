"""
repository.py - The SQL data access layer for Layer 2.

Handles batch inserts (executemany) with ON CONFLICT DO NOTHING for idempotency,
and spatio-temporal queries indexed by H3 hexagon cells and time intervals.
"""

import uuid
from datetime import datetime
from typing import Any

import asyncpg

from db import get_pool

_SPILL_ID_NAMESPACE = uuid.UUID("6f1c6e9e-0b1a-4a7a-9c2e-5b7a6f0d1a2b")


# ============================================================
# AIS pings
# ============================================================

async def insert_ais_batch(rows: list[dict[str, Any]]) -> int:
    """
    rows: [{mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts}, ...]
    Returns number of rows attempted.
    """
    if not rows:
        return 0
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO ais_pings (mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (mmsi, ts) DO NOTHING
            """,
            [
                (
                    r["mmsi"],
                    r["lat"],
                    r["lon"],
                    r.get("speed_kn"),
                    r.get("heading_deg"),
                    r["h3_index"],
                    r["ts"],
                )
                for r in rows
            ],
        )
    return len(rows)


async def get_ais_in_hexes_and_time(
    hex_cells: list[int], start: datetime, end: datetime, limit: int = 500
) -> list[asyncpg.Record]:
    """Retrieve AIS pings within specified H3 cells and time window."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts
            FROM ais_pings
            WHERE h3_index = ANY($1::bigint[])
              AND ts BETWEEN $2 AND $3
            ORDER BY ts DESC
            LIMIT $4
            """,
            hex_cells,
            start,
            end,
            limit,
        )


# ============================================================
# Spill detections (+ hex coverage junction table)
# ============================================================

async def insert_spill_with_coverage(spill: dict[str, Any], hex_cells: list[int]) -> uuid.UUID:
    """
    spill: {confidence, area_km2, centroid_lat, centroid_lon, ts}
    hex_cells: every H3 cell the spill polygon touches (from h3_utils.encode_polygon)
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
                spill_id,
                spill["confidence"],
                spill.get("area_km2"),
                spill.get("centroid_lat"),
                spill.get("centroid_lon"),
                spill["ts"],
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


async def get_pings_near_spill(
    spill_id: uuid.UUID, start: datetime, end: datetime, limit: int = 500
) -> list[asyncpg.Record]:
    """Joins spill_hex_coverage with ais_pings to find vessels intersecting the spill polygon."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT DISTINCT a.mmsi, a.lat, a.lon, a.speed_kn, a.heading_deg, a.h3_index, a.ts
            FROM ais_pings a
            JOIN spill_hex_coverage c ON c.h3_index = a.h3_index
            WHERE c.spill_id = $1
              AND a.ts BETWEEN $2 AND $3
            ORDER BY a.ts DESC
            LIMIT $4
            """,
            spill_id,
            start,
            end,
            limit,
        )


async def list_spill_detections(limit: int = 100) -> list[asyncpg.Record]:
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """SELECT spill_id, confidence, area_km2, centroid_lat, centroid_lon,
                      ts, polygon_geojson, oil_type, estimated_mass_kg
               FROM spill_detections ORDER BY ts DESC LIMIT $1""",
            limit,
        )


async def get_spill_detection(spill_id: uuid.UUID) -> asyncpg.Record | None:
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            """SELECT spill_id, confidence, area_km2, centroid_lat, centroid_lon,
                      ts, polygon_geojson, oil_type, estimated_mass_kg
               FROM spill_detections WHERE spill_id = $1""",
            spill_id,
        )


# ============================================================
# Ocean readings (wind/current)
# ============================================================

async def insert_ocean_batch(rows: list[dict[str, Any]]) -> int:
    """rows: [{lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, h3_index, ts}, ...]"""
    if not rows:
        return 0
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO ocean_readings (lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, h3_index, ts)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (h3_index, ts) DO UPDATE SET
                current_speed_ms = COALESCE(EXCLUDED.current_speed_ms, ocean_readings.current_speed_ms),
                current_dir_deg = COALESCE(EXCLUDED.current_dir_deg, ocean_readings.current_dir_deg),
                wind_speed_ms = COALESCE(EXCLUDED.wind_speed_ms, ocean_readings.wind_speed_ms),
                wind_dir_deg = COALESCE(EXCLUDED.wind_dir_deg, ocean_readings.wind_dir_deg)
            """,
            [
                (
                    r["lat"],
                    r["lon"],
                    r.get("current_speed_ms"),
                    r.get("current_dir_deg"),
                    r.get("wind_speed_ms"),
                    r.get("wind_dir_deg"),
                    r["h3_index"],
                    r["ts"],
                )
                for r in rows
            ],
        )
    return len(rows)


async def get_ocean_in_hexes_and_time(
    hex_cells: list[int], start: datetime, end: datetime, limit: int = 500
) -> list[asyncpg.Record]:
    """Retrieve ocean current and wind readings within specified H3 cells and time window."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT lat, lon, current_speed_ms, current_dir_deg, wind_speed_ms, wind_dir_deg, h3_index, ts
            FROM ocean_readings
            WHERE h3_index = ANY($1::bigint[])
              AND ts BETWEEN $2 AND $3
            ORDER BY ts DESC
            LIMIT $4
            """,
            hex_cells,
            start,
            end,
            limit,
        )
