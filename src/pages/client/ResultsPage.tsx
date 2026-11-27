import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { GuideChecklist, LilacTable, PageHead, Panel } from '../../components/overview/OverviewParts'
import ClicksChart from '../../components/results/ClicksChart'
import CreateReport from '../../components/results/CreateReport'
import ReportView from '../../components/results/ReportView'
import Icon from '../../components/ui/Icon'
import { Bone } from '../../components/ui/Loading'
import { useReportList, useReports } from '../../hooks/useReports'
import { ApiError } from '../../lib/api'
import { CHANGE_TONE, changeOf, creatableMonths, fmtMetric, REPORT_ROWS, SOURCE_NAME, winsOf } from '../../lib/baseline'
import { clientPath } from '../../lib/clientSetup'
import { BTN_LIME, CARD, PILL } from '../../lib/ui'
import type { Report, ReportsState } from '../../types/seo'

// Client Overview › Results (/clients/{site id}/results): Day 10 + every month, each number vs the baseline.
// Design: docs/design/overview/Results.dc.html. Reports start from the month the baseline ends in (decided Nov 28).
// Wins are worked out by code from the latest report. ?report={id} opens one report. Never sample numbers.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const mon = (m: string) => new Date(`${m}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })
const savedOn = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function ResultsPage() {
  const c = useClientContext()
  const q = useReports(c.siteId)
  const [params, setParams] = useSearchParams()
  const openId = params.get('report')
  const [creating, setCreating] = useState(false)
  const view = useRef<HTMLDivElement>(null)
  const s = q.data
  // The last 3 reports (oldest → newest) for the table and the wins.
  const last3 = (s?.reports ?? []).slice(0, 3).reverse()
  const full = useReportList(c.siteId, last3.map((r) => r.id))
  const loaded = full.map((x) => x.data).filter((x): x is Report => !!x)
  const latest = loaded[loaded.length - 1]
  const months = s ? creatableMonths(s) : []

  const open = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('report', id)
    else next.delete('report')
    setParams(next, { replace: false })
  }
  useEffect(() => {
    if (openId) view.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [openId])

  const sub = latest ? `Day 10 + every month · each number compared with the ${latest.numbers.baseline.label ?? ''} baseline (saved ${savedOn(latest.numbers.baseline.savedAt)})`.replace('the  baseline', 'the baseline') : 'Day 10 + every month · each number compared with the baseline.'

  return (
    <>
      <PageHead lead="Results," accent="month by month." sub={sub}>
        {s &&
          (!s.hasBaseline ? (
            <Link to={clientPath(c.siteId, 'baseline')} className={BTN_LIME}>
              Save a baseline first
            </Link>
          ) : (
            <button type="button" className={BTN_LIME} onClick={() => setCreating(true)} disabled={months.length === 0} title={months.length === 0 ? 'Every month from the baseline onward has a report' : undefined}>
              {months.length ? `Create ${months[0].title}` : 'All months have a report'}
            </button>
          ))}
      </PageHead>

      {q.isError && <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the reports. Try again in a moment.')}</p>}

      <div ref={view} className="scroll-mt-6">
        {openId && <ReportView siteId={c.siteId} id={openId} onClose={() => open(null)} />}
      </div>

      <Wins s={s} latest={latest} pending={q.isPending || full.some((x) => x.isPending)} />

      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        <EveryNumber reports={loaded} pending={q.isPending || full.some((x) => x.isPending)} />
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Clicks from Google" sub="Search Console · per month">
            {q.isPending ? <Bone className="h-[170px] w-full rounded-2xl" /> : s ? <ClicksChart data={s.clicksByMonth} /> : null}
          </Panel>
          <GuideChecklist siteId={c.siteId} step={8} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Panel title="Notes for the report" sub={latest ? latest.title : undefined}>
          {latest?.notes ? (
            <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed">{latest.notes}</p>
          ) : (
            <p className="m-0 text-[13px] leading-relaxed text-vv-body">Claude drafts this from the month’s numbers (what moved, likely why, the next 30 days). You edit and approve it before it goes in the report. Comes in the next step.</p>
          )}
        </Panel>
        <ReportsList s={s} pending={q.isPending} openId={openId} onOpen={open} />
      </div>

      {creating && s && (
        <CreateReport
          siteId={c.siteId}
          state={s}
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            open(id)
          }}
        />
      )}
    </>
  )
}

function Wins({ s, latest, pending }: { s: ReportsState | undefined; latest: Report | undefined; pending: boolean }) {
  if (pending) return <Bone className="h-[120px] w-full rounded-[24px]" />
  const box = `${CARD} !rounded-[24px] !border-dashed !border-vv-lavender !gap-2 !p-6`
  const head = (
    <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-vv-purple-ink">
      <Icon name="sparkles" className="h-3.5 w-3.5" />
      Win
    </span>
  )
  if (!latest)
    return (
      <section className={box} aria-label="Wins">
        {head}
        <p className="m-0 font-display text-[22px] font-semibold leading-tight">{s?.hasBaseline ? 'The biggest wins show here once there’s a monthly report.' : 'Save a baseline, then create the first monthly report.'}</p>
      </section>
    )
  const wins = winsOf(REPORT_ROWS.filter((r) => latest.numbers.sources.includes(r.source)), latest.numbers.baseline.snapshots, latest.numbers.snapshots, latest.numbers.baseline.label ?? 'the baseline')
  if (!wins.length)
    return (
      <section className={box} aria-label="Wins">
        {head}
        <p className="m-0 font-display text-[22px] font-semibold leading-tight">No wins yet vs the baseline in the {latest.title}.</p>
        <p className="m-0 text-[13px] text-vv-body">Wins show when a number gets better than the baseline.</p>
      </section>
    )
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4" aria-label="Wins">
      {wins.map((w) => (
        <section key={w.label} className={box}>
          {head}
          <span className="font-display text-[34px] font-semibold leading-none">{w.big}</span>
          <span className="text-[13px] text-vv-body">{w.text}</span>
        </section>
      ))}
    </div>
  )
}

function EveryNumber({ reports, pending }: { reports: Report[]; pending: boolean }) {
  const latest = reports[reports.length - 1]
  if (pending || !latest)
    return (
      <Panel title="Every number vs baseline" sub="Monthly snapshots">
        {pending ? <Bone className="h-[240px] w-full rounded-2xl" /> : <p className="m-0 text-[13px] text-vv-body">Each month’s numbers show here next to the baseline once there’s a report.</p>}
      </Panel>
    )
  const base = latest.numbers.baseline
  const rows = REPORT_ROWS.filter((r) => latest.numbers.sources.includes(r.source))
  return (
    <Panel flush title="Every number vs baseline" sub={`Baseline · ${base.label ?? 'saved'} ${savedOn(base.savedAt)} · latest ${reports.length} report${reports.length === 1 ? '' : 's'}`}>
      <LilacTable
        head={['Metric', 'Baseline', ...reports.map((r) => mon(r.month)), 'Change']}
        right={[1, ...reports.map((_, i) => i + 2), reports.length + 2]}
        minWidth={480}
        rows={rows.map((x) => {
          const b = base.snapshots.find((s) => s.source === x.source)?.values[x.metric]
          const now = latest.numbers.snapshots.find((s) => s.source === x.source)?.values[x.metric]
          const ch = changeOf(x, b, now)
          return [
            <div key="m">
              <div className="font-semibold">{x.label}</div>
              <div className="text-[11px] text-vv-body">{SOURCE_NAME[x.source]}</div>
            </div>,
            <span key="b">{fmtMetric(x.kind, b)}</span>,
            ...reports.map((r) => {
              const v = r.numbers.snapshots.find((s) => s.source === x.source)?.values[x.metric]
              const why = r.numbers.missing.find((m) => m.source === x.source)?.reason
              return (
                <span key={r.id} title={why} className={r.id === latest.id ? 'font-semibold' : ''}>
                  {fmtMetric(x.kind, v)}
                </span>
              )
            }),
            ch.tone === 'none' ? (
              <span key="c" className={CHANGE_TONE.none}>
                —
              </span>
            ) : (
              <span key="c" className={`${PILL} !px-2.5 !py-0.5 ${CHANGE_TONE[ch.tone]}`} title={x.lowerIsBetter ? 'Lower is better' : undefined}>
                {ch.text}
              </span>
            ),
          ]
        })}
      />
    </Panel>
  )
}

function ReportsList({ s, pending, openId, onOpen }: { s: ReportsState | undefined; pending: boolean; openId: string | null; onOpen: (id: string) => void }) {
  return (
    <Panel title="Monthly reports" sub={s?.firstMonth ? `From ${new Date(`${s.firstMonth}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, the month the baseline ends in` : undefined}>
      {pending ? (
        <Bone className="h-[100px] w-full rounded-2xl" />
      ) : !s || s.reports.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">No reports yet. Each month’s report (draft → sent) is listed here.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {s.reports.map((r) => (
            <li key={r.id} className="border-0 border-t border-solid border-vv-line first:border-t-0">
              <button type="button" aria-current={openId === r.id ? 'true' : undefined} onClick={() => onOpen(r.id)} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border-0 bg-transparent px-2 py-2.5 text-left font-body text-vv-ink hover:bg-vv-lavender-50 ${openId === r.id ? 'bg-vv-lavender-50' : ''}`}>
                <span className="flex min-w-0 flex-col">
                  <strong className="text-[14px]">{r.title}</strong>
                  <span className="text-[12px] text-vv-body">{r.dates ?? 'No Search Console window'}</span>
                </span>
                <span className={`${PILL} ${r.status === 'sent' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>{r.status === 'sent' && r.sentOn ? `Sent · ${savedOn(r.sentOn)}` : 'Draft'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
