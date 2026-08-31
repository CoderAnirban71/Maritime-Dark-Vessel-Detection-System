import { calculateCandidate } from "../features/attribution/scoring";
import { caseRepository } from "./repository";
import {
  cases as seedCases,
  drift,
  incidents,
  runs,
  scenes,
  vessels,
} from "../mocks/fixtures";
import type { Services } from "./contracts";
import type {
  AISVessel,
  CaseRecord,
  DriftSnapshot,
  ModelRun,
  OilSpillIncident,
} from "../types/domain";
import { z } from "zod";
const pause = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const sourced = <T>(data: T) => ({ source: "mock" as const, data });
let localRuns = [...runs];
let localCases: CaseRecord[] | undefined;
export const mockServices: Services = {
  incidents: {
    async list() {
      await pause();
      return sourced(incidents);
    },
    async get(id) {
      await pause();
      const item = incidents.find((x) => x.id === id);
      if (!item) throw new Error("Incident not found");
      return sourced(item);
    },
  },
  imagery: {
    async list(id) {
      await pause();
      return sourced(scenes.filter((x) => x.incidentId === id));
    },
    async run(id) {
      await pause(700);
      const run: ModelRun = {
        id: `RUN-${Date.now()}`,
        incidentId: id,
        model: "SlickSeg-Net",
        version: "2.4.1",
        startedAt: new Date().toISOString(),
        durationMs: 18700,
        status: "success",
        confidence: 0.92,
        source: "mock",
      };
      localRuns = [run, ...localRuns];
      return sourced(run);
    },
  },
  drift: {
    async list(id) {
      await pause();
      return sourced(drift.map((x) => ({ ...x, incidentId: id })));
    },
  },
  ais: {
    async list() {
      await pause();
      return sourced(vessels);
    },
  },
  attribution: {
    async rank(id) {
      await pause();
      return sourced(
        vessels
          .map((v, i) => calculateCandidate(v, i, id))
          .sort((a, b) => b.score - a.score),
      );
    },
  },
  cases: {
    async list() {
      await pause();
      localCases ??= caseRepository.load(seedCases);
      return sourced(localCases);
    },
    async save(value) {
      localCases ??= caseRepository.load(seedCases);
      localCases = [value, ...localCases.filter((x) => x.id !== value.id)];
      caseRepository.save(localCases);
      return sourced(value);
    },
  },
  models: {
    async runs() {
      await pause();
      return sourced(localRuns);
    },
    async datasets() {
      await pause();
      return sourced([
        {
          id: "mock-fixtures",
          name: "Deterministic demonstration fixtures",
          kind: "synthetic",
          format: "TypeScript",
          records: incidents.length + vessels.length,
          bytes: 0,
          status: "available" as const,
        },
      ]);
    },
    async health() {
      return { ok: true, message: "Synthetic services ready", latencyMs: 18 };
    },
  },
};
const unavailable = () =>
  Promise.reject(
    new Error(
      "This resource is not exposed by the Samudra Netra backend. Switch to Mock data for this workflow.",
    ),
  );

const aisPingSchema = z.object({
  mmsi: z.number().int(),
  lat: z.number(),
  lon: z.number(),
  speed_kn: z.number().nullable(),
  heading_deg: z.number().nullable(),
  h3_index: z.number().nullable().optional(),
  ts: z.string(),
  vessel_name: z.string().nullable().optional(),
  vessel_type: z.string().nullable().optional(),
});
const nearbySchema = z.object({
  query_lat: z.number(),
  query_lon: z.number(),
  radius_km: z.number(),
  cell_count_searched: z.number().int(),
  results: z.array(aisPingSchema),
});
const oceanSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  current_speed_ms: z.number().nullable(),
  current_dir_deg: z.number().nullable(),
  wind_speed_ms: z.number().nullable(),
  wind_dir_deg: z.number().nullable(),
  h3_index: z.number().nullable().optional(),
  ts: z.string(),
});
const environmentalSchema = z.object({
  query_lat: z.number(),
  query_lon: z.number(),
  radius_km: z.number(),
  cell_count_searched: z.number().int(),
  results: z.array(oceanSchema),
});
const healthSchema = z.object({ status: z.string(), database: z.string() });
const spillSchema = z.object({
  spill_id: z.string().uuid(),
  confidence: z.number().nullable(),
  area_km2: z.number().nullable(),
  centroid_lat: z.number().nullable(),
  centroid_lon: z.number().nullable(),
  ts: z.string(),
  polygon_geojson: z.array(z.array(z.number())).nullable().optional(),
  oil_type: z.string().nullable().optional(),
  estimated_mass_kg: z.number().nullable().optional(),
});
const spillListSchema = z.object({
  results: z.array(spillSchema),
  count: z.number().int(),
});
const sceneListSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      sensor: z.literal("SAR"),
      product_type: z.string(),
      acquired_at: z.string(),
      orbit: z.string(),
      pass: z.enum(["Ascending", "Descending"]),
      polarizations: z.array(z.string()),
      footprint: z.array(z.object({ lat: z.number(), lon: z.number() })),
      quicklook_url: z.string(),
    }),
  ),
});
const attributionSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      incident_id: z.string(),
      vessel_id: z.string(),
      score: z.number(),
      closest_approach_km: z.number(),
      time_offset_hours: z.number(),
      breakdown: z.object({
        proximity: z.number(),
        temporal: z.number(),
        trajectory: z.number(),
        anomaly: z.number(),
        data_quality: z.number(),
        environmental: z.number(),
        penalty: z.number(),
      }),
      flags: z.array(z.string()),
      evidence_status: z.enum(["requires review", "insufficient", "reviewed"]),
    }),
  ),
});
const modelListSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      model: z.string(),
      version: z.string(),
      started_at: z.string(),
      duration_ms: z.number(),
      status: z.enum(["success", "running", "failed"]),
      source: z.literal("demo"),
    }),
  ),
});
const datasetListSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      format: z.string(),
      records: z.number().int().optional(),
      entities: z.number().int().optional(),
      bytes: z.number().int(),
      status: z.enum(["available", "missing"]),
    }),
  ),
});
const analysisJobSchema = z.object({
  job_id: z.string(),
  status: z.enum(["running", "complete", "failed"]),
  progress: z.number(),
  stage: z.string(),
  error: z.string().optional(),
  result: z.object({
    environmental_samples: z.number(),
    vessel_tracks: z.number(),
    mean_current_ms: z.number(),
    mean_wind_ms: z.number(),
  }).optional(),
  completed_at: z.string().optional(),
});
const backendBase = () =>
  localStorage.getItem("samudra-netra:backend-url") ||
  import.meta.env.VITE_DEMO_API_URL ||
  "http://localhost:8000";
async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(12000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${backendBase().replace(/\/$/, "")}${path}`, {
      signal: combined,
    });
  } catch {
    if (combined.aborted)
      throw new Error("Samudra Netra API request timed out or was cancelled");
    throw new Error("Samudra Netra API is unreachable");
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* response was not JSON */
    }
    throw new Error(detail);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("Samudra Netra API returned an unexpected response shape");
  return parsed.data;
}
async function apiPost<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${backendBase().replace(/\/$/, "")}${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `HTTP ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Samudra Netra API returned an unexpected analysis status");
  return parsed.data;
}
const mapAnalysisJob = (job: z.infer<typeof analysisJobSchema>) => ({
  jobId: job.job_id,
  status: job.status,
  progress: job.progress,
  stage: job.stage,
  error: job.error,
  result: job.result && {
    environmentalSamples: job.result.environmental_samples,
    vesselTracks: job.result.vessel_tracks,
    meanCurrentMs: job.result.mean_current_ms,
    meanWindMs: job.result.mean_wind_ms,
  },
  completedAt: job.completed_at,
});
async function backendPoint(id?: string, signal?: AbortSignal) {
  if (id && z.string().uuid().safeParse(id).success) {
    const spill = await apiGet(
      `/api/v1/spills/${encodeURIComponent(id)}`,
      spillSchema,
      signal,
    );
    return {
      lat: spill.centroid_lat ?? 22.47,
      lon: spill.centroid_lon ?? 69.06,
      ts: spill.ts,
    };
  }
  return { lat: 22.47, lon: 69.06, ts: undefined };
}
function backendWindow(ts?: string) {
  if (!ts) return "";
  const center = Date.parse(ts);
  return `&start=${encodeURIComponent(new Date(center - 12 * 3600000).toISOString())}&end=${encodeURIComponent(new Date(center + 12 * 3600000).toISOString())}`;
}
async function backendVessels(id?: string, signal?: AbortSignal) {
  if (!id) {
    const result = await apiGet(
      "/api/v1/ais/dataset?limit=10000",
      nearbySchema,
      signal,
    );
    return groupBackendVessels(result.results);
  }
  const point = await backendPoint(id, signal);
  const result = await apiGet(
    `/api/v1/nearby?lat=${point.lat}&lon=${point.lon}&radius_km=25&limit=1000${backendWindow(point.ts)}`,
    nearbySchema,
    signal,
  );
  return groupBackendVessels(result.results);
}
function groupBackendVessels(pings: z.infer<typeof aisPingSchema>[]) {
  const groups = new Map<number, typeof pings>();
  for (const ping of pings)
    groups.set(ping.mmsi, [...(groups.get(ping.mmsi) ?? []), ping]);
  return [...groups.entries()].map(([mmsi, vesselPings], index): AISVessel => {
    const ordered = [...vesselPings].sort(
      (a, b) => Date.parse(a.ts) - Date.parse(b.ts),
    );
    const latest = ordered.at(-1)!;
    return {
      id: `AIS-${mmsi}`,
      name: latest.vessel_name ?? `Vessel ${mmsi}`,
      imo: "Not provided",
      mmsi: String(mmsi),
      synthetic: false,
      type: latest.vessel_type ?? "Unclassified",
      flag: "Unknown",
      dimensions: "Not provided",
      destination: "Not provided",
      lastUpdate: latest.ts,
      track: ordered.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        at: p.ts,
        speedKn: p.speed_kn ?? 0,
        course: p.heading_deg ?? 0,
        quality: "reported",
      })),
      aisGapHours: ordered
        .slice(1)
        .reduce(
          (max, p, i) =>
            Math.max(
              max,
              (Date.parse(p.ts) - Date.parse(ordered[i]!.ts)) / 3600000,
            ),
          0,
        ),
      loitering: 0,
      identityIssue: false,
      relevance: index < 10 ? "candidate" : "relevant",
    };
  });
}
function backendIncident(spill: z.infer<typeof spillSchema>): OilSpillIncident {
  const lat = spill.centroid_lat ?? 22.47,
    lon = spill.centroid_lon ?? 69.06,
    confidence = spill.confidence ?? 0,
    area = spill.area_km2 ?? 0;
  const severity: OilSpillIncident["severity"] =
    confidence >= 0.9
      ? "critical"
      : confidence >= 0.75
        ? "high"
        : confidence >= 0.55
          ? "medium"
          : "low";
  const outline =
    spill.polygon_geojson
      ?.filter((point) => point.length >= 2)
      .map(([pointLon, pointLat]) => ({ lat: pointLat!, lon: pointLon! })) ??
    [];
  const isEnnore = lat >= 11 && lat <= 15 && lon >= 78 && lon <= 82;
  return {
    id: spill.spill_id,
    simulated: false,
    location: `${isEnnore ? "Ennore coast" : "Indian Ocean"} · ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`,
    region: isEnnore ? "Ennore, Chennai" : "Indian Ocean",
    firstDetected: spill.ts,
    lastObserved: spill.ts,
    sensor: "SAR",
    confidence,
    severity,
    status: "verified",
    assignedAnalyst: "Unassigned",
    estimatedAgeHours: [0, 6],
    driftBearing: 45,
    coastalProximityKm: 5,
    geometry: {
      centroid: { lat, lon },
      areaKm2: area,
      perimeterKm: area > 0 ? Math.sqrt(area) * 4 : 0,
      majorAxisKm: area > 0 ? Math.sqrt(area) * 1.8 : 0,
      minorAxisKm: area > 0 ? Math.sqrt(area) * 0.7 : 0,
      orientationDeg: 45,
      compactness: 0.6,
      shorelineDistanceKm: 5,
      outline:
        outline.length >= 3
          ? outline
          : [
              { lat: lat + 0.02, lon: lon - 0.03 },
              { lat: lat + 0.015, lon: lon + 0.035 },
              { lat: lat - 0.02, lon: lon + 0.025 },
              { lat: lat - 0.015, lon: lon - 0.025 },
            ],
    },
  };
}
export const demoServices: Services = {
  incidents: {
    async list(signal) {
      const result = await apiGet(
        "/api/v1/spills?limit=100",
        spillListSchema,
        signal,
      );
      return { source: "demo", data: result.results.map(backendIncident) };
    },
    async get(id, signal) {
      const result = await apiGet(
        `/api/v1/spills/${encodeURIComponent(id)}`,
        spillSchema,
        signal,
      );
      return { source: "demo", data: backendIncident(result) };
    },
  },
  imagery: {
    async list(id) {
      const result = await apiGet("/api/v1/scenes", sceneListSchema);
      return {
        source: "demo",
        data: result.results.map((scene) => ({
          id: scene.id,
          incidentId: id,
          sensor: scene.sensor,
          acquiredAt: scene.acquired_at,
          orbit: scene.orbit,
          pass: scene.pass,
          state: "ready" as const,
          previewUrl: `${backendBase().replace(/\/$/, "")}${scene.quicklook_url}`,
          footprint: scene.footprint,
          productType: scene.product_type,
          polarizations: scene.polarizations,
        })),
      };
    },
    run: unavailable,
    async startAnalysis(id) {
      return mapAnalysisJob(await apiPost(`/api/v1/analysis/jobs?spill_id=${encodeURIComponent(id)}`, analysisJobSchema));
    },
    async analysisStatus(jobId) {
      return mapAnalysisJob(await apiGet(`/api/v1/analysis/jobs/${encodeURIComponent(jobId)}`, analysisJobSchema));
    },
  },
  drift: {
    async list(id, signal) {
      const point = await backendPoint(id, signal);
      const result = await apiGet(
        `/api/v1/environmental/nearby?lat=${point.lat}&lon=${point.lon}&radius_km=40&limit=1000${backendWindow(point.ts)}`,
        environmentalSchema,
        signal,
      );
      const data: DriftSnapshot[] = result.results.map((r, index) => ({
        id: `ENV-${index}`,
        incidentId: id,
        at: r.ts,
        phase: "observation",
        centroid: { lat: r.lat, lon: r.lon },
        areaKm2: 0,
        uncertaintyKm: result.radius_km,
        vectors: [
          {
            kind: "current",
            speed: r.current_speed_ms ?? 0,
            direction: r.current_dir_deg ?? 0,
            unit: "m/s",
          },
          {
            kind: "wind",
            speed: (r.wind_speed_ms ?? 0) * 1.94384,
            direction: r.wind_dir_deg ?? 0,
            unit: "kn",
          },
        ],
      }));
      return { source: "demo", data };
    },
  },
  ais: {
    async list(id, signal) {
      return { source: "demo", data: await backendVessels(id, signal) };
    },
  },
  attribution: {
    async rank(id) {
      const result = await apiGet(
        `/api/v1/spills/${encodeURIComponent(id)}/attribution`,
        attributionSchema,
      );
      return {
        source: "demo",
        data: result.results.map((candidate) => ({
          id: candidate.id,
          incidentId: candidate.incident_id,
          vesselId: candidate.vessel_id,
          score: candidate.score,
          closestApproachKm: candidate.closest_approach_km,
          timeOffsetHours: candidate.time_offset_hours,
          breakdown: {
            proximity: candidate.breakdown.proximity,
            temporal: candidate.breakdown.temporal,
            trajectory: candidate.breakdown.trajectory,
            anomaly: candidate.breakdown.anomaly,
            dataQuality: candidate.breakdown.data_quality,
            environmental: candidate.breakdown.environmental,
            penalty: candidate.breakdown.penalty,
          },
          flags: candidate.flags,
          evidenceStatus: candidate.evidence_status,
        })),
      };
    },
  },
  // Case records are analyst-owned, versioned browser data until the backend
  // exposes a case-management API. Keep this workflow available in API mode.
  cases: mockServices.cases,
  models: {
    async runs() {
      const result = await apiGet("/api/v1/models", modelListSchema);
      return {
        source: "demo",
        data: result.results.map((run) => ({
          id: run.id,
          model: run.model,
          version: run.version,
          startedAt: run.started_at,
          durationMs: run.duration_ms,
          status: run.status,
          source: run.source,
        })),
      };
    },
    async datasets() {
      const result = await apiGet("/api/v1/datasets", datasetListSchema);
      return { source: "demo", data: result.results };
    },
    async health() {
      const started = performance.now();
      try {
        const response = await apiGet("/api/v1/health", healthSchema);
        return {
          ok: response.status === "ok" && response.database === "reachable",
          message:
            response.database === "reachable"
              ? "API + TimescaleDB reachable"
              : "Database unavailable",
          latencyMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error ? error.message : "Backend unavailable",
        };
      }
    },
  },
};
export type DataSource = "mock" | "demo";
export const getDataSource = (): DataSource =>
  (localStorage.getItem("samudra-netra:data-source") ||
    localStorage.getItem("signal-coast:data-source") ||
    import.meta.env.VITE_DATA_SOURCE) === "demo"
    ? "demo"
    : "mock";
export const getServices = (source = getDataSource()) =>
  source === "demo" ? demoServices : mockServices;
