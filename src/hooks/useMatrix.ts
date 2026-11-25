// 3×3 matrix + clusters for one client (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getClusters, getMatrix, setMatrixCell } from '../lib/api'
import type { MatrixCellInput } from '../types/seo'

export function useMatrix(siteId: string) {
  return useQuery({ queryKey: ['matrix', siteId], queryFn: () => getMatrix(siteId), select: (d) => d.matrix })
}

export function useSetMatrixCell(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cell: Omit<MatrixCellInput, 'siteId'>) => setMatrixCell({ ...cell, siteId }),
    onSuccess: (data) => {
      qc.setQueryData(['matrix', siteId], { matrix: data.matrix })
      // A hand-picked primary may get the Primary role: refresh what shows roles.
      for (const key of [['keywords', siteId], ['client', siteId], ['clients']]) void qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useClusters(siteId: string) {
  return useQuery({ queryKey: ['clusters', siteId], queryFn: () => getClusters(siteId), select: (d) => d.pages })
}
