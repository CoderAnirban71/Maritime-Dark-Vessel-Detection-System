"""
models.py - shape/type validation for every message that arrives over Redis.

Pure definitions, no logic of its own. ingest_consumer.py calls these to
reject a malformed message before it ever reaches h3_utils.py or the DB -
the same job a form-checking counter does at a post office.
"""

from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator


class AISPing(BaseModel):
    mmsi: int = Field(..., ge=100000000, le=999999999, description="9-digit Maritime Mobile Service Identity")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    speed_kn: float | None = Field(None, ge=0, le=60)
    heading_deg: float | None = Field(None, ge=0, lt=360)
    ts: datetime

    @field_validator("ts")
    @classmethod
    def ts_must_be_utc(cls, v: datetime) -> datetime:
        # A naive timestamp here would silently corrupt every time-window
        # query downstream (IST vs UTC drift) - fail loudly instead.
        if v.tzinfo is None:
            raise ValueError("ts must be timezone-aware (UTC) - naive timestamps are rejected")
        return v.astimezone(timezone.utc)


class SpillDetection(BaseModel):
    confidence: float = Field(..., ge=0, le=1)
    area_km2: float | None = Field(None, ge=0)
    # Outer ring of the slick polygon: list of (lat, lon) vertices, min 3 to be a polygon.
    polygon: list[tuple[float, float]] = Field(..., min_length=3)
    ts: datetime

    @field_validator("ts")
    @classmethod
    def ts_must_be_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("ts must be timezone-aware (UTC) - naive timestamps are rejected")
        return v.astimezone(timezone.utc)

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
    current_dir_deg: float | None = Field(None, ge=0, lt=360)
    wind_speed_ms: float | None = Field(None, ge=0, le=60)
    wind_dir_deg: float | None = Field(None, ge=0, lt=360)
    ts: datetime

    @field_validator("ts")
    @classmethod
    def ts_must_be_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("ts must be timezone-aware (UTC) - naive timestamps are rejected")
        return v.astimezone(timezone.utc)


# ---- Query API response shapes ----

class AISPingOut(BaseModel):
    mmsi: int
    lat: float
    lon: float
    speed_kn: float | None
    heading_deg: float | None
    ts: datetime


class NearbyResponse(BaseModel):
    query_lat: float
    query_lon: float
    radius_km: float
    cell_count_searched: int
    results: list[AISPingOut]
