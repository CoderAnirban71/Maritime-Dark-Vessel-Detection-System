"""Read-only catalog for the real assets bundled with Samudra Netra."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from xml.etree import ElementTree

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = BACKEND_ROOT / "Data" / "Demo 1"
AIS_CSV = DATA_ROOT / "ennore_ais_2017_massive.csv"
OCEAN_NC = DATA_ROOT / "cmems_mod_glo_phy_my_0.083deg_P1D-m_1787602924183.nc"
WIND_NC = DATA_ROOT / "7410704ea21710183b11f17c9bf25383.nc"
SAFE_DIR = next(DATA_ROOT.glob("*.SAFE"), None)
MODEL_DIR = BACKEND_ROOT / "AI_Model" / "ML_Output" / "best_unet_v2.pth"


def _size(path: Path | None) -> int:
    if path is None or not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


@lru_cache(maxsize=1)
def vessel_catalog() -> dict[int, dict]:
    vessels: dict[int, dict] = {}
    if not AIS_CSV.exists():
        return vessels
    with AIS_CSV.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            mmsi = int(row["MMSI"])
            item = vessels.setdefault(
                mmsi,
                {
                    "mmsi": mmsi,
                    "vessel_name": row["Vessel_Name"],
                    "vessel_type": row["Vessel_Type"],
                    "record_count": 0,
                    "first_seen": row["Timestamp"],
                    "last_seen": row["Timestamp"],
                },
            )
            item["record_count"] += 1
            item["first_seen"] = min(item["first_seen"], row["Timestamp"])
            item["last_seen"] = max(item["last_seen"], row["Timestamp"])
    return vessels


@lru_cache(maxsize=1)
def ais_records() -> list[dict]:
    records: list[dict] = []
    identities = vessel_catalog()
    if not AIS_CSV.exists():
        return records
    with AIS_CSV.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            mmsi = int(row["MMSI"])
            identity = identities.get(mmsi, {})
            timestamp = row["Timestamp"].replace(" ", "T") + "Z"
            records.append(
                {
                    "mmsi": mmsi,
                    "lat": float(row["Latitude"]),
                    "lon": float(row["Longitude"]),
                    "speed_kn": float(row["Speed_Knots"]) if row["Speed_Knots"] else None,
                    "heading_deg": float(row["Heading"]) if row["Heading"] else None,
                    "h3_index": None,
                    "ts": timestamp,
                    "vessel_name": identity.get("vessel_name"),
                    "vessel_type": identity.get("vessel_type"),
                }
            )
    return records


@lru_cache(maxsize=1)
def scene_record() -> dict | None:
    if SAFE_DIR is None:
        return None
    root = ElementTree.parse(SAFE_DIR / "manifest.safe").getroot()

    def text(local_name: str, default: str = "") -> str:
        node = root.find(f".//{{*}}{local_name}")
        return node.text.strip() if node is not None and node.text else default

    scene_id = SAFE_DIR.name.removesuffix(".SAFE")
    quicklook = SAFE_DIR / "preview" / "quick-look.png"
    footprint = [
        {"lat": float(pair.split(",")[0]), "lon": float(pair.split(",")[1])}
        for pair in text("coordinates").split()
    ]
    return {
        "id": scene_id,
        "sensor": "SAR",
        "platform": "SENTINEL-1A",
        "product_type": text("productType", "GRD"),
        "acquired_at": text("startTime") + "Z",
        "stopped_at": text("stopTime") + "Z",
        "orbit": text("orbitNumber"),
        "relative_orbit": text("relativeOrbitNumber"),
        "pass": text("pass", "DESCENDING").title(),
        "polarizations": ["VV", "VH"],
        "footprint": footprint,
        "quicklook_url": f"/api/v1/scenes/{scene_id}/quicklook",
        "quicklook_path": str(quicklook),
        "measurement_bytes": sum(
            item.stat().st_size for item in (SAFE_DIR / "measurement").glob("*.tiff")
        ),
    }


def datasets() -> list[dict]:
    return [
        {"id": "sentinel-1-safe", "name": "Sentinel-1A IW GRD dual-polarization scene", "kind": "sar_imagery", "format": "SAFE / GeoTIFF", "records": 1 if scene_record() else 0, "bytes": _size(SAFE_DIR), "status": "available" if SAFE_DIR else "missing"},
        {"id": "ennore-ais-2017", "name": "Ennore AIS vessel tracks", "kind": "ais", "format": "CSV", "records": len(ais_records()), "entities": len(vessel_catalog()), "bytes": _size(AIS_CSV), "status": "available" if AIS_CSV.exists() else "missing"},
        {"id": "cmems-currents", "name": "CMEMS ocean-current forcing", "kind": "ocean_current", "format": "NetCDF/HDF5", "bytes": _size(OCEAN_NC), "status": "available" if OCEAN_NC.exists() else "missing"},
        {"id": "era5-wind", "name": "ERA5/ECMWF wind forcing", "kind": "wind", "format": "NetCDF/HDF5", "bytes": _size(WIND_NC), "status": "available" if WIND_NC.exists() else "missing"},
        {"id": "unet-resnet34", "name": "Oil-spill U-Net (ResNet34 encoder)", "kind": "model", "format": "PyTorch checkpoint", "bytes": _size(MODEL_DIR), "status": "available" if MODEL_DIR.exists() else "missing"},
    ]


def model_assets() -> list[dict]:
    pipeline = BACKEND_ROOT / "AI_Model" / "ML_Output" / "inference_pipeline.py"
    registered = pipeline.stat().st_mtime if pipeline.exists() else 0
    return [{"id": "MODEL-UNET-V2", "model": "Oil-spill U-Net", "version": "v2 · ResNet34 · epoch 25", "started_at": datetime.fromtimestamp(registered, tz=timezone.utc).isoformat(), "duration_ms": 0, "status": "success" if MODEL_DIR.exists() else "failed", "source": "demo", "size_bytes": _size(MODEL_DIR)}]


def quicklook_path(scene_id: str) -> Path | None:
    scene = scene_record()
    if scene and scene["id"] == scene_id:
        path = Path(scene["quicklook_path"])
        return path if path.exists() else None
    return None
