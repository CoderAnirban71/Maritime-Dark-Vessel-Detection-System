# Samudra Netra — Frontend details

## Purpose

Samudra Netra is a maritime intelligence interface for reviewing marine slick detections, correlating them with environmental and AIS records, reconstructing possible drift, ranking vessel candidates, and maintaining analyst cases.

The application is an evidence-review tool. Confidence scores, candidate ranks and drift projections prioritize investigation; they do not establish legal responsibility.

## Technology and application structure

- **React 18 + TypeScript** render the user interface.
- **Vite** provides development and production builds.
- **React Router** maps URLs to operational pages.
- **TanStack Query** loads, caches, retries and refreshes service data. Queries have a 30-second stale time and one retry.
- **Zod** validates every backend response before the UI uses it.
- **Lucide React** supplies interface icons.
- **Recharts** is available for data visualization.
- **localStorage** holds settings and analyst case records.
- **Global CSS** implements the visual system, responsive layouts, print view, loading sequence and subtle animations. All motion is disabled when reduced motion is requested.

The entry point is `frontend/src/main.tsx`. It creates the Query client, browser router and root React application. `frontend/src/app/App.tsx` defines lazy-loaded routes. `AppShell.tsx` provides the persistent navigation rail and command bar.

## Data-source model

The frontend supports two adapters with the same TypeScript service contracts.

### Mock mode

Mock mode uses deterministic typed fixtures from `frontend/src/mocks/fixtures.ts`. It provides the complete UI experience, including imagery scenes, model runs, attribution ranking and cases.

### Samudra Netra API mode

API mode reads real backend records from the configured FastAPI URL. It currently supports:

- API/database health
- Recent spill detections
- A single spill detection
- AIS pings near a spill and within its time window
- Ocean-current and wind readings near a spill
- Sentinel-1 SAFE metadata and the real quick-look image
- Real backend file/model inventory
- Named AIS vessel catalog
- Evidence-ranked vessel attribution

Backend responses are converted into the frontend's domain types in `frontend/src/services/index.ts`. Requests time out after 12 seconds and invalid response shapes produce a visible error instead of silently falling back to mock data.

The integration layer now exposes real SAFE scene metadata and its quick-look, the trained model asset, spill geometry, AIS identities and backend-derived attribution. The backend still does not expose case-management endpoints or web tiles for both full-resolution measurement bands. Consequently:

- The analysis canvas displays the real Sentinel-1 quick-look with spill and vector overlays. The two approximately 811 MB GeoTIFF bands remain server-side instead of being downloaded into the browser.
- Case records remain local and work in either data mode.
- Any remaining synthetic presentation is explicitly labelled.

The source is selected by `VITE_DATA_SOURCE`, then can be overridden by the Settings page. The API base URL comes from `VITE_DEMO_API_URL` and can also be overridden in Settings.

## Shared application shell

### Boot sequence

`BootSequence.tsx` shows the animated Samudra Netra loading experience while the interface initializes. It includes staged system messages, a progress sequence and a skip action. Reduced-motion users receive a shortened non-animated experience.

### Navigation rail

The left rail links to Overview, Incidents, Analysis Lab, Vessel Explorer, Cases, Data & Models, and Settings. The active route is highlighted. On narrow screens it becomes a drawer controlled by the menu button and dismissible scrim.

### Command bar

The top bar displays the current workspace title, global-search field, active data source, UTC clock, notification control and analyst avatar. The clock updates every second.

The search field is currently visual shell infrastructure; page-specific searches perform the actual filtering.

### Error and loading behavior

`ErrorBoundary.tsx` prevents a rendering failure from blanking the whole application. Shared `Skeleton`, `ErrorState`, and `EmptyState` components provide consistent pending, failed, and empty-query states.

## Page-by-page behavior

### Overview — `/overview`

Overview is the operational landing page.

- Metric cards summarize active detections, affected area, critical incidents, average confidence and pipeline state.
- Filters narrow incidents by severity, workflow status, sensor and text.
- The world map plots incident markers and a selected incident drawer.
- Map controls toggle detections, EO coverage, currents, forecast and uncertainty layers.
- Reset restores the default map layers and selection.
- The incident queue supports priority/freshness sorting and synchronized map selection.
- Lower panels summarize detection volume, severity distribution and pipeline activity.

`WorldMap.tsx` owns the SVG map interaction and layer presentation. `overview/logic.ts` contains reusable filtering and sorting logic.

### Incidents — `/incidents`

The Incidents page provides a filterable operational table.

- Search matches incident identifiers, locations and analysts.
- Severity and status filters narrow the table.
- Column sorting changes row order.
- Selecting an incident opens its detail route.
- CSV export downloads the currently displayed dataset.
- Mock and backend records remain visibly labelled.

### Incident detail — `/incidents/:incidentId`

This page gathers all evidence related to one detection.

- The header shows location, incident ID, severity, status, analyst and source.
- The summary section presents a spatial snapshot, spill geometry and confidence signals.
- Anchor navigation jumps to summary, imagery, drift, vessels, evidence and activity sections.
- **Open analysis** carries the incident identifier into the Analysis Lab.
- The embedded Drift Workspace reconstructs and forecasts movement.
- The attribution table ranks candidate vessels and exposes score breakdowns.
- The activity timeline explains the investigation sequence.

### Satellite Analysis Lab — `/analysis/:incidentId`

The Analysis Lab combines imagery review with backend correlation.

- The scene selector and filmstrip switch between available SAR/EO scenes.
- Pan, inspect, polygon, measure, mask and split tools change the active review mode.
- Zoom controls enlarge, reduce or fit the scene.
- The comparison slider changes the SAR/EO split position.
- Layer controls show or hide SAR backscatter, segmentation mask and drift vectors.
- Mask opacity adjusts the segmentation overlay.
- The Inspect tab shows time-correlated API results after analysis.
- The annotation field captures an analyst observation and is carried into a saved case.
- **Run analysis** loads environmental observations and AIS tracks for the incident. It calculates returned counts, mean current, mean wind and completion time.
- Progress, completion and failure states make the analysis lifecycle visible.

In API mode the raster backdrop is the real Sentinel-1 SAFE quick-look. Spill coordinates and polygon geometry, named AIS tracks, environmental aggregates and scene metadata come from the backend.

### OceanTrace Drift Workspace

`DriftWorkspace.tsx` is shared by Analysis and Incident detail.

- The map shows hindcast, observation and forecast positions with an uncertainty envelope.
- The timeline slider selects a time step.
- Scenario controls adjust time window, wind speed/direction and current speed.
- Recalculate applies those parameters to the plotted snapshots.
- Reset restores the baseline scenario.
- **Save to case** becomes available after recalculation.
- Saving updates the case matching the incident or creates a new case.
- The exact scenario parameters and current Analysis annotation are persisted.
- Duplicate scenario and note strings are suppressed.
- A success/error message confirms the outcome.
- Supporting panels explain probable origin, coastline risk, path reasoning and input provenance.

`drift/scenario.ts` contains the pure scenario-adjustment logic.

### Vessel Explorer — `/vessels`

The Vessel Explorer reconstructs and reviews AIS tracks.

- The map plots vessel paths and moving replay markers.
- Play/pause, restart, reset and timeline controls operate the replay.
- Search filters by vessel identity.
- Type and AIS-gap filters narrow results.
- Selecting a vessel updates the map and profile.
- The profile reports identifiers, flag, dimensions, destination, gap duration, relevance and quality flags.
- In API mode, raw pings are grouped by MMSI and converted into ordered vessel tracks.

### Candidate attribution component

`AttributionTable.tsx` ranks vessels for an incident.

- Composite scores are produced by `attribution/scoring.ts`.
- Rows display approach distance, time offset, trajectory, anomaly and evidence status.
- Expanding a row reveals the complete score breakdown and limitations.
- Pin buttons build a comparison set of up to three candidates.
- Ranking is investigative prioritization, not a culpability decision.

In API mode attribution is computed from real database AIS tracks around the selected spill. It combines proximity, temporal alignment, heading alignment, AIS gaps and data quality and remains an evidence-prioritization score.

### Case operations — `/cases`

Cases are versioned analyst workflow records stored in the browser.

- The queue shows priority, status, incident association and evidence completeness.
- Selecting a row opens that case.
- Analyst and status changes persist immediately.
- **Mark ready for review** updates the workflow state.
- Evidence-completeness checks summarize the case record.
- Saved drift scenarios are shown with their exact parameters.
- Analyst notes save the exact entered text and appear immediately in numbered history.
- `Ctrl/Command + Enter` also saves a note.
- The report preview includes scenario and analyst-note content.
- Print/Save PDF uses the browser's print dialog and print-specific layout.
- Export JSON downloads the complete active case record.

Case data uses the `samudra-netra:cases:v1` localStorage key. Clearing browser site data removes local cases and settings.

### Data & Models — `/data-models`

This page explains pipeline and connector health.

- The headline badge reports API/database health.
- Pipeline stages show illustrative ingest, preprocessing, segmentation, drift and correlation state.
- Connectors distinguish configured, healthy and degraded capabilities.
- Queue graphics summarize illustrative processing pressure.
- The backend asset inventory reports the SAFE product, AIS CSV, CMEMS file, ERA5 file and U-Net checkpoint with measured sizes and record counts where applicable.
- Model runs are listed in Mock mode; API mode shows the registered U-Net ResNet34 checkpoint.
- Notices explicitly state which integrations are real and which remain simulated.

### Settings — `/settings`

Settings controls runtime behavior.

- Choose Mock or Samudra Netra API data.
- Set the backend base URL.
- Check API/database connectivity.
- Choose UTC/local time, metric/nautical units and map treatment.
- Follow system motion preferences or reduce motion.
- Adjust attribution scoring weights.
- Reset restores defaults in the editor.
- Save persists the data source and backend URL. Reload the page afterward so the selected adapter takes effect.

## Shared UI components

`frontend/src/components/ui.tsx` contains:

- `Badge`: compact status/source/severity labels with semantic color tones.
- `Panel`: the bordered surface used throughout the application.
- `PanelHead`: standardized indexed panel titles and optional secondary content.
- `Skeleton`: loading placeholders.
- `EmptyState`: consistent zero-result presentation.
- `ErrorState`: error message with optional retry action.
- `ScoreBar`: accessible percentage visualization.

## Domain model

`frontend/src/types/domain.ts` is the frontend data contract. Its main types are:

- `OilSpillIncident`: identity, detection times, source, confidence, workflow state and geometry.
- `SpillGeometry`: centroid, outline, axes, area, perimeter and shoreline distance.
- `SatelliteScene`: sensor and acquisition metadata.
- `DriftSnapshot`: timestamped centroid, uncertainty and environmental vectors.
- `AISVessel` and `VesselTrackPoint`: vessel identity and ordered movement history.
- `SuspectCandidate` and `ScoreBreakdown`: attribution evidence and ranking factors.
- `CaseRecord`: workflow state, notes, evidence and saved scenarios.
- `ModelRun`: model execution provenance and status.
- `Sourced<T>`: marks returned data as `mock` or `demo`.

## Service and state flow

The normal read path is:

```text
Page component
  → TanStack Query
  → selected Services adapter
  → mock fixture or validated FastAPI request
  → typed domain object
  → page/component rendering
```

The analysis-to-case write path is:

```text
Recalculate scenario
  → Save to case
  → find case by incident ID
  → update or create CaseRecord
  → persist localStorage
  → invalidate the cases query
  → Case operations shows scenario and annotation
```

Case operations deliberately always uses the local case service, even in API mode, because the current backend has no case endpoints.

## Styling, responsiveness and accessibility

`frontend/src/styles/global.css` defines the Samudra Netra visual language: warm canvas, dark maritime ink, citron selection, coral warnings, teal data signals and technical typography.

- Desktop uses a fixed rail and dense operational grids.
- Tablet/mobile layouts collapse grids, convert navigation into a drawer and reposition map detail panels.
- Buttons, panels, routes, map markers, forecast lines, status messages and loading states use subtle motion.
- `prefers-reduced-motion` disables animations and transitions.
- Visible focus outlines, semantic controls, ARIA labels, live regions and a skip link improve keyboard and assistive-technology use.
- Print CSS removes navigation and editing controls while preserving the report.

## Persistence keys

- `samudra-netra:cases:v1`: case records, notes and saved scenarios.
- `samudra-netra:data-source`: selected adapter.
- `samudra-netra:backend-url`: backend base URL.

Time, unit, basemap, motion and scoring-weight controls currently affect the Settings editor only; only the data source and backend URL are persisted. This boundary should be revisited when those preferences are connected globally.

Browser storage is device- and browser-profile-specific. It is not synchronized to PostgreSQL.

## Testing and quality checks

The frontend includes tests for:

- Formatting helpers
- Overview filtering/sorting logic
- Drift scenario calculations
- Attribution scoring
- Repository persistence
- Backend adapter validation
- Case availability across Mock and API modes

Developer commands are listed at the end of `instruction.md`. A clean handoff should pass type checking, ESLint, all Vitest tests and the production build.

## Important integration boundaries

- PostgreSQL/TimescaleDB is the backend source for spill, AIS and environmental records.
- Redis and `ingest_consumer.py` are needed only for new streaming ingestion.
- Existing seeded data can be queried without Redis.
- Frontend cases are local until backend case endpoints are implemented.
- API mode serves the real SAFE quick-look; full-resolution GeoTIFF tiling is not yet exposed.
- API-mode attribution uses real AIS database records. Mock mode retains deterministic local scoring.
