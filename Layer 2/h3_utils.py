"""
h3_utils.py - wraps h3-py v4 so the rest of the codebase never touches the
h3 library directly.

Pure functions: give lat/lon or a polygon, get H3 cell IDs back.
Uses the INT api (h3.api.basic_int) everywhere, not the hex string api,
so cell IDs are standard 64-bit Python ints that map cleanly to PostgreSQL BIGINT.
"""

import math
from typing import Sequence

import h3.api.basic_int as h3

from config import settings


def encode_point(lat: float, lon: float, resolution: int | None = None) -> int:
    """Single lat/lon -> one H3 cell ID (int). Used for AIS pings and ocean readings."""
    res = resolution if resolution is not None else settings.h3_resolution
    return h3.latlng_to_cell(lat, lon, res)


def encode_polygon(ring_lat_lon: Sequence[Sequence[float]], resolution: int | None = None) -> list[int]:
    """
    A polygon's outer ring (list of (lat, lon) vertices) -> every H3 cell
    it touches, at a single uniform resolution.

    Used for spill polygons: each returned cell becomes one row in spill_hex_coverage.
    """
    res = resolution if resolution is not None else settings.h3_resolution
    # Ensure format is tuple/list pairs
    formatted_ring = [(float(p[0]), float(p[1])) for p in ring_lat_lon]
    poly = h3.LatLngPoly(formatted_ring)
    cells = h3.polygon_to_cells(poly, res)
    return list(cells)


def cells_in_radius(lat: float, lon: float, radius_km: float, resolution: int | None = None) -> list[int]:
    """
    Every H3 cell within roughly radius_km of (lat, lon), via a k-ring
    (grid_disk) around the center cell.

    Approximates a circular candidate area using H3 hexagons. Center-to-center
    spacing is edge_length * sqrt(3).
    """
    res = resolution if resolution is not None else settings.h3_resolution
    center = h3.latlng_to_cell(lat, lon, res)
    edge_km = h3.average_hexagon_edge_length(res, unit="km")
    step_km = edge_km * math.sqrt(3)
    k = max(1, math.ceil(radius_km / step_km))
    return list(h3.grid_disk(center, k))


def great_circle_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Exact distance in km, for precise filtering after candidate fetching."""
    return h3.great_circle_distance((lat1, lon1), (lat2, lon2), unit="km")


def cell_to_center(cell: int) -> tuple[float, float]:
    """H3 cell ID -> its center (lat, lon)."""
    return h3.cell_to_latlng(cell)


def is_valid_cell(cell: int) -> bool:
    """Checks if the given int is a valid H3 cell index."""
    return h3.is_valid_cell(cell)
