import { useMemo } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import type { VesselTrack } from '../../types';
import { detectDarkVessels } from '../../services/darkVesselDetection';

interface DarkVesselGapSegmentsProps {
  vesselTracks: VesselTrack[];
  originPoint: { lat: number; lng: number } | null;
}

const GAP_COLORS: Record<string, string> = {
  CRITICAL: '#F05D5E',
  HIGH: '#E8A84E',
  MODERATE: '#D5B76A',
  LOW: '#68746F',
};

/**
 * Renders dashed polyline segments on the map for each detected
 * AIS transmission gap. Line interpolates between last-known and
 * next-known position (i.e., where the vessel was "dark").
 */
export function DarkVesselGapSegments({
  vesselTracks,
  originPoint,
}: DarkVesselGapSegmentsProps) {
  const gaps = useMemo(() => {
    if (!originPoint || vesselTracks.length === 0) return [];
    const report = detectDarkVessels(vesselTracks, originPoint, {
      minGapMinutes: 15,
      scanRadiusKm: 25,
    });
    // Only render CRITICAL, HIGH, MODERATE gaps on the map (skip LOW to reduce clutter)
    return report.gaps.filter((g) => g.riskLevel !== 'LOW');
  }, [vesselTracks, originPoint]);

  if (gaps.length === 0) return null;

  return (
    <>
      {gaps.map((gap, idx) => {
        const color = GAP_COLORS[gap.riskLevel] || '#F05D5E';
        const positions: [number, number][] = [
          [gap.startPosition.lat, gap.startPosition.lng],
          [gap.endPosition.lat, gap.endPosition.lng],
        ];

        return (
          <Polyline
            key={`gap-${gap.mmsi}-${idx}`}
            positions={positions}
            pathOptions={{
              color,
              weight: 3,
              dashArray: '6, 4',
              opacity: 0.85,
            }}
          >
            <Tooltip sticky className="font-mono text-[9px]">
              <div className="text-[#E8EFEC] font-bold" style={{ color }}>
                AIS BLACKOUT: {gap.vesselName}
              </div>
              <div>MMSI: {gap.mmsi}</div>
              <div>GAP: {gap.gapDurationMinutes} min</div>
              <div>DIST TO ORIGIN: {gap.distanceToOriginKm} km</div>
              <div style={{ color }}>
                {gap.classification.replace(/_/g, ' ')} ({gap.riskLevel})
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
