import { useState } from 'react'
import { useMetricsOverview, useSyncMetrics } from '../../hooks/useGoogle'
import { ApiError } from '../../lib/api'
import { TONE, type Tone } from '../../lib/tones'
import { BTN_GHOST, PILL } from '../../lib/ui'
import type { MetricRange, MetricsOverview } from '../../types/seo'
import { Bone, Spinner } from '../ui/Loading'
import { Dash, LilacTable, Panel } from './OverviewParts'

// Client Overview › Search Console + GA4 numbers (phase 2b; design docs/design/overview/Main.dc.html). Read from the
// last pull (daily cron + "Update numbers"). Each range is compared with the period of the same length just before;
// no change is shown when the history doesn't cover that period. One measure per chart (never two y-axes): the
// Search performance chart switches between Clicks and Impressions. A missing day is a gap, never 0.

const RANGES: { key: MetricRange; label: string }[] = [
  { key: '28d', label: '28 days' },
  { key: '3m', label: '3 months' },
  { key: '12m', label: '12 months' },
]
const RANGE_WORDS: Record<MetricRange, string> = { '28d': '28 days', '3m': '3 months', '12m': '12 months' }

const int = (n: number | null) => (n === null ? null : Math.round(n).toLocaleString('en-US'))
const compact = (n: number | null) => (n === null ? null : n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : Math.round(n).toLocaleString('en-US'))
const pct = (n: number | null, digits = 1) => (n === null ? null : `${(n * 100).toFixed(digits)}%`)
const pos = (n: number | null) => (n === null ? null : n.toFixed(1))
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const secs = (n: number | null) => (n === null ? null : `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`)

type Change = { text: string; good: boolean | null }
/** % change (counts), points (CTR) or places (position: lower is better). null = not comparable. */
function change(now: number | null, prev: number | null, kind: 'count' | 'rate' | 'position', comparable: boolean): Change | null {
  if (!comparable || now === null || prev === null) return null
  if (kind === 'count') {
    if (prev === 0) return now === 0 ? { text: '0%', good: null } : null
    const p = ((now - prev) / prev) * 100
    return { text: `${p > 0 ? '+' : ''}${Math.round(p)}%`, good: Math.round(p) === 0 ? null : p > 0 }
  }
  if (kind === 'rate') {
    const d = (now - prev) * 100
    return { text: `${d > 0 ? '+' : ''}${d.toFixed(1)} pts`, good: Math.abs(d) < 0.05 ? null : d > 0 }
  }
  const d = prev - now
  return { text: `${d > 0 ? '↑' : d < 0 ? '↓' : ''} ${Math.abs(d).toFixed(1)}`.trim(), good: Math.abs(d) < 0.05 ? null : d > 0 }
}

function ChangePill({ c }: { c: Change | null }) {
  if (!c) return null
  const cls = c.good === null ? 'bg-vv-surface text-vv-body' : c.good ? 'bg-vv-surface text-vv-green-ink' : 'bg-vv-surface text-vv-red'
  return <span className={`${PILL} !px-2.5 !py-0.5 !text-[12px] ${cls}`}>{c.text}</span>
}

/** Tiny line for a tile (no axis). Position is drawn upside down (lower = better = higher on the tile). */
function Sparkline({ values, invert, tone }: { values: (number | null)[]; invert?: boolean; tone: Tone }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (pts.length < 2) return <div className="h-10" />
  const ys = pts.map((p) => (invert ? -p[1] : p[1]))
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const d = pts.map((p, i) => `${(p[0] / (values.length - 1)) * 200},${36 - ((ys[i] - lo) / (hi - lo || 1)) * 32}`).join(' ')
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className={`h-10 w-full ${TONE[tone].ink}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiTile({ label, value, c, tone, spark, invert, note }: { label: string; value: string | null; c: Change | null; tone: Tone; spark: (number | null)[]; invert?: boolean; note: string }) {
  const t = TONE[tone]
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-[24px] px-[22px] py-5 ${t.bg}`}>
      <span className={`text-[12px] font-bold uppercase tracking-[0.06em] ${t.ink}`}>{label}</span>
      <span className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-display text-[36px] font-semibold leading-none text-vv-ink">{value ?? <Dash />}</span>
        <ChangePill c={c} />
      </span>
      <Sparkline values={spark} invert={invert} tone={tone} />
      <span className="text-[12px] text-vv-body">{note}</span>
    </div>
  )
}

/** One measure over time with a hover crosshair. A null point is a gap (no history), never 0. */
function LineChart({ points, label, format }: { points: { day: string; v: number | null }[]; label: string; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 800
  const H = 220
  const vals = points.map((p) => p.v).filter((v): v is number => v !== null)
  if (!vals.length) return <p className="m-0 text-[13px] text-vv-body">No data in this range yet.</p>
  const max = Math.max(...vals) || 1
  const x = (i: number) => (points.length < 2 ? W / 2 : (i / (points.length - 1)) * W)
  const y = (v: number) => H - 6 - (v / max) * (H - 24)
  // Split into runs so a gap stays a gap.
  const runs: string[] = []
  let cur: string[] = []
  points.forEach((p, i) => {
    if (p.v === null) {
      if (cur.length) runs.push(cur.join(' '))
      cur = []
    } else cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
  })
  if (cur.length) runs.push(cur.join(' '))
  const ticks = [0, 0.5, 1].map((f) => max * f)
  const h = hover !== null ? points[hover] : null
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[220px] w-full touch-none text-vv-purple"
        role="img"
        aria-label={`${label} per ${points.length > 60 ? 'week' : 'day'}`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1))
          setHover(Math.max(0, Math.min(points.length - 1, i)))
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} className="stroke-vv-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {runs.map((r) => (
          <polyline key={r} points={r} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {h && h.v !== null && hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-vv-muted" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(h.v)} r="5" fill="currentColor" className="stroke-vv-surface" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="pointer-events-none absolute left-0 top-0 flex h-[220px] flex-col justify-between py-1 text-[11px] text-vv-muted" aria-hidden="true">
        {[...ticks].reverse().map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-2 text-[12px] shadow-[0_10px_24px_-16px_rgba(75,51,181,.5)]"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 140px))` }}
        >
          <div className="text-vv-body">{points.length > 60 || points.length === 53 ? `Week of ${shortDay(h.day)}` : shortDay(h.day)}</div>
          <strong className="text-vv-ink">{h.v === null ? 'No data' : `${format(h.v)} ${label.toLowerCase()}`}</strong>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[11px] text-vv-body">
        {[0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1].map((i) => (
          <span key={i}>{points[i] ? shortDay(points[i].day) : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** Sessions per day / week / month, with a per-bar hover. */
function Bars({ bars }: { bars: NonNullable<MetricsOverview['ga4']>['bars'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map((b) => b.sessions ?? 0))
  const h = hover !== null ? bars[hover] : null
  return (
    <div className="relative">
      <div className="flex h-[120px] items-end gap-[2px]" role="img" aria-label="Organic sessions">
        {bars.map((b, i) => (
          <div key={b.from} className="flex h-full min-w-0 flex-1 items-end" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <div
              className={`w-full rounded-t-[4px] ${b.sessions === null ? 'border border-dashed border-vv-line bg-transparent' : i === bars.length - 1 ? 'bg-vv-purple' : 'bg-vv-lavender'}`}
              style={{ height: b.sessions === null ? '100%' : `${Math.max(2, (b.sessions / max) * 100)}%`, opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </div>
        ))}
      </div>
      {h && (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-1.5 text-[12px] shadow-[0_10px_24px_-16px_rgba(75,51,181,.5)]">
          <span className="text-vv-body">{h.from === h.to ? shortDay(h.from) : `${shortDay(h.from)} – ${shortDay(h.to)}`}</span> · <strong>{h.sessions === null ? 'No data' : `${int(h.sessions)} sessions`}</strong>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[11px] text-vv-body">
        <span>{bars[0]?.label}</span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export default function GoogleNumbers({ siteId }: { siteId: string }) {
  const [range, setRange] = useState<MetricRange>('28d')
  const [metric, setMetric] = useState<'clicks' | 'impressions'>('clicks')
  const q = useMetricsOverview(siteId, range, true)
  const sync = useSyncMetrics(siteId)
  const o = q.data
  const g = o?.gsc ?? null
  const a = o?.ga4 ?? null
  const prevWords = `previous ${RANGE_WORDS[range]}`
  const noData = o && !g && !a

  return (
    <section className="flex flex-col gap-4" aria-label="Search Console and GA4 numbers">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Range" className="flex rounded-full border border-solid border-vv-field-line bg-vv-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => setRange(r.key)}
              className={`min-h-9 rounded-full border-0 px-4 font-body text-[13px] font-semibold ${range === r.key ? 'bg-vv-purple text-white' : 'bg-transparent text-vv-body hover:text-vv-ink'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-vv-body">
          {o?.lastSyncAt && <span>Pulled {new Date(o.lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
          <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[13px]`} disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending && <Spinner />}
            {sync.isPending ? 'Pulling…' : 'Update numbers'}
          </button>
        </span>
      </div>
      {(sync.data?.errors.length ?? 0) > 0 && <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">{sync.data!.errors.join(' · ')}</p>}
      {sync.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{sync.error instanceof ApiError && sync.error.detail ? sync.error.detail : 'Couldn’t pull the numbers.'}</p>}
      {!sync.data && o?.lastSyncOk === false && o.lastError && <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">Last pull: {o.lastError}</p>}

      {q.isPending && <Bone className="h-[160px] w-full rounded-[24px]" />}
      {q.isError && <p className="m-0 text-[14px] font-semibold text-vv-red">Couldn’t load the numbers. Try again in a moment.</p>}
      {noData && <p className="m-0 rounded-2xl border border-dashed border-vv-lavender bg-vv-surface px-4 py-5 text-[14px] text-vv-body">No numbers pulled yet. Press <strong>Update numbers</strong> (the first pull fetches about 16 months).</p>}

      {g && (
        <>
          <div className="grid grid-cols-4 gap-4 [@media(max-width:1200px)]:grid-cols-2 phone:grid-cols-1">
            <KpiTile label="Impressions" value={compact(g.now.impressions)} c={change(g.now.impressions, g.prev.impressions, 'count', g.comparable)} tone="purple" spark={g.series.map((s) => s.impressions)} note={`${prevWords}: ${compact(g.prev.impressions) ?? '—'} · Search Console`} />
            <KpiTile label="Clicks" value={int(g.now.clicks)} c={change(g.now.clicks, g.prev.clicks, 'count', g.comparable)} tone="pink" spark={g.series.map((s) => s.clicks)} note={`${prevWords}: ${int(g.prev.clicks) ?? '—'} · Search Console`} />
            <KpiTile label="CTR" value={pct(g.now.ctr)} c={change(g.now.ctr, g.prev.ctr, 'rate', g.comparable)} tone="green" spark={g.series.map((s) => s.ctr)} note={`${prevWords}: ${pct(g.prev.ctr) ?? '—'} · Search Console`} />
            <KpiTile label="Avg position" value={pos(g.now.position)} c={change(g.now.position, g.prev.position, 'position', g.comparable)} tone="orange" spark={g.series.map((s) => s.position)} invert note={`${prevWords}: ${pos(g.prev.position) ?? '—'} · lower is better`} />
          </div>
          {!g.comparable && <p className="m-0 text-[12px] text-vv-body">No change shown: the history SEO Hub has doesn’t cover the whole {prevWords} yet.</p>}
        </>
      )}

      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        {g && (
          <Panel
            title="Search performance"
            sub={`Google Search Console · ${shortDay(g.from)} – ${shortDay(g.to)}${range === '12m' ? ' · per week' : ' · per day'}`}
            right={
              <div role="radiogroup" aria-label="Measure" className="flex rounded-full border border-solid border-vv-field-line p-0.5">
                {(['clicks', 'impressions'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={metric === m} onClick={() => setMetric(m)} className={`min-h-8 rounded-full border-0 px-3 font-body text-[12px] font-semibold capitalize ${metric === m ? 'bg-vv-lavender-100 text-vv-purple-ink' : 'bg-transparent text-vv-body'}`}>
                    {m}
                  </button>
                ))}
              </div>
            }
          >
            <LineChart points={g.series.map((s) => ({ day: s.day, v: s[metric] }))} label={metric === 'clicks' ? 'Clicks' : 'Impressions'} format={(n) => Math.round(n).toLocaleString('en-US')} />
          </Panel>
        )}
        {a && (
          <Panel title="Website traffic" sub={`GA4 · organic search · ${shortDay(a.from)} – ${shortDay(a.to)}`}>
            <span className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-display text-[32px] font-semibold leading-none">{int(a.now.sessions) ?? <Dash />}</span>
              <span className="text-[13px] text-vv-body">sessions</span>
              <ChangePill c={change(a.now.sessions, a.prev.sessions, 'count', a.comparable)} />
            </span>
            <Bars bars={a.bars} />
            <div className="grid grid-cols-3 gap-2.5 border-0 border-t border-solid border-vv-line pt-3">
              {[
                [int(a.now.users), 'Users'],
                [int(a.now.keyEvents), 'Key events'],
                [secs(a.now.avgSeconds), 'Avg session'],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-[18px] font-bold">{v ?? <Dash />}</div>
                  <div className="text-[12px] text-vv-body">{l}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {g && (
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
          <Panel flush title="Top searches" sub={`Search Console · queries · ${RANGE_WORDS[range]}`}>
            {g.queries.length === 0 ? (
              <p className="m-0 px-5 pb-5 text-[13px] text-vv-body">No searches in this range.</p>
            ) : (
              <LilacTable
                head={['Query', 'Clicks', 'Impr.', 'CTR', 'Position']}
                right={[1, 2, 3, 4]}
                minWidth={520}
                rows={g.queries.map((x) => {
                  const d = x.prevPosition === null ? null : x.prevPosition - x.position
                  return [
                    x.label,
                    <strong key="c">{int(x.clicks)}</strong>,
                    int(x.impressions),
                    pct(x.ctr),
                    <span key="p" className="whitespace-nowrap">
                      {x.position.toFixed(1)}{' '}
                      <span className={`text-[12px] font-semibold ${d === null ? 'text-vv-purple-deep' : d >= 0.5 ? 'text-vv-green-ink' : d <= -0.5 ? 'text-vv-red' : 'text-vv-muted'}`}>
                        {d === null ? 'new' : Math.abs(d) < 0.5 ? '·' : `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(0)}`}
                      </span>
                    </span>,
                  ]
                })}
              />
            )}
          </Panel>
          <Panel title="Top pages" sub={`Search Console · pages · ${RANGE_WORDS[range]}`}>
            {g.pages.length === 0 && <p className="m-0 text-[13px] text-vv-body">No pages in this range.</p>}
            {g.pages.map((p) => (
              <div key={p.label} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate" title={p.label}>
                    {p.label.replace(/^https?:\/\/[^/]+/, '') || '/'}
                  </span>
                  <strong className="flex-none">{int(p.clicks)} {p.clicks === 1 ? 'click' : 'clicks'}</strong>
                </div>
                <div className="h-2 rounded-full bg-vv-lavender-50">
                  <div className="h-2 rounded-full bg-vv-purple" style={{ width: `${Math.max(2, (p.clicks / Math.max(1, g.pages[0].clicks)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </section>
  )
}
