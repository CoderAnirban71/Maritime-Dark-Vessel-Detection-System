import type { InvestigationReport, OilSpill, Investigation, AttributionCandidate, ReportClassification } from '../types';
import { demoReports } from './demo';

const STORAGE_KEY = 'marine_spill_reports_v1';

export function getStoredReports(): InvestigationReport[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load reports from localStorage', e);
  }
  return demoReports;
}

export function saveReports(reports: InvestigationReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save reports to localStorage', e);
  }
}

export function createInvestigationReport(
  spill: OilSpill,
  investigation: Investigation,
  selectedCandidate: AttributionCandidate,
  investigatorName = 'Cmdr. R. Sharma (Indian Coast Guard / DG Shipping)'
): InvestigationReport {
  const nowIso = new Date().toISOString();
  const caseNumber = `DG-MARPOL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const sat = spill.satelliteObservation;
  const origin = investigation.originEstimate;

  const originLat = origin ? origin.probableOriginLocation.lat.toFixed(4) : spill.location.lat.toFixed(4);
  const originLng = origin ? origin.probableOriginLocation.lng.toFixed(4) : spill.location.lng.toFixed(4);
  const originTime = origin
    ? `${new Date(origin.estimatedTimeWindow.mostProbable).toISOString().replace('T', ' ').replace('Z', '')} UTC`
    : '2017-01-28 04:05:00 UTC';

  const classification: ReportClassification = 'CONFIDENTIAL_LEGAL';

  const newReport: InvestigationReport = {
    id: `rep-${Date.now()}`,
    investigationId: investigation.id,
    caseNumber,
    title: `Statutory Forensic Attribution Dossier: ${spill.name} (${selectedCandidate.vessel.name})`,
    authority: 'Directorate General of Shipping • Maritime Investigation Bureau',
    author: investigatorName,
    generatedAt: nowIso,
    classification,
    executiveSummary: `Technical investigation into marine hydrocarbon slick detection ${spill.code} observed by ${sat.platform} on ${new Date(sat.acquisitionTime).toUTCString()}. Hydrodynamic CMEMS backward drift hindcast models converged on probable discharge coordinates ${originLat}°N, ${originLng}°E at 04:03 UTC. High-density AIS Class-A trajectory reconstruction attributes ${selectedCandidate.vessel.name} (MMSI ${selectedCandidate.vessel.mmsi}) with ${selectedCandidate.overallScore}% correlation certainty, supported by kinematic collision deceleration of -${selectedCandidate.speedDropKnots || 11.2} knots.`,
    satelliteFindings: {
      sceneId: sat.rawGranuleId,
      satellite: `${sat.platform} (${sat.sensor})`,
      detectionTime: sat.acquisitionTime,
      sensorMode: `${sat.mode} • Polarization ${sat.polarization}`,
      slickAreaKm2: spill.geometry.areaKm2,
      slickCoordinates: `${spill.geometry.center.lat.toFixed(4)}°N, ${spill.geometry.center.lng.toFixed(4)}°E`,
    },
    hindcastAnalysis: {
      modelUsed: origin ? origin.hindcastModel : 'Copernicus CMEMS Reanalysis Currents + ERA5 Wind Leeway',
      calculatedOriginCoords: `${originLat}°N, ${originLng}°E (Uncertainty radius: 1.2 km)`,
      calculatedOriginTime: originTime,
      oceanCurrentSummary: 'Copernicus CMEMS Physical Reanalysis 0.083° (0.42 m/s @ 215° SW)',
      windVectorSummary: 'ERA5 Reanalysis 10m Wind Field (8.2 kts @ 045° NE Leeway)',
    },
    vesselAttribution: {
      primaryVesselName: selectedCandidate.vessel.name,
      mmsi: selectedCandidate.vessel.mmsi,
      imo: selectedCandidate.vessel.imo || '9185449',
      flag: selectedCandidate.vessel.flagCountry,
      attributionConfidencePercent: selectedCandidate.overallScore,
      keyViolations: [
        'MARPOL 73/78 Annex I, Regulation 15 (Control of Discharge of Oil into the Sea)',
        'Merchant Shipping Act 1958, Section 356 (Prevention of Pollution of the Sea by Oil)',
        'Failure to submit mandatory immediate pollution incident reporting (POLREP)',
      ],
      evidenceCount: selectedCandidate.evidence.length,
    },
    evidentiaryChain: selectedCandidate.evidence,
    concludingRemarks: `Based upon corroborated satellite SAR backscatter anomaly damping (-6.4 dB), Lagrangian hydrodynamic hindcast trajectory convergence, and synchronized AIS kinematic collision deceleration records, the Directorate General of Shipping concludes that ${selectedCandidate.vessel.name} is the primary liable source for the discharge.`,
    signoff: {
      officerName: investigatorName,
      rank: 'Chief Maritime Safety Officer & Lead Investigator',
      date: new Date().toISOString().split('T')[0],
    },
  };

  const currentReports = getStoredReports();
  const updated = [newReport, ...currentReports];
  saveReports(updated);

  return newReport;
}

export function deleteReport(reportId: string): InvestigationReport[] {
  const current = getStoredReports();
  const updated = current.filter((r) => r.id !== reportId);
  saveReports(updated);
  return updated;
}
