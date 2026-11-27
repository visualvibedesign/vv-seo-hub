// Phase 2d: GBP numbers (typed monthly) and Whitespark map grid scans (typed), per client.
// 2g: GBP numbers read from a screenshot (estimate → read → "Ready to review" → approve / discard).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveGbpShot, deleteGbp, deleteMapGrid, discardGbpShot, estimateGbpShot, getLocal, readGbpShot, saveGbp, saveMapGrid, type ScreenshotImage } from '../lib/api'
import type { GbpInput, MapGridInput } from '../types/seo'

export function useLocal(siteId: string) {
  return useQuery({ queryKey: ['local', siteId], queryFn: () => getLocal(siteId), staleTime: 5 * 60_000 })
}

function useLocalMutation<T, R = unknown>(siteId: string, fn: (v: T) => Promise<R>, alsoBaseline = false) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['local', siteId] })
      // New GBP numbers change what a baseline save / a report preview would freeze.
      if (alsoBaseline) void qc.invalidateQueries({ queryKey: ['baseline', siteId] })
    },
  })
}

export const useSaveGbp = (siteId: string) => useLocalMutation(siteId, (v: GbpInput) => saveGbp(siteId, v))
export const useDeleteGbp = (siteId: string) => useLocalMutation(siteId, (id: string) => deleteGbp(siteId, id))
export const useSaveMapGrid = (siteId: string) => useLocalMutation(siteId, (v: MapGridInput) => saveMapGrid(siteId, v))
export const useDeleteMapGrid = (siteId: string) => useLocalMutation(siteId, (id: string) => deleteMapGrid(siteId, id))

// ---- 2g · GBP screenshot --------------------------------------------------------------------------------------------
export const useGbpShotEstimate = (siteId: string) => useMutation({ mutationFn: (image: ScreenshotImage) => estimateGbpShot(siteId, image) })
export const useReadGbpShot = (siteId: string) => useLocalMutation(siteId, (image: ScreenshotImage) => readGbpShot(siteId, image))
export const useApproveGbpShot = (siteId: string) => useLocalMutation(siteId, (v: { id: string; input: GbpInput }) => approveGbpShot(siteId, v.id, v.input), true)
export const useDiscardGbpShot = (siteId: string) => useLocalMutation(siteId, (id: string) => discardGbpShot(siteId, id))
