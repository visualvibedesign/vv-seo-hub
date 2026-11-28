// Phase 3 step 5 · BrandScript (A–P once per client) + Claude's draft.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { confirmBrandScript, draftBrandScript, estimateBrandScript, getBrandScript, saveBrandScript, skipBrandDraft } from '../lib/api'
import type { BrandKey, BrandScript } from '../types/seo'

export function useBrandScript(siteId: string) {
  return useQuery({ queryKey: ['brandscript', siteId], queryFn: () => getBrandScript(siteId), staleTime: 60_000 })
}

function useBrandMutation<T = void>(siteId: string, fn: (v: T) => Promise<BrandScript>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (b) => qc.setQueryData(['brandscript', siteId], b) })
}

export const useSaveBrandScript = (siteId: string) => useBrandMutation(siteId, (answers: Partial<Record<BrandKey, string>>) => saveBrandScript(siteId, answers))
export const useConfirmBrandScript = (siteId: string) => useBrandMutation(siteId, (confirmed: boolean) => confirmBrandScript(siteId, confirmed))
export const useSkipBrandDraft = (siteId: string) => useBrandMutation(siteId, () => skipBrandDraft(siteId))
export const useDraftBrandScript = (siteId: string) => useBrandMutation(siteId, () => draftBrandScript(siteId))

export function useBrandEstimate(siteId: string, asked: boolean) {
  return useQuery({ queryKey: ['brandscript-estimate', siteId], queryFn: () => estimateBrandScript(siteId), enabled: asked, staleTime: 0, gcTime: 0, retry: false })
}
