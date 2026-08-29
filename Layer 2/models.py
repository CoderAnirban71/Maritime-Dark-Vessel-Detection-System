"""
models.py - Shape and type validation for messages in Layer 2.

Validates incoming messages from Redis / Layer 1 and defines Query API response shapes.
"""

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator


def _ensure_utc(v: Any) -> datetime:
    """Normalize datetime or ISO string to UTC timezone-aware datetime."""
    if isinstance(v, str):
        # Let pydantic or fromisoformat handle string parsing
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    elif isinstance(v, datetime):
        dt = v
    elif isinstance(v, (int, float)):
        dt = datetime.fromtimestamp(v, tz=timezone.utc)
    else:
        raise ValueError(f"Invalid timestamp format: {v!r}")

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AISPing(BaseModel):
    mmsi: int = Field(..., ge=100000000, le=999999999, description="9-digit Maritime Mobile Service Identity")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    speed_kn: float | None = Field(None, ge=0, le=60)
    heading_deg: float | None = Field(None, ge=0, le=360)
    ts: datetime

    @field_validator("ts", mode="before")
    @classmethod
    def validate_ts(cls, v: Any) -> datetime:
        return _ensure_utc(v)


class SpillDetection(BaseModel):
    confidence: float = Field(..., ge=0, le=1)
    area_km2: float | None = Field(None, ge=0)
    # Outer ring of the slick polygon: list of (lat, lon) vertices, min 3 to be a polygon.
    polygon: list[tuple[float, float]] = Field(..., min_length=3)
    ts: datetime

    @field_validator("ts", mode="before")
    @classmethod
    def validate_ts(cls, v: Any) -> datetime:
        return _ensure_utc(v)

    @field_validator("polygon")
    @classmethod
    def polygon_coords_in_range(cls, v: list[tuple[float, float]]) -> list[tuple[float, float]]:
        for lat, lon in v:
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"polygon vertex out of range: ({lat}, {lon})")
        return v


class OceanReading(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    current_speed_ms: float | None = Field(None, ge=0, le=10)
    current_dir_deg: float | None = Field(None, ge=0, le=360)
    wind_speed_ms: float | None = Field(None, ge=0, le=60)
    wind_dir_deg: float | None = Field(None, ge=0, le=360)
    ts: datetime

    @field_validator("ts", mode="before")
    @classmethod
    def validate_ts(cls, v: Any) -> datetime:
        return _ensure_utc(v)


class WindReading(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    wind_speed_ms: float = Field(..., ge=0, le=60)
    wind_dir_deg: float = Field(..., ge=0, le=360)
    ts: datetime

    @field_validator("ts", mode="before")
    @classmethod
    def validate_ts(cls, v: Any) -> datetime:
        return _ensure_utc(v)


# ---- Query API response shapes ----

class AISPingOut(BaseModel):
    mmsi: int
    lat: float
    lon: float
    speed_kn: float | None = None
    heading_deg: float | None = None
    h3_index: int | None = None
    ts: datetime


class NearbyResponse(BaseModel):
    query_lat: float
    query_lon: float
    radius_km: float
    cell_count_searched: int
    results: list[AISPingOut]


class OceanReadingOut(BaseModel):
    lat: float
    lon: float
    current_speed_ms: float | None = None
    current_dir_deg: float | None = None
    wind_speed_ms: float | None = None
    wind_dir_deg: float | None = None
    h3_index: int | None = None
    ts: datetime


class EnvironmentalNearbyResponse(BaseModel):
    query_lat: float
    query_lon: float
    radius_km: float
    cell_count_searched: int
    results: list[OceanReadingOut]
