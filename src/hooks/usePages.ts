// Phase 3 · Pages: the ideal sitemap + hotspots of a client (seo_pages, migration 0021).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addPage, backfillPages, draftHotspots, estimateHotspots, getPages, saveHotspots, setPageParent, setRedirectStatus, setSiteStructure, skipHotspotDraft } from '../lib/api'
import type { CategoryCode, HotspotsInput, PagesState, PageType, RedirectStatus, SiteStructure } from '../types/seo'

export function usePages(siteId: string) {
  return useQuery({ queryKey: ['pages', siteId], queryFn: () => getPages(siteId), staleTime: 60_000 })
}

function usePagesMutation<T>(siteId: string, fn: (v: T) => Promise<PagesState>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (state) => {
      qc.setQueryData(['pages', siteId], state)
      void qc.invalidateQueries({ queryKey: ['clusters', siteId] }) // Clusters shows the same pages
    },
  })
}

export const useSaveHotspots = (siteId: string) => usePagesMutation(siteId, (v: HotspotsInput) => saveHotspots(siteId, v))
export const useAddPage = (siteId: string) => usePagesMutation(siteId, (v: { name: string; category: CategoryCode; type?: PageType; keywordId?: string }) => addPage(siteId, v))
export const useSiteStructure = (siteId: string) => usePagesMutation(siteId, (s: SiteStructure) => setSiteStructure(siteId, s))
export const usePageParent = (siteId: string) => usePagesMutation(siteId, (v: { pageId: string; parentId: string | null }) => setPageParent(siteId, v.pageId, v.parentId))
export const useRedirectStatus = (siteId: string) => usePagesMutation(siteId, (v: { id: string; status: RedirectStatus }) => setRedirectStatus(siteId, v.id, v.status))

/** Dry run (apply = false) or apply; applying reloads the pages. */
export function useBackfillPages(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (apply: boolean) => backfillPages(siteId, apply),
    onSuccess: (r) => {
      if (r.applied) void qc.invalidateQueries({ queryKey: ['pages', siteId] })
    },
  })
}

// ---- Step 4 · Claude hotspot drafts ---------------------------------------------------------------------------------
export const useSkipHotspotDraft = (siteId: string) => usePagesMutation(siteId, (pageId: string) => skipHotspotDraft(siteId, pageId))

/** Estimate for the picked pages (only when asked). */
export function useHotspotsEstimate(siteId: string, pageIds: string[], asked: boolean) {
  return useQuery({ queryKey: ['hotspots-estimate', siteId, [...pageIds].sort().join(',')], queryFn: () => estimateHotspots(siteId, pageIds), enabled: asked && pageIds.length > 0, staleTime: 0, gcTime: 0, retry: false })
}

export function useDraftHotspots(siteId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (pageIds: string[]) => draftHotspots(siteId, pageIds), onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', siteId] }) })
}
