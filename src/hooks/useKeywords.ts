// Keyword database (TanStack Query). Edits show at once (optimistic) and roll back if saving fails.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getKeywords, updateKeywords } from '../lib/api'
import type { KeywordChanges, KeywordItem, KeywordUpdateRequest } from '../types/seo'

const key = (siteId: string) => ['keywords', siteId]

export function useKeywords(siteId: string) {
  return useQuery({ queryKey: key(siteId), queryFn: () => getKeywords(siteId), select: (d) => d.keywords })
}

function apply(k: KeywordItem, c: KeywordChanges): KeywordItem {
  const next = { ...k }
  if (c.kpVolume !== undefined) {
    next.kpVolume = c.kpVolume || null
    next.kpVolumeBy = c.kpVolume ? 'typed' : null
  }
  if (c.role !== undefined) next.role = c.role
  if (c.serviceId !== undefined) next.serviceId = c.serviceId
  if (c.track !== undefined) next.track = c.track
  if (c.status !== undefined) next.status = c.status
  if (c.notes !== undefined) next.notes = c.notes
  return next
}

export function useUpdateKeywords(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: Omit<KeywordUpdateRequest, 'siteId'>) => updateKeywords({ ...req, siteId }),
    onSuccess: (res, req) => {
      if (!('updated' in res)) return // needs a confirm first: nothing was saved
      const ids = new Set(req.ids)
      qc.setQueryData<{ keywords: KeywordItem[] }>(key(siteId), (old) => old && { keywords: old.keywords.map((k) => (ids.has(k.id) ? apply(k, req.changes) : k)) })
      void qc.invalidateQueries({ queryKey: ['client', siteId] })
    },
  })
}
