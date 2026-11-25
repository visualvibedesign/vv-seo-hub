import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '../ui/Loading'
import { ApiError, applySheet, previewSheet } from '../../lib/api'
import { fileToBase64, MAX_FILE_BYTES as XLSX_MAX_BYTES } from '../../lib/readCsv' // 3 MB, same cap as src/lib/xlsx.ts (the server reads the file)
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, PILL_DONE, PILL_TODO, PILL_WAITING } from '../../lib/ui'
import type { ClientDetail, SheetApplyResult, SheetPlan, SheetTabKind, SheetTabPlan } from '../../types/seo'
import { Act, Fold, Plan as SamsPlan, Table } from './SamsGuideImport'

// Import a whole client Sheet (.xlsx) once: an EXTRA way in (raw exports and single-tab imports keep working).
// Choose the file → dry run of every tab (nothing saved) → tick Sam's Guide conflicts / new competitor names → Apply.
// The server reads the .xlsx (values only) and runs the existing importers per tab; Apply builds the plan again.
// On Uploads (Day 2) and Keywords › Import.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e instanceof Error && e.message ? e.message : fallback)
const KIND: Record<SheetTabKind, string> = { master_db: 'Master DB', sams_guide: 'Sam’s Guide', clusters: 'Clusters', competitors: 'Competitors', unused: 'Not used yet' }
const STATUS: Record<SheetApplyResult['tabs'][number]['status'], { cls: string; text: string }> = {
  applied: { cls: PILL_DONE, text: 'Applied' },
  skipped: { cls: PILL_TODO, text: 'Skipped' },
  failed: { cls: PILL_WAITING, text: 'Failed' },
  not_run: { cls: PILL_TODO, text: 'Not run' },
}

export default function ClientSheetImport({ client: c }: { client: ClientDetail }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null)
  const [readError, setReadError] = useState('')
  const [replace, setReplace] = useState<Set<string>>(new Set())
  const [approve, setApprove] = useState<Set<string>>(new Set())
  const preview = useMutation({ mutationFn: (f: { name: string; base64: string }) => previewSheet(c.siteId, f.name, f.base64).then((r) => r.plan) })
  const apply = useMutation({
    mutationFn: () => applySheet(c.siteId, file!.name, file!.base64, [...replace], [...approve]),
    onSuccess: () => {
      for (const key of [['imports', c.siteId], ['client', c.siteId], ['clients'], ['keywords', c.siteId], ['matrix', c.siteId], ['clusters', c.siteId], ['guide', c.siteId], ['notes', c.siteId]])
        void qc.invalidateQueries({ queryKey: key })
    },
  })
  const plan = preview.data

  const choose = async (f: File | undefined) => {
    if (!f) return
    apply.reset()
    preview.reset()
    setReplace(new Set())
    setApprove(new Set())
    setReadError('')
    if (!/\.xlsx$/i.test(f.name)) return setReadError('Choose an .xlsx file (Google Sheets: File › Download › Microsoft Excel).')
    if (f.size > XLSX_MAX_BYTES) return setReadError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The cap is 3 MB.`)
    const next = { name: f.name, base64: await fileToBase64(f) }
    setFile(next)
    preview.mutate(next)
  }

  const heading = (
    <h2 id="cs-h" className={CARD_TITLE}>
      Client Sheet (.xlsx) <span className="text-[15px] font-normal text-vv-muted">· whole file, once</span>
    </h2>
  )

  if (!open)
    return (
      <section className={`${CARD} flex-row flex-wrap items-center justify-between`} aria-labelledby="cs-h">
        <span className="flex min-w-0 flex-col gap-1">
          {heading}
          <span className="text-[14px] text-vv-body">An extra way in: drop the client’s Sheet and each tab runs its own import (Master DB, Sam’s Guide, Clusters, Competitors). Dry run first.</span>
        </span>
        <button type="button" className={BTN_GHOST} onClick={() => setOpen(true)}>
          Import a client Sheet
        </button>
      </section>
    )

  const usable = plan?.tabs.filter((t) => t.kind !== 'unused' && !t.blocked) ?? []
  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="cs-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {heading}
        <span className="flex flex-wrap gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => input.current?.click()} disabled={preview.isPending || apply.isPending}>
            {preview.isPending && <Spinner />}
            {file ? 'Choose another file' : 'Choose the .xlsx'}
          </button>
          <button type="button" className={BTN_GHOST} onClick={() => setOpen(false)} disabled={apply.isPending}>
            Close
          </button>
        </span>
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
      </div>
      <p className="m-0 text-[14px] text-vv-body">
        In Google Sheets: File › Download › Microsoft Excel (.xlsx), 3 MB max. Tabs are recognised by their title and headers. Only values are read (no formulas or formatting); volumes stay exactly as written and only fill empty
        fields. Nothing is saved until you click Apply.
      </p>
      {(readError || preview.error) && <p className="m-0 text-[14px] font-semibold text-vv-red">{readError || errText(preview.error, 'Couldn’t read that file.')}</p>}
      {plan && <SheetPlanView plan={plan} client={c} replace={replace} setReplace={setReplace} approve={approve} setApprove={setApprove} />}
      {plan && !apply.data && (
        <div className="flex flex-wrap items-center gap-3 border-0 border-t border-solid border-vv-line pt-4">
          <button type="button" className={BTN_LIME} disabled={apply.isPending || !usable.length} onClick={() => apply.mutate()}>
            {apply.isPending && <Spinner />}
            Apply to {c.name}
          </button>
          <span className="text-[13px] text-vv-muted">
            {usable.length ? `In this order: ${usable.map((t) => `${KIND[t.kind]} (“${t.name}”)`).join(' → ')}` : 'Nothing in this file can be imported.'}
            {approve.size ? ` · ${approve.size} competitor${approve.size === 1 ? '' : 's'} ticked` : ''}
            {replace.size ? ` · ${replace.size} replace ticked` : ''}
          </span>
          {apply.error && <span className="w-full text-[14px] font-semibold text-vv-red">{errText(apply.error, 'The import didn’t go through. Nothing was saved; try again.')}</span>}
        </div>
      )}
      {apply.data && <Result result={apply.data} />}
    </section>
  )
}

function Result({ result }: { result: SheetApplyResult }) {
  const failed = result.tabs.some((t) => t.status === 'failed')
  return (
    <div className="flex flex-col gap-2">
      <p className={`m-0 rounded-2xl px-4 py-3 text-[15px] font-semibold ${failed || !result.importId ? 'bg-vv-red-100 text-vv-red' : 'bg-vv-green-100 text-vv-green-ink'}`}>
        {!result.importId ? 'Nothing was applied.' : failed ? 'Applied up to the tab that failed (it was undone). The .xlsx and each applied tab are in Import history.' : 'Applied. The .xlsx and each tab’s import are in Import history.'}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px]">
        {result.tabs.map((t) => (
          <li key={t.name} className="flex flex-wrap items-baseline gap-2">
            <span className={STATUS[t.status].cls}>{STATUS[t.status].text}</span>
            <strong className="text-vv-ink">{t.name}</strong>
            <span className="text-vv-muted">
              {KIND[t.kind]}
              {t.message ? ` · ${t.message}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SheetPlanView(props: { plan: SheetPlan; client: ClientDetail; replace: Set<string>; setReplace: (s: Set<string>) => void; approve: Set<string>; setApprove: (s: Set<string>) => void }) {
  const { plan: p } = props
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 text-[13px]">
        {p.tabs.map((t) => (
          <span key={t.name} className={t.kind === 'unused' ? PILL_TODO : t.blocked ? PILL_WAITING : PILL_DONE}>
            {t.name} · {KIND[t.kind]}
            {t.blocked ? ' · won’t import' : ''}
          </span>
        ))}
      </div>
      {p.crossCheck.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-solid border-vv-st-waiting bg-vv-lavender-50 p-3">
          <strong className="text-[14px] text-vv-ink">Sam’s Guide and Clusters disagree on {p.crossCheck.length} keyword pages. The Clusters tab wins.</strong>
          <Table head={['Keyword', 'Sam’s Guide Top 10', 'Clusters tab (used)']} rows={p.crossCheck.map((x) => [x.keyword, x.samsGuide, x.clusters])} />
        </div>
      )}
      {p.tabs.map((t) => (
        <Fold key={t.name} title={`${t.name} · ${KIND[t.kind]}${t.blocked ? ' · won’t import' : ''}`} open={t.kind !== 'unused' && !t.blocked && t.kind !== 'sams_guide'}>
          <TabView tab={t} {...props} />
        </Fold>
      ))}
    </div>
  )
}

function TabView({ tab: t, client: c, replace, setReplace, approve, setApprove }: { tab: SheetTabPlan; client: ClientDetail; replace: Set<string>; setReplace: (s: Set<string>) => void; approve: Set<string>; setApprove: (s: Set<string>) => void }) {
  const toggle = (k: string) => {
    const next = new Set(approve)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setApprove(next)
  }
  return (
    <div className="flex flex-col gap-2 text-[13px] text-vv-body">
      <span className="text-vv-muted">
        {t.why} · {t.rows} rows
      </span>
      {t.blocked && <p className="m-0 rounded-xl bg-vv-red-100 px-3 py-2 font-semibold text-vv-red">Won’t import: {t.blocked}</p>}

      {t.masterDb && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {[
              [`${t.masterDb.unique} keywords`, PILL_TODO],
              [`${t.masterDb.newKeywords} new`, PILL_DONE],
              [`${t.masterDb.existing} already there`, PILL_TODO],
              [`${t.masterDb.filled} with empty numbers to fill`, PILL_DONE],
              [`${t.masterDb.kpFilled} KP ranges to fill`, PILL_DONE],
              [`${t.masterDb.kpKept} KP ranges kept as they are`, PILL_TODO],
              [`${t.masterDb.skippedDuplicates} duplicates`, PILL_TODO],
              [`${t.masterDb.addresses.length} address-like held back`, PILL_TODO],
            ].map(([text, cls]) => (
              <span key={text} className={cls}>
                {text}
              </span>
            ))}
          </div>
          {t.masterDb.differences.length > 0 && (
            <p className="m-0">
              {t.masterDb.differences.length} keywords have different numbers in the Sheet. The numbers already saved (from the real exports) are kept: a Sheet never replaces them.
            </p>
          )}
          {t.masterDb.unmatchedServices.length > 0 && <p className="m-0">Services not found for this client (left empty): {t.masterDb.unmatchedServices.join(', ')}</p>}
          {t.masterDb.unknownRoles.length > 0 && <p className="m-0">Roles not understood (left empty): {t.masterDb.unknownRoles.join(', ')}</p>}
          {t.masterDb.sampleNew.length > 0 && <p className="m-0">New, e.g.: {t.masterDb.sampleNew.join(' · ')}</p>}
        </>
      )}

      {t.samsGuide && (
        <>
          {t.samsGuide.pages.some((pg) => pg.keywords.some((k) => k.action.startsWith('Skipped: the Clusters'))) && <p className="m-0 font-semibold">This file has a Clusters tab, so Sam’s Guide Top 10 adds no pages here (shown for reference).</p>}
          <SamsPlan plan={t.samsGuide} client={c} ticks={replace} setTicks={setReplace} />
        </>
      )}

      {t.clusters && (
        <>
          <Table
            head={['Category', 'Page', 'Priority', 'Primary', 'Keywords']}
            rows={t.clusters.pages.map((pg) => [pg.category, `${pg.name}${pg.url ? ` · ${pg.url.replace(/^https?:\/\/[^/]+/, '') || '/'}` : ''}`, pg.priority ? pg.priority[0].toUpperCase() + pg.priority.slice(1) : 'Medium (default)', pg.primary ?? '—', pg.keywords])}
          />
          {t.clusters.unmatched.length > 0 && (
            <p className="m-0">
              Not in the client’s keywords (skipped, not created): {t.clusters.unmatched.slice(0, 30).map((u) => u.keyword).join(' · ')}
              {t.clusters.unmatched.length > 30 ? ` … +${t.clusters.unmatched.length - 30}` : ''}
            </p>
          )}
          {t.clusters.onTwoPages.length > 0 && <p className="m-0">On two pages (kept on the first): {t.clusters.onTwoPages.map((x) => `${x.keyword} → ${x.kept}`).join(' · ')}</p>}
        </>
      )}

      {t.competitors && (
        <>
          <p className="m-0">Names only (no address, no ratings, no notes). New names are saved only if you tick them.</p>
          <Table
            head={['Save', 'In the Sheet', 'Saved as', 'Action']}
            rows={t.competitors.map((x) => [
              x.approvable ? (
                <input key="t" type="checkbox" className="h-4 w-4 accent-vv-purple" checked={approve.has(x.key)} onChange={() => toggle(x.key)} aria-label={`Save ${x.name} as ${x.code}`} disabled={!!t.blocked} />
              ) : (
                <span key="t" className="text-vv-muted">
                  ·
                </span>
              ),
              x.written,
              x.name ? `${x.code ? `${x.code} ` : ''}${x.name}` : '—',
              <Act key="a" a={x.action} />,
            ])}
          />
        </>
      )}
    </div>
  )
}
