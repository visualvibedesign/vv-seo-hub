import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Bone } from '../../components/ui/Loading'
import { useClient } from '../../hooks/useClients'
import { useReport } from '../../hooks/useReports'
import { agencyDate } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { CHANGE_TONE, changeOf, fmtMetric, REPORT_ROWS, shortDates, snapshotDates, SOURCE_NAME, winsOf } from '../../lib/baseline'
import { clientPath } from '../../lib/clientSetup'
import { BTN_LIME, BTN_LINK, PILL, siteLabel } from '../../lib/ui'
import type { ClientDetail, Report, ReportActionKind } from '../../types/seo'

// 2g · A monthly report laid out for A4: the browser's "Save as PDF" makes the PDF (no server PDF, no new Vercel
// function). Route /clients/{site id}/results/{report id}/print sits inside RequireSession (team login, like every
// page) and outside the sidebar layout. Data = the signed-in report + client APIs only.
// Shown: client name + site domain, title + period, baseline vs this month (dates, change), missing reasons, wins,
// APPROVED notes only, next actions. Never: the private address, accounts, internal notes, Claude drafts or costs.
// ?print=1 opens the print dialog once the report and the fonts are ready. Always light mode (restored on leaving).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const KIND_LABEL: Record<ReportActionKind, string> = { page: 'Page', gbp: 'GBP', links: 'Links', tracking: 'Tracking', other: 'Other' }
/** The notes' three part headings (Claude's draft format) are printed bold when they stand on their own line. */
const NOTE_HEADINGS = new Set(['what moved', 'likely why', 'next 30 days'])

export default function ReportPrintPage() {
  const { siteId = '', reportId = '' } = useParams()
  const [params] = useSearchParams()
  const client = useClient(siteId)
  const report = useReport(siteId, reportId)
  const printed = useRef(false)

  // Light mode for the print view; the person's own choice comes back when they leave.
  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')
    return () => {
      if (wasDark) html.classList.add('dark')
    }
  }, [])

  const ready = !!client.data && !!report.data
  useEffect(() => {
    if (!ready || printed.current || params.get('print') !== '1') return
    printed.current = true
    void document.fonts.ready.then(() => window.setTimeout(() => window.print(), 150))
  }, [ready, params])

  useEffect(() => {
    if (report.data && client.data) document.title = `${client.data.name} · ${report.data.title}`
  }, [report.data, client.data])

  return (
    <div className="min-h-screen bg-vv-cream font-body text-vv-ink print:bg-white">
      {ready && <PageRules r={report.data!} />}
      <div className="mx-auto flex max-w-[210mm] flex-col gap-4 px-4 py-6 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to={`${clientPath(siteId, 'results')}?report=${encodeURIComponent(reportId)}`} className={`${BTN_LINK} text-[14px]`}>
            ‹ Back to the report
          </Link>
          <button type="button" className={BTN_LIME} onClick={() => window.print()} disabled={!ready}>
            Print / Save as PDF
          </button>
        </div>
        {report.isError || client.isError ? (
          <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(report.error ?? client.error, 'Couldn’t load the report.')}</p>
        ) : !ready ? (
          <Bone className="h-[297mm] w-full rounded-[8px]" />
        ) : (
          <>
            {!report.data!.notes && (
              <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] font-semibold text-vv-orange-ink print:hidden">
                {report.data!.notesDraft ? 'The notes are still a draft (not approved), so they’re left out of the PDF.' : 'No approved notes yet, so the notes section is left out of the PDF.'} Approve them on the report first if you want them in.
              </p>
            )}
            <Sheet c={client.data!} r={report.data!} />
          </>
        )}
      </div>
    </div>
  )
}

/** A4 page, margins, colours kept in print, footer text and page numbers (CSS @page margin boxes). */
function PageRules({ r }: { r: Report }) {
  const day = agencyDate(r.sentOn ?? new Date().toISOString())
  const footer = `Prepared by Visual Vibe Design · ${day}`.replace(/["\\]/g, '')
  return (
    <style>{`
      @page { size: A4; margin: 14mm 14mm 16mm;
        @bottom-left { content: "${footer}"; font: 9pt Inter, sans-serif; color: #50575e; }
        @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9pt Inter, sans-serif; color: #50575e; } }
      @media print { html, body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `}</style>
  )
}

function Sheet({ c, r }: { c: ClientDetail; r: Report }) {
  const n = r.numbers
  const rows = REPORT_ROWS.filter((x) => n.sources.includes(x.source))
  const wins = winsOf(rows, n.baseline.snapshots, n.snapshots, n.baseline.label ?? 'the baseline')
  const gsc = n.snapshots.find((s) => s.source === 'gsc')
  const section = 'flex flex-col gap-2 break-inside-avoid'
  const h2 = 'm-0 font-display text-[17px] font-semibold leading-tight'
  return (
    <article className="flex flex-col gap-6 rounded-[8px] bg-white p-[14mm] text-[12px] leading-snug text-[#131314] shadow-[0_14px_30px_-24px_rgba(91,63,208,0.45)] print:rounded-none print:p-0 print:shadow-none">
      <header className="flex flex-col gap-3 border-0 border-b-2 border-solid border-[#7C5CE6] pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4a3a8c]">
          <span>Visual Vibe Design · SEO report</span>
          <span>{r.status === 'sent' && r.sentOn ? `Sent ${agencyDate(r.sentOn)}` : 'Draft'}</span>
        </div>
        <h1 className="m-0 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">
          {c.name}, <em className="font-medium text-[#7C5CE6]">{r.title.replace(/ report$/, '')}.</em>
        </h1>
        <div className="flex flex-col gap-0.5 text-[12px] text-[#50575e]">
          <span>{siteLabel(c.siteUrl)}</span>
          <span>
            Period: {gsc ? snapshotDates(gsc) : r.title.replace(/ report$/, '')} · compared with the {n.baseline.label ?? ''} baseline saved {agencyDate(n.baseline.savedAt)}
          </span>
        </div>
      </header>

      <section className={section} aria-label="Baseline vs this month">
        <h2 className={h2}>Baseline vs this month</h2>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#f3efff] text-left text-[10px] uppercase tracking-[0.05em] text-[#4a3a8c]">
              <th className="px-2 py-1.5 font-bold">Metric</th>
              <th className="px-2 py-1.5 font-bold">Source</th>
              <th className="px-2 py-1.5 text-right font-bold">Baseline</th>
              <th className="px-2 py-1.5 text-right font-bold">This month</th>
              <th className="px-2 py-1.5 text-right font-bold">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const b = n.baseline.snapshots.find((s) => s.source === x.source)
              const m = n.snapshots.find((s) => s.source === x.source)
              const ch = changeOf(x, b?.values[x.metric], m?.values[x.metric])
              return (
                <tr key={`${x.source}.${x.metric}`} className="break-inside-avoid border-0 border-t border-solid border-[#eeeef0]">
                  <td className="px-2 py-1.5 font-semibold">
                    {x.label}
                    {x.lowerIsBetter && <span className="block text-[9.5px] font-normal text-[#50575e]">lower is better</span>}
                  </td>
                  <td className="px-2 py-1.5 text-[#50575e]">{SOURCE_NAME[x.source]}</td>
                  <td className="px-2 py-1.5 text-right">
                    {fmtMetric(x.kind, b?.values[x.metric])}
                    <span className="block text-[9.5px] text-[#787c82]">{b ? shortDates(b) : 'not in baseline'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold">
                    {fmtMetric(x.kind, m?.values[x.metric])}
                    <span className="block text-[9.5px] font-normal text-[#787c82]">{m ? shortDates(m) : 'not available'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{ch.tone === 'none' ? <span className="text-[#787c82]">—</span> : <span className={`${PILL} !px-2 !py-0.5 !text-[10.5px] ${CHANGE_TONE[ch.tone]}`}>{ch.text}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {n.missing.length > 0 && (
          <p className="m-0 text-[11px] text-[#50575e]">
            <strong className="text-[#131314]">Not available this month:</strong> {n.missing.map((m) => m.reason).join(' · ')}.
          </p>
        )}
      </section>

      <section className={section} aria-label="Wins">
        <h2 className={h2}>Wins</h2>
        {wins.length ? (
          <div className="grid grid-cols-3 gap-2.5">
            {wins.map((w) => (
              <div key={w.label} className="break-inside-avoid rounded-[12px] border border-dashed border-[#BFAFFF] p-3">
                <div className="font-display text-[20px] font-semibold leading-none">{w.big}</div>
                <div className="mt-1 text-[11px] text-[#50575e]">{w.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[12px] text-[#50575e]">No number got better than the baseline this month yet.</p>
        )}
      </section>

      {r.notes && (
        <section className={section} aria-label="Notes">
          <h2 className={h2}>Notes</h2>
          <div className="whitespace-pre-wrap text-[12px] leading-relaxed">
            {r.notes.split('\n').map((line, i) =>
              NOTE_HEADINGS.has(line.trim().toLowerCase()) ? (
                <strong key={i} className="mt-1 block text-[12.5px] first:mt-0">
                  {line.trim()}
                </strong>
              ) : (
                <span key={i} className="block min-h-[1em]">
                  {line}
                </span>
              ),
            )}
          </div>
        </section>
      )}

      <section className={section} aria-label="Next actions">
        <h2 className={h2}>Next actions</h2>
        {r.actions.length ? (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {r.actions.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 break-inside-avoid rounded-[10px] bg-[#f7f5ff] px-3 py-2">
                <strong>{i + 1}.</strong>
                <span className={`${PILL} !px-2 !py-0 !text-[10px] bg-[#eeeaff] text-[#4a3a8c]`}>{KIND_LABEL[a.kind]}</span>
                <span className={`min-w-0 flex-1 ${a.done ? 'line-through opacity-70' : ''}`}>{a.body}</span>
                <span className="text-[11px] text-[#50575e]">{[a.done ? 'Done' : null, a.owner, a.due ? `due ${agencyDate(a.due)}` : null].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-[12px] text-[#50575e]">No next actions set for this month.</p>
        )}
      </section>
    </article>
  )
}
