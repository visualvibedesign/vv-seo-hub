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
function Sparkline({ values, invert, tone, line }: { values: (number | null)[]; invert?: boolean; tone: Tone; line?: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (pts.length < 2) return <div className="h-10" />
  const ys = pts.map((p) => (invert ? -p[1] : p[1]))
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const d = pts.map((p, i) => `${(p[0] / (values.length - 1)) * 200},${36 - ((ys[i] - lo) / (hi - lo || 1)) * 32}`).join(' ')
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className={`h-10 w-full ${line ?? TONE[tone].ink}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiTile({ label, value, c, tone, spark, invert, note, line }: { label: string; value: string | null; c: Change | null; tone: Tone; spark: (number | null)[]; invert?: boolean; note: string; line?: string }) {
  const t = TONE[tone]
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-[24px] px-[22px] py-5 ${t.bg}`}>
      <span className={`text-[12px] font-bold uppercase tracking-[0.06em] ${t.ink}`}>{label}</span>
      <span className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-display text-[36px] font-semibold leading-none text-vv-ink">{value ?? <Dash />}</span>
        <ChangePill c={c} />
      </span>
      <Sparkline values={spark} invert={invert} tone={tone} line={line} />
      <span className="text-[12px] text-vv-body">{note}</span>
    </div>
  )
}

type Shown = { impressions: boolean; clicks: boolean }

/** A nice round top for an axis: 6 → 6, 47 → 50, 461 → 500, 3,120 → 4,000. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return (steps.find((s) => s * p >= v) ?? 10) * p
}

/** Split a series into runs so a gap (no history) stays a gap, never drawn as 0. */
function runsOf(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): { i: number; pts: string[] }[] {
  const runs: { i: number; pts: string[] }[] = []
  let cur: { i: number; pts: string[] } | null = null
  values.forEach((v, i) => {
    if (v === null) {
      if (cur) runs.push(cur)
      cur = null
    } else {
      cur ??= { i, pts: [] }
      cur.pts.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    }
  })
  if (cur) runs.push(cur)
  return runs
}

/**
 * Search performance, like Search Console (Angel, Nov 26): Impressions (pink, soft area) on the LEFT scale and Clicks
 * (purple) on the RIGHT scale, both on by default. Each scale is labelled in its own colour key; the hover shows the
 * exact values, so nobody has to read one line against the other's scale. Dashed amber line = the baseline date.
 */
function SearchChart({ series, shown, baselineDay }: { series: NonNullable<MetricsOverview['gsc']>['series']; shown: Shown; baselineDay: string | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 800
  const H = 230
  const imp = series.map((s) => s.impressions)
  const clk = series.map((s) => s.clicks)
  const any = (xs: (number | null)[]) => xs.some((v) => v !== null)
  if (!any(imp) && !any(clk)) return <p className="m-0 text-[13px] text-vv-body">No data in this range yet.</p>
  const maxImp = niceMax(Math.max(0, ...imp.filter((v): v is number => v !== null)))
  const maxClk = niceMax(Math.max(0, ...clk.filter((v): v is number => v !== null)))
  const x = (i: number) => (series.length < 2 ? W / 2 : (i / (series.length - 1)) * W)
  const yImp = (v: number) => H - 4 - (v / maxImp) * (H - 16)
  const yClk = (v: number) => H - 4 - (v / maxClk) * (H - 16)
  const impRuns = runsOf(imp, x, yImp)
  const clkRuns = runsOf(clk, x, yClk)
  const grid = [0, 0.25, 0.5, 0.75, 1]
  const weekly = series.length > 1 && Date.parse(series[1].day) - Date.parse(series[0].day) > 2 * 86_400_000
  const bIndex = baselineDay ? series.findIndex((s) => s.day >= baselineDay) : -1
  const h = hover !== null ? series[hover] : null
  const label = (d: string) => (weekly ? `Week of ${shortDay(d)}` : shortDay(d))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px] font-semibold">
        <span className={`flex items-center gap-1.5 ${shown.impressions ? 'text-vv-body' : 'invisible'}`}>
          <span aria-hidden="true" className="h-[3px] w-3.5 rounded-full bg-vv-chart-impr" />
          Impressions
        </span>
        <span className={`flex items-center gap-1.5 ${shown.clicks ? 'text-vv-body' : 'invisible'}`}>
          Clicks
          <span aria-hidden="true" className="h-[3px] w-3.5 rounded-full bg-vv-chart-clicks" />
        </span>
      </div>
      <div className="flex gap-2">
        <div className={`flex h-[230px] w-9 flex-none flex-col justify-between text-right text-[11px] text-vv-muted ${shown.impressions ? '' : 'invisible'}`} aria-hidden="true">
          {[...grid].reverse().map((g) => (
            <span key={g}>{compact(maxImp * g)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[230px] w-full touch-none"
            role="img"
            aria-label={`Impressions and clicks per ${weekly ? 'week' : 'day'}, ${shortDay(series[0].day)} to ${shortDay(series[series.length - 1].day)}`}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
              setHover(Math.max(0, Math.min(series.length - 1, Math.round(((e.clientX - r.left) / r.width) * (series.length - 1)))))
            }}
            onPointerLeave={() => setHover(null)}
          >
            {grid.map((g) => (
              <line key={g} x1="0" x2={W} y1={H - 4 - g * (H - 16)} y2={H - 4 - g * (H - 16)} className="stroke-vv-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {shown.impressions &&
              impRuns.map((r) => (
                <g key={`i${r.i}`}>
                  <polygon points={`${r.pts[0].split(',')[0]},${H - 4} ${r.pts.join(' ')} ${r.pts[r.pts.length - 1].split(',')[0]},${H - 4}`} className="fill-vv-chart-impr-area" />
                  <polyline points={r.pts.join(' ')} fill="none" className="stroke-vv-chart-impr" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            {shown.clicks &&
              clkRuns.map((r) => (
                <polyline key={`c${r.i}`} points={r.pts.join(' ')} fill="none" className="stroke-vv-chart-clicks" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            {bIndex >= 0 && (
              <line x1={x(bIndex)} x2={x(bIndex)} y1="0" y2={H} stroke="#d39b16" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            )}
            {h && hover !== null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-vv-muted" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                {shown.impressions && h.impressions !== null && <circle cx={x(hover)} cy={yImp(h.impressions)} r="4.5" className="fill-vv-chart-impr stroke-vv-surface" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                {shown.clicks && h.clicks !== null && <circle cx={x(hover)} cy={yClk(h.clicks)} r="4.5" className="fill-vv-chart-clicks stroke-vv-surface" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
              </>
            )}
          </svg>
          {h && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 flex min-w-[150px] flex-col gap-0.5 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-2 text-[12px] shadow-[0_10px_24px_-16px_rgba(75,51,181,.5)]"
              style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 75px), calc(100% - 160px))` }}
            >
              <span className="text-vv-body">{label(h.day)}</span>
              {shown.impressions && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vv-chart-impr" />
                  <strong className="text-vv-ink">{h.impressions === null ? 'No data' : int(h.impressions)}</strong> {h.impressions === 1 ? 'impression' : 'impressions'}
                </span>
              )}
              {shown.clicks && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vv-chart-clicks" />
                  <strong className="text-vv-ink">{h.clicks === null ? 'No data' : int(h.clicks)}</strong> {h.clicks === 1 ? 'click' : 'clicks'}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={`flex h-[230px] w-9 flex-none flex-col justify-between text-[11px] text-vv-muted ${shown.clicks ? '' : 'invisible'}`} aria-hidden="true">
          {[...grid].reverse().map((g) => (
            <span key={g}>{compact(maxClk * g)}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-between px-11 text-[11px] text-vv-body">
        {[0, Math.floor((series.length - 1) / 3), Math.floor(((series.length - 1) * 2) / 3), series.length - 1].map((i) => (
          <span key={i}>{series[i] ? shortDay(series[i].day) : ''}</span>
        ))}
      </div>
      {bIndex >= 0 && baselineDay && (
        <span className="flex items-center gap-1.5 text-[11px] text-vv-body">
          <span aria-hidden="true" className="w-3.5 border-0 border-t-2 border-dashed border-[#d39b16]" />
          Baseline {shortDay(baselineDay)}
        </span>
      )}
    </div>
  )
}

/** On/off pills for the two measures (at least one stays on). */
function MeasureToggles({ shown, setShown }: { shown: Shown; setShown: (s: Shown) => void }) {
  const pill = (k: keyof Shown, label: string, dot: string) => {
    const on = shown[k]
    const last = on && !shown[k === 'clicks' ? 'impressions' : 'clicks']
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={last}
        title={last ? 'At least one stays on' : undefined}
        onClick={() => setShown({ ...shown, [k]: !on })}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-solid px-3 font-body text-[12px] font-semibold ${on ? 'border-vv-field-line bg-vv-surface text-vv-ink' : 'border-vv-line bg-transparent text-vv-muted'} disabled:cursor-default`}
      >
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${on ? dot : 'bg-vv-line'}`} />
        {label}
      </button>
    )
  }
  return (
    <div className="flex gap-1.5">
      {pill('impressions', 'Impressions', 'bg-vv-chart-impr')}
      {pill('clicks', 'Clicks', 'bg-vv-chart-clicks')}
    </div>
  )
}

type SortBy = 'clicks' | 'impressions'
/** Clicks / Impressions sort switch for the top lists. */
function SortToggle({ value, onChange }: { value: SortBy; onChange: (v: SortBy) => void }) {
  return (
    <div role="radiogroup" aria-label="Sort by" className="flex rounded-full border border-solid border-vv-field-line p-0.5">
      {(['clicks', 'impressions'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border-0 px-3 font-body text-[12px] font-semibold capitalize ${value === m ? 'bg-vv-lavender-100 text-vv-purple-ink' : 'bg-transparent text-vv-body'}`}
        >
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${m === 'clicks' ? 'bg-vv-chart-clicks' : 'bg-vv-chart-impr'}`} />
          {m}
        </button>
      ))}
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
  const [shown, setShown] = useState<Shown>({ impressions: true, clicks: true })
  const [sortQ, setSortQ] = useState<SortBy>('clicks')
  const [sortP, setSortP] = useState<SortBy>('clicks')
  const q = useMetricsOverview(siteId, range, true)
  const sync = useSyncMetrics(siteId)
  const o = q.data
  const g = o?.gsc ?? null
  const a = o?.ga4 ?? null
  const prevWords = `previous ${RANGE_WORDS[range]}`
  const noData = o && !g && !a
  const by = (k: SortBy) => (x: { clicks: number; impressions: number }, y: { clicks: number; impressions: number }) =>
    k === 'clicks' ? y.clicks - x.clicks || y.impressions - x.impressions : y.impressions - x.impressions || y.clicks - x.clicks
  const queries = g ? [...g.queries].sort(by(sortQ)).slice(0, 10) : []
  const pages = g ? [...g.pages].sort(by(sortP)).slice(0, 6) : []
  const pageMax = Math.max(1, ...pages.map((p) => p[sortP]))
  const word = (k: SortBy, n: number) => (k === 'clicks' ? (n === 1 ? 'click' : 'clicks') : n === 1 ? 'impression' : 'impressions')

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
      {noData && (
        <p className="m-0 rounded-2xl border border-dashed border-vv-lavender bg-vv-surface px-4 py-5 text-[14px] text-vv-body">
          No numbers pulled yet. Press <strong>Update numbers</strong> (the first pull fetches about 16 months).
        </p>
      )}

      {g && (
        <>
          <div className="grid grid-cols-4 gap-4 [@media(max-width:1200px)]:grid-cols-2 phone:grid-cols-1">
            <KpiTile label="Impressions" value={compact(g.now.impressions)} c={change(g.now.impressions, g.prev.impressions, 'count', g.comparable)} tone="pink" line="text-vv-chart-impr" spark={g.series.map((s) => s.impressions)} note={`${prevWords}: ${compact(g.prev.impressions) ?? '—'} · Search Console`} />
            <KpiTile label="Clicks" value={int(g.now.clicks)} c={change(g.now.clicks, g.prev.clicks, 'count', g.comparable)} tone="purple" line="text-vv-chart-clicks" spark={g.series.map((s) => s.clicks)} note={`${prevWords}: ${int(g.prev.clicks) ?? '—'} · Search Console`} />
            <KpiTile label="CTR" value={pct(g.now.ctr)} c={change(g.now.ctr, g.prev.ctr, 'rate', g.comparable)} tone="green" spark={g.series.map((s) => s.ctr)} note={`${prevWords}: ${pct(g.prev.ctr) ?? '—'} · Search Console`} />
            <KpiTile label="Avg position" value={pos(g.now.position)} c={change(g.now.position, g.prev.position, 'position', g.comparable)} tone="orange" spark={g.series.map((s) => s.position)} invert note={`${prevWords}: ${pos(g.prev.position) ?? '—'} · lower is better`} />
          </div>
          {!g.comparable && <p className="m-0 text-[12px] text-vv-body">No change shown: the history SEO Hub has doesn’t cover the whole {prevWords} yet.</p>}
        </>
      )}

      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        {g && (
          <Panel title="Search performance" sub={`Google Search Console · ${shortDay(g.from)} – ${shortDay(g.to)}${range === '12m' ? ' · per week' : ' · per day'}`} right={<MeasureToggles shown={shown} setShown={setShown} />}>
            <SearchChart series={g.series} shown={shown} baselineDay={g.baselineDay} />
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
          <Panel flush title="Top searches" sub={`Search Console · queries · ${RANGE_WORDS[range]}`} right={<SortToggle value={sortQ} onChange={setSortQ} />}>
            {queries.length === 0 ? (
              <p className="m-0 px-5 pb-5 text-[13px] text-vv-body">No searches in this range.</p>
            ) : (
              <LilacTable
                head={['Query', 'Clicks', 'Impr.', 'CTR', 'Position']}
                right={[1, 2, 3, 4]}
                minWidth={520}
                rows={queries.map((x) => {
                  const d = x.prevPosition === null ? null : x.prevPosition - x.position
                  return [
                    x.label,
                    sortQ === 'clicks' ? <strong key="c">{int(x.clicks)}</strong> : int(x.clicks),
                    sortQ === 'impressions' ? <strong key="i">{int(x.impressions)}</strong> : int(x.impressions),
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
          <Panel title="Top pages" sub={`Search Console · pages · ${RANGE_WORDS[range]}`} right={<SortToggle value={sortP} onChange={setSortP} />}>
            {pages.length === 0 && <p className="m-0 text-[13px] text-vv-body">No pages in this range.</p>}
            {pages.map((p) => {
              const main = p[sortP]
              const otherKey: SortBy = sortP === 'clicks' ? 'impressions' : 'clicks'
              const other = p[otherKey]
              return (
                <a key={p.label} href={p.label} target="_blank" rel="noopener noreferrer" title={p.label} className="group flex flex-col gap-1 rounded-lg text-vv-ink no-underline">
                  <span className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate group-hover:text-vv-purple-deep group-hover:underline">
                      {p.label.replace(/^https?:\/\/[^/]+/, '') || '/'} <span aria-hidden="true">↗</span>
                    </span>
                    <span className="flex flex-none items-baseline gap-2">
                      <strong>
                        {int(main)} {word(sortP, main)}
                      </strong>
                      <span className="text-[11px] text-vv-muted">
                        {int(other)} {word(otherKey, other)}
                      </span>
                    </span>
                  </span>
                  <span className="h-2 rounded-full bg-vv-lavender-50">
                    <span className={`block h-2 rounded-full ${sortP === 'clicks' ? 'bg-vv-chart-clicks' : 'bg-vv-chart-impr'}`} style={{ width: `${Math.max(2, (main / pageMax) * 100)}%` }} />
                  </span>
                </a>
              )
            })}
          </Panel>
        </div>
      )}
    </section>
  )
}
