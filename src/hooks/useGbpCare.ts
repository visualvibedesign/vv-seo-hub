// Phase 4b · GBP care (Day 7): products, review tracker + email, 13-week posts. Every write returns the whole state.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gbpCareWrite, getGbpCare } from '../lib/api'

export function useGbpCare(siteId: string) {
  return useQuery({ queryKey: ['gbp-care', siteId], queryFn: () => getGbpCare(siteId), staleTime: 60_000 })
}

type Action = Parameters<typeof gbpCareWrite>[1]

export function useGbpCareWrite(siteId: string, action: Action) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: object) => gbpCareWrite(siteId, action, input), onSuccess: (s) => qc.setQueryData(['gbp-care', siteId], s) })
}
