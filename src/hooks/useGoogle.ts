// Phase 2a: the client's Google setup (email to add, saved link, properties the service account can see).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGoogleSetup, getMetricsOverview, syncMetrics } from '../lib/api'
import type { MetricRange } from '../types/seo'

export function useGoogleSetup(siteId: string) {
  return useQuery({ queryKey: ['google', siteId], queryFn: () => getGoogleSetup(siteId), staleTime: 60_000 })
}

/** Search Console + GA4 numbers for the Overview (from the last pull). */
export function useMetricsOverview(siteId: string, range: MetricRange, enabled: boolean) {
  return useQuery({ queryKey: ['metrics', siteId, range], queryFn: () => getMetricsOverview(siteId, range), enabled, staleTime: 5 * 60_000 })
}

/** "Update numbers": pull now, then refresh every range and the link status. */
export function useSyncMetrics(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncMetrics(siteId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['metrics', siteId] })
      void qc.invalidateQueries({ queryKey: ['google', siteId] })
    },
  })
}
