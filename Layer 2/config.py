"""
config.py - single source of truth for settings.

This file imports nothing else from this project - it only reads .env.
Every other file imports FROM here.

Uses pydantic-settings so a missing or malformed .env fails loudly and
clearly at startup, instead of crashing confusingly deep inside an
insert or a query later.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # PostgreSQL / TimescaleDB
    database_url: str

    # Redis
    redis_url: str
    redis_channel_ais: str = "layer1:ais"
    redis_channel_spill: str = "layer1:spill"
    redis_channel_ocean: str = "layer1:ocean"

    # H3 - one resolution for points AND polygon coverage, so they are
    # directly joinable on h3_index with no parent/child conversion.
    h3_resolution: int = 8

    # Ingestion consumer batching
    batch_max_size: int = 100
    batch_max_wait_seconds: float = 5.0

    # Query API
    api_host: str = "0.0.0.0"
    api_port: int = 8000


# Import this singleton everywhere: `from config import settings`
settings = Settings()
