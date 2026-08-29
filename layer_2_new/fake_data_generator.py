"""
fake_data_generator.py - publishes REALISTIC synthetic messages to the same
Redis channels the real Layer 1 will publish to, so Layer 2 can be built
and tested end to end before Layer 1 is ready.

"Realistic" specifically means:
  - Coordinates are drawn from the real Gulf of Kutch / Gujarat coast
    bounding box (the project's own validation case), not 0,0 or random
    global points.
  - MMSIs use REAL ITU Maritime Identification Digits (419 India, 351
    Panama, 538 Marshall Islands, 563 Singapore, 636 Liberia) - verified
    against the ITU/Wikipedia MID table - not made-up prefixes. This also
    mirrors the actual scenario: a mix of Indian coastal traffic and
    foreign-flagged tankers transiting the area, which is exactly what
    Layer 5 (vessel attribution) needs to reason about.
  - Speed/heading/current/wind values are sampled from real-world ranges
    for the relevant instrument, not arbitrary numbers.
  - Timestamps are real current UTC time (datetime.now), not a fixed
    hardcoded date.

This file is fully independent - it only needs Redis running. It does not
import config from any other Layer 2 file's runtime state, doesn't touch
Postgres, and doesn't know ingest_consumer.py exists. When real Layer 1
data arrives, this script is simply not run - nothing else changes.
"""

import argparse
import asyncio
import json
import math
import random
from datetime import datetime, timezone

import redis.asyncio as redis

from config import settings

# Gulf of Kutch / Gujarat coast bounding box - the project's real validation area.
LAT_RANGE = (20.5, 23.5)
LON_RANGE = (68.0, 72.0)

# Real ITU Maritime Identification Digits, verified against the ITU/Wikipedia
# MID table. Weighted so Indian-flagged coastal traffic dominates with a
# realistic minority of foreign-flagged tankers, matching real Gulf of
# Kutch shipping patterns.
MID_WEIGHTS = [("419", 0.55), ("351", 0.12), ("538", 0.12), ("563", 0.11), ("636", 0.10)]


def _random_mmsi() -> int:
    mid = random.choices([m for m, _ in MID_WEIGHTS], weights=[w for _, w in MID_WEIGHTS])[0]
    return int(mid + "".join(str(random.randint(0, 9)) for _ in range(6)))


def _random_point() -> tuple[float, float]:
    return (round(random.uniform(*LAT_RANGE), 6), round(random.uniform(*LON_RANGE), 6))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_ais_ping() -> dict:
    lat, lon = _random_point()
    # 0 kn (anchored/drifting) is realistic near a port; otherwise typical
    # cargo/tanker cruising speed.
    speed = 0.0 if random.random() < 0.08 else round(random.uniform(6.0, 18.0), 1)
    return {
        "mmsi": _random_mmsi(),
        "lat": lat,
        "lon": lon,
        "speed_kn": speed,
        "heading_deg": round(random.uniform(0, 359.9), 1),
        "ts": _now_iso(),
    }


def make_spill_polygon(n_vertices: int = 7) -> dict:
    """
    An irregular, slightly elongated blob around a random center - real oil
    slicks stretch out under current/wind rather than staying circular, so
    a perfect circle would be a less realistic test shape.
    """
    center_lat, center_lon = _random_point()
    base_radius_km = random.uniform(0.6, 2.5)
    stretch_axis = random.uniform(0, math.pi)  # direction of elongation
    stretch_factor = random.uniform(1.3, 2.2)

    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * math.cos(math.radians(center_lat))

    ring = []
    for i in range(n_vertices):
        angle = 2 * math.pi * i / n_vertices
        jitter = random.uniform(0.7, 1.3)
        r = base_radius_km * jitter
        # stretch the radius along stretch_axis to make it elongated, not circular
        elong = 1 + (stretch_factor - 1) * abs(math.cos(angle - stretch_axis))
        r *= elong
        d_lat = (r * math.sin(angle)) / km_per_deg_lat
        d_lon = (r * math.cos(angle)) / km_per_deg_lon
        ring.append((round(center_lat + d_lat, 6), round(center_lon + d_lon, 6)))

    area_km2 = round(math.pi * base_radius_km * base_radius_km * ((stretch_factor + 1) / 2), 2)
    return {
        "confidence": round(random.uniform(0.55, 0.97), 2),
        "area_km2": area_km2,
        "polygon": ring,
        "ts": _now_iso(),
        "_centroid": (center_lat, center_lon),  # convenience for the CLI printout only
    }


def make_ocean_reading() -> dict:
    lat, lon = _random_point()
    return {
        "lat": lat,
        "lon": lon,
        # Real-world Arabian Sea surface current speeds are typically well under 2 m/s.
        "current_speed_ms": round(random.uniform(0.05, 1.8), 2),
        "current_dir_deg": round(random.uniform(0, 359.9), 1),
        "ts": _now_iso(),
    }


def make_wind_reading() -> dict:
    lat, lon = _random_point()
    return {
        "lat": lat,
        "lon": lon,
        # Coastal wind speeds, calm to strong breeze (m/s).
        "wind_speed_ms": round(random.uniform(0.5, 18.0), 1),
        "wind_dir_deg": round(random.uniform(0, 359.9), 1),
        "ts": _now_iso(),
    }


async def run(count: int, interval_seconds: float, spill_every: int) -> None:
    r = redis.from_url(settings.redis_url)
    published = {"ais": 0, "spill": 0, "ocean": 0, "wind": 0}
    try:
        for i in range(1, count + 1):
            ais = make_ais_ping()
            await r.publish(settings.redis_channel_ais, json.dumps(ais))
            published["ais"] += 1

            ocean = make_ocean_reading()
            await r.publish(settings.redis_channel_ocean, json.dumps(ocean))
            published["ocean"] += 1

            wind = make_wind_reading()
            await r.publish(settings.redis_channel_wind, json.dumps(wind))
            published["wind"] += 1

            if i % spill_every == 0:
                spill = make_spill_polygon()
                centroid = spill.pop("_centroid")
                await r.publish(settings.redis_channel_spill, json.dumps(spill))
                published["spill"] += 1
                print(f"[{i}/{count}] published spill near {centroid}, {len(spill['polygon'])} vertices")

            if i % 10 == 0 or i == count:
                print(f"[{i}/{count}] published so far -> {published}")

            if interval_seconds > 0:
                await asyncio.sleep(interval_seconds)
    finally:
        await r.aclose()
        print(f"done. totals: {published}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish realistic synthetic Layer 1 messages to Redis for testing.")
    parser.add_argument("--count", type=int, default=20, help="number of AIS+ocean+wind message sets to publish")
    parser.add_argument("--interval", type=float, default=0.0, help="seconds to sleep between messages (0 = burst)")
    parser.add_argument("--spill-every", type=int, default=5, help="publish one spill polygon every N iterations")
    args = parser.parse_args()
    asyncio.run(run(args.count, args.interval, args.spill_every))
