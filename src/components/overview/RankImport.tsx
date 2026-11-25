import { useEffect, useRef, useState } from 'react'
import { useCommitRanks, usePreviewRanks } from '../../hooks/useRankings'
import { ApiError } from '../../lib/api'
import { fileToBase64 } from '../../lib/readCsv'
import { BTN_GHOST, BTN_LIME, BTN_LINK } from '../../lib/ui'
import type { RankPlan } from '../../types/seo'
import { Spinner } from '../ui/Loading'

// Phase 2c: "Upload CSV" for the Semrush Position Tracking export (Overview › Keyword rankings, Baseline › Semrush).
// Pick the file → dry run (nothing saved) → Import. Numbers are kept exactly as exported; the raw file is kept too.

const MAX = 3 * 1024 * 1024
const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function RankImport({ siteId, label = 'Upload CSV', primary = false }: { siteId: string; label?: string; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const dlg = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null)
  const [readErr, setReadErr] = useState('')
  const preview = usePreviewRanks(siteId)
  const commit = useCommitRanks(siteId)
  const open = !!file || !!readErr

  useEffect(() => {
    const d = dlg.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const reset = () => {
    setFile(null)
    setReadErr('')
    preview.reset()
    commit.reset()
    if (input.current) input.current.value = ''
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    preview.reset()
    commit.reset()
    if (f.size > MAX) return setReadErr('That file is over 3 MB. Export only this project’s Rankings Overview as CSV.')
    if (!/\.csv$/i.test(f.name)) return setReadErr('Pick the .csv file (Semrush › Export › CSV), not Excel or PDF.')
    const base64 = await fileToBase64(f)
    setFile({ name: f.name, base64 })
    preview.mutate(base64)
  }

  const plan = commit.data?.plan ?? preview.data?.plan
  return (
    <>
      <button type="button" className={`${primary ? BTN_LIME : BTN_GHOST} min-h-10 px-4 text-[13px]`} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <dialog
        ref={dlg}
        onClose={reset}
        onClick={(e) => e.target === dlg.current && !commit.isPending && reset()}
        aria-labelledby="rank-h"
        className="m-auto w-[calc(100%-32px)] max-w-[520px] rounded-[26px] border-0 bg-vv-surface p-0 text-vv-ink shadow-[0_30px_60px_-30px_rgba(42,28,110,0.5)] backdrop:bg-[rgba(42,28,110,0.18)]"
      >
        {open && (
          <div className="flex flex-col gap-3.5 p-[26px] phone:p-5">
            <h2 id="rank-h" className="m-0 font-display text-[24px] font-semibold leading-[1.2]">
              {commit.isSuccess ? 'Rankings imported' : 'Import Position Tracking CSV'}
            </h2>
            {file && <p className="m-0 break-all text-[13px] text-vv-body">{file.name}</p>}
            {readErr && <p className="m-0 text-[14px] font-semibold text-vv-red">{readErr}</p>}
            {preview.isPending && (
              <p className="m-0 flex items-center gap-2 text-[14px] text-vv-body">
                <Spinner /> Reading the file (dry run, nothing saved)…
              </p>
            )}
            {preview.error && <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(preview.error, 'Couldn’t read that file.')}</p>}
            {plan && <PlanView plan={plan} done={commit.isSuccess} />}
            {commit.error && <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(commit.error, 'Couldn’t save the rankings. Nothing was changed.')}</p>}
            <div className="mt-1 flex flex-wrap justify-end gap-2">
              {commit.isSuccess ? (
                <button type="button" className={BTN_LIME} onClick={reset}>
                  Done
                </button>
              ) : (
                <>
                  <button type="button" className={`${BTN_LINK} px-3`} onClick={reset} disabled={commit.isPending}>
                    Cancel
                  </button>
                  <button type="button" className={BTN_LIME} disabled={!preview.data || commit.isPending} onClick={() => file && commit.mutate({ fileName: file.name, base64: file.base64 })}>
                    {commit.isPending && <Spinner />}
                    {preview.data?.plan.replaces ? 'Import and replace' : 'Import'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}

function PlanView({ plan: p, done }: { plan: RankPlan; done: boolean }) {
  const dates = p.dates.length === 1 ? day(p.dates[0]) : `${p.dates.length} dates · ${day(p.dates[0])} – ${day(p.dates[p.dates.length - 1])}`
  const facts: [string, string][] = [
    ['Tracked site', p.domain],
    ['Positions from', dates],
    ['Keywords', `${p.keywords}${p.matched < p.keywords ? ` · ${p.matched} in the Database` : ' · all in the Database'}`],
    [`On ${day(p.latest.date)}`, `${p.latest.ranked} in the top 100 · ${p.latest.top10} in the top 10 · ${p.latest.top3} in the top 3${p.latest.avgPosition !== null ? ` · avg ${p.latest.avgPosition.toFixed(1)}` : ''}`],
  ]
  return (
    <div className="flex flex-col gap-2.5">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-vv-lavender-50 p-3.5 text-[13px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-vv-body">{k}</dt>
            <dd className="m-0 break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {p.replaces > 0 && !done && <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">{p.replaces} saved positions for these dates will be replaced by this file.</p>}
      {p.unmatched.length > 0 && (
        <p className="m-0 text-[13px] text-vv-body">
          Not in the Database (imported anyway, not added as keywords): {p.unmatched.slice(0, 6).join(', ')}
          {p.unmatched.length > 6 ? ` +${p.unmatched.length - 6} more` : ''}
        </p>
      )}
      {p.otherDomains.length > 0 && <p className="m-0 text-[13px] text-vv-body">Competitor columns skipped: {p.otherDomains.join(', ')}</p>}
      {done ? <p className="m-0 text-[13px] font-semibold text-vv-green-ink">Saved. The raw file is kept in the import history.</p> : <p className="m-0 text-[12px] text-vv-muted">Dry run: nothing saved yet. Positions stay exactly as exported.</p>}
    </div>
  )
}
