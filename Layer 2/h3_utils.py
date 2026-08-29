"""
h3_utils.py - wraps h3-py v4 so the rest of the codebase never touches the
h3 library directly.

Pure functions only: give lat/lon or a polygon, get H3 cell IDs back.
No DB, no Redis, no config dependency beyond H3_RESOLUTION. This means it
can be tested completely standalone (see test_pipeline.py).

Uses the INT api (h3.api.basic_int) everywhere, not the default string
api, so cell IDs come out as Python ints and store directly in a
Postgres BIGINT column - smaller and faster to index than the hex-string
form ("8842c680b1fffff"). Verified H3 res 0-15 cell IDs fit safely inside
signed BIGINT (max observed bit_length is 60, BIGINT holds 63).
"""

import math

import h3.api.basic_int as h3

from config import settings


def encode_point(lat: float, lon: float, resolution: int | None = None) -> int:
    """Single lat/lon -> one H3 cell ID (int). Used for AIS pings and ocean readings."""
    res = resolution if resolution is not None else settings.h3_resolution
    return h3.latlng_to_cell(lat, lon, res)


def encode_polygon(ring_lat_lon: list[tuple[float, float]], resolution: int | None = None) -> list[int]:
    """
    A polygon's outer ring (list of (lat, lon) vertices) -> every H3 cell
    it touches, at a SINGLE uniform resolution (deliberately NOT compacted
    to mixed parent/child resolutions - see note below).

    Used for spill polygons: each returned cell becomes one row in
    spill_hex_coverage.
    """
    res = resolution if resolution is not None else settings.h3_resolution
    poly = h3.LatLngPoly(ring_lat_lon)
    cells = h3.polygon_to_cells(poly, res)
    return list(cells)

    # NOTE on compact_cells(): h3 offers compact_cells() to collapse a big
    # uniform-resolution cell set into fewer cells at mixed resolutions
    # (huge storage savings for very large polygons). We deliberately do
    # NOT use it here: spill_hex_coverage is joined directly against
    # ais_pings.h3_index at a fixed resolution, and a mixed-resolution
    # cell set would need parent/child walking to join correctly. For
    # hackathon-scale spill polygons (tens to low hundreds of cells) the
    # simplicity of a flat join is worth more than the storage saving.


def cells_in_radius(lat: float, lon: float, radius_km: float, resolution: int | None = None) -> list[int]:
    """
    Every H3 cell within roughly radius_km of (lat, lon), via a k-ring
    (grid_disk) around the center cell.

    This is a hex-shaped approximation of a circle, not an exact circle -
    it will over-include some cells near the radius edge. That's
    intentional: this feeds a CANDIDATE search (per the main plan, Layer 5
    does precise dead-reckoning/heading scoring afterwards), so
    over-fetching a few extra candidates is far cheaper than a missed
    vessel from under-fetching. Use great_circle_distance_km() below if a
    caller needs the exact distance to filter further.
    """
    res = resolution if resolution is not None else settings.h3_resolution
    center = h3.latlng_to_cell(lat, lon, res)
    edge_km = h3.average_hexagon_edge_length(res, unit="km")
    # Center-to-center spacing between adjacent H3 cells is edge_length * sqrt(3),
    # NOT edge_length itself. Verified empirically at res 8: using raw edge_km
    # here under-counts the step size by ~1.73x, which made k (and therefore the
    # candidate cell count) roughly 3x too large - e.g. 331 cells instead of 127
    # for a 5km radius. This was caught by measuring actual grid_disk() distances
    # against the target radius before shipping.
    step_km = edge_km * math.sqrt(3)
    k = max(1, math.ceil(radius_km / step_km))
    return list(h3.grid_disk(center, k))


def great_circle_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Exact distance in km, for precise filtering after a cells_in_radius candidate fetch."""
    return h3.great_circle_distance((lat1, lon1), (lat2, lon2), unit="km")


def cell_to_center(cell: int) -> tuple[float, float]:
    """H3 cell ID -> its center (lat, lon). Handy for debugging/visualization."""
    return h3.cell_to_latlng(cell)


def is_valid_cell(cell: int) -> bool:
    return h3.is_valid_cell(cell)
