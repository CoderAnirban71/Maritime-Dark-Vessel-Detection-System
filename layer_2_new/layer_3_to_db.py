"""
layer3_to_db.py - Layer 3 -> Database bridge.

Reads Layer 3's output (layer3_output.json, produced by inference_pipeline.py)
and writes the best-confidence spill into the spill_detections /
spill_hex_coverage tables, instead of leaving it as a standalone JSON file.

This replaces the earlier JSON-file handoff (layer3_to_layer4_adapter.py)
with a proper database write, so Layer 4 and Layer 5 can both query the
same spill through query_api.py / repository.py instead of passing files
around.

Run from inside layer_2_new/ so it can import config, db, h3_utils, repository:
    python layer3_to_db.py --input path\to\layer3_output.json
"""

import argparse
import asyncio
import json
import re
import os
from datetime import datetime, timezone

from db import init_pool, close_pool
from h3_utils import encode_polygon
from repository import insert_spill_with_coverage

# Same assumption used earlier: Sentinel-1 GRD ground range pixel spacing.
PIXEL_SIZE_M = 10


def extract_detection_time(safe_dir_path: str) -> datetime:
    """SAFE folder names embed the acquisition time, e.g.
    S1A_IW_GRDH_1SDV_20170129T003132_..._6D04.SAFE"""
    folder_name = os.path.basename(safe_dir_path.rstrip("\\/"))
    match = re.search(r"_(\d{8}T\d{6})_", folder_name)
    if not match:
        raise ValueError(f"No timestamp found in SAFE folder name: {folder_name}")
    raw = match.group(1)
    return datetime(
        int(raw[0:4]), int(raw[4:6]), int(raw[6:8]),
        int(raw[9:11]), int(raw[11:13]), int(raw[13:15]),
        tzinfo=timezone.utc,
    )


def pick_best_polygon(polygons: list[dict]) -> dict:
    """Highest confidence first, largest area as tiebreaker - same rule
    Layer 4's JSON adapter used, kept consistent here."""
    if not polygons:
        raise ValueError("layer3_output.json has no polygons to store")
    return max(polygons, key=lambda p: (p["confidence"], p["area_px"]))


async def write_spill_to_db(layer3_output_path: str):
    with open(layer3_output_path) as f:
        layer3 = json.load(f)

    detection_time = extract_detection_time(layer3["safe_dir"])
    best = pick_best_polygon(layer3["polygons"])

    # Layer 3 stores coordinates as [lon, lat]; h3_utils wants (lat, lon).
    coords_lonlat = best["coordinates"]
    coords_latlon = [(lat, lon) for lon, lat in coords_lonlat]

    lons = [c[0] for c in coords_lonlat]
    lats = [c[1] for c in coords_lonlat]
    centroid_lon = sum(lons) / len(lons)
    centroid_lat = sum(lats) / len(lats)

    area_m2 = best["area_px"] * (PIXEL_SIZE_M ** 2)
    area_km2 = area_m2 / 1_000_000

    hex_cells = encode_polygon(coords_latlon)

    await init_pool()
    try:
        spill = {
            "confidence": best["confidence"],
            "area_km2": area_km2,
            "centroid_lat": centroid_lat,
            "centroid_lon": centroid_lon,
            "ts": detection_time,
        }
        spill_id = await insert_spill_with_coverage(spill, hex_cells)

        # insert_spill_with_coverage doesn't know about polygon_geojson
        # (added by db_migration_add_polygon.sql), so store it separately.
        from db import get_pool
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE spill_detections SET polygon_geojson = $1::jsonb WHERE spill_id = $2",
                json.dumps(coords_lonlat),
                spill_id,
            )

        print("=" * 60)
        print("  Layer 3 -> Database")
        print("=" * 60)
        print(f"  spill_id       : {spill_id}")
        print(f"  detection_time : {detection_time.isoformat()}")
        print(f"  confidence     : {best['confidence']:.3f}")
        print(f"  area_km2       : {area_km2:.4f}")
        print(f"  centroid       : ({centroid_lat:.5f}, {centroid_lon:.5f})")
        print(f"  hex cells      : {len(hex_cells)}")
        print(f"  polygon points : {len(coords_lonlat)}")
        print("=" * 60)
        return spill_id
    finally:
        await close_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True,
                         help="Path to layer3_output.json produced by inference_pipeline.py")
    args = parser.parse_args()
    asyncio.run(write_spill_to_db(args.input))