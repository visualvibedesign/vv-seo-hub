// Auto-fill suggestions for one client (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideAutofill, estimateAi, getAutofill, retireStaleAutofill, runAi, runAutofillRules } from '../lib/api'
import type { AiTask } from '../lib/aiModels'
import type { AutofillDecision } from '../types/seo'

export function useAutofill(siteId: string) {
  return useQuery({ queryKey: ['autofill', siteId], queryFn: () => getAutofill(siteId), select: (d) => d.rows })
}

export function useRunRules(siteId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => runAutofillRules(siteId), onSuccess: (data) => qc.setQueryData(['autofill', siteId], data) })
}

/** Estimate first (free), then run on click. */
export function useEstimateAi(siteId: string) {
  return useMutation({ mutationFn: ({ task, input }: { task: AiTask; input?: string }) => estimateAi(siteId, task, input).then((r) => r.estimate) })
}

export function useRunAi(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ task, input }: { task: AiTask; input?: string }) => runAi(siteId, task, input),
    onSuccess: (data) => {
      qc.setQueryData(['autofill', siteId], data)
      // Day 1 approvals change the client (services, areas, words): refreshed on decide; nothing changes on a run.
    },
  })
}

export function useDecide(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ autofillId, decisions }: { autofillId: string; decisions: AutofillDecision[] }) => decideAutofill(siteId, autofillId, decisions),
    onSuccess: (data) => {
      qc.setQueryData(['autofill', siteId], data)
      // Approved rows changed keywords: refresh what shows them.
      for (const key of [['keywords', siteId], ['matrix', siteId], ['clusters', siteId], ['guide', siteId], ['client', siteId], ['clients']]) void qc.invalidateQueries({ queryKey: key })
    },
  })
}

/** Retire open lists that point to removed keywords (the server counts again first). */
export function useRetireStale(siteId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => retireStaleAutofill(siteId), onSuccess: (data) => qc.setQueryData(['autofill', siteId], data) })
}
