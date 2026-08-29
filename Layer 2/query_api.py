"""
query_api.py - Spatio-Temporal Query REST API.

Provides fast H3 hex + time window queries for Layer 5 (Attribution Engine)
and the frontend UI dashboard.

Run:  uvicorn query_api:app --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs
"""

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import repository as repo
from config import settings
from db import close_pool, get_pool, init_pool
from h3_utils import cells_in_radius
from models import AISPingOut, EnvironmentalNearbyResponse, NearbyResponse, OceanReadingOut

DEFAULT_WINDOW_HOURS = 6


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="SAMUDRA-NETRA Layer 2 Query API",
    description="Spatio-temporal lookups over AIS, spill, and ocean data indexed by H3 + time.",
    lifespan=lifespan,
)

# Enable CORS for Frontend UI connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


def _resolve_window(start: datetime | None, end: datetime | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    end_ts = end or now
    start_ts = start or (end_ts - timedelta(hours=DEFAULT_WINDOW_HOURS))
    if start_ts.tzinfo is None:
        start_ts = start_ts.replace(tzinfo=timezone.utc)
    if end_ts.tzinfo is None:
        end_ts = end_ts.replace(tzinfo=timezone.utc)
    return start_ts, end_ts


def _rows_to_ais_out(rows) -> list[AISPingOut]:
    return [
        AISPingOut(
            mmsi=r["mmsi"],
            lat=r["lat"],
            lon=r["lon"],
            speed_kn=r["speed_kn"],
            heading_deg=r["heading_deg"],
            h3_index=r["h3_index"] if "h3_index" in r else None,
            ts=r["ts"],
        )
        for r in rows
    ]


def _rows_to_ocean_out(rows) -> list[OceanReadingOut]:
    return [
        OceanReadingOut(
            lat=r["lat"],
            lon=r["lon"],
            current_speed_ms=r["current_speed_ms"],
            current_dir_deg=r["current_dir_deg"],
            wind_speed_ms=r["wind_speed_ms"],
            wind_dir_deg=r["wind_dir_deg"],
            h3_index=r["h3_index"] if "h3_index" in r else None,
            ts=r["ts"],
        )
        for r in rows
    ]


@router.get("/health")
@app.get("/health")
async def health():
    """Confirms the API can reach the database."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "reachable"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unreachable: {exc!r}")


@router.get("/nearby", response_model=NearbyResponse)
@app.get("/nearby", response_model=NearbyResponse)
async def nearby(
    lat: float = Query(..., ge=-90, le=90, description="query latitude"),
    lon: float = Query(..., ge=-180, le=180, description="query longitude"),
    radius_km: float = Query(5.0, gt=0, le=200, description="search radius in km"),
    start: datetime | None = Query(None, description="ISO8601, default: end - 6h"),
    end: datetime | None = Query(None, description="ISO8601, default: now"),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Find every vessel seen within radius_km of (lat, lon) during the time window.
    Used by Layer 5 as the first candidate search step around a spill's hindcast origin.
    """
    start_ts, end_ts = _resolve_window(start, end)
    if start_ts >= end_ts:
        raise HTTPException(status_code=400, detail="start must be before end")

    cells = cells_in_radius(lat, lon, radius_km)
    rows = await repo.get_ais_in_hexes_and_time(cells, start_ts, end_ts, limit)
    return NearbyResponse(
        query_lat=lat,
        query_lon=lon,
        radius_km=radius_km,
        cell_count_searched=len(cells),
        results=_rows_to_ais_out(rows),
    )


@router.get("/environmental/nearby", response_model=EnvironmentalNearbyResponse)
@app.get("/environmental/nearby", response_model=EnvironmentalNearbyResponse)
@router.get("/ocean/nearby", response_model=EnvironmentalNearbyResponse)
@app.get("/ocean/nearby", response_model=EnvironmentalNearbyResponse)
async def environmental_nearby(
    lat: float = Query(..., ge=-90, le=90, description="query latitude"),
    lon: float = Query(..., ge=-180, le=180, description="query longitude"),
    radius_km: float = Query(25.0, gt=0, le=200, description="search radius in km"),
    start: datetime | None = Query(None, description="ISO8601, default: end - 6h"),
    end: datetime | None = Query(None, description="ISO8601, default: now"),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Find ocean current and wind readings within radius_km of (lat, lon) during the time window.
    Used by Hindcasting (Layer 4) and Attribution (Layer 5) for environmental drift queries.
    """
    start_ts, end_ts = _resolve_window(start, end)
    if start_ts >= end_ts:
        raise HTTPException(status_code=400, detail="start must be before end")

    cells = cells_in_radius(lat, lon, radius_km)
    rows = await repo.get_ocean_in_hexes_and_time(cells, start_ts, end_ts, limit)
    return EnvironmentalNearbyResponse(
        query_lat=lat,
        query_lon=lon,
        radius_km=radius_km,
        cell_count_searched=len(cells),
        results=_rows_to_ocean_out(rows),
    )


@router.get("/spills/{spill_id}/nearby-vessels")
@app.get("/spills/{spill_id}/nearby-vessels")
async def spill_nearby_vessels(
    spill_id: uuid.UUID,
    start: datetime | None = Query(None, description="ISO8601, default: end - 6h"),
    end: datetime | None = Query(None, description="ISO8601, default: now"),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Find every vessel seen in any hex this spill's polygon touches during the time window.
    Direct join against spill_hex_coverage.
    """
    start_ts, end_ts = _resolve_window(start, end)
    if start_ts >= end_ts:
        raise HTTPException(status_code=400, detail="start must be before end")

    pool = get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM spill_detections WHERE spill_id = $1", spill_id)
    if not exists:
        raise HTTPException(status_code=404, detail=f"no spill with id {spill_id}")

    rows = await repo.get_pings_near_spill(spill_id, start_ts, end_ts, limit)
    return {
        "spill_id": str(spill_id),
        "window_start": start_ts,
        "window_end": end_ts,
        "vessel_count": len(rows),
        "vessels": _rows_to_ais_out(rows),
    }


# Include /api/v1 prefix for frontend compatibility
app.include_router(router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("query_api:app", host=settings.api_host, port=settings.api_port, reload=False)
