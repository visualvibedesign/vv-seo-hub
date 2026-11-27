// Phase 2f · Monthly reports: list (+ months, clicks per month), one report, preview, create, refresh, status, actions.
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createReport, getReport, getReports, previewReport, refreshReport, saveReportActions, setReportStatus } from '../lib/api'
import type { Report, ReportAction } from '../types/seo'

export function useReports(siteId: string) {
  return useQuery({ queryKey: ['reports', siteId], queryFn: () => getReports(siteId), staleTime: 60_000 })
}

export function useReport(siteId: string, id: string | null) {
  return useQuery({ queryKey: ['report', siteId, id], queryFn: () => getReport(siteId, id!), enabled: !!id, staleTime: 60_000 })
}

/** Several reports at once (the "Every number vs baseline" table: the last 3). */
export function useReportList(siteId: string, ids: string[]) {
  return useQueries({ queries: ids.map((id) => ({ queryKey: ['report', siteId, id], queryFn: () => getReport(siteId, id), staleTime: 60_000 })) })
}

/** What a report for the month would freeze, without saving. */
export function useReportPreview(siteId: string, month: string | null) {
  return useQuery({ queryKey: ['report-preview', siteId, month], queryFn: () => previewReport(siteId, month!), enabled: !!month, staleTime: 30_000, retry: false })
}

function useReportMutation<T>(siteId: string, fn: (v: T) => Promise<Report>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.setQueryData(['report', siteId, r.id], r)
      void qc.invalidateQueries({ queryKey: ['reports', siteId] })
    },
  })
}

export const useCreateReport = (siteId: string) => useReportMutation(siteId, (month: string) => createReport(siteId, month))
export const useRefreshReport = (siteId: string) => useReportMutation(siteId, (id: string) => refreshReport(siteId, id))
export const useReportStatus = (siteId: string) => useReportMutation(siteId, (v: { id: string; status: 'draft' | 'sent'; sentOn?: string }) => setReportStatus(siteId, v.id, v.status, v.sentOn))
export const useReportActions = (siteId: string) => useReportMutation(siteId, (v: { id: string; actions: Omit<ReportAction, 'id'>[] }) => saveReportActions(siteId, v.id, v.actions))
