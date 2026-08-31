"""
SAMUDRA-NETRA — Layer 4: Hindcasting Engine (OpenDrift / OpenOil)
==================================================================
Fetches spill from spill_detections and ocean/wind from ocean_readings
(raw u,v components) directly from the database. No NetCDF files needed.
"""

import argparse
import asyncio
import json
import os
import re
import uuid

import numpy as np
import asyncpg
from datetime import datetime, timedelta, timezone

from opendrift.models.openoil import OpenOil
from opendrift.readers import reader_constant

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL  = "postgresql://postgres:Data1234@localhost:5432/samudra_netra"
ASSUMED_THICKNESS_M = 0.0001
OIL_DENSITY_KG_M3   = 900
PIXEL_SIZE_M        = 10


# ============================================================
# SPILL FETCH FROM DB
# ============================================================
async def _fetch_spill_row(spill_id):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        if spill_id:
            row = await conn.fetchrow(
                "SELECT spill_id, confidence, area_km2, centroid_lat, centroid_lon, "
                "ts, polygon_geojson, oil_type, estimated_mass_kg "
                "FROM spill_detections WHERE spill_id = $1",
                uuid.UUID(spill_id),
            )
        else:
            row = await conn.fetchrow(
                "SELECT spill_id, confidence, area_km2, centroid_lat, centroid_lon, "
                "ts, polygon_geojson, oil_type, estimated_mass_kg "
                "FROM spill_detections ORDER BY ts DESC LIMIT 1"
            )
    finally:
        await conn.close()
    if row is None:
        raise RuntimeError("No spill found. Run inference_pipeline.py first.")
    return row


def load_spill_from_db(spill_id=None):
    row = asyncio.run(_fetch_spill_row(spill_id))
    detection_time = row["ts"]
    if detection_time.tzinfo is not None:
        detection_time = detection_time.replace(tzinfo=None)
    polygon  = np.array(json.loads(row["polygon_geojson"]))
    oil_type = row["oil_type"] or "GENERIC MEDIUM CRUDE"
    mass_kg  = row["estimated_mass_kg"] or 1000
    print(f"Loaded spill {row['spill_id']} from database "
          f"(confidence={row['confidence']:.3f}, area_km2={row['area_km2']:.4f})")
    return detection_time, polygon, oil_type, mass_kg, row["spill_id"]


# ============================================================
# HINDCAST RESULT -> DB (replaces layer4_output.json handoff to Layer 5)
# ============================================================
async def _insert_hindcast_result(spill_id, origin_lat, origin_lon,
                                   origin_time_utc, search_end_utc, uncertainty_km):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO hindcast_results
                (spill_id, origin_lat, origin_lon, origin_time_utc, search_end_utc, uncertainty_km)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING result_id
            """,
            spill_id, origin_lat, origin_lon, origin_time_utc, search_end_utc, uncertainty_km,
        )
    finally:
        await conn.close()
    return row["result_id"]


def save_hindcast_result_to_db(spill_id, result):
    origin_time = datetime.fromisoformat(result['estimated_origin_time']).replace(tzinfo=timezone.utc)
    search_end  = datetime.fromisoformat(result['searched_back_from']).replace(tzinfo=timezone.utc)
    result_id = asyncio.run(_insert_hindcast_result(
        spill_id,
        result['origin_point'][0],
        result['origin_point'][1],
        origin_time,
        search_end,
        result['uncertainty_km'],
    ))
    print(f"Saved hindcast result {result_id} to database (hands off to Layer 5)")
    return result_id


# ============================================================
# JSON FILE INPUT (testing without DB)
# ============================================================
def extract_detection_time(safe_dir_path):
    folder_name = os.path.basename(safe_dir_path.rstrip("\\/"))
    match = re.search(r"_(\d{8}T\d{6})_", folder_name)
    if not match:
        raise ValueError(f"No timestamp in SAFE folder name: {folder_name}")
    raw = match.group(1)
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}T{raw[9:11]}:{raw[11:13]}:{raw[13:15]}"


def load_spill_input(path):
    with open(path) as f:
        layer3 = json.load(f)
    dt_str = extract_detection_time(layer3["safe_dir"])
    detection_time = datetime.fromisoformat(dt_str)
    best = max(layer3["polygons"], key=lambda p: (p["confidence"], p["area_px"]))
    polygon  = np.array([[float(x), float(y)] for x, y in best["coordinates"]])
    oil_type = "GENERIC MEDIUM CRUDE"
    mass_kg  = round((best["area_px"] * PIXEL_SIZE_M**2 * ASSUMED_THICKNESS_M) * OIL_DENSITY_KG_M3, 1)
    print(f"Loaded Layer 3 JSON from {path}")
    return detection_time, polygon, oil_type, mass_kg


# ============================================================
# ENVIRONMENT FETCH FROM DB — raw u,v components
# ============================================================
async def _fetch_env_row(centroid_lon, centroid_lat, ts, radius_deg=2.0, hours=48):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            """
            SELECT
                AVG(current_u_ms)    AS current_u,
                AVG(current_v_ms)    AS current_v,
                AVG(wind_u_ms)       AS wind_u,
                AVG(wind_v_ms)       AS wind_v,
                COUNT(*) FILTER (WHERE current_u_ms IS NOT NULL) AS n_current,
                COUNT(*) FILTER (WHERE wind_u_ms IS NOT NULL)    AS n_wind
            FROM ocean_readings
            WHERE lat BETWEEN $1 AND $2
              AND lon BETWEEN $3 AND $4
              AND ts  BETWEEN $5 AND $6
            """,
            centroid_lat - radius_deg, centroid_lat + radius_deg,
            centroid_lon - radius_deg, centroid_lon + radius_deg,
            ts - timedelta(hours=hours), ts + timedelta(hours=hours),
        )
    finally:
        await conn.close()
    return row


def build_environment_from_db(centroid_lon, centroid_lat, ts):
    row = asyncio.run(_fetch_env_row(centroid_lon, centroid_lat, ts))

    got_current = row and row["n_current"] and row["current_u"] is not None
    got_wind    = row and row["n_wind"]    and row["wind_u"] is not None

    if not got_current and not got_wind:
        print("WARNING: no ocean_readings found near this spill - "
              "falling back to synthetic constant current/wind")
        return (
            reader_constant.Reader({'x_sea_water_velocity': 0.15, 'y_sea_water_velocity': 0.05}),
            reader_constant.Reader({'x_wind': 3.0, 'y_wind': -1.5}),
        )

    # Current — use raw u,v directly (no lossy polar conversion)
    if got_current:
        cu, cv = float(row["current_u"]), float(row["current_v"])
        print(f"Using REAL current from DB ({row['n_current']} rows avg): "
              f"u={cu:.4f} m/s, v={cv:.4f} m/s")
    else:
        print("WARNING: no current data in DB near spill - using synthetic")
        cu, cv = 0.15, 0.05

    # Wind — use raw u,v directly
    if got_wind:
        wu, wv = float(row["wind_u"]), float(row["wind_v"])
        print(f"Using REAL wind from DB ({row['n_wind']} rows avg): "
              f"u={wu:.4f} m/s, v={wv:.4f} m/s")
    else:
        print("WARNING: no wind data in DB near spill - using synthetic")
        wu, wv = 3.0, -1.5

    current_reader = reader_constant.Reader({
        'x_sea_water_velocity': cu,
        'y_sea_water_velocity': cv,
    })
    wind_reader = reader_constant.Reader({
        'x_wind': wu,
        'y_wind': wv,
    })
    return current_reader, wind_reader


def build_environment_from_files(current_nc, wind_nc):
    if current_nc and os.path.exists(current_nc):
        from opendrift.readers import reader_netCDF_CF_generic
        current_reader = reader_netCDF_CF_generic.Reader(current_nc)
        print(f"Using REAL current data (file): {current_nc}")
    else:
        print("WARNING: current-nc not found, using synthetic")
        current_reader = reader_constant.Reader({'x_sea_water_velocity': 0.15, 'y_sea_water_velocity': 0.05})

    if wind_nc and os.path.exists(wind_nc):
        from opendrift.readers import reader_netCDF_CF_generic
        wind_reader = reader_netCDF_CF_generic.Reader(wind_nc)
        print(f"Using REAL wind data (file): {wind_nc}")
    else:
        print("WARNING: wind-nc not found, using synthetic")
        wind_reader = reader_constant.Reader({'x_wind': 3.0, 'y_wind': -1.5})

    return current_reader, wind_reader


# ============================================================
# POLYGON SEEDING
# ============================================================
def seed_points_within_polygon(polygon, n_particles, seed=42):
    lon_min, lat_min = polygon.min(axis=0)
    lon_max, lat_max = polygon.max(axis=0)
    rng = np.random.default_rng(seed=seed)
    accepted_lons, accepted_lats = [], []
    batch = max(n_particles * 4, 1000)
    while len(accepted_lons) < n_particles:
        cl = rng.uniform(lon_min, lon_max, batch)
        cb = rng.uniform(lat_min, lat_max, batch)
        inside = _points_in_polygon(cl, cb, polygon)
        accepted_lons.extend(cl[inside])
        accepted_lats.extend(cb[inside])
    return np.array(accepted_lons[:n_particles]), np.array(accepted_lats[:n_particles])


def _points_in_polygon(lons, lats, polygon):
    n = len(polygon)
    inside = np.zeros(len(lons), dtype=bool)
    px, py = polygon[:, 0], polygon[:, 1]
    j = n - 1
    for i in range(n):
        cond = ((py[i] > lats) != (py[j] > lats)) & (
            lons < (px[j] - px[i]) * (lats - py[i]) / (py[j] - py[i] + 1e-15) + px[i])
        inside ^= cond
        j = i
    return inside


# ============================================================
# SIMULATION
# ============================================================
def _make_model(current_reader, wind_reader):
    o = OpenOil(loglevel=50)
    o.add_reader([current_reader, wind_reader])
    o.set_config('environment:fallback:land_binary_mask', 0)
    o.set_config('general:use_auto_landmask', False)
    o.set_config('drift:vertical_mixing', False)
    return o


def run_backward_hindcast(detection_time, polygon, oil_type, mass_kg,
                           current_reader, wind_reader, n_particles=2000, hours_back=18):
    o = _make_model(current_reader, wind_reader)
    lons, lats = seed_points_within_polygon(polygon, n_particles)
    o.seed_elements(lon=lons, lat=lats, time=detection_time,
                    oil_type=oil_type, mass_oil=mass_kg)
    out_file = os.path.join(BASE_DIR, 'backward_hindcast.nc')
    o.run(time_step=-900, duration=timedelta(hours=hours_back),
          outfile=out_file)
    return o


def estimate_origin(o):
    sim_times   = o.result['time'].values
    origin_lons = o.result['lon'].isel(time=-1).values
    origin_lats = o.result['lat'].isel(time=-1).values
    return {
        'origin_point': (float(np.nanmean(origin_lats)), float(np.nanmean(origin_lons))),
        'estimated_origin_time': np.datetime_as_string(sim_times.min(), unit='s'),
        'searched_back_from':    np.datetime_as_string(sim_times.max(), unit='s'),
        'uncertainty_km': round(float(np.nanstd(origin_lats)) * 111, 2),
    }


def run_forward_forecast(detection_time, polygon, oil_type, mass_kg,
                          current_reader, wind_reader, hours=36):
    o = _make_model(current_reader, wind_reader)
    center_lon, center_lat = polygon.mean(axis=0)
    o.seed_elements(lon=center_lon, lat=center_lat, time=detection_time,
                    oil_type=oil_type, mass_oil=mass_kg, number=500)
    out_file = os.path.join(BASE_DIR, 'forward_forecast.nc')
    o.run(time_step=900, duration=timedelta(hours=hours),
          outfile=out_file)
    return o


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='SAMUDRA-NETRA Layer 4')
    parser.add_argument('--input',      default=None, help='Layer 3 JSON file (optional, testing)')
    parser.add_argument('--spill-id',   default=None, help='Specific spill UUID from DB')
    parser.add_argument('--current-nc', default=None, help='Override: real current NetCDF file')
    parser.add_argument('--wind-nc',    default=None, help='Override: real wind NetCDF file')
    parser.add_argument('--particles',  type=int, default=2000)
    parser.add_argument('--hours-back', type=int, default=18)
    parser.add_argument('--forecast-hours', type=int, default=36)
    args = parser.parse_args()

    # --- Spill ---
    if args.input:
        detection_time, polygon, oil_type, mass_kg = load_spill_input(args.input)
        spill_id = None
    else:
        detection_time, polygon, oil_type, mass_kg, spill_id = load_spill_from_db(args.spill_id)
    print(f"  detection_time={detection_time}, oil_type={oil_type}, vertices={len(polygon)}")

    # --- Environment ---
    if args.current_nc or args.wind_nc:
        current_reader, wind_reader = build_environment_from_files(args.current_nc, args.wind_nc)
    else:
        centroid_lon, centroid_lat = polygon.mean(axis=0)
        current_reader, wind_reader = build_environment_from_db(
            centroid_lon, centroid_lat, detection_time)

    # --- Simulation ---
    print("\n=== Running BACKWARD hindcast (finding spill origin) ===")
    o_back = run_backward_hindcast(detection_time, polygon, oil_type, mass_kg,
                                    current_reader, wind_reader,
                                    n_particles=args.particles, hours_back=args.hours_back)
    result = estimate_origin(o_back)
    print(f"Estimated origin point (lat, lon): {result['origin_point']}")
    print(f"Estimated origin time: {result['estimated_origin_time']} "
          f"(searched back from {result['searched_back_from']})")
    print(f"Rough spatial uncertainty: {result['uncertainty_km']} km")

    print("\n=== Running FORWARD forecast (threat radius) ===")
    o_fwd = run_forward_forecast(detection_time, polygon, oil_type, mass_kg,
                                  current_reader, wind_reader, hours=args.forecast_hours)
    print("Forward forecast complete -> forward_forecast.nc")

    print("\n=== Plotting ===")
    back_plot = os.path.join(BASE_DIR, 'backward_hindcast.png')
    fwd_plot = os.path.join(BASE_DIR, 'forward_forecast.png')
    o_back.plot(filename=back_plot, fast=True)
    o_fwd.plot(filename=fwd_plot, fast=True)
    print(f"Saved {os.path.basename(back_plot)} and {os.path.basename(fwd_plot)}")

    print("\n=== Saving hindcast result to database ===")
    save_hindcast_result_to_db(spill_id, result)


if __name__ == '__main__':
    main()