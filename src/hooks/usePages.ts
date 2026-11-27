// Phase 3 · Pages: the ideal sitemap + hotspots of a client (seo_pages, migration 0021).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addPage, backfillPages, getPages, saveHotspots, setSiteStructure } from '../lib/api'
import type { CategoryCode, HotspotsInput, PagesState, PageType, SiteStructure } from '../types/seo'

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
