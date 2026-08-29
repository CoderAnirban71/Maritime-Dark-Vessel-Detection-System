import { useState, useEffect, useCallback } from 'react';
import type { InvestigationReport, AnalyticsSummary, SystemStatus, Vessel } from '../types';
import { dataService } from '../data';

export function useReports() {
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataService.getReports();
      setReports(data);
      if (data.length > 0 && !selectedReportId) {
        setSelectedReportId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;

  return { reports, selectedReport, selectedReportId, setSelectedReportId, loading, error, refetch: fetchReports };
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await dataService.getAnalyticsSummary();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { analytics, loading, error };
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await dataService.getSystemStatus();
        setStatus(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { status, loading };
}

export function useVessels() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await dataService.getVessels();
        setVessels(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch vessels');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { vessels, loading, error };
}
