"""
test_pipeline.py - run this any time you want to know "sab thik hai?"

Self-contained: only needs Postgres (with schema.sql already applied)
reachable. Does NOT need Redis or a running ingest_consumer/query_api -
it calls h3_utils and repository directly, which is what those processes
call internally, so a pass here means the core logic is sound.

Uses fixed, known coordinates (not random) so failures are reproducible
and the assertions can check exact expected results, not just "did not
crash".

WARNING: truncates ais_pings, spill_detections, spill_hex_coverage, and
ocean_readings. Only run this against a dev/test database.

Run: python3 test_pipeline.py
Exit code 0 = all checks passed. Non-zero = something is broken.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from db import close_pool, get_pool, init_pool
from h3_utils import cells_in_radius, encode_point, encode_polygon, great_circle_distance_km
import repository as repo

PASS, FAIL = [], []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASS.append(label)
        print(f"  PASS  {label}")
    else:
        FAIL.append(label)
        print(f"  FAIL  {label}  {detail}")


async def main() -> None:
    print("=" * 60)
    print("SAMUDRA-NETRA Layer 2 - end-to-end pipeline check")
    print("=" * 60)

    await init_pool()
    pool = get_pool()

    print("\n[1/5] Resetting test data...")
    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE ais_pings, spill_hex_coverage, spill_detections, ocean_readings")
    print("  done")

    now = datetime.now(timezone.utc)

    # Fixed, known point: just off the Gulf of Kutch coast.
    hub_lat, hub_lon = 22.4707, 69.0577
    hub_cell = encode_point(hub_lat, hub_lon)

    print("\n[2/5] H3 encoding correctness...")
    check("encode_point returns a valid, deterministic cell",
          encode_point(hub_lat, hub_lon) == hub_cell)
    far_cell = encode_point(hub_lat + 5, hub_lon + 5)
    check("a point 5 degrees away encodes to a different cell", far_cell != hub_cell)

    ring_cells = cells_in_radius(hub_lat, hub_lon, 5.0)
    check("cells_in_radius(5km) includes the center cell", hub_cell in ring_cells)
    check("cells_in_radius(5km) count is in the expected ballpark (90-180)",
          90 <= len(ring_cells) <= 180, f"got {len(ring_cells)}")
    d = great_circle_distance_km(hub_lat, hub_lon, hub_lat, hub_lon + 0.1)
    check("great_circle_distance_km is sane for a small offset (~10km)", 8 < d < 12, f"got {d:.2f}")

    print("\n[3/5] Inserting known AIS pings (1 inside hub cell, 1 far away)...")
    near_row = {"mmsi": 419100001, "lat": hub_lat, "lon": hub_lon, "speed_kn": 10.0,
                "heading_deg": 180.0, "h3_index": hub_cell, "ts": now}
    far_row = {"mmsi": 419100002, "lat": hub_lat + 5, "lon": hub_lon + 5, "speed_kn": 5.0,
               "heading_deg": 0.0, "h3_index": far_cell, "ts": now}
    await repo.insert_ais_batch([near_row, far_row])

    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM ais_pings")
    check("both AIS pings landed in the DB", total == 2, f"got {total}")

    print("\n[4/5] Idempotency + hex/time query correctness...")
    await repo.insert_ais_batch([near_row, far_row])  # simulate a Redis redelivery
    async with pool.acquire() as conn:
        total_after_redelivery = await conn.fetchval("SELECT COUNT(*) FROM ais_pings")
    check("re-inserting the same rows does not create duplicates",
          total_after_redelivery == 2, f"got {total_after_redelivery}")

    nearby = await repo.get_ais_in_hexes_and_time(ring_cells, now - timedelta(minutes=5), now + timedelta(minutes=5))
    nearby_mmsis = {r["mmsi"] for r in nearby}
    check("hex+time query finds the near vessel", 419100001 in nearby_mmsis)
    check("hex+time query correctly excludes the far vessel", 419100002 not in nearby_mmsis)

    print("\n[5/5] Spill polygon -> coverage -> vessel join...")
    ring = [(22.40, 69.00), (22.42, 69.03), (22.415, 69.06), (22.39, 69.055), (22.375, 69.02)]
    spill_cells = encode_polygon(ring)
    inside_point = (22.405, 69.03)   # visually inside the ring above
    outside_point = (25.0, 75.0)     # nowhere near it
    inside_cell = encode_point(*inside_point)
    check("a point inside the drawn polygon is among its covering cells", inside_cell in spill_cells)

    spill = {"confidence": 0.9, "area_km2": 3.0, "centroid_lat": 22.40, "centroid_lon": 69.03, "ts": now}
    spill_id = await repo.insert_spill_with_coverage(spill, spill_cells)

    inside_ping = {"mmsi": 419200001, "lat": inside_point[0], "lon": inside_point[1], "speed_kn": 2.0,
                   "heading_deg": 90.0, "h3_index": inside_cell, "ts": now}
    outside_ping = {"mmsi": 419200002, "lat": outside_point[0], "lon": outside_point[1], "speed_kn": 8.0,
                    "heading_deg": 45.0, "h3_index": encode_point(*outside_point), "ts": now}
    await repo.insert_ais_batch([inside_ping, outside_ping])

    joined = await repo.get_pings_near_spill(spill_id, now - timedelta(minutes=5), now + timedelta(minutes=5))
    joined_mmsis = {r["mmsi"] for r in joined}
    check("spill-to-vessel join finds the vessel inside the polygon", 419200001 in joined_mmsis)
    check("spill-to-vessel join correctly excludes the far-away vessel", 419200002 not in joined_mmsis)

    spill_id_2 = await repo.insert_spill_with_coverage(spill, spill_cells)
    check("re-inserting an identical spill message reuses the same spill_id (idempotent)",
          spill_id == spill_id_2)

    await close_pool()

    print("\n" + "=" * 60)
    print(f"RESULT: {len(PASS)} passed, {len(FAIL)} failed")
    print("=" * 60)
    if FAIL:
        print("Failed checks:", ", ".join(FAIL))
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
