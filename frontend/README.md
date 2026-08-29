# Samudra-Netra — Frontend Workstation
> **SIH Problem Statement 26143**: *Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill.*

---

## Overview
**Samudra-Netra** is a specialized geospatial intelligence workstation designed for maritime authorities (Directorate General of Shipping, Indian Coast Guard, State Maritime Boards) to detect satellite SAR oil slick damping anomalies and correlate high-resolution AIS vessel tracks with hydrodynamic hindcast models to identify the liable polluter.

---

## Key Capabilities
- **Satellite SAR Granule Analysis**: Visualizes Sentinel-1 C-Band IW GRD radar damping anomalies (-6.4 dB contrast) with dual-polarization (VV/VH) diagnostics.
- **CMEMS Hydrodynamic Particle Simulation**: Real-time canvas-based Lagrangian reverse particle drift modeling simulating backward advection-diffusion towards the release node.
- **AIS Traffic Reconstruction**: Multi-vessel kinematic analysis across 50 vessels, decoding speed drops, collision intersections, and waypoint anomalies.
- **Dark Vessel / Transponder Gap Detection**: Identifies AIS blackout gaps ($\ge 15\text{ min}$) within the spill perimeter and validates transponder continuity.
- **Explainable Multi-Factor Scoring**: 5-factor mathematical attribution model broken down across spatial proximity, temporal alignment, speed anomalies, AIS continuity, and cargo hazard.
- **Statutory Dossier Generator**: Compiles signed legal reports formatted for DG Shipping and MARPOL Annex I regulatory enforcement.
- **Interactive Judge Demo Stepper**: 10-step guided walkthrough demonstrating end-to-end detection, hindcasting, candidate filtering, attribution, and reporting.

---

## Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Maritime Workstation CSS Tokens
- **Geospatial Visualization**: Leaflet / React-Leaflet + Esri Canvas Dark Raster Tiles
- **Charts & Telemetry**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
Open `http://127.0.0.1:5173/` in your browser.

### Production Build & Type Checking
```bash
npm run build
```
The production bundle will be output to `frontend/dist/`.

---

## Environment Configuration
The frontend supports both standalone client-side demonstration mode and live REST API connection:

```env
# Base URL for production backend API (optional, defaults to /api/v1)
VITE_API_URL=http://localhost:8000/api/v1
```
