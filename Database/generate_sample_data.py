"""
generate_sample_data.py -- builds ONE fixed, shareable demo dataset.

Unlike fake_data_generator.py (which streams random data over Redis forever,
different every run -- good for testing the pipeline, bad for a demo),
this script uses a FIXED random seed and writes plain SQL INSERT statements
to `sample_data.sql`.

Why SQL and not JSON: `sample_data.sql` can be committed straight to git and
loaded with a single command (`psql -f sample_data.sql`) -- no Python
required to seed the database, so even a teammate who hasn't set up the
Python side yet can load real-looking data into their local Postgres.

Run this ONCE (or whenever you want to regenerate the demo set):
    python3 generate_sample_data.py

Then everyone loads the result with:
    docker exec -i samudra_timescaledb psql -U samudra -d samudra_netra < sample_data.sql
"""
import random
from datetime import datetime, timedelta, timezone

import h3_utils

random.seed(42)  # fixed seed -> same "random" data every time this runs

OUTPUT_FILE = "sample_data.sql"

MID_PREFIXES = {
    419: "India",
    351: "Panama",
    538: "Marshall Islands",
    563: "Singapore",
    636: "Liberia",
}

# Gulf of Kachchh / Gujarat coast bounding box
LAT_RANGE = (20.5, 23.5)
LON_RANGE = (68.0, 71.5)

# A fixed "demo now" so timestamps are stable and predictable across runs
# and across teammates -- not `datetime.now()`, which would differ every time.
DEMO_NOW = datetime(2026, 8, 20, 6, 0, 0, tzinfo=timezone.utc)


def random_mmsi() -> int:
    mid = random.choice(list(MID_PREFIXES.keys()))
    suffix = random.randint(100_000, 999_999)
    return int(f"{mid}{suffix}")


def random_point() -> tuple[float, float]:
    lat = round(random.uniform(*LAT_RANGE), 5)
    lon = round(random.uniform(*LON_RANGE), 5)
    return lat, lon


def sql_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S%z")


def polygon_centroid(polygon: list[list[float]]) -> tuple[float, float]:
    n = len(polygon)
    area = cx = cy = 0.0
    for i in range(n):
        x0, y0 = polygon[i][1], polygon[i][0]
        x1, y1 = polygon[(i + 1) % n][1], polygon[(i + 1) % n][0]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5
    if abs(area) < 1e-12:
        lats = [p[0] for p in polygon]
        lons = [p[1] for p in polygon]
        return sum(lats) / n, sum(lons) / n
    return cy / (6 * area), cx / (6 * area)


def build_demo_dataset():
    ais_rows = []
    ocean_rows = []
    spill_statements = []

    # ---- One "anchor" spill: the event our demo story centers on ----
    spill_center = (21.62, 69.35)  # Gulf of Kachchh, near shipping lanes
    delta = 0.03
    spill_polygon = [
        [spill_center[0] - delta, spill_center[1] - delta],
        [spill_center[0] - delta, spill_center[1] + delta * 1.5],
        [spill_center[0] + delta * 0.6, spill_center[1] + delta * 1.5],
        [spill_center[0] + delta * 0.6, spill_center[1] - delta],
    ]
    spill_ts = DEMO_NOW - timedelta(hours=3)
    centroid_lat, centroid_lon = polygon_centroid(spill_polygon)
    hex_cells = h3_utils.encode_polygon(spill_polygon)

    spill_statements.append(
        f"""
WITH new_spill AS (
    INSERT INTO spill_detections (confidence, area_km2, centroid_lat, centroid_lon, ts)
    VALUES (0.91, 4.7, {centroid_lat}, {centroid_lon}, '{sql_ts(spill_ts)}')
    RETURNING spill_id
)
INSERT INTO spill_hex_coverage (spill_id, h3_index, ts)
SELECT spill_id, unnest(ARRAY[{','.join(str(c) for c in hex_cells)}]::bigint[]), '{sql_ts(spill_ts)}'
FROM new_spill;
"""
    )

    # A couple of extra minor/older spills elsewhere, for realism
    for _ in range(2):
        lat, lon = random_point()
        d = round(random.uniform(0.01, 0.02), 4)
        poly = [[lat - d, lon - d], [lat - d, lon + d], [lat + d, lon + d], [lat + d, lon - d]]
        ts = DEMO_NOW - timedelta(days=random.randint(2, 10))
        clat, clon = polygon_centroid(poly)
        cells = h3_utils.encode_polygon(poly)
        conf = round(random.uniform(0.6, 0.8), 2)
        area = round(random.uniform(0.3, 1.5), 2)
        spill_statements.append(
            f"""
WITH new_spill AS (
    INSERT INTO spill_detections (confidence, area_km2, centroid_lat, centroid_lon, ts)
    VALUES ({conf}, {area}, {clat}, {clon}, '{sql_ts(ts)}')
    RETURNING spill_id
)
INSERT INTO spill_hex_coverage (spill_id, h3_index, ts)
SELECT spill_id, unnest(ARRAY[{','.join(str(c) for c in cells)}]::bigint[]), '{sql_ts(ts)}'
FROM new_spill;
"""
        )

    # ---- Vessel traffic: a handful of "suspect" vessels near the spill
    #      origin around the spill time, plus unrelated background traffic ----

    # Suspects: plausible tanker traffic passing near the spill origin in
    # the hours just before the detection -- this is what your attribution
    # scoring will point to in the demo.
    suspect_mmsis = [random_mmsi() for _ in range(4)]
    for mmsi in suspect_mmsis:
        base_lat = spill_center[0] + random.uniform(-0.15, 0.15)
        base_lon = spill_center[1] + random.uniform(-0.15, 0.15)
        for step in range(6):  # a short track, one ping every ~30 min
            ts = spill_ts - timedelta(hours=3) + timedelta(minutes=30 * step)
            lat = round(base_lat + step * random.uniform(-0.01, 0.02), 5)
            lon = round(base_lon + step * random.uniform(-0.01, 0.02), 5)
            h3idx = h3_utils.encode_point(lat, lon)
            ais_rows.append(
                (mmsi, lat, lon, round(random.uniform(8, 16), 1),
                 round(random.uniform(0, 359), 1), h3idx, ts)
            )

    # Background traffic: unrelated vessels scattered across the whole box
    # and time range, so the query results aren't suspiciously "clean."
    for _ in range(60):
        mmsi = random_mmsi()
        lat, lon = random_point()
        ts = DEMO_NOW - timedelta(hours=random.uniform(0, 72))
        h3idx = h3_utils.encode_point(lat, lon)
        ais_rows.append(
            (mmsi, lat, lon, round(random.uniform(0, 20), 1),
             round(random.uniform(0, 359), 1), h3idx, ts)
        )

    # ---- Ocean readings scattered across the same area/time range ----
    for _ in range(40):
        lat, lon = random_point()
        ts = DEMO_NOW - timedelta(hours=random.uniform(0, 72))
        h3idx = h3_utils.encode_point(lat, lon)
        ocean_rows.append(
            (lat, lon, round(random.uniform(0, 2.2), 2),
             round(random.uniform(0, 359), 1), h3idx, ts)
        )

    return ais_rows, ocean_rows, spill_statements


def write_sql(ais_rows, ocean_rows, spill_statements):
    lines = [
        "-- sample_data.sql -- fixed demo dataset for SAMUDRA-NETRA Layer 2",
        "-- Generated by generate_sample_data.py with random.seed(42) -- rerunning",
        "-- the script reproduces this exact file, so it's safe to regenerate.",
        "-- Apply AFTER schema.sql:",
        "--   docker exec -i samudra_timescaledb psql -U samudra -d samudra_netra < sample_data.sql",
        "",
        "TRUNCATE spill_hex_coverage, spill_detections, ais_pings, ocean_readings;",
        "",
        "-- === AIS pings ===",
    ]
    for mmsi, lat, lon, speed, heading, h3idx, ts in ais_rows:
        lines.append(
            "INSERT INTO ais_pings (mmsi, lat, lon, speed_kn, heading_deg, h3_index, ts) "
            f"VALUES ({mmsi}, {lat}, {lon}, {speed}, {heading}, {h3idx}, "
            f"'{sql_ts(ts)}') ON CONFLICT (mmsi, ts) DO NOTHING;"
        )
        
    lines.append("\n-- === Ocean readings ===")
    for lat, lon, speed, direction, h3idx, ts in ocean_rows:
        lines.append(
            "INSERT INTO ocean_readings (lat, lon, current_speed_ms, current_dir_deg, h3_index, ts) "
            f"VALUES ({lat}, {lon}, {speed}, {direction}, {h3idx}, "
            f"'{sql_ts(ts)}') ON CONFLICT (h3_index, ts) DO NOTHING;"
        )

    lines.append("\n-- === Spills (with hex coverage) ===")
    lines.extend(spill_statements)

    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote {len(ais_rows)} AIS pings, {len(ocean_rows)} ocean readings, "
          f"{len(spill_statements)} spills to {OUTPUT_FILE}")


if __name__ == "__main__":
    ais_rows, ocean_rows, spill_statements = build_demo_dataset()
    write_sql(ais_rows, ocean_rows, spill_statements)