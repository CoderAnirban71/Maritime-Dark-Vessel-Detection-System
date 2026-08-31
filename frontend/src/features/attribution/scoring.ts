import type {
  AISVessel,
  ScoreBreakdown,
  SuspectCandidate,
} from "../../types/domain";
import { clamp } from "../../lib/format";
export const SCORE_WEIGHTS = {
  proximity: 0.25,
  temporal: 0.2,
  trajectory: 0.2,
  anomaly: 0.15,
  dataQuality: 0.08,
  environmental: 0.12,
} as const;
export function calculateCandidate(
  v: AISVessel,
  index: number,
  incidentId: string,
): SuspectCandidate {
  const breakdown: ScoreBreakdown = {
    proximity: clamp(94 - index * 13),
    temporal: clamp(88 - index * 8),
    trajectory: clamp(91 - index * 11),
    anomaly: clamp(v.loitering + v.aisGapHours * 8),
    dataQuality: v.identityIssue ? 36 : Math.max(55, 94 - v.aisGapHours * 10),
    environmental: clamp(87 - index * 7),
    penalty: v.identityIssue ? 8 : index === 5 ? 15 : 0,
  };
  const score = Math.round(
    Object.entries(SCORE_WEIGHTS).reduce(
      (sum, [key, w]) => sum + breakdown[key as keyof typeof SCORE_WEIGHTS] * w,
      0,
    ) - breakdown.penalty,
  );
  return {
    id: `CAN-${v.id}`,
    incidentId,
    vesselId: v.id,
    score: clamp(score),
    closestApproachKm: Number((1.4 + index * 2.8).toFixed(1)),
    timeOffsetHours: Number((0.8 + index * 1.6).toFixed(1)),
    breakdown,
    flags: [
      ...(v.aisGapHours > 2 ? ["AIS gap"] : []),
      ...(v.loitering > 30 ? ["Loitering"] : []),
      ...(v.identityIssue ? ["Identity inconsistency"] : []),
    ],
    evidenceStatus: index < 3 ? "requires review" : "insufficient",
  };
}
