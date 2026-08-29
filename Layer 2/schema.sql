-- schema.sql
-- Run ONCE against a fresh database: psql "$DATABASE_URL" -f schema.sql
-- No Python file imports or runs this - everything downstream just assumes
-- this structure already exists.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- 1. ais_pings - one row per vessel position report (high volume)
-- ============================================================
CREATE TABLE IF NOT EXISTS ais_pings (
    mmsi        BIGINT              NOT NULL,
    lat         DOUBLE PRECISION    NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon         DOUBLE PRECISION    NOT NULL CHECK (lon BETWEEN -180 AND 180),
    speed_kn    REAL,
    heading_deg REAL,
    h3_index    BIGINT              NOT NULL,
    ts          TIMESTAMPTZ         NOT NULL,
    PRIMARY KEY (mmsi, ts)
);

SELECT create_hypertable(
    'ais_pings', 'ts',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Backbone index: every Layer 5 query is "these hexagons, this time window".
CREATE INDEX IF NOT EXISTS idx_ais_pings_h3_ts ON ais_pings (h3_index, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ais_pings_mmsi_ts ON ais_pings (mmsi, ts DESC);

-- ============================================================
-- 2. spill_detections - one row per SAR-detected slick (low volume)
-- ============================================================
CREATE TABLE IF NOT EXISTS spill_detections (
    spill_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confidence  REAL CHECK (confidence BETWEEN 0 AND 1),
    area_km2    REAL,
    centroid_lat DOUBLE PRECISION,
    centroid_lon DOUBLE PRECISION,
    ts          TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spill_detections_ts ON spill_detections (ts DESC);

-- ============================================================
-- 3. spill_hex_coverage - junction table: one row per hex a spill touches.
-- A spill polygon spans many hexagons, so this is a proper many-to-one
-- table rather than an array column - it keeps "which pings fall inside
-- this spill" a plain index join instead of an array-containment scan.
-- ============================================================
CREATE TABLE IF NOT EXISTS spill_hex_coverage (
    spill_id  UUID        NOT NULL REFERENCES spill_detections(spill_id) ON DELETE CASCADE,
    h3_index  BIGINT      NOT NULL,
    ts        TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (spill_id, h3_index)
);

CREATE INDEX IF NOT EXISTS idx_spill_hex_coverage_h3_ts ON spill_hex_coverage (h3_index, ts DESC);

-- ============================================================
-- 4. ocean_readings - wind/current samples (high volume, gridded)
-- ============================================================
CREATE TABLE IF NOT EXISTS ocean_readings (
    lat             DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon             DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
    current_speed_ms  REAL,
    current_dir_deg   REAL,
    wind_speed_ms     REAL,
    wind_dir_deg      REAL,
    h3_index        BIGINT      NOT NULL,
    ts              TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (h3_index, ts)
);

SELECT create_hypertable(
    'ocean_readings', 'ts',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_ocean_readings_h3_ts ON ocean_readings (h3_index, ts DESC);
