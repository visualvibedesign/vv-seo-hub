// Phase 2e · How baseline numbers are labelled and written (Baseline page now, "Baseline vs now" + Results later).
// The numbers themselves come from the server (server/services/baselineService.ts). null = missing → "—", never 0.
import type { BaselineSnapshot, BaselineSource, ReportsState } from '../types/seo'

export type MetricDef = { key: string; label: string; kind: 'count' | 'pct' | 'pos' | 'secs' | 'rating'; lowerIsBetter?: boolean }

export const SOURCE_NAME: Record<BaselineSource, string> = {
  gsc: 'Search Console',
  ga4: 'GA4',
  semrush: 'Semrush Position Tracking',
  gbp: 'Google Business Profile',
  whitespark: 'Whitespark map grid',
}

/** The four numbers each source card shows, in order. */
export const SOURCE_METRICS: Record<BaselineSource, MetricDef[]> = {
  semrush: [
    { key: 'avg_position', label: 'Avg position (ranking)', kind: 'pos', lowerIsBetter: true },
    { key: 'top10', label: 'In top 10', kind: 'count' },
    { key: 'top3', label: 'In top 3', kind: 'count' },
    { key: 'top100', label: 'In top 100', kind: 'count' },
  ],
  gsc: [
    { key: 'impressions', label: 'Impressions', kind: 'count' },
    { key: 'clicks', label: 'Clicks', kind: 'count' },
    { key: 'ctr', label: 'CTR', kind: 'pct' },
    { key: 'position', label: 'Avg position', kind: 'pos', lowerIsBetter: true },
  ],
  ga4: [
    { key: 'sessions', label: 'Sessions', kind: 'count' },
    { key: 'users', label: 'Users', kind: 'count' },
    { key: 'key_events', label: 'Key events', kind: 'count' },
    { key: 'avg_engagement_sec', label: 'Avg time', kind: 'secs' },
  ],
  gbp: [
    { key: 'views', label: 'Profile views', kind: 'count' },
    { key: 'calls', label: 'Calls', kind: 'count' },
    { key: 'directions', label: 'Directions', kind: 'count' },
    { key: 'website_clicks', label: 'Website clicks', kind: 'count' },
  ],
  whitespark: [
    { key: 'avg_rank', label: 'Avg rank (found)', kind: 'pos', lowerIsBetter: true },
    { key: 'top3', label: 'Points in top 3', kind: 'count' },
    { key: 'found', label: 'Points found', kind: 'count' },
    { key: 'points', label: 'Points', kind: 'count' },
  ],
}

/** One number as people read it. */
export function fmtMetric(kind: MetricDef['kind'], v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  if (kind === 'pct') return `${(v * 100).toFixed(2)}%`
  if (kind === 'pos') return v.toFixed(1)
  if (kind === 'rating') return v.toFixed(1)
  if (kind === 'secs') return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`
  return Math.round(v).toLocaleString('en-US')
}

const d12 = (d: string) => new Date(`${d}T12:00:00`)
const md = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const mdy = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Oct 29 – Nov 25, 2026 · 28 days", "Oct 2026", or one date. */
export function snapshotDates(s: Pick<BaselineSnapshot, 'from' | 'to' | 'source'>): string {
  if (!s.from || !s.to) return 'No dates'
  if (s.from === s.to) return mdy(s.to)
  const a = d12(s.from)
  const b = d12(s.to)
  const whole = a.getDate() === 1 && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() && b.getDate() === new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate()
  if (whole) return a.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
  return `${md(s.from)} – ${mdy(s.to)} · ${days} days`
}

/** Extra line under the numbers: GBP reviews + rating, map grid keyword / grid / spacing, Semrush tracked count. */
export function snapshotExtra(s: BaselineSnapshot): string | null {
  if (s.source === 'gbp') {
    const r = s.values.reviews
    const rt = s.values.rating
    if ((r === null || r === undefined) && (rt === null || rt === undefined)) return 'Reviews not typed'
    return [r !== null && r !== undefined ? `${fmtMetric('count', r)} reviews` : null, rt !== null && rt !== undefined ? `rating ${fmtMetric('rating', rt)}` : null].filter(Boolean).join(' · ')
  }
  if (s.source === 'whitespark') return [s.texts.keyword, s.texts.grid, s.texts.spacing ? `${s.texts.spacing} apart` : null].filter(Boolean).join(' · ') || null
  if (s.source === 'semrush' && s.values.tracked !== null && s.values.tracked !== undefined) return `${fmtMetric('count', s.values.tracked)} keywords tracked`
  return null
}

/** Compact dates for table cells: "Oct 29 – Nov 25", "Oct 2026", "Nov 25". */
export function shortDates(s: Pick<BaselineSnapshot, 'from' | 'to'>): string {
  if (!s.from || !s.to) return ''
  if (s.from === s.to) return md(s.to)
  const full = snapshotDates({ ...s, source: 'gbp' })
  return full.includes('·') ? `${md(s.from)} – ${md(s.to)}` : full
}

// ---- Baseline vs now (Overview; Results later) -------------------------------------------------------------------

export type CompareRow = { source: BaselineSource; metric: string; label: string; kind: MetricDef['kind']; lowerIsBetter?: boolean }

/** The rows of "Baseline vs now". GSC + GA4 "now" = the last 28 days, the same length as the baseline's. */
export const COMPARE_ROWS: CompareRow[] = [
  { source: 'gsc', metric: 'impressions', label: 'Search impressions', kind: 'count' },
  { source: 'gsc', metric: 'clicks', label: 'Search clicks', kind: 'count' },
  { source: 'gsc', metric: 'position', label: 'Search avg position', kind: 'pos', lowerIsBetter: true },
  { source: 'ga4', metric: 'sessions', label: 'Organic sessions', kind: 'count' },
  { source: 'semrush', metric: 'top10', label: 'Keywords in top 10', kind: 'count' },
  { source: 'whitespark', metric: 'avg_rank', label: 'Map grid avg rank', kind: 'pos', lowerIsBetter: true },
  { source: 'gbp', metric: 'calls', label: 'GBP calls', kind: 'count' },
  { source: 'gbp', metric: 'reviews', label: 'Reviews', kind: 'count' },
]

export type Change = { text: string; tone: 'better' | 'worse' | 'same' | 'none' }

/** now vs baseline: signed difference (+ % for counts), green when better. Lower is better for positions / ranks. */
export function changeOf(row: Pick<CompareRow, 'kind' | 'lowerIsBetter'>, base: number | null | undefined, now: number | null | undefined): Change {
  if (base === null || base === undefined || now === null || now === undefined || !Number.isFinite(base) || !Number.isFinite(now)) return { text: '—', tone: 'none' }
  const d = now - base
  const sign = (x: number) => (x > 0 ? '+' : '−')
  let text: string
  let same: boolean
  if (row.kind === 'pct') {
    const pts = d * 100
    same = Math.abs(pts) < 0.005
    text = `${sign(pts)}${Math.abs(pts).toFixed(2)} pts`
  } else if (row.kind === 'pos' || row.kind === 'rating') {
    same = Math.abs(d) < 0.05
    text = `${sign(d)}${Math.abs(d).toFixed(1)}`
  } else if (row.kind === 'secs') {
    same = Math.abs(d) < 1
    text = `${sign(d)}${fmtMetric('secs', Math.abs(d))}`
  } else {
    same = Math.round(d) === 0
    const pct = base > 0 ? ` · ${sign(d)}${Math.abs(Math.round((d / base) * 100))}%` : ''
    text = `${sign(d)}${Math.abs(Math.round(d)).toLocaleString('en-US')}${pct}`
  }
  if (same) return { text: 'Same', tone: 'same' }
  const better = row.lowerIsBetter ? d < 0 : d > 0
  return { text, tone: better ? 'better' : 'worse' }
}

// ---- Results: every number vs baseline + wins ------------------------------------------------------------------

/** The Results table rows: the Overview rows + CTR (9 rows, as in the design). */
export const REPORT_ROWS: CompareRow[] = [
  ...COMPARE_ROWS.slice(0, 2),
  { source: 'gsc', metric: 'ctr', label: 'Search CTR', kind: 'pct' },
  ...COMPARE_ROWS.slice(2),
]

export type Win = { label: string; big: string; text: string }

/**
 * Up to 3 wins, worked out by code (no Claude): the rows that got better vs the baseline, biggest relative
 * improvement first. Lower is better for positions / ranks. A row missing on either side is never a win.
 */
export function winsOf(rows: CompareRow[], base: BaselineSnapshot[], now: BaselineSnapshot[], since: string): Win[] {
  const out: (Win & { score: number })[] = []
  for (const r of rows) {
    const b = base.find((s) => s.source === r.source)?.values[r.metric]
    const n = now.find((s) => s.source === r.source)?.values[r.metric]
    if (b === null || b === undefined || n === null || n === undefined) continue
    const ch = changeOf(r, b, n)
    if (ch.tone !== 'better') continue
    const score = b !== 0 ? Math.abs(n - b) / Math.abs(b) : 1
    const pct = b !== 0 ? Math.round((Math.abs(n - b) / Math.abs(b)) * 100) : null
    const from = fmtMetric(r.kind, b)
    const to = fmtMetric(r.kind, n)
    const big = r.kind === 'count' && pct !== null ? `+${pct}%` : `${from} → ${to}`
    const verb = r.lowerIsBetter ? 'improved' : 'up'
    out.push({ label: r.label, big, text: `${r.label} ${verb} from ${from} to ${to} since ${since}`, score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3).map(({ label, big, text }) => ({ label, big, text }))
}

/** Change pill colours: green = better, red = worse, grey = same; "none" = plain dash. */
export const CHANGE_TONE: Record<Change['tone'], string> = {
  better: 'bg-vv-green-100 text-vv-green-ink',
  worse: 'bg-vv-red-100 text-vv-red',
  same: 'bg-vv-st-todo text-vv-st-todo-ink',
  none: 'text-vv-muted',
}

/** Months a report can be created for: from the baseline's month onward, without a report yet (newest first). */
export function creatableMonths(s: ReportsState) {
  return s.months.filter((m) => !m.exists && !m.beforeBaseline)
}
