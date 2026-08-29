import { useState, useEffect, useCallback } from 'react';
import type { Investigation, WorkflowStageKey } from '../types';
import { dataService } from '../data';

export function useInvestigation(spillIdOrInvestigationId?: string | null) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [activeStage, setActiveStage] = useState<WorkflowStageKey>('SATELLITE_OBSERVATION');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestigation = useCallback(async () => {
    if (!spillIdOrInvestigationId) {
      const all = await dataService.getInvestigations();
      if (all.length > 0) {
        setInvestigation(all[0]);
        setActiveStage(all[0].currentStage);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let data = await dataService.getInvestigationById(spillIdOrInvestigationId);
      if (!data) {
        data = await dataService.getInvestigationBySpillId(spillIdOrInvestigationId);
      }
      setInvestigation(data);
      if (data) {
        setActiveStage(data.currentStage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investigation');
    } finally {
      setLoading(false);
    }
  }, [spillIdOrInvestigationId]);

  useEffect(() => {
    fetchInvestigation();
  }, [fetchInvestigation]);

  return {
    investigation,
    activeStage,
    setActiveStage,
    loading,
    error,
    refetch: fetchInvestigation,
  };
}
