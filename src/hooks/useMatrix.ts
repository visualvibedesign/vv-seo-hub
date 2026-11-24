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
    onSuccess: (data) => qc.setQueryData(['matrix', siteId], data),
  })
}

export function useClusters(siteId: string) {
  return useQuery({ queryKey: ['clusters', siteId], queryFn: () => getClusters(siteId), select: (d) => d.pages })
}
