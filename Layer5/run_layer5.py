"""
SAMUDRA-NETRA - Layer 5: Vessel Attribution Engine
====================================================
Input  : layer4_output.json  (origin lat/lon/time from Layer 4 hindcast)
         ais_pings table      (real AIS vessel data from Layer 2 DB)
         spill_detections     (polygon for slick orientation from Layer 3)

Output : ranked_suspects_output.json  (scored + ranked vessel list)

Scoring formula (plan Section 4, Layer 5):
    composite = DR_score(40%) + orientation_score(30%) + proximity_score(30%)
    dark_vessel_bonus adds up to +0.35 on top (capped at 1.0)

Run from the project root:
    python Layer5/run_layer5.py
    python Layer5/run_layer5.py --layer4-output path/to/layer4_output.json
"""

import argparse
import asyncio
import json
import math
import os
import asyncpg
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from geopy.distance import geodesic
import h3.api.basic_int as h3

# ============================================================
# CONFIG
# ============================================================
DATABASE_URL  = "postgresql://postgres:Data1234@localhost:5432/samudra_netra"
H3_RESOLUTION = 8

BASE_PROJECT  = r"C:\Users\anirb\Desktop\SIH Project\Maritime-Dark-Vessel-Detection-System"
LAYER4_OUTPUT = os.path.join(BASE_PROJECT, "layer4_output.json")
OUTPUT_FILE   = os.path.join(BASE_PROJECT, "Layer5", "ranked_suspects_output.json")

# Search radius around origin point (km)
AIS_SEARCH_RADIUS_KM = 50
# Time window around origin time to search for AIS pings (hours each side)
AIS_TIME_WINDOW_HOURS = 12


# ============================================================
# DATA STRUCTURES
# ============================================================
@dataclass
class OriginEstimate:
    lat: float
    lon: float
    time_window_start: datetime
    time_window_end: datetime
    slick_orientation_deg: float


@dataclass
class AISPing:
    mmsi: str
    vessel_name: str
    lat: float
    lon: float
    timestamp: datetime
    speed_knots: float
    heading_deg: float


# ============================================================
# STEP 1: LOAD LAYER 4 OUTPUT
# ============================================================
def load_layer4_output(path: str) -> dict:
    with open(path) as f:
        data = json.load(f)

    required = ["estimated_origin_lat", "estimated_origin_lon",
                "estimated_origin_time_utc", "search_window_end_utc"]
    for key in required:
        if key not in data:
            raise KeyError(f"layer4_output.json is missing key: '{key}'")
    return data


# ============================================================
# STEP 2: COMPUTE SLICK ORIENTATION FROM DB POLYGON
# ============================================================
async def _fetch_latest_polygon():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            "SELECT polygon_geojson FROM spill_detections ORDER BY ts DESC LIMIT 1"
        )
    finally:
        await conn.close()
    return row


def compute_slick_orientation(polygon_coords: list) -> float:
    """
    Fits a principal axis through the polygon's vertices and returns its
    compass bearing. Uses the angle of maximum spatial variance
    (simplified PCA on lat/lon) - good enough for elongated slick shapes.
    """
    if len(polygon_coords) < 2:
        return 0.0

    lons = [c[0] for c in polygon_coords]
    lats = [c[1] for c in polygon_coords]

    mean_lon = sum(lons) / len(lons)
    mean_lat = sum(lats) / len(lats)

    dx = [lo - mean_lon for lo in lons]
    dy = [la - mean_lat for la in lats]

    cov_xx = sum(x * x for x in dx) / len(dx)
    cov_yy = sum(y * y for y in dy) / len(dy)
    cov_xy = sum(x * y for x, y in zip(dx, dy)) / len(dx)

    # Principal axis angle
    angle_rad = 0.5 * math.atan2(2 * cov_xy, cov_xx - cov_yy)
    # Convert to compass bearing (degrees from North, clockwise)
    bearing = (90 - math.degrees(angle_rad)) % 360
    return round(bearing, 1)


def get_slick_orientation_from_db() -> float:
    row = asyncio.run(_fetch_latest_polygon())
    if row is None or not row["polygon_geojson"]:
        print("WARNING: no spill polygon in DB - using default orientation 0°")
        return 0.0
    coords = json.loads(row["polygon_geojson"])  # [[lon, lat], ...]
    orientation = compute_slick_orientation(coords)
    print(f"Slick orientation (from DB polygon): {orientation}°")
    return orientation


# ============================================================
# STEP 3: FETCH AIS PINGS FROM DB NEAR ORIGIN
# ============================================================
async def _fetch_ais_near_origin(origin_lat, origin_lon, start_ts, end_ts):
    """
    Uses H3 grid_disk to find all hex cells within AIS_SEARCH_RADIUS_KM
    of the origin point, then queries ais_pings for those cells in the
    time window - exactly the fast hash-based lookup Layer 2 was built for.
    """
    center_cell = h3.latlng_to_cell(origin_lat, origin_lon, H3_RESOLUTION)
    edge_km = h3.average_hexagon_edge_length(H3_RESOLUTION, unit="km")
    step_km = edge_km * math.sqrt(3)
    k = max(1, math.ceil(AIS_SEARCH_RADIUS_KM / step_km))
    hex_cells = list(h3.grid_disk(center_cell, k))

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            """
            SELECT mmsi, lat, lon, speed_kn, heading_deg, ts
            FROM ais_pings
            WHERE h3_index = ANY($1::bigint[])
              AND ts BETWEEN $2 AND $3
            ORDER BY mmsi, ts
            """,
            hex_cells, start_ts, end_ts
        )
    finally:
        await conn.close()
    return rows


def fetch_ais_from_db(origin_lat, origin_lon, origin_time) -> Dict[str, List[AISPing]]:
    start_ts = (origin_time - timedelta(hours=AIS_TIME_WINDOW_HOURS)).replace(tzinfo=timezone.utc)
    end_ts   = (origin_time + timedelta(hours=AIS_TIME_WINDOW_HOURS)).replace(tzinfo=timezone.utc)

    rows = asyncio.run(_fetch_ais_near_origin(origin_lat, origin_lon, start_ts, end_ts))

    vessels: Dict[str, List[AISPing]] = {}
    for r in rows:
        mmsi = str(r["mmsi"])
        ping = AISPing(
            mmsi=mmsi,
            vessel_name=f"Vessel_{mmsi}",  # AIS data has no vessel name column
            lat=r["lat"],
            lon=r["lon"],
            timestamp=r["ts"].replace(tzinfo=None),
            speed_knots=r["speed_kn"] or 0.0,
            heading_deg=r["heading_deg"] or 0.0,
        )
        vessels.setdefault(mmsi, []).append(ping)

    print(f"Found {len(rows)} AIS pings from {len(vessels)} vessels near origin "
          f"(radius={AIS_SEARCH_RADIUS_KM}km, window=±{AIS_TIME_WINDOW_HOURS}h)")
    return vessels


# ============================================================
# STEP 4: SCORING FUNCTIONS (unchanged from original - logic was good)
# ============================================================
def compute_dead_reckoning_score(last_ping: AISPing, origin: OriginEstimate) -> float:
    """How feasible was it for this vessel to have reached the origin point
    at the origin time, given its last known speed and position?"""
    dist_nm = geodesic((last_ping.lat, last_ping.lon),
                        (origin.lat, origin.lon)).nautical
    time_diff_hours = abs(
        (origin.time_window_start - last_ping.timestamp).total_seconds()) / 3600.0
    if time_diff_hours == 0:
        time_diff_hours = 0.01

    required_speed_knots = dist_nm / time_diff_hours
    speed_discrepancy = abs(required_speed_knots - last_ping.speed_knots)
    return max(0.0, 1.0 - (speed_discrepancy / 15.0))


def compute_heading_alignment_score(vessel_heading: float,
                                     slick_angle: float) -> float:
    """Does the vessel's heading match the slick's principal axis?"""
    diff = abs((vessel_heading - slick_angle + 180) % 360 - 180)
    diff = min(diff, abs(diff - 180))
    return max(0.0, 1.0 - (diff / 90.0))


def compute_proximity_score(last_ping: AISPing, origin: OriginEstimate) -> float:
    """How close was the vessel to the origin point? Normalised over 50km."""
    dist_km = geodesic((last_ping.lat, last_ping.lon),
                        (origin.lat, origin.lon)).km
    return max(0.0, 1.0 - (dist_km / AIS_SEARCH_RADIUS_KM))


def detect_dark_vessel_anomaly(vessel_pings: List[AISPing],
                                origin: OriginEstimate) -> Dict:
    """Detects AIS signal gaps > 45 minutes (potential transponder shutoff)."""
    is_dark = False
    anomaly_bonus = 0.0
    ghost_path = []

    for i in range(len(vessel_pings) - 1):
        gap_mins = ((vessel_pings[i + 1].timestamp - vessel_pings[i].timestamp)
                    .total_seconds() / 60.0)
        if gap_mins > 45:
            is_dark = True
            anomaly_bonus = 0.35
            ghost_path.append({
                "gap_start":  vessel_pings[i].timestamp.isoformat(),
                "gap_end":    vessel_pings[i + 1].timestamp.isoformat(),
                "gap_mins":   round(gap_mins, 1),
                "last_lat":   vessel_pings[i].lat,
                "last_lon":   vessel_pings[i].lon,
            })

    return {"is_dark": is_dark, "anomaly_bonus": anomaly_bonus,
            "ghost_path": ghost_path}


# ============================================================
# STEP 5: ATTRIBUTION ENGINE
# ============================================================
def run_attribution_engine(origin: OriginEstimate,
                            vessel_database: Dict[str, List[AISPing]]) -> list:
    ranked_suspects = []

    for mmsi, pings in vessel_database.items():
        pings_sorted = sorted(pings, key=lambda p: p.timestamp)
        last_ping    = pings_sorted[-1]

        s_dr        = compute_dead_reckoning_score(last_ping, origin)
        s_orient    = compute_heading_alignment_score(last_ping.heading_deg,
                                                       origin.slick_orientation_deg)
        s_proximity = compute_proximity_score(last_ping, origin)
        dark_data   = detect_dark_vessel_anomaly(pings_sorted, origin)

        # Plan weights: DR 40%, Orientation 30%, Proximity 30%
        composite = (s_dr * 0.40) + (s_orient * 0.30) + (s_proximity * 0.30)
        # Dark vessel bonus on top (capped at 1.0)
        final_score = min(1.0, composite + dark_data["anomaly_bonus"])

        ranked_suspects.append({
            "mmsi":            mmsi,
            "vessel_name":     last_ping.vessel_name,
            "last_known_lat":  last_ping.lat,
            "last_known_lon":  last_ping.lon,
            "last_known_time": last_ping.timestamp.isoformat(),
            "composite_score": round(final_score * 100, 2),
            "breakdown": {
                "dead_reckoning_match_pct": round(s_dr * 100, 1),
                "orientation_match_pct":    round(s_orient * 100, 1),
                "proximity_score_pct":      round(s_proximity * 100, 1),
                "ais_dark_anomaly":         dark_data["is_dark"],
                "anomaly_bonus_applied":    dark_data["anomaly_bonus"] > 0,
            },
            "ghost_path_data": dark_data["ghost_path"],
        })

    return sorted(ranked_suspects, key=lambda x: x["composite_score"], reverse=True)


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description="SAMUDRA-NETRA Layer 5 - Vessel Attribution Engine")
    parser.add_argument("--layer4-output", default=LAYER4_OUTPUT,
                         help="Path to layer4_output.json")
    parser.add_argument("--output", default=OUTPUT_FILE,
                         help="Where to save ranked_suspects_output.json")
    args = parser.parse_args()

    print("=" * 60)
    print("  SAMUDRA-NETRA: Layer 5 Attribution Engine")
    print("=" * 60)

    # Step 1: Load Layer 4 output
    print(f"\n[1/4] Loading Layer 4 output from: {args.layer4_output}")
    l4 = load_layer4_output(args.layer4_output)
    origin_lat  = l4["estimated_origin_lat"]
    origin_lon  = l4["estimated_origin_lon"]
    origin_time = datetime.fromisoformat(l4["estimated_origin_time_utc"])
    end_time    = datetime.fromisoformat(l4["search_window_end_utc"])
    print(f"  Origin: ({origin_lat:.5f}, {origin_lon:.5f})")
    print(f"  Time  : {origin_time} → {end_time}")

    # Step 2: Slick orientation from DB polygon
    print("\n[2/4] Computing slick orientation from DB polygon...")
    slick_deg = get_slick_orientation_from_db()

    origin = OriginEstimate(
        lat=origin_lat,
        lon=origin_lon,
        time_window_start=origin_time,
        time_window_end=end_time,
        slick_orientation_deg=slick_deg,
    )

    # Step 3: Fetch AIS from DB (H3-indexed query)
    print("\n[3/4] Fetching AIS vessel data from database (H3 spatial query)...")
    vessels = fetch_ais_from_db(origin_lat, origin_lon, origin_time)

    if not vessels:
        print("  WARNING: No AIS vessels found near origin.")
        print("  Run ingest_real_demo.py to load AIS data into the DB first.")
        results = []
    else:
        # Step 4: Run attribution
        print("\n[4/4] Running attribution engine...")
        results = run_attribution_engine(origin, vessels)

    # Save output
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    if results:
        for i, s in enumerate(results[:5], 1):
            print(f"  #{i} MMSI:{s['mmsi']} | Score:{s['composite_score']}% | "
                  f"DR:{s['breakdown']['dead_reckoning_match_pct']}% | "
                  f"Orient:{s['breakdown']['orientation_match_pct']}% | "
                  f"Proximity:{s['breakdown']['proximity_score_pct']}% | "
                  f"Dark:{s['breakdown']['ais_dark_anomaly']}")
    else:
        print("  No suspects ranked (no AIS data in DB near origin)")

    print(f"\nSaved to: {args.output}")
    print("Done! Pass results to Layer 6 (frontend/report).")


if __name__ == "__main__":
    main()