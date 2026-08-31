# Samudra Netra backend contract

Audited from the read-only `/backend` FastAPI implementation. The confirmed development base URL is `http://localhost:8000`; every query route is available both at the root and beneath `/api/v1`. The frontend uses `/api/v1`.

## Confirmed endpoints

### `GET /api/v1/health`

Response: `{ "status": "ok", "database": "reachable" }`. Returns HTTP 503 with a FastAPI `detail` when TimescaleDB cannot be reached.

### `GET /api/v1/nearby`

Query: required `lat`, `lon`; optional `radius_km` (default 5, maximum 200), `start`, `end`, and `limit` (default 200, maximum 1000).

Response: `query_lat`, `query_lon`, `radius_km`, `cell_count_searched`, and `results[]`. Each result contains `mmsi`, `lat`, `lon`, nullable `speed_kn` and `heading_deg`, nullable `h3_index`, and `ts`.

### `GET /api/v1/environmental/nearby`

Alias: `/api/v1/ocean/nearby`. Query parameters match `/nearby`; radius defaults to 25 km.

Response metadata matches `/nearby`. Each result contains `lat`, `lon`, nullable `current_speed_ms`, `current_dir_deg`, `wind_speed_ms`, `wind_dir_deg`, nullable `h3_index`, and `ts`.

### `GET /api/v1/spills/{spill_id}/nearby-vessels`

`spill_id` must be a UUID. Optional `start`, `end`, and `limit`. Response contains `spill_id`, `window_start`, `window_end`, `vessel_count`, and `vessels[]` using the AIS ping shape. Returns 404 for an unknown spill.

### `GET /api/v1/spills` and `GET /api/v1/spills/{spill_id}`

Read-only operational endpoints added for the frontend. The list accepts `limit` (1–500) and returns stored spill UUID, confidence, area, centroid, and timestamp. The detail endpoint returns the same shape for one UUID. These values come directly from `spill_detections` in TimescaleDB.

## Backend-derived non-HTTP contracts

- Layer 4 accepts `detection_time_utc`, a `[lon, lat]` spill polygon, optional oil type and estimated mass. Its origin result includes `origin_point`, `estimated_origin_time`, `searched_back_from`, and `uncertainty_km`.
- Layer 5 currently writes `ranked_suspects_output.json`; it is not exposed by FastAPI. Entries contain MMSI, vessel name, composite score, dead-reckoning/orientation breakdown, dark-AIS anomaly, and ghost-path segments.

## Integration boundary

Demo mode uses spill, health, AIS-nearby, and environmental-nearby endpoints with timeout, cancellation, HTTP error mapping, and Zod schema validation. “Run analysis” correlates the selected stored spill against AIS and environmental records in its ±12-hour window and presents returned sample counts and environmental means. Raster imagery, case persistence, model runs, and Layer 5 attribution are not exposed over HTTP and remain explicitly identified as unavailable or mock-only.
