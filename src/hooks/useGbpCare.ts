// Phase 4b · GBP care (Day 7): products, review tracker + email, 13-week posts. Every write returns the whole state.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gbpCareClaude, gbpCareWrite, getGbpCare } from '../lib/api'

export function useGbpCare(siteId: string) {
  return useQuery({ queryKey: ['gbp-care', siteId], queryFn: () => getGbpCare(siteId), staleTime: 60_000 })
}

type Action = Parameters<typeof gbpCareWrite>[1]

export function useGbpCareWrite(siteId: string, action: Action) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: object) => gbpCareWrite(siteId, action, input), onSuccess: (s) => qc.setQueryData(['gbp-care', siteId], s) })
}

/** 4b step 4 · Claude: estimate (no caching) and draft (replaces the state: the draft shows as Ready to review). */
export function useCareEstimate(siteId: string, kind: 'products' | 'posts') {
  return useMutation({ mutationFn: (input: object) => gbpCareClaude(siteId, kind === 'products' ? 'gbp-products-estimate' : 'gbp-posts-estimate', input) })
}

export function useCareDraft(siteId: string, kind: 'products' | 'posts') {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: object) => gbpCareClaude(siteId, kind === 'products' ? 'gbp-products-draft' : 'gbp-posts-draft', input), onSuccess: (s) => qc.setQueryData(['gbp-care', siteId], s) })
}
