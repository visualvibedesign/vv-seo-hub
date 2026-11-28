// Phase 4a · GBP check (Day 4): map pack per service, Whitespark factors, business details. Every save returns the
// whole state, so the cache is just replaced.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteMapCompetitor, getGbpCheck, saveGbpFactor, saveGbpProfile, saveMapCompetitor, saveMapSearch } from '../lib/api'
import type { GbpCheckState, GbpFactorKey, GbpFactorStatus, GbpProfile, MapCompetitorInput, MapSearch } from '../types/seo'

export function useGbpCheck(siteId: string) {
  return useQuery({ queryKey: ['gbp-check', siteId], queryFn: () => getGbpCheck(siteId), staleTime: 60_000 })
}

function useGbpMutation<T>(siteId: string, fn: (v: T) => Promise<GbpCheckState>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (s) => qc.setQueryData(['gbp-check', siteId], s) })
}

export const useSaveMapSearch = (siteId: string) => useGbpMutation(siteId, (v: MapSearch) => saveMapSearch(siteId, v))
export const useSaveMapCompetitor = (siteId: string) => useGbpMutation(siteId, (v: MapCompetitorInput) => saveMapCompetitor(siteId, v))
export const useDeleteMapCompetitor = (siteId: string) => useGbpMutation(siteId, (id: string) => deleteMapCompetitor(siteId, id))
export const useSaveGbpFactor = (siteId: string) => useGbpMutation(siteId, (v: { factor: GbpFactorKey; status: GbpFactorStatus; note: string | null }) => saveGbpFactor(siteId, v))
export const useSaveGbpProfile = (siteId: string) => useGbpMutation(siteId, (v: GbpProfile) => saveGbpProfile(siteId, v))
