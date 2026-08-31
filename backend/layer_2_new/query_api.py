"""Samudra Netra query API and real backend-asset gateway."""
from __future__ import annotations

import asyncio
import math
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import repository as repo
from config import settings
from data_catalog import ais_records, datasets as catalog_datasets, model_assets, quicklook_path, scene_record, vessel_catalog
from db import close_pool, get_pool, init_pool
from h3_utils import cells_in_radius
from models import AISPingOut, EnvironmentalNearbyResponse, NearbyResponse, OceanReadingOut, SpillDetectionOut, SpillListResponse

DEFAULT_WINDOW_HOURS = 6


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_pool()
        app.state.database_ready, app.state.database_error = True, None
    except Exception as exc:
        app.state.database_ready, app.state.database_error = False, str(exc)
    yield
    await close_pool()


app = FastAPI(title="SAMUDRA-NETRA Integrated API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])
router = APIRouter()
analysis_jobs: dict[str, dict] = {}


def _require_database():
    if not getattr(app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=f"database unavailable: {getattr(app.state, 'database_error', 'not connected')}")


def _resolve_window(start: datetime | None, end: datetime | None):
    end_ts = end or datetime.now(timezone.utc)
    start_ts = start or end_ts - timedelta(hours=DEFAULT_WINDOW_HOURS)
    start_ts = start_ts.replace(tzinfo=start_ts.tzinfo or timezone.utc)
    end_ts = end_ts.replace(tzinfo=end_ts.tzinfo or timezone.utc)
    if start_ts >= end_ts:
        raise HTTPException(status_code=400, detail="start must be before end")
    return start_ts, end_ts


def _rows_to_ais(rows):
    identities = vessel_catalog()
    return [AISPingOut(mmsi=r["mmsi"], lat=r["lat"], lon=r["lon"], speed_kn=r["speed_kn"], heading_deg=r["heading_deg"], h3_index=r["h3_index"] if "h3_index" in r else None, ts=r["ts"], vessel_name=identities.get(r["mmsi"], {}).get("vessel_name"), vessel_type=identities.get(r["mmsi"], {}).get("vessel_type")) for r in rows]


def _spill(row):
    return SpillDetectionOut(spill_id=str(row["spill_id"]), confidence=row["confidence"], area_km2=row["area_km2"], centroid_lat=row["centroid_lat"], centroid_lon=row["centroid_lon"], ts=row["ts"], polygon_geojson=row["polygon_geojson"], oil_type=row["oil_type"], estimated_mass_kg=row["estimated_mass_kg"])


def _job_update(job_id: str, progress: int, stage: str, **extra):
    analysis_jobs[job_id].update(progress=progress, stage=stage, updated_at=datetime.now(timezone.utc), **extra)


async def _run_analysis_job(job_id: str, spill_id: uuid.UUID):
    """Run the query-side correlation workflow and publish honest stage progress."""
    try:
        _job_update(job_id, 8, "Validating spill detection")
        spill = await repo.get_spill_detection(spill_id)
        if spill is None:
            raise ValueError(f"no spill with id {spill_id}")
        lat, lon, ts = spill["centroid_lat"], spill["centroid_lon"], spill["ts"]
        if lat is None or lon is None:
            raise ValueError("spill has no centroid")

        cells = cells_in_radius(lat, lon, 50)
        start, end = ts - timedelta(hours=12), ts + timedelta(hours=12)
        _job_update(job_id, 30, "Loading environmental observations")
        environmental = await repo.get_ocean_in_hexes_and_time(cells, start, end, 1000)
        _job_update(job_id, 60, "Correlating AIS vessel tracks", environmental_samples=len(environmental))
        vessels = await repo.get_ais_in_hexes_and_time(cells, start, end, 1000)
        vessel_count = len({row["mmsi"] for row in vessels})
        _job_update(job_id, 88, "Finalizing evidence summary", vessel_tracks=vessel_count)

        currents = [row["current_speed_ms"] for row in environmental if row["current_speed_ms"] is not None]
        winds = [row["wind_speed_ms"] for row in environmental if row["wind_speed_ms"] is not None]
        _job_update(
            job_id,
            100,
            "Analysis complete",
            status="complete",
            result={
                "environmental_samples": len(environmental),
                "vessel_tracks": vessel_count,
                "mean_current_ms": sum(currents) / len(currents) if currents else 0,
                "mean_wind_ms": sum(winds) / len(winds) if winds else 0,
            },
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as exc:
        _job_update(job_id, 100, "Analysis failed", status="failed", error=str(exc))


@app.post("/analysis/jobs", status_code=202)
@router.post("/analysis/jobs", status_code=202)
async def start_analysis(spill_id: uuid.UUID):
    _require_database()
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    analysis_jobs[job_id] = {
        "job_id": job_id,
        "spill_id": str(spill_id),
        "status": "running",
        "progress": 2,
        "stage": "Queued on backend",
        "created_at": now,
        "updated_at": now,
    }
    asyncio.create_task(_run_analysis_job(job_id, spill_id))
    return analysis_jobs[job_id]


@app.get("/analysis/jobs/{job_id}")
@router.get("/analysis/jobs/{job_id}")
async def analysis_status(job_id: str):
    job = analysis_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="analysis job not found")
    return job


@app.get("/")
async def root():
    return {"service": "Samudra Netra", "version": app.version, "docs": "/docs"}


@app.get("/health")
@router.get("/health")
async def health():
    _require_database()
    try:
        async with get_pool().acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "reachable"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unreachable: {exc!r}") from exc


@app.get("/spills", response_model=SpillListResponse)
@router.get("/spills", response_model=SpillListResponse)
async def spills(limit: int = Query(100, ge=1, le=500)):
    _require_database()
    rows = await repo.list_spill_detections(limit)
    return SpillListResponse(results=[_spill(r) for r in rows], count=len(rows))


@app.get("/spills/{spill_id}", response_model=SpillDetectionOut)
@router.get("/spills/{spill_id}", response_model=SpillDetectionOut)
async def spill_detail(spill_id: uuid.UUID):
    _require_database()
    row = await repo.get_spill_detection(spill_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"no spill with id {spill_id}")
    return _spill(row)


@app.get("/nearby", response_model=NearbyResponse)
@router.get("/nearby", response_model=NearbyResponse)
async def nearby(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), radius_km: float = Query(5, gt=0, le=200), start: datetime | None = None, end: datetime | None = None, limit: int = Query(200, ge=1, le=1000)):
    _require_database()
    start_ts, end_ts = _resolve_window(start, end)
    cells = cells_in_radius(lat, lon, radius_km)
    rows = await repo.get_ais_in_hexes_and_time(cells, start_ts, end_ts, limit)
    return NearbyResponse(query_lat=lat, query_lon=lon, radius_km=radius_km, cell_count_searched=len(cells), results=_rows_to_ais(rows))


@app.get("/environmental/nearby", response_model=EnvironmentalNearbyResponse)
@app.get("/ocean/nearby", response_model=EnvironmentalNearbyResponse)
@router.get("/environmental/nearby", response_model=EnvironmentalNearbyResponse)
@router.get("/ocean/nearby", response_model=EnvironmentalNearbyResponse)
async def environmental_nearby(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), radius_km: float = Query(25, gt=0, le=200), start: datetime | None = None, end: datetime | None = None, limit: int = Query(200, ge=1, le=1000)):
    _require_database()
    start_ts, end_ts = _resolve_window(start, end)
    cells = cells_in_radius(lat, lon, radius_km)
    rows = await repo.get_ocean_in_hexes_and_time(cells, start_ts, end_ts, limit)
    results = [OceanReadingOut(**dict(r)) for r in rows]
    return EnvironmentalNearbyResponse(query_lat=lat, query_lon=lon, radius_km=radius_km, cell_count_searched=len(cells), results=results)


@app.get("/spills/{spill_id}/nearby-vessels")
@router.get("/spills/{spill_id}/nearby-vessels")
async def spill_nearby_vessels(spill_id: uuid.UUID, start: datetime | None = None, end: datetime | None = None, limit: int = Query(200, ge=1, le=1000)):
    _require_database()
    start_ts, end_ts = _resolve_window(start, end)
    if await repo.get_spill_detection(spill_id) is None:
        raise HTTPException(status_code=404, detail=f"no spill with id {spill_id}")
    rows = await repo.get_pings_near_spill(spill_id, start_ts, end_ts, limit)
    return {"spill_id": str(spill_id), "window_start": start_ts, "window_end": end_ts, "vessel_count": len(rows), "vessels": _rows_to_ais(rows)}


@app.get("/datasets")
@router.get("/datasets")
async def datasets():
    return {"results": catalog_datasets()}


@app.get("/scenes")
@router.get("/scenes")
async def scenes():
    scene = scene_record()
    return {"results": [] if scene is None else [{k: v for k, v in scene.items() if k != "quicklook_path"}]}


@app.get("/scenes/{scene_id}/quicklook", response_class=FileResponse)
@router.get("/scenes/{scene_id}/quicklook", response_class=FileResponse)
async def scene_quicklook(scene_id: str):
    path = quicklook_path(scene_id)
    if path is None:
        raise HTTPException(status_code=404, detail="scene quick-look not found")
    return FileResponse(path, media_type="image/png", filename=f"{scene_id}.png")


@app.get("/vessels/catalog")
@router.get("/vessels/catalog")
async def vessels_catalog():
    results = sorted(vessel_catalog().values(), key=lambda x: x["record_count"], reverse=True)
    return {"results": results, "count": len(results)}


@app.get("/ais/dataset", response_model=NearbyResponse)
@router.get("/ais/dataset", response_model=NearbyResponse)
async def ais_dataset(limit: int = Query(10000, ge=1, le=10000)):
    return NearbyResponse(query_lat=13.25, query_lon=80.31, radius_km=100, cell_count_searched=0, results=[AISPingOut(**r) for r in ais_records()[:limit]])


@app.get("/models")
@router.get("/models")
async def models():
    return {"results": model_assets()}


def _distance(lat1, lon1, lat2, lon2):
    p1, p2, dp, dl = map(math.radians, (lat1, lat2, lat2 - lat1, lon2 - lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 12742.0176 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1, lon1, lat2, lon2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))) + 360) % 360


@app.get("/spills/{spill_id}/attribution")
@router.get("/spills/{spill_id}/attribution")
async def spill_attribution(spill_id: uuid.UUID, radius_km: float = Query(50, gt=0, le=200), hours: int = Query(12, ge=1, le=72)):
    _require_database()
    spill = await repo.get_spill_detection(spill_id)
    if spill is None:
        raise HTTPException(status_code=404, detail=f"no spill with id {spill_id}")
    lat, lon, ts = spill["centroid_lat"], spill["centroid_lon"], spill["ts"]
    if lat is None or lon is None:
        raise HTTPException(status_code=422, detail="spill has no centroid")
    rows = await repo.get_ais_in_hexes_and_time(cells_in_radius(lat, lon, radius_km), ts - timedelta(hours=hours), ts + timedelta(hours=hours), 1000)
    grouped = {}
    for row in rows: grouped.setdefault(row["mmsi"], []).append(row)
    identities, results = vessel_catalog(), []
    for mmsi, track in grouped.items():
        ordered = sorted(track, key=lambda r: r["ts"])
        distances = [_distance(r["lat"], r["lon"], lat, lon) for r in ordered]
        closest = min(distances); row = ordered[distances.index(closest)]
        offset = abs((row["ts"] - ts).total_seconds()) / 3600
        proximity = max(0, 100 * (1 - closest / radius_km)); temporal = max(0, 100 * (1 - offset / hours))
        target, heading = _bearing(row["lat"], row["lon"], lat, lon), row["heading_deg"]
        difference = min(abs(heading - target), 360 - abs(heading - target)) if heading is not None else 180
        trajectory = max(0, 100 * (1 - difference / 180))
        gaps = [(ordered[i]["ts"] - ordered[i - 1]["ts"]).total_seconds() / 3600 for i in range(1, len(ordered))]
        max_gap = max(gaps, default=0); anomaly = min(100, max_gap / 6 * 100); quality = min(100, len(ordered) / 12 * 100); penalty = max(0, 30 - quality * .3)
        score = max(0, min(100, proximity * .3 + temporal * .2 + trajectory * .25 + anomaly * .1 + quality * .1 + 2.5 - penalty))
        flags = ([f"AIS gap {max_gap:.1f}h"] if max_gap > 2 else []) + (["Close approach"] if closest < 10 else []) + (["Heading aligned"] if difference < 30 else [])
        identity = identities.get(mmsi, {})
        results.append({"id": f"ATTR-{spill_id}-{mmsi}", "incident_id": str(spill_id), "vessel_id": f"AIS-{mmsi}", "mmsi": str(mmsi), "vessel_name": identity.get("vessel_name", f"Vessel {mmsi}"), "vessel_type": identity.get("vessel_type", "Unclassified"), "score": round(score, 1), "closest_approach_km": round(closest, 2), "time_offset_hours": round(offset, 2), "breakdown": {"proximity": round(proximity, 1), "temporal": round(temporal, 1), "trajectory": round(trajectory, 1), "anomaly": round(anomaly, 1), "data_quality": round(quality, 1), "environmental": 50, "penalty": round(penalty, 1)}, "flags": flags, "evidence_status": "requires review" if score >= 40 else "insufficient"})
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"spill_id": str(spill_id), "results": results, "count": len(results)}


app.include_router(router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("query_api:app", host=settings.api_host, port=settings.api_port)
