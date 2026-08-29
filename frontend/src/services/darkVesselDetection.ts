import type { VesselTrack } from '../types';

export interface AISGap {
  vesselName: string;
  mmsi: string;
  gapStartTime: string;
  gapEndTime: string;
  gapDurationMinutes: number;
  startPosition: { lat: number; lng: number };
  endPosition: { lat: number; lng: number };
  estimatedDistanceTraveledKm: number;
  distanceToOriginKm: number;
  classification: 'INTENTIONAL_BLACKOUT' | 'COVERAGE_GAP' | 'PORT_STATIONARY';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
}

export interface DarkVesselReport {
  totalVesselsScanned: number;
  vesselsWithGaps: number;
  totalGapsDetected: number;
  gaps: AISGap[];
  scanRadiusKm: number;
  minGapMinutes: number;
  originPoint: { lat: number; lng: number };
  scanTimestamp: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyGap(
  gap: { durationMin: number; startSpeed: number; endSpeed: number; distToOrigin: number },
): { classification: AISGap['classification']; riskLevel: AISGap['riskLevel'] } {
  // If vessel was stationary (< 0.5 kts) at both ends, it's likely in port
  if (gap.startSpeed < 0.5 && gap.endSpeed < 0.5) {
    return { classification: 'PORT_STATIONARY', riskLevel: 'LOW' };
  }
  // If gap is very long (> 2h) and near the spill origin, suspicious
  if (gap.durationMin > 120 && gap.distToOrigin < 10) {
    return { classification: 'INTENTIONAL_BLACKOUT', riskLevel: 'CRITICAL' };
  }
  // If gap is moderate (> 60m) and within 15km, still concerning
  if (gap.durationMin > 60 && gap.distToOrigin < 15) {
    return { classification: 'INTENTIONAL_BLACKOUT', riskLevel: 'HIGH' };
  }
  // Short gaps far from origin are likely coverage gaps
  if (gap.distToOrigin > 20) {
    return { classification: 'COVERAGE_GAP', riskLevel: 'LOW' };
  }
  return { classification: 'COVERAGE_GAP', riskLevel: 'MODERATE' };
}

export function detectDarkVessels(
  vesselTracks: VesselTrack[],
  originPoint: { lat: number; lng: number },
  options: {
    minGapMinutes?: number;
    scanRadiusKm?: number;
  } = {},
): DarkVesselReport {
  const minGapMinutes = options.minGapMinutes ?? 30;
  const scanRadiusKm = options.scanRadiusKm ?? 25;
  const gaps: AISGap[] = [];

  for (const track of vesselTracks) {
    if (!track.records || track.records.length < 2) continue;

    // Check if any point in the track is within scan radius
    const isInRange = track.records.some(
      (r) => haversineKm(r.lat, r.lng, originPoint.lat, originPoint.lng) < scanRadiusKm,
    );
    if (!isInRange) continue;

    // Sort records by timestamp
    const sorted = [...track.records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Scan for transmission gaps
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const gapMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      const gapMin = gapMs / 60000;

      if (gapMin >= minGapMinutes) {
        const midLat = (current.lat + next.lat) / 2;
        const midLng = (current.lng + next.lng) / 2;
        const distToOrigin = haversineKm(midLat, midLng, originPoint.lat, originPoint.lng);
        const estimatedDistKm = haversineKm(current.lat, current.lng, next.lat, next.lng);

        const { classification, riskLevel } = classifyGap({
          durationMin: gapMin,
          startSpeed: current.speedKnots,
          endSpeed: next.speedKnots,
          distToOrigin,
        });

        gaps.push({
          vesselName: track.vesselName,
          mmsi: track.mmsi,
          gapStartTime: current.timestamp,
          gapEndTime: next.timestamp,
          gapDurationMinutes: Math.round(gapMin),
          startPosition: { lat: current.lat, lng: current.lng },
          endPosition: { lat: next.lat, lng: next.lng },
          estimatedDistanceTraveledKm: Math.round(estimatedDistKm * 100) / 100,
          distanceToOriginKm: Math.round(distToOrigin * 100) / 100,
          classification,
          riskLevel,
        });
      }
    }
  }

  // Sort by risk level priority
  const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
  gaps.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  const uniqueVesselsWithGaps = new Set(gaps.map((g) => g.mmsi));

  return {
    totalVesselsScanned: vesselTracks.length,
    vesselsWithGaps: uniqueVesselsWithGaps.size,
    totalGapsDetected: gaps.length,
    gaps,
    scanRadiusKm,
    minGapMinutes,
    originPoint,
    scanTimestamp: new Date().toISOString(),
  };
}
