import { useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  Polygon,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { OilSpill, Investigation, VesselTrack } from '../../types';
import { Layers, Eye, Waves } from 'lucide-react';
import { ParticleDriftLayer } from './ParticleDriftLayer';
import { DarkVesselGapSegments } from './DarkVesselGapSegments';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React bundles
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface SpillMapProps {
  selectedSpill: OilSpill | null;
  investigation: Investigation | null;
  vesselTracks?: VesselTrack[];
  selectedVesselMmsi?: string | null;
  timelineTimestamp?: string;
  onSelectVessel?: (mmsi: string) => void;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom, { animate: true });
  return null;
}

export function SpillMap({
  selectedSpill,
  investigation,
  vesselTracks = [],
  selectedVesselMmsi,
  timelineTimestamp,
  onSelectVessel,
}: SpillMapProps) {
  const [baseLayerType, setBaseLayerType] = useState<'dark_gray' | 'satellite' | 'osm'>('dark_gray');
  const [showSarOverlay, setShowSarOverlay] = useState(true);
  const [sarOpacity, setSarOpacity] = useState(0.85);
  const [showDriftModel, setShowDriftModel] = useState(true);
  const [showAisTracks, setShowAisTracks] = useState(true);
  const [showCentroid, setShowCentroid] = useState(true);
  const [showParticleDrift, setShowParticleDrift] = useState(true);
  const [showDarkVesselGaps, setShowDarkVesselGaps] = useState(true);

  const center: [number, number] = selectedSpill
    ? [selectedSpill.location.lat, selectedSpill.location.lng]
    : [13.2415, 80.3412]; // Ennore default

  const slickPolygonCoords: [number, number][] =
    selectedSpill?.geometry?.coordinates?.[0] || [];

  const originPoint: [number, number] | null = investigation?.originEstimate
    ? [
        investigation.originEstimate.probableOriginLocation.lat,
        investigation.originEstimate.probableOriginLocation.lng,
      ]
    : null;

  const hindcast = investigation?.driftPredictions?.find((d) => d.trajectoryType === 'HINDCAST');
  const hindcastTrajectory: [number, number][] =
    hindcast?.steps?.map((p) => [p.lat, p.lng]) || [];

  // Compute particle drift progress from timeline timestamp
  // Steps go from observation (T0) backward to origin (T-20.5h)
  // Timeline goes forward: as timeline advances past collision → progress increases
  const driftProgress = useMemo(() => {
    if (!hindcast?.steps?.length || !timelineTimestamp) return 0;
    const steps = hindcast.steps;
    // Origin time (collision): earliest step timestamp
    const originTime = new Date(steps[steps.length - 1].timestamp).getTime();
    // Observation time (SAR detection): latest step timestamp
    const obsTime = new Date(steps[0].timestamp).getTime();
    const currentTime = new Date(timelineTimestamp).getTime();

    if (currentTime <= originTime) return 1.0; // Before collision: particles at origin
    if (currentTime >= obsTime) return 0.0; // After SAR detection: particles at slick

    // Inverse: as time goes forward from origin→observation, progress goes 1→0
    return 1.0 - (currentTime - originTime) / (obsTime - originTime);
  }, [hindcast, timelineTimestamp]);

  // SAR Image GroundOverlay geographic bounds (SW, NE)
  const sarBounds: L.LatLngBoundsExpression = [
    [11.8885, 78.2199],
    [13.8412, 80.8105],
  ];

  // Satellite Footprint Quad Bounds
  const sarFootprintQuad: [number, number][] = [
    [11.888502, 80.499916],
    [12.333139, 78.219948],
    [13.841207, 78.516136],
    [13.400343, 80.810555],
  ];

  const primarySuspectMmsi = investigation?.attributionResult?.primarySuspect.vessel.mmsi;

  return (
    <div className="relative w-full h-full rounded-xs overflow-hidden border border-[#29332F] bg-[#060908] select-none">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <MapController center={center} zoom={11} />

        {/* 1. Free, Clean Base Map Tile Layers (Zero API Keys / Zero Watermarks) */}
        {baseLayerType === 'dark_gray' && (
          <>
            <TileLayer
              attribution='&copy; Esri &bull; Sentinel-1 ESA &bull; Copernicus'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
              opacity={0.65}
            />
          </>
        )}

        {baseLayerType === 'satellite' && (
          <TileLayer
            attribution='&copy; Esri World Imagery &bull; Sentinel-1 ESA'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        )}

        {baseLayerType === 'osm' && (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {/* 2. Sentinel-1 SAR GroundOverlay */}
        {showSarOverlay && selectedSpill?.satelliteObservation.quicklookUrl && (
          <ImageOverlay
            url={selectedSpill.satelliteObservation.quicklookUrl}
            bounds={sarBounds}
            opacity={sarOpacity}
          />
        )}

        {/* 3. Sentinel-1 Footprint Quad Perimeter */}
        <Polygon
          positions={sarFootprintQuad}
          pathOptions={{
            color: '#38B99A',
            weight: 1,
            fillOpacity: 0.02,
            dashArray: '4, 8',
          }}
        />

        {/* 4. Oil Slick Polygon */}
        {slickPolygonCoords.length > 0 && (
          <Polygon
            positions={slickPolygonCoords}
            pathOptions={{
              color: '#5EE6C0',
              weight: 1.5,
              fillColor: '#000000',
              fillOpacity: 0.85,
            }}
          >
            <Popup className="custom-dark-popup">
              <div className="p-1 font-mono text-xs">
                <div className="font-bold text-[#5EE6C0] text-sm">
                  {selectedSpill?.code} &bull; SAR Damping Anomaly
                </div>
                <div className="text-[10px] text-[#A5B1AC] mt-1 space-y-0.5">
                  <div>AREA: <span className="text-[#E8EFEC] font-bold">{selectedSpill?.geometry.areaKm2} km²</span></div>
                  <div>CONFIDENCE: <span className="text-[#5EE6C0] font-bold">{selectedSpill?.confidenceScore}%</span></div>
                  <div>WEATHERING AGE: <span className="text-[#E8A84E] font-bold">{selectedSpill?.estimatedAgeHours}h</span></div>
                  <div>CONTRAST: <span className="text-[#E8EFEC] font-bold">{selectedSpill?.satelliteObservation.darkPatchContrastDb} dB</span></div>
                </div>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 5. Slick Centroid Node */}
        {showCentroid && selectedSpill && (
          <Marker
            position={[selectedSpill.location.lat, selectedSpill.location.lng]}
            icon={L.divIcon({
              className: 'centroid-marker',
              html: `<div style="
                width: 14px;
                height: 14px;
                background-color: #5EE6C0;
                border: 2px solid #0B0F0E;
                border-radius: 50%;
                box-shadow: 0 0 10px #5EE6C0;
              "></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Tooltip permanent={false} direction="top" className="font-mono text-[10px]">
              Slick Center of Mass: {selectedSpill.geometry.center.lat.toFixed(4)}°N, {selectedSpill.geometry.center.lng.toFixed(4)}°E
            </Tooltip>
          </Marker>
        )}

        {/* 6. CMEMS Hydrodynamic Backward Drift Hindcast Vector */}
        {showDriftModel && hindcastTrajectory.length > 1 && (
          <Polyline
            positions={hindcastTrajectory}
            pathOptions={{
              color: '#E8A84E',
              weight: 2.5,
              dashArray: '5, 5',
              opacity: 0.9,
            }}
          >
            <Tooltip sticky className="font-mono text-[10px]">
              CMEMS Backward Drift Hindcast: T-20.5h (-0.42 m/s @ 215° SW)
            </Tooltip>
          </Polyline>
        )}

        {/* 7. Probable Release Node & Uncertainty Radius */}
        {showDriftModel && originPoint && (
          <>
            <Circle
              center={originPoint}
              radius={(investigation?.originEstimate?.uncertaintyRadiusKm || 1.2) * 1000}
              pathOptions={{
                color: '#E8A84E',
                weight: 1.5,
                fillColor: '#E8A84E',
                fillOpacity: 0.15,
                dashArray: '3, 6',
              }}
            >
              <Popup className="custom-dark-popup">
                <div className="p-1 font-mono text-xs">
                  <div className="font-bold text-[#E8A84E] text-xs">
                    ESTIMATED DISCHARGE ORIGIN
                  </div>
                  <div className="text-[10px] text-[#A5B1AC] mt-1 space-y-0.5">
                    <div>COORDS: {originPoint[0].toFixed(4)}°N, {originPoint[1].toFixed(4)}°E</div>
                    <div>UNCERTAINTY: ±{investigation?.originEstimate?.uncertaintyRadiusKm || 1.2} km</div>
                    <div>EST. TIME: 2017-01-28 04:03 UTC</div>
                    <div>HINDCAST: CMEMS Currents + ERA5 Leeway</div>
                  </div>
                </div>
              </Popup>
            </Circle>

            <Marker
              position={originPoint}
              icon={L.divIcon({
                className: 'origin-marker',
                html: `<div style="
                  width: 16px;
                  height: 16px;
                  background-color: #E8A84E;
                  border: 2px solid #0B0F0E;
                  border-radius: 2px;
                  box-shadow: 0 0 12px #E8A84E;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #0B0F0E;
                  font-weight: bold;
                  font-size: 9px;
                  font-family: monospace;
                ">★</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Tooltip permanent direction="bottom" className="font-mono text-[9px]">
                Origin Node (04:03 UTC)
              </Tooltip>
            </Marker>
          </>
        )}

        {/* 8. AIS Vessel Trajectory Paths */}
        {showAisTracks &&
          vesselTracks.map((track) => {
            const isSuspect = track.mmsi === primarySuspectMmsi;
            const isCollisionPartner = track.mmsi === '235008000'; // BW Maple
            const isSelected = track.mmsi === selectedVesselMmsi;

            let pathColor = '#38B99A';
            let weight = 1;
            let opacity = 0.35;

            if (isSuspect) {
              pathColor = '#F05D5E';
              weight = 3;
              opacity = 0.95;
            } else if (isCollisionPartner) {
              pathColor = '#E8A84E';
              weight = 2.5;
              opacity = 0.9;
            } else if (isSelected) {
              pathColor = '#5EE6C0';
              weight = 2;
              opacity = 0.8;
            }

            return (
              <Polyline
                key={track.mmsi}
                positions={track.coordinates}
                pathOptions={{
                  color: pathColor,
                  weight,
                  opacity,
                }}
                eventHandlers={{
                  click: () => onSelectVessel?.(track.mmsi),
                }}
              >
                <Tooltip sticky className="font-mono text-[10px]">
                  <div className="font-bold text-[#E8EFEC]">{track.vesselName}</div>
                  <div>MMSI: {track.mmsi}</div>
                  <div>AVG SPEED: {track.avgSpeedKnots} kts</div>
                  {isSuspect && <div className="text-[#F05D5E] font-bold">PRIMARY SUSPECT (98% MATCH)</div>}
                </Tooltip>
              </Polyline>
            );
          })}

        {/* 9. Vessel Current Sliced Position Nodes */}
        {showAisTracks &&
          vesselTracks.map((track) => {
            const isSuspect = track.mmsi === primarySuspectMmsi;
            const isCollisionPartner = track.mmsi === '235008000';
            const isSelected = track.mmsi === selectedVesselMmsi;

            // Pick closest record to timelineTimestamp
            let record = track.records[0];
            if (timelineTimestamp && track.records.length > 1) {
              const targetMs = new Date(timelineTimestamp).getTime();
              let minDiff = Infinity;
              for (let i = 0; i < track.records.length; i++) {
                const r = track.records[i];
                const diff = Math.abs(new Date(r.timestamp).getTime() - targetMs);
                if (diff < minDiff) {
                  minDiff = diff;
                  record = r;
                }
              }
            }
            if (!record) return null;

            let markerColor = '#38B99A';
            let size = 8;
            if (isSuspect) {
              markerColor = '#F05D5E';
              size = 14;
            } else if (isCollisionPartner) {
              markerColor = '#E8A84E';
              size = 12;
            } else if (isSelected) {
              markerColor = '#5EE6C0';
              size = 10;
            }

            return (
              <Marker
                key={`marker-${track.mmsi}`}
                position={[record.lat, record.lng]}
                icon={L.divIcon({
                  className: 'vessel-marker',
                  html: `<div style="
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${markerColor};
                    border: 1.5px solid #0B0F0E;
                    border-radius: 50%;
                    transform: rotate(${record.headingDegrees}deg);
                  "></div>`,
                  iconSize: [size, size],
                  iconAnchor: [size / 2, size / 2],
                })}
                eventHandlers={{
                  click: () => onSelectVessel?.(track.mmsi),
                }}
              >
                <Tooltip direction="top" className="font-mono text-[9px]">
                  {track.vesselName} ({record.speedKnots} kts)
                </Tooltip>
              </Marker>
            );
          })}

        {/* 10. Lagrangian Particle Drift Simulation */}
        {showParticleDrift && hindcast && (
          <ParticleDriftLayer
            hindcastSteps={hindcast.steps}
            progress={driftProgress}
            particleCount={150}
            visible={showParticleDrift}
          />
        )}

        {/* 11. Dark Vessel AIS Gap Segments */}
        {showDarkVesselGaps && (
          <DarkVesselGapSegments
            vesselTracks={vesselTracks}
            originPoint={originPoint ? { lat: originPoint[0], lng: originPoint[1] } : null}
          />
        )}
      </MapContainer>

      {/* Floating Tactical Layer HUD */}
      <div className="absolute top-2 right-2 z-[400] bg-[#0B0F0E]/90 backdrop-blur-xs border border-[#29332F] rounded-xs p-2.5 space-y-2 text-[10px] font-mono shadow-xl max-w-[200px]">
        <div className="flex items-center gap-1.5 font-bold text-[#E8EFEC] border-b border-[#202925] pb-1">
          <Layers className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <span>TACTICAL LAYERS</span>
        </div>

        {/* Base Tile Layer Switcher */}
        <div className="space-y-1">
          <span className="text-[#68746F] text-[9px] block">BASE LAYER:</span>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setBaseLayerType('dark_gray')}
              className={`py-0.5 rounded-xs text-[8px] uppercase font-bold cursor-pointer transition-colors ${
                baseLayerType === 'dark_gray'
                  ? 'bg-[#236B5B] text-slate-950'
                  : 'bg-[#161D1B] text-[#A5B1AC] hover:text-[#E8EFEC]'
              }`}
            >
              DARK
            </button>
            <button
              type="button"
              onClick={() => setBaseLayerType('satellite')}
              className={`py-0.5 rounded-xs text-[8px] uppercase font-bold cursor-pointer transition-colors ${
                baseLayerType === 'satellite'
                  ? 'bg-[#236B5B] text-slate-950'
                  : 'bg-[#161D1B] text-[#A5B1AC] hover:text-[#E8EFEC]'
              }`}
            >
              SATELLITE
            </button>
            <button
              type="button"
              onClick={() => setBaseLayerType('osm')}
              className={`py-0.5 rounded-xs text-[8px] uppercase font-bold cursor-pointer transition-colors ${
                baseLayerType === 'osm'
                  ? 'bg-[#236B5B] text-slate-950'
                  : 'bg-[#161D1B] text-[#A5B1AC] hover:text-[#E8EFEC]'
              }`}
            >
              STREETS
            </button>
          </div>
        </div>

        {/* SAR Overlay Toggle & Slider */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-[#A5B1AC] hover:text-[#E8EFEC]">
            <input
              type="checkbox"
              checked={showSarOverlay}
              onChange={(e) => setShowSarOverlay(e.target.checked)}
              className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
            />
            <span>SENTINEL-1A SAR</span>
          </label>
          {showSarOverlay && (
            <div className="flex items-center gap-1.5 pl-4">
              <Eye className="w-2.5 h-2.5 text-[#68746F]" />
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={sarOpacity}
                onChange={(e) => setSarOpacity(parseFloat(e.target.value))}
                className="w-16 h-1 bg-[#161D1B] rounded cursor-pointer accent-[#5EE6C0]"
              />
            </div>
          )}
        </div>

        {/* Drift Model Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#A5B1AC] hover:text-[#E8EFEC]">
          <input
            type="checkbox"
            checked={showDriftModel}
            onChange={(e) => setShowDriftModel(e.target.checked)}
            className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
          />
          <span>HINDCAST DRIFT VECTOR</span>
        </label>

        {/* AIS Tracks Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#A5B1AC] hover:text-[#E8EFEC]">
          <input
            type="checkbox"
            checked={showAisTracks}
            onChange={(e) => setShowAisTracks(e.target.checked)}
            className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
          />
          <span>AIS TRACKS [{vesselTracks.length}]</span>
        </label>

        {/* Centroid Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#A5B1AC] hover:text-[#E8EFEC]">
          <input
            type="checkbox"
            checked={showCentroid}
            onChange={(e) => setShowCentroid(e.target.checked)}
            className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
          />
          <span>SLICK CENTROID NODE</span>
        </label>

        {/* Particle Drift Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#5EE6C0] hover:text-[#E8EFEC]">
          <input
            type="checkbox"
            checked={showParticleDrift}
            onChange={(e) => setShowParticleDrift(e.target.checked)}
            className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
          />
          <span className="flex items-center gap-1">
            <Waves className="w-3 h-3" />
            PARTICLE DRIFT SIM
          </span>
        </label>

        {/* Dark Vessel Gap Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#F05D5E] hover:text-[#E8EFEC]">
          <input
            type="checkbox"
            checked={showDarkVesselGaps}
            onChange={(e) => setShowDarkVesselGaps(e.target.checked)}
            className="rounded-xs text-[#F05D5E] accent-[#F05D5E]"
          />
          <span>AIS BLACKOUT GAPS</span>
        </label>

        {/* Temporal Time Window Slice */}
        {timelineTimestamp && (
          <div className="pt-1.5 border-t border-[#202925] text-[9px] text-[#5EE6C0]">
            <span className="text-[#68746F] block">PLAYBACK SLICE:</span>
            <span className="font-bold">{new Date(timelineTimestamp).toISOString().replace('T', ' ').replace('Z', '')} UTC</span>
          </div>
        )}

        {/* Tactical Legend */}
        <div className="pt-1.5 border-t border-[#202925] space-y-1 text-[9px]">
          <div className="flex items-center gap-1.5 text-[#A5B1AC]">
            <span className="w-2 h-2 bg-[#F05D5E] inline-block rounded-xs"></span>
            <span>SUSPECT (MT DAWN K.)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#A5B1AC]">
            <span className="w-2 h-2 bg-[#E8A84E] inline-block rounded-xs"></span>
            <span>COLLISION (BW MAPLE)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#A5B1AC]">
            <span className="w-2 h-1 border border-[#5EE6C0] inline-block"></span>
            <span>SAR SLICK POLYGON</span>
          </div>
        </div>
      </div>
    </div>
  );
}
