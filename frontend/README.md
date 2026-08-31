# Samudra Netra

Samudra Netra is an operational maritime intelligence frontend for SIH problem 26143. It combines oil-slick review, hindcast/forecast visualization, AIS reconstruction, evidence-led vessel correlation, and case reporting.

## Run

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Copy `.env.example` to `.env.local` when configuration is needed:

- `VITE_DATA_SOURCE=mock|demo` selects the deterministic mock workspace or Samudra Netra API.
- `VITE_DEMO_API_URL=http://localhost:8000` configures the FastAPI base URL.

Demo mode uses confirmed spill, health, AIS proximity, and environmental proximity routes. Analysis runs correlate a selected database spill with time-matched backend records and display the returned counts and environmental aggregates. Raster imagery remains a clearly marked synthetic visualization because the API does not serve the supplied TIFF/SAFE assets. Responses are never silently mixed across sources.

## Routes

- `/overview` global incident map, filters, urgency queue, and pipeline overview
- `/incidents` filterable operations table and CSV export
- `/incidents/:incidentId` incident summary, drift, candidates, and activity
- `/analysis/:incidentId` synthetic SAR/EO imagery tools and drift analysis
- `/vessels` backend-capable AIS proximity exploration and mock attribution
- `/cases` persistent local case queue and printable report
- `/data-models` connector, queue, backend, and model-run health
- `/settings` source, backend URL, display, map, motion, and weights

## Repository boundary

Frontend code and tooling remain confined to `/frontend`. The sibling `/backend` was inspected to establish its API contract but was not modified. See `docs/demo-backend-contract.md` for exact schemas and integration limits.
