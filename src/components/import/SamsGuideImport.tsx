import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '../ui/Loading'
import { ApiError, applySamsGuide, previewSamsGuide } from '../../lib/api'
import { fileToBase64 } from '../../lib/readCsv'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, PILL_DONE, PILL_TODO, PILL_WAITING } from '../../lib/ui'
import type { ClientDetail, SamsGuidePlan } from '../../types/seo'

// Sam's Guide sheet (one-time per client), on Keywords › Import. Choose the CSV → dry run (nothing saved) →
// tick "replace" on conflicts you want the sheet to win → Apply. The server builds the plan again on Apply.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const tone = (action: string) =>
  action.startsWith('Conflict') ? PILL_WAITING : /^(No change|Held|Refused)/.test(action) ? PILL_TODO : action.startsWith('Same') ? PILL_TODO : PILL_DONE

export default function SamsGuideImport({ client: c }: { client: ClientDetail }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [ticks, setTicks] = useState<Set<string>>(new Set())
  const preview = useMutation({ mutationFn: (f: { name: string; base64: string }) => previewSamsGuide(c.siteId, f.name, f.base64).then((r) => r.plan) })
  const apply = useMutation({
    mutationFn: () => applySamsGuide(c.siteId, file!.name, file!.base64, [...ticks]),
    onSuccess: () => {
      for (const key of [['imports', c.siteId], ['client', c.siteId], ['clients'], ['keywords', c.siteId], ['matrix', c.siteId], ['clusters', c.siteId], ['guide', c.siteId]])
        void qc.invalidateQueries({ queryKey: key })
    },
  })
  const plan = preview.data

  const choose = async (f: File | undefined) => {
    if (!f) return
    apply.reset()
    setTicks(new Set())
    const next = { name: f.name, base64: await fileToBase64(f) }
    setFile(next)
    preview.mutate(next)
  }

  if (!open)
    return (
      <section className={`${CARD} flex-row flex-wrap items-center justify-between`} aria-labelledby="sg-h">
        <span className="flex min-w-0 flex-col gap-1">
          <h2 id="sg-h" className={CARD_TITLE}>
            Sam’s Guide sheet <span className="text-[15px] font-normal text-vv-muted">· one-time setup</span>
          </h2>
          <span className="text-[14px] text-vv-body">Register → matrix, Top 10 → pages, keep-for-later, competitors (names only). Dry run first.</span>
        </span>
        <button type="button" className={BTN_GHOST} onClick={() => setOpen(true)}>
          Import a Sam’s Guide tab
        </button>
      </section>
    )

  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="sg-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sg-h" className={CARD_TITLE}>
          Sam’s Guide sheet <span className="text-[15px] font-normal text-vv-muted">· one-time setup</span>
        </h2>
        <span className="flex flex-wrap gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => input.current?.click()} disabled={preview.isPending || apply.isPending}>
            {preview.isPending && <Spinner />}
            {file ? 'Choose another file' : 'Choose the CSV'}
          </button>
          <button type="button" className={BTN_GHOST} onClick={() => setOpen(false)} disabled={apply.isPending}>
            Close
          </button>
        </span>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
      </div>
      <p className="m-0 text-[14px] text-vv-body">
        Export the client’s “Sam’s Guide” tab as CSV. You see everything first; nothing is saved until you click Apply. Volumes stay exactly as written and only fill empty fields.
      </p>
      {preview.error && <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(preview.error, 'Couldn’t read that file.')}</p>}
      {plan && <Plan plan={plan} client={c} ticks={ticks} setTicks={setTicks} />}
      {plan && !apply.data && (
        <div className="flex flex-wrap items-center gap-3 border-0 border-t border-solid border-vv-line pt-4">
          <button type="button" className={BTN_LIME} disabled={apply.isPending || !!plan.alreadyImported || !plan.sameClient} onClick={() => apply.mutate()}>
            {apply.isPending && <Spinner />}
            Apply to {c.name}
          </button>
          <span className="text-[13px] text-vv-muted">
            {plan.counts.newKeywords} new keywords · {plan.counts.matrixCells} matrix cells · {plan.counts.pages} pages · {plan.counts.later} Later/Rejected · {plan.counts.competitors} competitors
            {ticks.size ? ` · ${ticks.size} replace ticked` : ''}
          </span>
          {apply.error && <span className="w-full text-[14px] font-semibold text-vv-red">{errText(apply.error, 'The import didn’t go through. New keywords and the import were undone; try again.')}</span>}
        </div>
      )}
      {apply.data && (
        <p className="m-0 rounded-2xl bg-vv-green-100 px-4 py-3 text-[15px] font-semibold text-vv-green-ink">
          Applied. The raw CSV is saved in Import history. Check the Matrix, Clusters and Database.
        </p>
      )}
    </section>
  )
}

/** The Sam's Guide dry run (also shown for a Sam's Guide tab in a whole-Sheet import). */
export function Plan({ plan: p, client: c, ticks, setTicks }: { plan: SamsGuidePlan; client: ClientDetail; ticks: Set<string>; setTicks: (s: Set<string>) => void }) {
  const toggle = (k: string) => {
    const next = new Set(ticks)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setTicks(next)
  }
  const n = p.counts
  return (
    <div className="flex flex-col gap-3">
      {p.alreadyImported && (
        <p className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[14px] font-semibold text-vv-red">
          {c.name} already has a Sam’s Guide import ({new Date(p.alreadyImported).toLocaleDateString('en-US')}). Delete it in Import history first to import again.
        </p>
      )}
      {!p.sameClient && (
        <p className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[14px] font-semibold text-vv-red">
          This sheet is for “{p.sheetClient}”, not {c.name}. Open the right client first.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 text-[13px]">
        {[
          [`${n.keywordsInSheet} keywords in the sheet`, PILL_TODO],
          [`${n.newKeywords} new`, PILL_DONE],
          [`${n.existingKeywords} already in`, PILL_TODO],
          [`${n.fills} with volumes to fill`, PILL_DONE],
          [`${n.matrixCells} matrix cells`, PILL_DONE],
          [`${n.pages} pages · ${n.pageKeywords} page keywords`, PILL_DONE],
          [`${n.track} Track on`, PILL_DONE],
          [`${p.later.length} keep for later · ${n.later} to save`, PILL_DONE],
          [`${n.competitors} competitors`, PILL_DONE],
          [`${n.conflicts} conflicts`, n.conflicts ? PILL_WAITING : PILL_TODO],
          [`${n.heldBack} held back`, PILL_TODO],
          [`${n.notUnderstood} not understood`, n.notUnderstood ? PILL_WAITING : PILL_TODO],
          [`${p.skipped.length} sections skipped`, PILL_TODO],
        ].map(([t, cls]) => (
          <span key={t} className={cls}>
            {t}
          </span>
        ))}
      </div>

      {p.conflicts.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-solid border-vv-st-waiting bg-vv-lavender-50 p-3">
          <strong className="text-[14px] text-vv-ink">Conflicts</strong>
          {p.conflicts.map((x) => (
            <label key={x.key} className={`flex items-start gap-2 text-[14px] text-vv-body ${x.replaceable ? 'cursor-pointer' : ''}`}>
              {x.replaceable ? (
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-vv-purple" checked={ticks.has(x.key)} onChange={() => toggle(x.key)} aria-label={`Replace: ${x.text}`} />
              ) : (
                <span className="mt-0.5 inline-block h-4 w-4 flex-none text-center text-vv-muted" aria-hidden="true">
                  ·
                </span>
              )}
              <span>
                {x.text}
                {x.replaceable ? <span className="text-vv-muted"> Tick to let the sheet win.</span> : null}
              </span>
            </label>
          ))}
        </div>
      )}

      <Fold title={`3×3 matrix (${p.matrix.length} cells)`} open>
        <Table head={['Cell', 'State', 'Primary', 'Backups', 'Action']} rows={p.matrix.map((m) => [`${m.id} · ${m.cell}`, m.state === 'n_a' ? 'N/A' : m.state === 'pending' ? 'Pending' : 'Target', m.primary ?? '—', m.backups.join(', ') || '—', <Act key="a" a={m.action} />])} />
      </Fold>
      <Fold title={`Pages + Top 10 (${p.pages.length} pages)`}>
        <div className="flex flex-col gap-3">
          {p.pages.map((pg) => (
            <div key={pg.name} className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-vv-ink">
                {pg.name} <span className="font-normal text-vv-muted">· {pg.category || '?'} · {pg.url ?? 'no URL yet'} · {pg.status === 'live' ? 'Live' : 'Planned'} · {pg.existing ? 'existing page' : 'new page'} · from {pg.from}</span>
              </span>
              <ol className="m-0 flex flex-col gap-0.5 pl-5 text-[13px] text-vv-body">
                {pg.keywords.map((k) => (
                  <li key={k.keyword}>
                    {k.keyword} {k.role === 'primary' && <span className={PILL_DONE}>primary</span>} {k.action !== 'Add' && <Act a={k.action} />}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Fold>
      <Fold title={`New keywords (${p.newKeywords.length}), marked “from Sheet”`}>
        <p className="m-0 text-[13px] text-vv-body">{p.newKeywords.map((k) => k.keyword).join(' · ') || 'None'}</p>
      </Fold>
      <Fold title={`Volumes to fill (${p.fills.length}, empty fields only)`}>
        <Table
          head={['Keyword', 'Semrush', 'KP', 'KD', 'CPC']}
          rows={p.fills.map((f) => [`${f.keyword}${f.isNew ? ' (new)' : ''}`, f.semrush?.toLocaleString('en-US') ?? '—', f.kp ?? '—', f.kd ?? '—', f.cpc != null ? `$${f.cpc}` : '—'])}
        />
      </Fold>
      <Fold title={`Keep for later (${p.later.length} · ${n.later} to save as Later / Rejected)`}>
        <Table head={['Type', 'Keyword', 'Action']} rows={p.later.map((l) => [l.type, l.keyword, <Act key="a" a={l.action} />])} />
        {p.areaNote && (
          <p className="m-0 mt-2 text-[13px] text-vv-body">
            <strong>Note added (Notes &amp; links):</strong> {p.areaNote}
          </p>
        )}
      </Fold>
      <Fold title={`Track on (${p.track.filter((t) => !t.already).length})`}>
        <p className="m-0 text-[13px] text-vv-body">{p.track.map((t) => `${t.keyword}${t.already ? ' (already on)' : ''}`).join(' · ') || 'None'}</p>
      </Fold>
      <Fold title={`Competitors (${p.competitors.length}), names only`}>
        <Table head={['#', 'Saved as', 'In the sheet', 'Action']} rows={p.competitors.map((x) => [x.code, x.name ?? '—', x.written, <Act key="a" a={x.action} />])} />
      </Fold>
      <Fold title={`Not understood (${p.notUnderstood.length}) · sections skipped (${p.skipped.length}) · held back (${p.heldBack.length})`}>
        <ul className="m-0 flex flex-col gap-0.5 pl-5 text-[13px] text-vv-body">
          {p.skipped.map((s) => (
            <li key={`s${s.line}`}>
              Line {s.line}: {s.why}
            </li>
          ))}
          {p.notUnderstood.map((s) => (
            <li key={`n${s.line}${s.text}`} className="text-vv-red">
              Line {s.line} ({s.section}): {s.text}
            </li>
          ))}
          {p.heldBack.map((h) => (
            <li key={h.keyword}>
              Held back: {h.keyword} ({h.why})
            </li>
          ))}
        </ul>
      </Fold>
    </div>
  )
}

export function Act({ a }: { a: string }) {
  return <span className={`${tone(a)} whitespace-normal`}>{a}</span>
}

export function Fold({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-solid border-vv-line px-3 py-2">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-vv-ink [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-2 pt-1">{children}</div>
    </details>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="m-0 text-[13px] text-vv-muted">None</p>
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-vv-surface text-[11px] font-bold uppercase tracking-[0.08em] text-vv-body">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-0 border-t border-solid border-vv-line align-top">
              {r.map((cell, j) => (
                <td key={j} className="px-2 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
