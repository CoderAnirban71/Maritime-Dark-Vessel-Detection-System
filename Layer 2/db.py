"""
db.py - one asyncpg connection pool, shared by everything that talks to
Postgres. Opening a fresh connection per insert/query is the single
biggest, easiest-to-hit performance mistake in this kind of service -
this file exists so nobody else has to think about it again.

repository.py and query_api.py both call get_pool(). ingest_consumer.py
calls init_pool()/close_pool() around its own lifetime; query_api.py does
the same inside FastAPI's lifespan.
"""

import asyncpg

from config import settings

_pool: asyncpg.Pool | None = None


async def init_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=min_size,
            max_size=max_size,
        )
    return _pool


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool not initialised - call init_pool() first (at app startup).")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
