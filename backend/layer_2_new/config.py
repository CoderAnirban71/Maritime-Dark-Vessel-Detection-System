"""
config.py - Single source of truth for settings.

This file reads environment variables or .env file using pydantic-settings.
Provides sensible local defaults so imports and tests don't crash when .env is absent.

The .env file is resolved relative to THIS file's location (layer_2_new/),
so the script works correctly regardless of which directory it is run from.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to the .env file — always layer_2_new/.env,
# no matter where the calling script is run from.
_ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # PostgreSQL / TimescaleDB
    database_url: str = "postgresql://samudra:samudra_dev_pw@127.0.0.1:5432/samudra_netra"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_channel_ais: str = "layer1:ais"
    redis_channel_spill: str = "layer1:spill"
    redis_channel_ocean: str = "layer1:ocean"
    redis_channel_wind: str = "layer1:wind"

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
