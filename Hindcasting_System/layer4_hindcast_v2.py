"""
SAMUDRA-NETRA — Layer 4: Hindcasting Engine (OpenDrift / OpenOil)
==================================================================

WHAT THIS SCRIPT TAKES AS INPUT
--------------------------------
This is NOT an image-processing script. It never sees the SAR image.
Layer 3 (your teammate's U-Net) is the ONLY layer that touches pixels;
its job is to turn a SAR image into exactly two things, and THOSE are
what this script consumes:

  1. A spill polygon  -> list of [lon, lat] vertices outlining the slick
  2. A detection time  -> when that SAR image was captured (UTC)

That handoff is represented here as a small JSON file (see
`example_spill_input.json`, auto-created on first run). In production,
Layer 3 would write this JSON directly after running its segmentation
model on a real SAR scene.

Optionally, this script also takes real ocean current / wind data as
NetCDF (.nc) files (from CMEMS / INCOIS / ERA5). If you don't have
these yet, it falls back to synthetic constant fields so you can keep
developing and testing the OpenDrift logic itself.

HOW TO RUN
----------
    # 1. Synthetic everything (no files needed) - sanity check the pipeline
    python3 layer4_hindcast_v2.py

    # 2. Your own spill polygon + time, still-synthetic environment
    python3 layer4_hindcast_v2.py --input my_spill.json

    # 3. Full real run: real spill polygon + real current/wind NetCDF data
    python3 layer4_hindcast_v2.py --input my_spill.json \
        --current-nc cmems_currents.nc --wind-nc era5_wind.nc

HOW TO TEST IT
---------------
    # a) Does it even run end-to-end? (synthetic mode, ~10 sec)
    python3 layer4_hindcast_v2.py

    # b) Does the origin estimate make sense for a KNOWN case?
    #    Take a real documented spill (the plan recommends validating
    #    against a real Gujarat/Bombay High incident): use the SPILL'S
    #    KNOWN location+time as input, run FORWARD to where it was later
    #    observed, then feed that observed polygon back in and run
    #    BACKWARD - the recovered origin should land close to the real
    #    starting point. That round-trip is your correctness test.

    # c) Unit-test style check: run with --input pointing at a spill
    #    whose polygon is a tiny single point (radius ~0) and confirm
    #    the backward origin sits along the reciprocal of the current
    #    direction you fed it - i.e. the physics is doing something
    #    sane, not returning garbage or the seed point unchanged.
"""

import argparse
import json
import os

import numpy as np
from datetime import datetime, timedelta

from opendrift.models.openoil import OpenOil
from opendrift.readers import reader_constant


EXAMPLE_INPUT_PATH = 'example_spill_input.json'


# ---------------------------------------------------------------------------
# Input handling: this is the actual contract with Layer 3.
# ---------------------------------------------------------------------------

def write_example_input_if_missing():
    """Create a sample input file showing the exact schema Layer 3 must produce."""
    if os.path.exists(EXAMPLE_INPUT_PATH):
        return
    example = {
        "detection_time_utc": "2026-03-10T06:00:00",
        "spill_polygon": [
            # [lon, lat] vertices - a real Layer 3 output would have many
            # more points tracing the actual segmentation mask boundary.
            [68.545, 21.845],
            [68.555, 21.845],
            [68.555, 21.855],
            [68.545, 21.855]
        ],
        "oil_type": "GENERIC MEDIUM CRUDE",
        "estimated_mass_kg": 1000
    }
    with open(EXAMPLE_INPUT_PATH, 'w') as f:
        json.dump(example, f, indent=2)
    print(f"No --input given: wrote a sample schema to {EXAMPLE_INPUT_PATH}")


def load_spill_input(path):
    """
    Load the Layer 3 -> Layer 4 handoff JSON. Returns detection time,
    polygon vertices as parallel lon/lat arrays, oil type, and mass.
    """
    with open(path) as f:
        data = json.load(f)

    detection_time = datetime.fromisoformat(data['detection_time_utc'])
    polygon = np.array(data['spill_polygon'])  # shape (N, 2) as [lon, lat]
    oil_type = data.get('oil_type', 'GENERIC MEDIUM CRUDE')
    mass_kg = data.get('estimated_mass_kg', 1000)
    return detection_time, polygon, oil_type, mass_kg


def seed_points_within_polygon(polygon, n_particles, seed=42):
    """
    Fill the polygon's bounding box with random points and keep only
    those inside it (simple, dependency-free point-in-polygon fill -
    fine for the wiggly, non-convex shapes real segmentation masks
    produce). For production-scale polygons, shapely's `.contains`
    is faster - swap in if this becomes a bottleneck.
    """
    lon_min, lat_min = polygon.min(axis=0)
    lon_max, lat_max = polygon.max(axis=0)

    rng = np.random.default_rng(seed=seed)
    accepted_lons, accepted_lats = [], []
    batch = max(n_particles * 4, 1000)

    while len(accepted_lons) < n_particles:
        cand_lon = rng.uniform(lon_min, lon_max, batch)
        cand_lat = rng.uniform(lat_min, lat_max, batch)
        inside = _points_in_polygon(cand_lon, cand_lat, polygon)
        accepted_lons.extend(cand_lon[inside])
        accepted_lats.extend(cand_lat[inside])

    return (np.array(accepted_lons[:n_particles]),
            np.array(accepted_lats[:n_particles]))


def _points_in_polygon(lons, lats, polygon):
    """Vectorized ray-casting point-in-polygon test."""
    n = len(polygon)
    inside = np.zeros(len(lons), dtype=bool)
    px, py = polygon[:, 0], polygon[:, 1]
    j = n - 1
    for i in range(n):
        cond = ((py[i] > lats) != (py[j] > lats)) & (
            lons < (px[j] - px[i]) * (lats - py[i]) / (py[j] - py[i] + 1e-15) + px[i]
        )
        inside ^= cond
        j = i
    return inside


# ---------------------------------------------------------------------------
# Environment data: synthetic fallback or real CMEMS/INCOIS/ERA5 NetCDF.
# ---------------------------------------------------------------------------

def build_environment(current_nc=None, wind_nc=None):
    """
    Returns (current_reader, wind_reader). Uses real NetCDF files if
    paths are given and exist; otherwise falls back to synthetic
    constant fields so the rest of the pipeline is still testable.
    """
    if current_nc and os.path.exists(current_nc):
        from opendrift.readers import reader_netCDF_CF_generic
        current_reader = reader_netCDF_CF_generic.Reader(current_nc)
        print(f"Using REAL current data: {current_nc}")
    else:
        if current_nc:
            print(f"WARNING: {current_nc} not found, falling back to synthetic current")
        current_reader = reader_constant.Reader({
            'x_sea_water_velocity': 0.15,
            'y_sea_water_velocity': 0.05,
        })

    if wind_nc and os.path.exists(wind_nc):
        from opendrift.readers import reader_netCDF_CF_generic
        wind_reader = reader_netCDF_CF_generic.Reader(wind_nc)
        print(f"Using REAL wind data: {wind_nc}")
    else:
        if wind_nc:
            print(f"WARNING: {wind_nc} not found, falling back to synthetic wind")
        wind_reader = reader_constant.Reader({
            'x_wind': 3.0,
            'y_wind': -1.5,
        })

    return current_reader, wind_reader


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------

def run_backward_hindcast(detection_time, polygon, oil_type, mass_kg,
                           current_nc=None, wind_nc=None,
                           n_particles=2000, hours_back=18):
    o = OpenOil(loglevel=50)
    current_reader, wind_reader = build_environment(current_nc, wind_nc)
    o.add_reader([current_reader, wind_reader])
    o.set_config('environment:fallback:land_binary_mask', 0)
    o.set_config('drift:vertical_mixing', False)

    lons, lats = seed_points_within_polygon(polygon, n_particles)
    o.seed_elements(
        lon=lons, lat=lats,
        time=detection_time,
        oil_type=oil_type,
        mass_oil=mass_kg,
    )
    o.run(time_step=-900, duration=timedelta(hours=hours_back),
          outfile='backward_hindcast.nc')
    return o


def estimate_origin(o):
    sim_times = o.result['time'].values
    origin_lons = o.result['lon'].isel(time=-1).values
    origin_lats = o.result['lat'].isel(time=-1).values

    origin_point = (float(np.nanmean(origin_lats)), float(np.nanmean(origin_lons)))
    spread_km = float(np.nanstd(origin_lats)) * 111

    earliest_time = np.datetime_as_string(sim_times.min(), unit='s')
    detection_time_str = np.datetime_as_string(sim_times.max(), unit='s')

    return {
        'origin_point': origin_point,
        'estimated_origin_time': earliest_time,
        'searched_back_from': detection_time_str,
        'uncertainty_km': round(spread_km, 2),
    }


def run_forward_forecast(detection_time, polygon, oil_type, mass_kg,
                          current_nc=None, wind_nc=None, hours=36):
    o = OpenOil(loglevel=50)
    current_reader, wind_reader = build_environment(current_nc, wind_nc)
    o.add_reader([current_reader, wind_reader])
    o.set_config('environment:fallback:land_binary_mask', 0)
    o.set_config('drift:vertical_mixing', False)

    center_lon, center_lat = polygon.mean(axis=0)
    o.seed_elements(
        lon=center_lon, lat=center_lat,
        time=detection_time,
        oil_type=oil_type,
        mass_oil=mass_kg,
        number=500,
    )
    o.run(time_step=900, duration=timedelta(hours=hours),
          outfile='forward_forecast.nc')
    return o


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='SAMUDRA-NETRA Layer 4 - Hindcasting Engine')
    parser.add_argument('--input', default=None,
                         help='Path to Layer 3 handoff JSON (spill polygon + detection time). '
                              'If omitted, a sample file is generated and used.')
    parser.add_argument('--current-nc', default=None,
                         help='Path to real ocean current NetCDF (CMEMS/INCOIS). '
                              'Falls back to synthetic constant current if omitted/missing.')
    parser.add_argument('--wind-nc', default=None,
                         help='Path to real wind NetCDF (CMEMS/ERA5). '
                              'Falls back to synthetic constant wind if omitted/missing.')
    parser.add_argument('--particles', type=int, default=2000)
    parser.add_argument('--hours-back', type=int, default=18,
                         help='How many hours back to search for the origin.')
    parser.add_argument('--forecast-hours', type=int, default=36)
    args = parser.parse_args()

    if args.input is None:
        write_example_input_if_missing()
        args.input = EXAMPLE_INPUT_PATH

    detection_time, polygon, oil_type, mass_kg = load_spill_input(args.input)
    print(f"Loaded spill input from {args.input}")
    print(f"  detection_time = {detection_time}, oil_type = {oil_type}, "
          f"polygon vertices = {len(polygon)}")

    print("\n=== Running BACKWARD hindcast (finding spill origin) ===")
    o_back = run_backward_hindcast(
        detection_time, polygon, oil_type, mass_kg,
        current_nc=args.current_nc, wind_nc=args.wind_nc,
        n_particles=args.particles, hours_back=args.hours_back)
    result = estimate_origin(o_back)
    print(f"Estimated origin point (lat, lon): {result['origin_point']}")
    print(f"Estimated origin time: {result['estimated_origin_time']} "
          f"(searched back from {result['searched_back_from']})")
    print(f"Rough spatial uncertainty: {result['uncertainty_km']} km")

    print("\n=== Running FORWARD forecast (threat radius) ===")
    o_fwd = run_forward_forecast(
        detection_time, polygon, oil_type, mass_kg,
        current_nc=args.current_nc, wind_nc=args.wind_nc,
        hours=args.forecast_hours)
    print("Forward forecast complete -> forward_forecast.nc")

    print("\n=== Plotting ===")
    o_back.plot(filename='backward_hindcast.png', fast=True)
    o_fwd.plot(filename='forward_forecast.png', fast=True)
    print("Saved backward_hindcast.png and forward_forecast.png")

    # Machine-readable output for Layer 5's consumption
    output_for_layer5 = {
        'estimated_origin_lat': result['origin_point'][0],
        'estimated_origin_lon': result['origin_point'][1],
        'estimated_origin_time_utc': result['estimated_origin_time'],
        'search_window_end_utc': result['searched_back_from'],
        'uncertainty_km': result['uncertainty_km'],
    }
    with open('layer4_output.json', 'w') as f:
        json.dump(output_for_layer5, f, indent=2)
    print("\nWrote layer4_output.json (this is what hands off to Layer 5)")


if __name__ == '__main__':
    main()
