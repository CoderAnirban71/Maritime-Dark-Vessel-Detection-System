"""Smoke-test file-backed data discovery without requiring PostgreSQL.

Testing the catalog directly keeps this check independent of the ASGI lifespan
and therefore useful on a cold machine where PostgreSQL is intentionally down.
HTTP routing is covered by the documented curl smoke checks.
"""

from data_catalog import ais_records, datasets, model_assets, quicklook_path, scene_record


def main() -> None:
    assets = datasets()
    assert {item["id"] for item in assets} >= {
        "sentinel-1-safe",
        "ennore-ais-2017",
        "cmems-currents",
        "era5-wind",
        "unet-resnet34",
    }

    scene = scene_record()
    assert scene["polarizations"] == ["VV", "VH"]
    preview = quicklook_path(scene["id"])
    assert preview.suffix.lower() == ".png" and preview.stat().st_size > 0

    records = ais_records()
    assert len(records) == 6545
    assert len({item["mmsi"] for item in records}) == 49
    assert all(item["vessel_name"] for item in records)

    models = model_assets()
    assert models[0]["status"] == "success"

    print("Static API smoke test passed: assets, scene, quick-look, 6,545 AIS rows, model.")


if __name__ == "__main__":
    main()
