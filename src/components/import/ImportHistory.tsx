import { useState } from 'react'
import { useDeleteImport, useImports } from '../../hooks/useImports'
import { ApiError, checkDeleteImport, getImportFileUrl } from '../../lib/api'
import { REPORTS, SOURCE_LABEL } from '../../lib/importRules'
import { BTN_LINK, CARD, CARD_TITLE, PILL_REVIEW, PILL_TODO, PILL_WAITING } from '../../lib/ui'
import type { DeleteImportCheck, ImportRecord, ImportReport } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Spinner } from '../ui/Loading'

// Import history (Keywords › Import): every import with its counts, a download link for the raw file,
// and "Delete this import" (counts shown in a confirm first; see server/services/importService.ts).
export default function ImportHistory({ siteId }: { siteId: string }) {
  const q = useImports(siteId)
  const del = useDeleteImport(siteId)
  const [opening, setOpening] = useState('')
  const [target, setTarget] = useState<ImportRecord | null>(null)
  const [check, setCheck] = useState<{ data?: DeleteImportCheck; error?: string } | null>(null)
  const [done, setDone] = useState('')

  const download = async (id: string) => {
    setOpening(id)
    try {
      const { url } = await getImportFileUrl(siteId, id)
      window.location.assign(url)
    } finally {
      setOpening('')
    }
  }

  // Delete: load the counts first (nothing deleted yet), then confirm.
  const askDelete = async (r: ImportRecord) => {
    setDone('')
    setTarget(r)
    setCheck(null)
    try {
      setCheck({ data: await checkDeleteImport(siteId, r.id) })
    } catch (e) {
      setCheck({ error: e instanceof ApiError && e.detail ? e.detail : 'Couldn’t count what this would delete.' })
    }
  }

  const confirmDelete = async () => {
    if (!target) return
    try {
      const res = await del.mutateAsync(target.id)
      const fileNote = check?.data?.hasFile && !res.fileRemoved ? ' (the raw file couldn’t be removed from Storage)' : ''
      setDone(`Deleted ${target.fileName}: ${res.keywordsRemoved} keyword${res.keywordsRemoved === 1 ? '' : 's'} removed${fileNote}.`)
      setTarget(null)
    } catch (e) {
      setCheck({ ...check, error: e instanceof ApiError && e.detail ? e.detail : 'Couldn’t delete it. Try again.' })
    }
  }

  const OTHER: Record<string, string> = { sams_guide: 'Sam’s Guide sheet', clusters: 'Clusters (sheet)', competitors: 'Competitors tab (names only)', client_sheet: 'Whole client Sheet (.xlsx)' }
  const reportLabel = (r: ImportReport) => REPORTS.find((x) => x.report === r)?.label ?? OTHER[r] ?? r
  const c = check?.data
  const parentName = (id: string | null) => (id ? q.data?.find((x) => x.id === id)?.fileName ?? 'a client Sheet' : '')
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <section className={CARD} aria-labelledby="imp-history">
      <h2 id="imp-history" className={CARD_TITLE}>
        Import <em className="font-medium text-vv-purple">history</em>
      </h2>
      {done && (
        <p role="status" className="m-0 rounded-2xl bg-vv-green-100 px-4 py-3 text-sm font-semibold text-vv-green-ink">
          {done}
        </p>
      )}
      {q.isPending && (
        <span className="flex items-center gap-2 text-sm text-vv-muted">
          <Spinner /> Loading imports…
        </span>
      )}
      {q.isError && <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t load the import history. Try again in a moment.</p>}
      {q.isSuccess && q.data.length === 0 && <p className="m-0 text-[15px] text-vv-muted">No imports yet.</p>}
      {q.isSuccess && q.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-vv-st-todo text-vv-st-todo-ink">
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Source</th>
                <th className="px-3 py-2 font-semibold">File</th>
                <th className="px-3 py-2 font-semibold">New</th>
                <th className="px-3 py-2 font-semibold">Already there</th>
                <th className="px-3 py-2 font-semibold">Duplicates</th>
                <th className="px-3 py-2 font-semibold">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.id} className="border-t border-solid border-vv-line align-top">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={r.source === 'sheet' ? PILL_WAITING : r.source === 'kp' ? PILL_REVIEW : PILL_TODO}>{SOURCE_LABEL[r.source]}</span>
                    <span className="mt-1 block text-xs text-vv-muted">
                      {reportLabel(r.report)}
                      {r.location ? ` · ${r.location}` : ''}
                      {r.filter ? ` · ${r.filter}` : ''}
                    </span>
                    {r.parentImportId && <span className="block text-xs text-vv-muted">From {parentName(r.parentImportId)}</span>}
                    {r.report === 'client_sheet' && r.note && <span className="block text-xs text-vv-muted">{r.note}</span>}
                    {r.totals.length > 0 && <span className="block text-xs text-vv-muted">Totals: {r.totals.map((t) => `${t.segment} ${t.volume}`).join(' · ')}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.hasFile ? (
                      <button type="button" className={`${BTN_LINK} min-h-0 text-left`} onClick={() => void download(r.id)} disabled={opening === r.id}>
                        {opening === r.id ? 'Opening…' : r.fileName} ↓
                      </button>
                    ) : (
                      r.fileName
                    )}
                  </td>
                  <td className="px-3 py-2">{r.rowsAdded}</td>
                  <td className="px-3 py-2">{r.rowsMerged}</td>
                  <td className="px-3 py-2">{r.rowsSkipped}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" className={`${BTN_LINK} min-h-0 !text-vv-red`} onClick={() => void askDelete(r)}>
                      Delete this import
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete this import?"
        confirmLabel={c ? 'Delete import' : 'Counting…'}
        busy={del.isPending || !c}
        onCancel={() => !del.isPending && setTarget(null)}
        onConfirm={() => void confirmDelete()}
        body={
          <div className="flex flex-col gap-2">
            <span className="break-all font-semibold text-vv-ink">{target?.fileName}</span>
            {!c && !check?.error && (
              <span className="flex items-center gap-2 text-vv-muted">
                <Spinner /> Counting what this removes…
              </span>
            )}
            {c && c.tabImports > 0 && <span className="font-semibold text-vv-ink">This is a whole client Sheet: its {plural(c.tabImports, 'tab import')} go with it (counts below are for all of them).</span>}
            {c && (
              <ul className="m-0 flex flex-col gap-1 pl-5">
                <li>
                  <strong>{plural(c.keywordsRemoved, 'keyword')}</strong> removed (only in this import)
                </li>
                <li>
                  <strong>{plural(c.keywordsKept, 'keyword')}</strong> stay (also in another import)
                </li>
                <li>
                  <strong>{plural(c.historyRows, 'history row')}</strong> removed
                </li>
                <li>{c.hasFile ? 'The raw file is removed from Storage' : 'No raw file was saved'}</li>
              </ul>
            )}
            {c && c.removedWithEdits > 0 && (
              <span className="font-semibold text-vv-orange-ink">
                {c.removedWithEdits} of the removed keywords have a KP range typed in the app, a role or a service. Those go too.
              </span>
            )}
            {c && c.removedInUse > 0 && <span className="font-semibold text-vv-orange-ink">{c.removedInUse} of them are in the matrix or clusters and will drop out.</span>}
            {c?.notes.map((n) => (
              <span key={n} className="text-[13px] text-vv-body">
                {n}
              </span>
            ))}
            {c && <span className="text-[13px] text-vv-muted">Numbers this import filled into keywords that stay are kept. This can’t be undone.</span>}
            {check?.error && <span className="font-semibold text-vv-red">{check.error}</span>}
          </div>
        }
      />
    </section>
  )
}
