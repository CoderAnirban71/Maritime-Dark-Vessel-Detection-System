import { afterEach, describe, expect, it, vi } from "vitest";
import { demoServices } from "./index";

describe("Samudra Netra API adapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("validates health and reports database connectivity", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: "ok", database: "reachable" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );
    await expect(demoServices.models.health()).resolves.toMatchObject({
      ok: true,
      message: "API + TimescaleDB reachable",
    });
  });
  it("groups nearby AIS pings into a backend-sourced vessel track", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query_lat: 22.47,
            query_lon: 69.06,
            radius_km: 25,
            cell_count_searched: 10,
            results: [
              {
                mmsi: 419001234,
                lat: 22.45,
                lon: 69.05,
                speed_kn: 12,
                heading_deg: 48,
                h3_index: 123,
                ts: "2026-04-10T12:00:00Z",
              },
              {
                mmsi: 419001234,
                lat: 22.52,
                lon: 69.12,
                speed_kn: 12,
                heading_deg: 44,
                h3_index: 124,
                ts: "2026-04-10T16:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await demoServices.ais.list();
    expect(result.source).toBe("demo");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.track).toHaveLength(2);
    expect(result.data[0]?.mmsi).toBe("419001234");
  });
  it("rejects malformed backend responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ results: "wrong" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(demoServices.ais.list()).rejects.toThrow(
      "unexpected response shape",
    );
  });
  it("maps stored spill detections into operational incidents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                spill_id: "8dde8d50-0b41-4a17-a97b-7f5103f73ca0",
                confidence: 0.91,
                area_km2: 4.7,
                centroid_lat: 21.614,
                centroid_lon: 69.3575,
                ts: "2026-08-20T03:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await demoServices.incidents.list();
    expect(result.source).toBe("demo");
    expect(result.data[0]).toMatchObject({
      id: "8dde8d50-0b41-4a17-a97b-7f5103f73ca0",
      simulated: false,
      severity: "critical",
    });
  });
  it("maps the real SAFE scene and quick-look URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                id: "S1A_REAL_SCENE",
                sensor: "SAR",
                product_type: "GRD",
                acquired_at: "2017-01-29T00:31:32Z",
                orbit: "15039",
                pass: "Descending",
                polarizations: ["VV", "VH"],
                footprint: [
                  { lat: 11.88, lon: 80.49 },
                  { lat: 13.4, lon: 80.81 },
                  { lat: 13.84, lon: 78.51 },
                ],
                quicklook_url: "/api/v1/scenes/S1A_REAL_SCENE/quicklook",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await demoServices.imagery.list("spill-id");
    expect(result.data[0]).toMatchObject({
      id: "S1A_REAL_SCENE",
      productType: "GRD",
      polarizations: ["VV", "VH"],
      previewUrl:
        "http://localhost:8000/api/v1/scenes/S1A_REAL_SCENE/quicklook",
    });
  });
  it("validates the backend asset inventory", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                id: "ennore-ais-2017",
                name: "Ennore AIS vessel tracks",
                kind: "ais",
                format: "CSV",
                records: 6545,
                entities: 49,
                bytes: 523892,
                status: "available",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await demoServices.models.datasets();
    expect(result.data[0]).toMatchObject({ records: 6545, entities: 49 });
  });
});
