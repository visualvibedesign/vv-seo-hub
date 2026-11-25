// Auto-fill suggestions for one client (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideAutofill, estimateAi, getAutofill, runAi, runAutofillRules } from '../lib/api'
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
  return useMutation({ mutationFn: (task: AiTask) => estimateAi(siteId, task).then((r) => r.estimate) })
}

export function useRunAi(siteId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (task: AiTask) => runAi(siteId, task), onSuccess: (data) => qc.setQueryData(['autofill', siteId], data) })
}

export function useDecide(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ autofillId, decisions }: { autofillId: string; decisions: AutofillDecision[] }) => decideAutofill(siteId, autofillId, decisions),
    onSuccess: (data) => {
      qc.setQueryData(['autofill', siteId], data)
      // Approved rows changed keywords: refresh what shows them.
      for (const key of [['keywords', siteId], ['matrix', siteId], ['guide', siteId], ['client', siteId], ['clients']]) void qc.invalidateQueries({ queryKey: key })
    },
  })
}
