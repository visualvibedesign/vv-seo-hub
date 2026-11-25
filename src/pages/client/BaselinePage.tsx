import { useClientContext } from '../../components/layout/ClientLayout'
import { Dash, GuideChecklist, PageHead, Soon } from '../../components/overview/OverviewParts'
import { TONE, type Tone } from '../../lib/tones'
import { CARD, PILL } from '../../lib/ui'

// Client Overview › Baseline (/clients/{site id}/baseline): Sam's Day 3, the starting numbers, each saved with its
// exact date. Design: docs/design/overview/Baseline.dc.html. Real now: the Day 3 checklist (same ticks as the guide).
// The six sources are empty until phase 2 (uploads, Google APIs, typed GBP numbers): never sample numbers.

const SOURCES: { i: string; name: string; how: string; tone: Tone; nums: string[] }[] = [
  { i: 'SR', name: 'Semrush Position Tracking', how: 'CSV import · US national · numbers exactly as exported', tone: 'pink', nums: ['Avg position', 'In top 10', 'In top 3', 'Visibility'] },
  { i: 'SC', name: 'Search Console', how: 'Pulled from Google · last 28 days', tone: 'purple', nums: ['Impressions', 'Clicks', 'CTR', 'Avg position'] },
  { i: 'GA', name: 'GA4', how: 'Pulled from Google · organic search', tone: 'green', nums: ['Sessions', 'Users', 'Conversions', 'Avg time'] },
  { i: 'GB', name: 'Google Business Profile', how: 'Typed in · last 28 days', tone: 'orange', nums: ['Profile views', 'Calls', 'Directions', 'Reviews'] },
  { i: 'WS', name: 'Whitespark map grid', how: 'CSV + screenshot · main service · 5×5', tone: 'purple', nums: ['Avg rank', 'In top 3', 'Grid spacing', 'Points'] },
  { i: 'PG', name: 'Site check snapshot', how: 'From the Site check tab · all live pages', tone: 'pink', nums: ['Site health', 'Pages', 'Problems', 'Mobile speed'] },
]

export default function BaselinePage() {
  const c = useClientContext()
  return (
    <>
      <PageHead lead="Baseline," accent="where we started." sub="Day 3 · the starting numbers, each saved with its exact date. Results compares everything against this.">
        <span className={`${PILL} !px-3.5 !py-2 !text-[13px] bg-vv-st-todo text-vv-st-todo-ink`}>0 of {SOURCES.length} saved</span>
      </PageHead>

      <GuideChecklist siteId={c.siteId} step={2} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-4">
        {SOURCES.map((s) => (
          <section key={s.name} className={`${CARD} !gap-3.5 !rounded-[20px] !p-5`} aria-label={s.name}>
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <span className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] text-[13px] font-bold ${TONE[s.tone].bg} ${TONE[s.tone].ink}`}>{s.i}</span>
                <div>
                  <h2 className="m-0 font-display text-[19px] font-semibold leading-tight">{s.name}</h2>
                  <div className="text-[12px] text-vv-body">{s.how}</div>
                </div>
              </div>
              <span className={`${PILL} !py-1 bg-vv-orange-100 text-vv-orange-ink`}>Not saved</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {s.nums.map((l) => (
                <div key={l} className="rounded-[14px] bg-vv-lavender-50 px-3 py-2.5">
                  <div className="font-display text-[22px] font-semibold">
                    <Dash />
                  </div>
                  <div className="text-[12px] text-vv-body">{l}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-0 border-t border-solid border-vv-line pt-3">
              <span className="text-[12px] text-vv-body">No date yet</span>
              <Soon>{s.i === 'PG' ? 'Comes with Site check' : 'Comes in phase 2'}</Soon>
            </div>
          </section>
        ))}
      </div>

      <p className="m-0 text-[12px] text-vv-body">Semrush stays in Semrush: we only import its CSV, numbers exactly as exported. A client’s private address is never stored or shown.</p>
    </>
  )
}
