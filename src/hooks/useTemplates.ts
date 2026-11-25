// Templates (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applyTemplate, getTemplates, saveTemplate } from '../lib/api'
import type { Template, TemplateInput } from '../types/seo'

export function useTemplates() {
  return useQuery({ queryKey: ['templates'], queryFn: getTemplates, select: (d) => d.templates })
}

/** Replaces one template in the cached list (or adds it). */
function useReplace() {
  const qc = useQueryClient()
  return (t: Template) =>
    qc.setQueryData<{ templates: Template[] }>(['templates'], (old) =>
      old ? { templates: old.templates.some((x) => x.id === t.id) ? old.templates.map((x) => (x.id === t.id ? t : x)) : [...old.templates, t] } : old,
    )
}

export function useSaveTemplate() {
  const replace = useReplace()
  return useMutation({ mutationFn: (t: TemplateInput) => saveTemplate(t), onSuccess: ({ template }) => replace(template) })
}

export function useApplyTemplate() {
  const replace = useReplace()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, siteId }: { templateId: string; siteId: string }) => applyTemplate(templateId, siteId),
    onSuccess: ({ template }, vars) => {
      replace(template)
      // Applying may fill the client's industry.
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['client', vars.siteId] })
    },
  })
}
