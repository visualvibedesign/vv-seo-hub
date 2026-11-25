import { useClientContext } from '../../components/layout/ClientLayout'
import { Dash, GuideChecklist, LilacTable, PageHead, Panel, Soon } from '../../components/overview/OverviewParts'
import { CARD } from '../../lib/ui'
import Icon from '../../components/ui/Icon'

// Client Overview › Results (/clients/{site id}/results): Day 10 + every month, each number compared with the baseline.
// Design: docs/design/overview/Results.dc.html. Real now: the Day 10 checklist (same ticks as the guide). Wins, the
// monthly table, the clicks chart and reports need the baseline + monthly numbers (phase 2): empty, never sample numbers.

const METRICS: { m: string; s: string }[] = [
  { m: 'Impressions', s: 'Search Console' },
  { m: 'Clicks', s: 'Search Console' },
  { m: 'CTR', s: 'Search Console' },
  { m: 'Avg position', s: 'Search Console' },
  { m: 'Organic sessions', s: 'GA4' },
  { m: 'Keywords in top 10', s: 'Semrush CSV' },
  { m: 'Map grid avg rank', s: 'Whitespark' },
  { m: 'GBP calls', s: 'GBP (typed in)' },
  { m: 'Reviews', s: 'GBP (typed in)' },
]

export default function ResultsPage() {
  const c = useClientContext()
  return (
    <>
      <PageHead lead="Results," accent="month by month." sub="Day 10 + every month · each number compared with the baseline." />

      <section className={`${CARD} !rounded-[24px] !border-dashed !border-vv-lavender !gap-2 !p-6 items-start`} aria-label="Wins">
        <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-vv-purple-ink">
          <Icon name="sparkles" className="h-3.5 w-3.5" />
          Wins
        </span>
        <p className="m-0 font-display text-[24px] font-semibold leading-tight">The biggest wins show here once there’s a baseline and a month of numbers.</p>
        <Soon>Comes in phase 2</Soon>
      </section>

      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        <Panel flush title="Every number vs baseline" sub="Monthly snapshots" right={<Soon>Phase 2</Soon>}>
          <LilacTable
            head={['Metric', 'Baseline', 'Latest', 'Change']}
            right={[1, 2, 3]}
            minWidth={480}
            rows={METRICS.map((r) => [
              <div key="m">
                <div className="font-semibold">{r.m}</div>
                <div className="text-[11px] text-vv-body">{r.s}</div>
              </div>,
              <Dash key="b" />,
              <Dash key="l" />,
              <Dash key="c" />,
            ])}
          />
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Clicks from Google" sub="Search Console · per month" right={<Soon>Phase 2</Soon>}>
            <p className="m-0 text-[13px] text-vv-body">One bar per month, starting from the baseline, once Search Console is connected.</p>
          </Panel>
          <GuideChecklist siteId={c.siteId} step={8} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Panel title="Notes for the report" right={<Soon>Phase 2</Soon>}>
          <p className="m-0 text-[13px] leading-relaxed text-vv-body">Claude drafts this from the month’s numbers (what moved, why, the next 30 days). You approve it before it goes in the report.</p>
        </Panel>
        <Panel title="Monthly reports">
          <p className="m-0 text-[13px] text-vv-body">No reports yet. Each month’s report (draft → sent, with the PDF) is listed here.</p>
        </Panel>
      </div>
    </>
  )
}
