import { useState, useEffect, useCallback } from 'react';
import type { OilSpill, AppStateFilter } from '../types';
import { dataService } from '../data';

export function useSpills(initialFilter?: Partial<AppStateFilter>) {
  const [spills, setSpills] = useState<OilSpill[]>([]);
  const [selectedSpillId, setSelectedSpillId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Partial<AppStateFilter>>(initialFilter || {});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dataService.getSpills(filter);
      setSpills(data);
      if (data.length > 0 && !selectedSpillId) {
        setSelectedSpillId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spills');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedSpillId]);

  useEffect(() => {
    fetchSpills();
  }, [fetchSpills]);

  const selectedSpill = spills.find((s) => s.id === selectedSpillId) || null;

  return {
    spills,
    selectedSpill,
    selectedSpillId,
    setSelectedSpillId,
    filter,
    setFilter,
    loading,
    error,
    refetch: fetchSpills,
  };
}
