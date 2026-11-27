// Phase 2e · Baseline: the current baseline (+ what a save would freeze now), one past baseline, save / fill.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBaseline, getBaselineById, saveBaseline } from '../lib/api'
import type { BaselineSource } from '../types/seo'

export function useBaseline(siteId: string) {
  return useQuery({ queryKey: ['baseline', siteId], queryFn: () => getBaseline(siteId), staleTime: 60_000 })
}

/** A past baseline's numbers, loaded only when its row is opened. */
export function useBaselineById(siteId: string, id: string | null) {
  return useQuery({ queryKey: ['baseline', siteId, 'one', id], queryFn: () => getBaselineById(siteId, id!), enabled: !!id, staleTime: Infinity })
}

export function useSaveBaseline(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { mode: 'new' | 'fill'; label?: string; note?: string; sources?: BaselineSource[] }) => saveBaseline(siteId, input),
    onSuccess: (state) => {
      qc.setQueryData(['baseline', siteId], state)
      // Day 3 auto-tick, the client's guide summary, and the dashed baseline marker on the Search chart.
      void qc.invalidateQueries({ queryKey: ['guide', siteId] })
      void qc.invalidateQueries({ queryKey: ['client', siteId] })
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['metrics', siteId] })
    },
  })
}
