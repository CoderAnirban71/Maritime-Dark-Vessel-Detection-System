"""
SAMUDRA-NETRA - Layer 3 Inference Pipeline
Input : Raw Sentinel-1 SAFE product (VV + VH GeoTIFFs)
Output: Oil spill polygon(s) with lat/lon coordinates + confidence + timestamp

Steps:
  1. Calibration      - convert raw digital numbers to Sigma0 dB (matches training data format)
  2. Tiling           - split the large scene into model-sized patches
  3. Inference        - run the trained U-Net on each patch
  4. Stitching        - merge patch predictions back into a full mask
  5. Polygon export   - extract oil spill shape(s) with georeferencing
"""

import os
import json
import time
import asyncio
import re
import uuid
from datetime import datetime, timezone
import numpy as np
import xml.etree.ElementTree as ET
import rasterio
from rasterio.windows import Window
import torch
import segmentation_models_pytorch as smp
import cv2
import asyncpg
import h3.api.basic_int as h3

# ============================================================
# CONFIG
# ============================================================
SAFE_DIR = r"C:\Users\anirb\Desktop\SIH Project\Maritime-Dark-Vessel-Detection-System\Data\Demo 1\S1A_IW_GRDH_1SDV_20170129T003132_20170129T003157_015039_01892E_6D04.SAFE"

VV_TIF = os.path.join(SAFE_DIR, "measurement", "s1a-iw-grd-vv-20170129t003132-20170129t003157-015039-01892e-001.tiff")
VH_TIF = os.path.join(SAFE_DIR, "measurement", "s1a-iw-grd-vh-20170129t003132-20170129t003157-015039-01892e-002.tiff")
VV_CAL = os.path.join(SAFE_DIR, "annotation", "calibration", "calibration-s1a-iw-grd-vv-20170129t003132-20170129t003157-015039-01892e-001.xml")
VH_CAL = os.path.join(SAFE_DIR, "annotation", "calibration", "calibration-s1a-iw-grd-vh-20170129t003132-20170129t003157-015039-01892e-002.xml")

MODEL_PATH = r"C:\Users\anirb\Desktop\SIH Project\Maritime-Dark-Vessel-Detection-System\AI_Model\ML_Output\best_unet_v2.pth"

OUTPUT_JSON = r"C:\Users\anirb\Desktop\SIH Project\Maritime-Dark-Vessel-Detection-System\AI_Model\ML_Output\layer3_output.json"

TILE_SIZE = 512
OVERLAP   = 64          # overlap between tiles to avoid edge artifacts
THRESHOLD = 0.5          # sigmoid threshold for oil vs sea

# Database (read directly - no import from layer_2_new needed)
DATABASE_URL = "postgresql://postgres:Data1234@localhost:5432/samudra_netra"
H3_RESOLUTION = 8

# Rough thickness assumption (meters) and crude oil density (kg/m3),
# used only to turn a pixel area into a plausible starting mass for
# the Layer 4 simulation.
ASSUMED_THICKNESS_M = 0.0001
OIL_DENSITY_KG_M3   = 900
PIXEL_SIZE_M        = 10   # Sentinel-1 GRD ground range pixel spacing (approx)

_SPILL_ID_NAMESPACE = uuid.UUID("6f1c6e9e-0b1a-4a7a-9c2e-5b7a6f0d1a2b")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# STEP 1: CALIBRATION (raw DN -> Sigma0 dB)
# ============================================================
def build_calibration_arrays(cal_xml_path):
    """Parse calibration XML and return raw arrays needed for
    fast separable interpolation (see calibrate_full_band)."""
    tree = ET.parse(cal_xml_path)
    root = tree.getroot()

    lines, pixels_ref, sigma_rows = [], None, []
    for vec in root.find("calibrationVectorList").findall("calibrationVector"):
        line = int(vec.find("line").text)
        pixel = [int(x) for x in vec.find("pixel").text.split()]
        sigma = [float(x) for x in vec.find("sigmaNought").text.split()]
        lines.append(line)
        if pixels_ref is None:
            pixels_ref = pixel
        sigma_rows.append(sigma)

    return np.array(lines), np.array(pixels_ref), np.array(sigma_rows)


def calibrate_full_band(tif_path, interp, lines, pixels_ref, sigma_grid):
    """
    Calibrate an entire band in one vectorized pass instead of per-tile.
    Uses separable interpolation (line-axis, then pixel-axis) which is
    far cheaper than querying the full 2D interpolator per pixel.
    """
    from scipy.interpolate import interp1d

    with rasterio.open(tif_path) as ds:
        dn = ds.read(1).astype(np.float32)
        height, width = ds.height, ds.width

    row_idx = np.arange(height)
    col_idx = np.arange(width)

    # Step 1: interpolate along the line axis at the reference pixel columns
    line_interp = interp1d(lines, sigma_grid, axis=0,
                            bounds_error=False, fill_value="extrapolate")
    sigma_at_rows = line_interp(row_idx)          # (height, n_pixels_ref)

    # Step 2: interpolate along the pixel axis to reach full scene width
    pixel_interp = interp1d(pixels_ref, sigma_at_rows, axis=1,
                             bounds_error=False, fill_value="extrapolate")
    cal_full = pixel_interp(col_idx).astype(np.float32)   # (height, width)

    sigma0_linear = (dn ** 2) / (cal_full ** 2 + 1e-12)
    sigma0_db = 10 * np.log10(sigma0_linear + 1e-12)
    return sigma0_db.astype(np.float32), dn


# ============================================================
# STEP 2 + 3 + 4: TILING, INFERENCE, STITCHING
# ============================================================
def load_model(model_path):
    model = smp.Unet(
        encoder_name="resnet34", encoder_weights=None,
        in_channels=2, classes=1, activation=None
    )
    ckpt = torch.load(model_path, map_location=DEVICE)
    model.load_state_dict(ckpt["model_state"])
    model.to(DEVICE)
    model.eval()
    print(f"Model loaded (trained epoch {ckpt.get('epoch','?')}, "
          f"val IoU {ckpt.get('val_iou','?')})")
    return model


def normalize_tile(vv_db, vh_db):
    """Per-channel normalization, same as training (CPU fallback, unused in fast path)"""
    def norm(ch):
        return (ch - ch.mean()) / (ch.std() + 1e-6)
    return np.stack([norm(vv_db), norm(vh_db)], axis=0)  # (2, H, W)


def run_full_scene_inference(vv_sigma0, vh_sigma0, model,
                              tile_size=512, overlap=64, batch_size=16):
    """
    Runs inference over a full, already-calibrated scene using
    batched GPU inference. Normalization is done on the GPU (torch),
    not with per-tile numpy in a Python loop, to keep the CPU from
    becoming the bottleneck.
    """
    height, width = vv_sigma0.shape
    print(f"Full scene: {width} x {height}")

    stride = tile_size - overlap
    prob_map   = np.zeros((height, width), dtype=np.float32)
    weight_map = np.zeros((height, width), dtype=np.float32)

    rows = list(range(0, height, stride))
    cols = list(range(0, width, stride))

    # Build list of tile bounds, skipping empty tiles up front
    tile_bounds = []
    for r in rows:
        r_end = min(r + tile_size, height)
        r_start = max(0, r_end - tile_size)
        for c in cols:
            c_end = min(c + tile_size, width)
            c_start = max(0, c_end - tile_size)
            if vv_sigma0[r_start:r_end, c_start:c_end].max() > -100:  # not pure no-data
                tile_bounds.append((r_start, r_end, c_start, c_end))

    total_tiles = len(tile_bounds)
    print(f"Tiles to process (non-empty): {total_tiles}")

    with torch.no_grad():
        for i in range(0, total_tiles, batch_size):
            batch_bounds = tile_bounds[i:i + batch_size]

            # Stack raw (un-normalized) tiles - cheap numpy slicing only
            vv_stack = np.stack([vv_sigma0[r0:r1, c0:c1] for (r0, r1, c0, c1) in batch_bounds])
            vh_stack = np.stack([vh_sigma0[r0:r1, c0:c1] for (r0, r1, c0, c1) in batch_bounds])
            raw = np.stack([vv_stack, vh_stack], axis=1)  # (B, 2, H, W)

            batch = torch.from_numpy(raw).float().to(DEVICE)

            # Per-channel, per-sample normalization done on the GPU
            mean = batch.mean(dim=(2, 3), keepdim=True)
            std  = batch.std(dim=(2, 3), keepdim=True) + 1e-6
            batch = (batch - mean) / std

            preds = torch.sigmoid(model(batch)).squeeze(1).cpu().numpy()

            for pred_np, (r_start, r_end, c_start, c_end) in zip(preds, batch_bounds):
                prob_map[r_start:r_end, c_start:c_end] += pred_np
                weight_map[r_start:r_end, c_start:c_end] += 1.0

            done = min(i + batch_size, total_tiles)
            print(f"  Tiles processed: {done}/{total_tiles}")

    weight_map[weight_map == 0] = 1.0
    prob_map = prob_map / weight_map
    return prob_map, width, height


# ============================================================
# STEP 5: POLYGON EXTRACTION + GEOREFERENCING
# ============================================================
def extract_polygons(prob_map, threshold, vv_tif, min_area_px=200):
    """Threshold probability map, clean up, and extract contours as polygons.
    Uses the SAFE product's Ground Control Points (GCPs) for pixel -> lon/lat
    conversion, since raw Sentinel-1 GRD GeoTIFFs have no simple affine
    geotransform - only a sparse GCP grid (like the calibration vectors)."""
    from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator

    binary_mask = (prob_map > threshold).astype(np.uint8) * 255

    kernel = np.ones((5, 5), np.uint8)
    binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel)
    binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)

    ds = rasterio.open(vv_tif)
    gcps, gcp_crs = ds.gcps
    projection = gcp_crs if gcp_crs is not None else ds.crs
    ds.close()

    if not gcps:
        raise RuntimeError(
            "No GCPs found in the GeoTIFF and no standard geotransform either - "
            "cannot georeference this product."
        )

    gcp_px = np.array([[g.col, g.row] for g in gcps])
    gcp_lon = np.array([g.x for g in gcps])
    gcp_lat = np.array([g.y for g in gcps])

    # Linear interpolation inside the GCP grid, nearest-neighbor fallback
    # for points slightly outside the convex hull (edges of the scene).
    lon_interp_lin = LinearNDInterpolator(gcp_px, gcp_lon)
    lat_interp_lin = LinearNDInterpolator(gcp_px, gcp_lat)
    lon_interp_nn  = NearestNDInterpolator(gcp_px, gcp_lon)
    lat_interp_nn  = NearestNDInterpolator(gcp_px, gcp_lat)

    def pixel_to_geo(px, py):
        pt = np.array([[px, py]])
        lon = lon_interp_lin(pt)[0]
        lat = lat_interp_lin(pt)[0]
        if np.isnan(lon) or np.isnan(lat):
            lon = lon_interp_nn(pt)[0]
            lat = lat_interp_nn(pt)[0]
        return float(lon), float(lat)

    geotransform = None  # not applicable for GCP-based products

    polygons = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area_px:
            continue

        # mean confidence inside this contour
        mask_i = np.zeros(binary_mask.shape, dtype=np.uint8)
        cv2.drawContours(mask_i, [cnt], -1, 255, -1)
        confidence = float(prob_map[mask_i == 255].mean())

        coords = []
        for pt in cnt.reshape(-1, 2):
            px, py = int(pt[0]), int(pt[1])
            gx, gy = pixel_to_geo(px, py)
            coords.append((gx, gy))

        polygons.append({
            "coordinates": coords,
            "area_px": float(area),
            "confidence": confidence,
        })

    print(f"Found {len(polygons)} oil spill region(s) "
          f"(area >= {min_area_px}px)")
    return polygons, geotransform, projection


# ============================================================
# DATABASE WRITE (self-contained - no import from layer_2_new)
# ============================================================
def extract_detection_time(safe_dir_path):
    """SAFE folder names embed the acquisition time, e.g.
    S1A_IW_GRDH_1SDV_20170129T003132_..._6D04.SAFE"""
    folder_name = os.path.basename(safe_dir_path.rstrip("\\/"))
    match = re.search(r"_(\d{8}T\d{6})_", folder_name)
    if not match:
        raise ValueError(f"No timestamp found in SAFE folder name: {folder_name}")
    raw = match.group(1)
    return datetime(
        int(raw[0:4]), int(raw[4:6]), int(raw[6:8]),
        int(raw[9:11]), int(raw[11:13]), int(raw[13:15]),
        tzinfo=timezone.utc,
    )


def pick_best_polygon(polygons):
    """Highest confidence first, largest area as tiebreaker."""
    if not polygons:
        raise ValueError("No polygons to store")
    return max(polygons, key=lambda p: (p["confidence"], p["area_px"]))


def estimate_mass_kg(area_px):
    area_m2 = area_px * (PIXEL_SIZE_M ** 2)
    volume_m3 = area_m2 * ASSUMED_THICKNESS_M
    return round(volume_m3 * OIL_DENSITY_KG_M3, 1)


async def write_spill_to_db(safe_dir, polygons):
    """Writes the best-confidence spill straight into spill_detections /
    spill_hex_coverage. Fully self-contained: opens its own asyncpg
    connection, does its own H3 encoding, no imports from layer_2_new."""
    detection_time = extract_detection_time(safe_dir)
    best = pick_best_polygon(polygons)

    coords_lonlat = best["coordinates"]                    # [(lon, lat), ...]
    coords_latlon = [(lat, lon) for lon, lat in coords_lonlat]

    lons = [c[0] for c in coords_lonlat]
    lats = [c[1] for c in coords_lonlat]
    centroid_lon = sum(lons) / len(lons)
    centroid_lat = sum(lats) / len(lats)

    area_km2 = (best["area_px"] * (PIXEL_SIZE_M ** 2)) / 1_000_000
    oil_type = "GENERIC MEDIUM CRUDE"
    mass_kg = estimate_mass_kg(best["area_px"])

    formatted_ring = [(float(lat), float(lon)) for lat, lon in coords_latlon]
    poly = h3.LatLngPoly(formatted_ring)
    hex_cells = list(h3.polygon_to_cells(poly, H3_RESOLUTION))

    spill_id = uuid.uuid5(
        _SPILL_ID_NAMESPACE,
        f"{detection_time.isoformat()}|{best['confidence']}|{centroid_lat}|{centroid_lon}",
    )

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO spill_detections
                    (spill_id, confidence, area_km2, centroid_lat, centroid_lon,
                     ts, polygon_geojson, oil_type, estimated_mass_kg)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
                ON CONFLICT (spill_id) DO UPDATE SET
                    polygon_geojson = EXCLUDED.polygon_geojson,
                    oil_type = EXCLUDED.oil_type,
                    estimated_mass_kg = EXCLUDED.estimated_mass_kg
                """,
                spill_id, best["confidence"], area_km2, centroid_lat, centroid_lon,
                detection_time, json.dumps(coords_lonlat), oil_type, mass_kg,
            )
            if hex_cells:
                await conn.executemany(
                    """
                    INSERT INTO spill_hex_coverage (spill_id, h3_index, ts)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (spill_id, h3_index) DO NOTHING
                    """,
                    [(spill_id, cell, detection_time) for cell in hex_cells],
                )
    finally:
        await conn.close()

    print("=" * 60)
    print("  Layer 3 -> Database (Layer-4-ready row)")
    print("=" * 60)
    print(f"  spill_id           : {spill_id}")
    print(f"  detection_time     : {detection_time.isoformat()}")
    print(f"  confidence         : {best['confidence']:.3f}")
    print(f"  area_km2           : {area_km2:.4f}")
    print(f"  centroid           : ({centroid_lat:.5f}, {centroid_lon:.5f})")
    print(f"  oil_type           : {oil_type}")
    print(f"  estimated_mass_kg  : {mass_kg}")
    print(f"  hex cells          : {len(hex_cells)}")
    print(f"  polygon points     : {len(coords_lonlat)}")
    print("=" * 60)
    return spill_id


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    t0 = time.time()

    print("=" * 60)
    print("  SAMUDRA-NETRA Layer 3 - Inference Pipeline")
    print("=" * 60)

    print("\n[1/5] Loading calibration tables...")
    vv_lines, vv_pixels, vv_sigma_grid = build_calibration_arrays(VV_CAL)
    vh_lines, vh_pixels, vh_sigma_grid = build_calibration_arrays(VH_CAL)
    print(f"  Done in {time.time()-t0:.1f}s")

    print("\n[2/5] Loading trained model...")
    model = load_model(MODEL_PATH)

    print("\n[3/5] Calibrating full scene (vectorized)...")
    t1 = time.time()
    vv_sigma0, _ = calibrate_full_band(VV_TIF, None, vv_lines, vv_pixels, vv_sigma_grid)
    vh_sigma0, _ = calibrate_full_band(VH_TIF, None, vh_lines, vh_pixels, vh_sigma_grid)
    print(f"  Calibration done in {time.time()-t1:.1f}s")

    print("\n[4/5] Running batched tiled inference over full scene...")
    t2 = time.time()
    prob_map, width, height = run_full_scene_inference(
        vv_sigma0, vh_sigma0, model,
        tile_size=TILE_SIZE, overlap=OVERLAP, batch_size=16
    )
    print(f"  Inference done in {time.time()-t2:.1f}s")

    print("\n[5/5] Extracting oil spill polygons...")
    polygons, geotransform, projection = extract_polygons(
        prob_map, THRESHOLD, VV_TIF
    )

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    for i, poly in enumerate(polygons, 1):
        print(f"  Polygon {i}: area={poly['area_px']:.0f}px, "
              f"confidence={poly['confidence']:.3f}, "
              f"points={len(poly['coordinates'])}")

    # Save results to JSON for Layer 4
    output = {
        "safe_dir": SAFE_DIR,
        "scene_width": width,
        "scene_height": height,
        "crs": str(projection),
        "georeferencing_method": "GCP-based (Linear + Nearest fallback)",
        "threshold": THRESHOLD,
        "num_polygons": len(polygons),
        "polygons": polygons,
    }
    with open(OUTPUT_JSON, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved results to: {OUTPUT_JSON}")

    # ---- Also write the best-confidence spill directly to the database ----
    spill_id = None
    try:
        print("\n[DB] Writing spill to database...")
        spill_id = asyncio.run(write_spill_to_db(SAFE_DIR, polygons))
    except Exception as e:
        print(f"\n[DB] Skipped database write: {e}")
        print("[DB] (JSON file was still saved above, so nothing is lost)")

    print(f"\nTotal pipeline time: {time.time()-t0:.1f}s")
    print("Done!")