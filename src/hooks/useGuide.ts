// Step-by-step guide progress for one client (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGuide, setGuideStep, setGuideTask } from '../lib/api'
import type { GuideState } from '../types/seo'

export function useGuide(siteId: string) {
  return useQuery({ queryKey: ['guide', siteId], queryFn: () => getGuide(siteId), select: (d) => d.guide })
}

/** Ticks and step status. The client list + client also carry the current step, so they refresh too. */
export function useGuideChange(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: { kind: 'task'; step: number; task: string; done: boolean } | { kind: 'step'; step: number; done: boolean }) =>
      c.kind === 'task' ? setGuideTask(siteId, c.step, c.task, c.done) : setGuideStep(siteId, c.step, c.done),
    onMutate: async (c) => {
      // Optimistic tick so the checkbox feels instant; the server's answer replaces it.
      if (c.kind !== 'task') return
      await qc.cancelQueries({ queryKey: ['guide', siteId] })
      qc.setQueryData<{ guide: GuideState }>(['guide', siteId], (old) =>
        old
          ? {
              guide: {
                ...old.guide,
                steps: old.guide.steps.map((s) =>
                  s.step === c.step ? { ...s, tasksDone: c.done ? [...s.tasksDone, c.task] : s.tasksDone.filter((k) => k !== c.task) } : s,
                ),
              },
            }
          : old,
      )
    },
    onSuccess: (data) => {
      qc.setQueryData(['guide', siteId], data)
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['client', siteId] })
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['guide', siteId] }),
  })
}
