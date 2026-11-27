// Phase 2e · How baseline numbers are labelled and written (Baseline page now, "Baseline vs now" + Results later).
// The numbers themselves come from the server (server/services/baselineService.ts). null = missing → "—", never 0.
import type { BaselineSnapshot, BaselineSource } from '../types/seo'

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
