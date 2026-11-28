// Phase 3 step 6 · Page brief (worksheet + StoryBrand copy V1 / V2) + Claude's draft, per page.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { draftPageCopy, estimatePageCopy, getPageBrief, savePageBrief, skipBriefDraft, type BriefInput } from '../lib/api'
import type { BriefVersion, PageBrief } from '../types/seo'

export function usePageBrief(siteId: string, pageId: string | null) {
  return useQuery({ queryKey: ['brief', siteId, pageId], queryFn: () => getPageBrief(siteId, pageId!), enabled: !!pageId, staleTime: 60_000 })
}

function useBriefMutation<T>(siteId: string, fn: (v: T) => Promise<PageBrief>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (b) => qc.setQueryData(['brief', siteId, b.page.id], b) })
}

export const useSavePageBrief = (siteId: string) => useBriefMutation(siteId, (v: BriefInput) => savePageBrief(siteId, v))
export const useSkipBriefDraft = (siteId: string) => useBriefMutation(siteId, (pageId: string) => skipBriefDraft(siteId, pageId))
export const useDraftPageCopy = (siteId: string) => useBriefMutation(siteId, (v: { pageId: string; version: BriefVersion }) => draftPageCopy(siteId, v.pageId, v.version))

export function usePageCopyEstimate(siteId: string, pageId: string, version: BriefVersion, asked: boolean) {
  return useQuery({ queryKey: ['brief-estimate', siteId, pageId, version], queryFn: () => estimatePageCopy(siteId, pageId, version), enabled: asked, staleTime: 0, gcTime: 0, retry: false })
}
