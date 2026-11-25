// CSV imports (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commitImport, deleteImport, getImports, previewImport } from '../lib/api'
import type { ImportPayload } from '../types/seo'

export function useImports(siteId: string) {
  return useQuery({ queryKey: ['imports', siteId], queryFn: () => getImports(siteId), select: (d) => d.imports })
}

export function usePreviewImport() {
  return useMutation({ mutationFn: (payload: ImportPayload) => previewImport(payload) })
}

export function useCommitImport(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, file }: { payload: ImportPayload; file: { base64: string; type: string } }) => commitImport(payload, file),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['imports', siteId] }),
        qc.invalidateQueries({ queryKey: ['client', siteId] }),
        qc.invalidateQueries({ queryKey: ['clients'] }),
        // Keywords changed: refresh the database, matrix volumes and the guide's auto-ticks too.
        qc.invalidateQueries({ queryKey: ['keywords', siteId] }),
        qc.invalidateQueries({ queryKey: ['matrix', siteId] }),
        qc.invalidateQueries({ queryKey: ['guide', siteId] }),
      ])
    },
  })
}

export function useDeleteImport(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (importId: string) => deleteImport(siteId, importId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['imports', siteId] }),
        qc.invalidateQueries({ queryKey: ['client', siteId] }),
        qc.invalidateQueries({ queryKey: ['clients'] }),
        // Keywords changed: refresh the database, matrix volumes and the guide's auto-ticks too.
        qc.invalidateQueries({ queryKey: ['keywords', siteId] }),
        qc.invalidateQueries({ queryKey: ['matrix', siteId] }),
        qc.invalidateQueries({ queryKey: ['guide', siteId] }),
      ])
    },
  })
}
