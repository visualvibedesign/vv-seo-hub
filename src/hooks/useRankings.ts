// Phase 2c: Semrush Position Tracking CSV (dry run, import) and the rankings it gives the Overview.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commitRankCsv, getRankings, previewRankCsv } from '../lib/api'

export function useRankings(siteId: string) {
  return useQuery({ queryKey: ['rankings', siteId], queryFn: () => getRankings(siteId), staleTime: 5 * 60_000 })
}

export function usePreviewRanks(siteId: string) {
  return useMutation({ mutationFn: (base64: string) => previewRankCsv(siteId, base64) })
}

export function useCommitRanks(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fileName, base64 }: { fileName: string; base64: string }) => commitRankCsv(siteId, fileName, base64),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['rankings', siteId] }), qc.invalidateQueries({ queryKey: ['imports', siteId] })])
    },
  })
}
