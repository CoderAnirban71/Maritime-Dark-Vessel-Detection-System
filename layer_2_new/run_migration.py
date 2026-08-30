"""
run_migration.py - Applies db_migration_add_polygon.sql to the EXISTING
database your teammate already set up, using the DATABASE_URL already
in .env. Does not create a new database or touch existing tables/data -
it only adds one new column (polygon_geojson) to spill_detections if
it isn't already there.

Run from inside layer_2_new/ (same folder as config.py, .env):
    python run_migration.py
"""

import asyncio
import asyncpg
from config import settings


MIGRATION_SQL = """
ALTER TABLE spill_detections
    ADD COLUMN IF NOT EXISTS polygon_geojson JSONB;

COMMENT ON COLUMN spill_detections.polygon_geojson IS
    'Full spill outline as a list of [lon, lat] vertex pairs, '
    'as produced by Layer 3 (inference_pipeline.py).';
"""


async def main():
    print(f"Connecting to database...")
    conn = await asyncpg.connect(settings.database_url)
    try:
        # Sanity check: does spill_detections even exist yet?
        exists = await conn.fetchval(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_name = 'spill_detections')"
        )
        if not exists:
            print("ERROR: spill_detections table doesn't exist yet.")
            print("Ask your teammate whether schema.sql was ever run "
                  "against this database, or run it yourself first.")
            return

        await conn.execute(MIGRATION_SQL)

        # Confirm the column is there now
        col_exists = await conn.fetchval(
            "SELECT EXISTS (SELECT FROM information_schema.columns "
            "WHERE table_name = 'spill_detections' "
            "AND column_name = 'polygon_geojson')"
        )
        if col_exists:
            print("SUCCESS: polygon_geojson column is ready on spill_detections.")
        else:
            print("WARNING: migration ran but column still not found - check manually.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())