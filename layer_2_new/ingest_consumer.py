"""
ingest_consumer.py - The ingestion consumer service for Layer 2.

Subscribes to Redis channels, validates incoming messages with Pydantic,
computes H3 spatial indexes, buffers high-volume streams, and performs
batch inserts into PostgreSQL/TimescaleDB.

Run: python3 ingest_consumer.py
"""

import asyncio
import json
import time
from typing import Any, Callable

import redis.asyncio as redis
from pydantic import ValidationError

import repository as repo
from config import settings
from db import close_pool, init_pool
from h3_utils import encode_point, encode_polygon
from models import AISPing, OceanReading, SpillDetection, WindReading


class BatchBuffer:
    """Accumulates rows and flushes via `flush_fn` when full OR when stale."""

    def __init__(
        self,
        name: str,
        flush_fn: Callable[[list[dict[str, Any]]], Any],
        max_size: int,
        max_wait_seconds: float,
    ):
        self.name = name
        self.flush_fn = flush_fn
        self.max_size = max_size
        self.max_wait_seconds = max_wait_seconds
        self._buffer: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._last_flush = time.monotonic()

    async def add(self, row: dict[str, Any]) -> None:
        async with self._lock:
            self._buffer.append(row)
            if len(self._buffer) >= self.max_size:
                await self._flush_locked()

    async def flush_if_stale(self) -> None:
        async with self._lock:
            if self._buffer and (time.monotonic() - self._last_flush) >= self.max_wait_seconds:
                await self._flush_locked()

    async def flush_now(self) -> None:
        async with self._lock:
            await self._flush_locked()

    async def _flush_locked(self) -> None:
        if not self._buffer:
            return
        batch, self._buffer = self._buffer, []
        self._last_flush = time.monotonic()
        try:
            await self.flush_fn(batch)
            print(f"[ingest] Flushed {len(batch)} rows -> {self.name}")
        except Exception as exc:
            print(f"[ingest] ERROR flushing {self.name} batch of {len(batch)}: {exc!r}")


def _parse_json(raw: Any) -> dict[str, Any] | None:
    try:
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError, UnicodeDecodeError) as exc:
        print(f"[ingest] SKIPPED - malformed JSON on channel: {exc!r}")
        return None


async def handle_ais(payload: dict[str, Any], buffer: BatchBuffer) -> None:
    try:
        ping = AISPing(**payload)
    except ValidationError as exc:
        print(f"[ingest] SKIPPED invalid AIS ping: {exc.error_count()} error(s)")
        return
    cell = encode_point(ping.lat, ping.lon)
    await buffer.add({
        "mmsi": ping.mmsi,
        "lat": ping.lat,
        "lon": ping.lon,
        "speed_kn": ping.speed_kn,
        "heading_deg": ping.heading_deg,
        "h3_index": cell,
        "ts": ping.ts,
    })


async def handle_ocean(payload: dict[str, Any], buffer: BatchBuffer) -> None:
    try:
        reading = OceanReading(**payload)
    except ValidationError as exc:
        print(f"[ingest] SKIPPED invalid ocean reading: {exc.error_count()} error(s)")
        return
    cell = encode_point(reading.lat, reading.lon)
    await buffer.add({
        "lat": reading.lat,
        "lon": reading.lon,
        "current_speed_ms": reading.current_speed_ms,
        "current_dir_deg": reading.current_dir_deg,
        "wind_speed_ms": reading.wind_speed_ms,
        "wind_dir_deg": reading.wind_dir_deg,
        "h3_index": cell,
        "ts": reading.ts,
    })


async def handle_wind(payload: dict[str, Any], buffer: BatchBuffer) -> None:
    # Accept speed_ms/dir_deg as aliases if present
    if "speed_ms" in payload and "wind_speed_ms" not in payload:
        payload["wind_speed_ms"] = payload["speed_ms"]
    if "dir_deg" in payload and "wind_dir_deg" not in payload:
        payload["wind_dir_deg"] = payload["dir_deg"]

    try:
        reading = WindReading(**payload)
    except ValidationError as exc:
        print(f"[ingest] SKIPPED invalid wind reading: {exc.error_count()} error(s)")
        return
    cell = encode_point(reading.lat, reading.lon)
    await buffer.add({
        "lat": reading.lat,
        "lon": reading.lon,
        "current_speed_ms": None,
        "current_dir_deg": None,
        "wind_speed_ms": reading.wind_speed_ms,
        "wind_dir_deg": reading.wind_dir_deg,
        "h3_index": cell,
        "ts": reading.ts,
    })


def _polygon_centroid(ring: list[tuple[float, float]]) -> tuple[float, float]:
    """
    Area-weighted polygon centroid (shoelace formula).
    Treats (lon, lat) as locally planar for small polygons.
    """
    pts = [(lon, lat) for lat, lon in ring]
    if pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    a_sum = cx_sum = cy_sum = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cross = x0 * y1 - x1 * y0
        a_sum += cross
        cx_sum += (x0 + x1) * cross
        cy_sum += (y0 + y1) * cross
    area = a_sum / 2.0
    if abs(area) < 1e-12:  # degenerate polygon fallback
        lats = [p[0] for p in ring]
        lons = [p[1] for p in ring]
        return (sum(lats) / len(lats), sum(lons) / len(lons))
    cx = cx_sum / (6 * area)
    cy = cy_sum / (6 * area)
    return (cy, cx)  # (lat, lon)


async def handle_spill(payload: dict[str, Any]) -> None:
    try:
        spill = SpillDetection(**payload)
    except ValidationError as exc:
        print(f"[ingest] SKIPPED invalid spill detection: {exc.error_count()} error(s)")
        return
    hex_cells = encode_polygon(spill.polygon)
    centroid_lat, centroid_lon = _polygon_centroid(spill.polygon)
    spill_id = await repo.insert_spill_with_coverage(
        {
            "confidence": spill.confidence,
            "area_km2": spill.area_km2,
            "centroid_lat": centroid_lat,
            "centroid_lon": centroid_lon,
            "ts": spill.ts,
        },
        hex_cells,
    )
    print(f"[ingest] Spill {spill_id} inserted, covering {len(hex_cells)} hexes")


async def periodic_flush_ticker(buffers: list[BatchBuffer], stop_event: asyncio.Event) -> None:
    """Every ~1s, flush any buffer that's been sitting non-empty past its max wait."""
    while not stop_event.is_set():
        for b in buffers:
            await b.flush_if_stale()
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1.0)
        except asyncio.TimeoutError:
            pass


async def consume(stop_event: asyncio.Event | None = None) -> None:
    """Main consumer loop. Runs until stop_event is set."""
    if stop_event is None:
        stop_event = asyncio.Event()

    await init_pool()
    r = redis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(
        settings.redis_channel_ais,
        settings.redis_channel_spill,
        settings.redis_channel_ocean,
        settings.redis_channel_wind,
    )
    print(f"[ingest] Subscribed to channels: {settings.redis_channel_ais}, {settings.redis_channel_spill}, {settings.redis_channel_ocean}, {settings.redis_channel_wind}")

    ais_buffer = BatchBuffer("ais_pings", repo.insert_ais_batch, settings.batch_max_size, settings.batch_max_wait_seconds)
    ocean_buffer = BatchBuffer("ocean_readings", repo.insert_ocean_batch, settings.batch_max_size, settings.batch_max_wait_seconds)

    ticker = asyncio.create_task(periodic_flush_ticker([ais_buffer, ocean_buffer], stop_event))

    try:
        while not stop_event.is_set():
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
            if message is None:
                continue
            channel = message["channel"].decode() if isinstance(message["channel"], bytes) else message["channel"]
            payload = _parse_json(message["data"])
            if payload is None:
                continue
            try:
                if channel == settings.redis_channel_ais:
                    await handle_ais(payload, ais_buffer)
                elif channel == settings.redis_channel_ocean:
                    await handle_ocean(payload, ocean_buffer)
                elif channel == settings.redis_channel_wind:
                    await handle_wind(payload, ocean_buffer)
                elif channel == settings.redis_channel_spill:
                    await handle_spill(payload)
            except Exception as exc:
                print(f"[ingest] SKIPPED - unexpected error handling message on {channel}: {exc!r}")
    finally:
        stop_event.set()
        ticker.cancel()
        try:
            await ticker
        except asyncio.CancelledError:
            pass
        await ais_buffer.flush_now()
        await ocean_buffer.flush_now()
        await pubsub.unsubscribe()
        await pubsub.aclose()
        await r.aclose()
        await close_pool()
        print("[ingest] Ingestion consumer shut down cleanly, all buffered data flushed.")


if __name__ == "__main__":
    stop = asyncio.Event()

    async def main():
        loop = asyncio.get_running_loop()
        for sig_name in ("SIGINT", "SIGTERM"):
            try:
                import signal
                loop.add_signal_handler(getattr(signal, sig_name), stop.set)
            except (NotImplementedError, AttributeError):
                pass
        await consume(stop)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ingest] Interrupted.")
