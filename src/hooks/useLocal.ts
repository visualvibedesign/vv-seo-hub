// Phase 2d: GBP numbers (typed monthly) and Whitespark map grid scans (typed), per client.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteGbp, deleteMapGrid, getLocal, saveGbp, saveMapGrid } from '../lib/api'
import type { GbpInput, MapGridInput } from '../types/seo'

export function useLocal(siteId: string) {
  return useQuery({ queryKey: ['local', siteId], queryFn: () => getLocal(siteId), staleTime: 5 * 60_000 })
}

function useLocalMutation<T>(siteId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['local', siteId] }) })
}

export const useSaveGbp = (siteId: string) => useLocalMutation(siteId, (v: GbpInput) => saveGbp(siteId, v))
export const useDeleteGbp = (siteId: string) => useLocalMutation(siteId, (id: string) => deleteGbp(siteId, id))
export const useSaveMapGrid = (siteId: string) => useLocalMutation(siteId, (v: MapGridInput) => saveMapGrid(siteId, v))
export const useDeleteMapGrid = (siteId: string) => useLocalMutation(siteId, (id: string) => deleteMapGrid(siteId, id))
