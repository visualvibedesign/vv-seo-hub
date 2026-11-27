// Phase 2e · Baseline (Sam's Day 3, docs/phase-2-plan.md). "Save baseline" freezes the current numbers of each source
// with that source's own dates into seo_baselines + seo_baseline_values. Re-pulling Google or importing a newer CSV
// later never changes a saved baseline. The numbers are worked out here from SEO Hub's own tables: the browser only
// says "save" / "fill", it never sends numbers.
//
// Saving goes through seo_save_baseline() (migration 0018): one transaction.
//   'new'  → the current baseline becomes history, a new current one is saved.
//   'fill' → adds only the sources the current baseline is missing (never overwrites a saved source).
//
// Required sources: Search Console, GA4, Semrush, GBP. Whitespark (map grid) is optional and only becomes required once
// the client has a map grid scan. Site check comes later and is never saved until it exists.
import type { BaselineSnapshot, BaselineSource, BaselineState, BaselineSummary } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'
import { localState } from './localService.js'
import { googleWindow } from './metricsService.js'
import { rankingsOverview } from './rankService.js'

/** A problem the person can fix (400). */
export class BaselineInputError extends Error {}

const SOURCES: BaselineSource[] = ['gsc', 'ga4', 'semrush', 'gbp', 'whitespark']
const ALWAYS: BaselineSource[] = ['gsc', 'ga4', 'semrush', 'gbp']
const TEXT_MAX = 60 // seo_baseline_values.value_text check

const isSource = (s: unknown): s is BaselineSource => typeof s === 'string' && (SOURCES as string[]).includes(s)

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new BaselineInputError('That client doesn’t exist.')
  return c
}

/** What a save would freeze right now, per source. A source with no data at all is left out (= missing). */
async function liveSnapshots(siteId: string, clientId: string): Promise<{ live: BaselineSnapshot[]; hasGrid: boolean }> {
  const [google, ranks, local] = await Promise.all([googleWindow(clientId, 28), rankingsOverview(siteId), localState(siteId)])
  const live: BaselineSnapshot[] = []

  if (google.gsc && google.gsc.totals.days > 0) {
    const t = google.gsc.totals
    live.push({ source: 'gsc', from: google.gsc.from, to: google.gsc.to, values: { impressions: t.impressions, clicks: t.clicks, ctr: t.ctr, position: t.position }, texts: {} })
  }
  if (google.ga4 && google.ga4.totals.days > 0) {
    const t = google.ga4.totals
    live.push({ source: 'ga4', from: google.ga4.from, to: google.ga4.to, values: { sessions: t.sessions, users: t.users, key_events: t.keyEvents, avg_engagement_sec: t.avgSeconds }, texts: {} })
  }
  if (ranks.latest) {
    const b = (i: number) => ranks.buckets[i]?.now ?? 0
    const out = ranks.buckets[ranks.buckets.length - 1]?.now ?? 0
    live.push({ source: 'semrush', from: ranks.latest, to: ranks.latest, values: { avg_position: ranks.avgPosition, top3: b(0), top10: b(0) + b(1), top100: ranks.total - out, tracked: ranks.total }, texts: {} })
  }
  const g = local.gbp[0] // newest period first
  if (g) {
    live.push({ source: 'gbp', from: g.periodFrom, to: g.periodTo, values: { views: g.views, calls: g.calls, directions: g.directions, website_clicks: g.websiteClicks, reviews: g.reviews, rating: g.rating }, texts: {} })
  }
  const m = local.grids[0] // newest scan first
  if (m) {
    const all = m.ranks.flat()
    const found = all.filter((r): r is number => r !== null)
    const texts: Record<string, string> = { keyword: m.keyword.slice(0, TEXT_MAX), grid: `${m.gridSize}×${m.gridSize}` }
    if (m.spacing) texts.spacing = m.spacing.slice(0, TEXT_MAX)
    live.push({
      source: 'whitespark',
      from: m.scannedOn,
      to: m.scannedOn,
      values: { avg_rank: found.length ? found.reduce((a, b) => a + b, 0) / found.length : null, top3: found.filter((r) => r <= 3).length, found: found.length, points: all.length },
      texts,
    })
  }
  return { live, hasGrid: local.grids.length > 0 }
}

type BaselineRow = { id: string; label: string | null; note: string | null; is_current: boolean; saved_at: string }
type ValueRow = { baseline_id: string; source: string; metric: string; value: string | number | null; value_text: string | null; date_from: string | null; date_to: string | null }

/** Rows → one snapshot per source. A metric row with value_text and no value is a text (keyword, grid, spacing). */
function toSnapshots(rows: ValueRow[]): BaselineSnapshot[] {
  const by = new Map<BaselineSource, BaselineSnapshot>()
  for (const r of rows) {
    if (!isSource(r.source)) continue // 'site' later
    const s = by.get(r.source) ?? { source: r.source, from: r.date_from, to: r.date_to, values: {}, texts: {} }
    if (r.value === null && r.value_text !== null) s.texts[r.metric] = r.value_text
    else s.values[r.metric] = r.value === null ? null : Number(r.value)
    by.set(r.source, s)
  }
  return SOURCES.filter((s) => by.has(s)).map((s) => by.get(s)!)
}

/** Snapshots → the rows seo_save_baseline() inserts. */
function toRows(snaps: BaselineSnapshot[]) {
  return snaps.flatMap((s) => [
    ...Object.entries(s.values).map(([metric, value]) => ({ source: s.source, metric, value, value_text: null, date_from: s.from, date_to: s.to })),
    ...Object.entries(s.texts).map(([metric, text]) => ({ source: s.source, metric, value: null, value_text: text.slice(0, TEXT_MAX), date_from: s.from, date_to: s.to })),
  ])
}

const summary = (b: BaselineRow, sources: BaselineSource[]): BaselineSummary => ({ id: b.id, label: b.label, note: b.note, savedAt: b.saved_at, sources })

/** Required sources: the four always, plus Whitespark once the client has a map grid scan (or it's in the baseline). */
function requiredSources(hasGrid: boolean, saved: BaselineSource[]): BaselineSource[] {
  return hasGrid || saved.includes('whitespark') ? [...ALWAYS, 'whitespark'] : [...ALWAYS]
}

/** Current baseline, history, and what a save would freeze now. */
export async function baselineState(siteId: string): Promise<BaselineState> {
  const c = await client(siteId)
  const [{ live, hasGrid }, list] = await Promise.all([
    liveSnapshots(siteId, c.id),
    db().from('seo_baselines').select('id, label, note, is_current, saved_at').eq('client_id', c.id).order('saved_at', { ascending: false }).limit(50),
  ])
  const baselines = must(list, 'Loading baselines') as BaselineRow[]
  const rows = baselines.length
    ? (must(await db().from('seo_baseline_values').select('baseline_id, source, metric, value, value_text, date_from, date_to').in('baseline_id', baselines.map((b) => b.id)), 'Loading baseline numbers') as ValueRow[])
    : []
  const sourcesOf = (id: string) => SOURCES.filter((s) => rows.some((r) => r.baseline_id === id && r.source === s))
  const cur = baselines.find((b) => b.is_current) ?? null
  const curSources = cur ? sourcesOf(cur.id) : []
  const required = requiredSources(hasGrid, curSources)
  return {
    required,
    current: cur ? { ...summary(cur, curSources), snapshots: toSnapshots(rows.filter((r) => r.baseline_id === cur.id)) } : null,
    savedRequired: required.filter((s) => curSources.includes(s)).length,
    live,
    history: baselines.map((b) => summary(b, sourcesOf(b.id))),
  }
}

/** One baseline (current or past) with its numbers, for the "Past baselines" list. */
export async function baselineById(siteId: string, id: unknown): Promise<BaselineSummary & { snapshots: BaselineSnapshot[] }> {
  const c = await client(siteId)
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new BaselineInputError('That baseline doesn’t exist.')
  const b = must(await db().from('seo_baselines').select('id, label, note, is_current, saved_at').eq('client_id', c.id).eq('id', id).maybeSingle(), 'Loading the baseline') as BaselineRow | null
  if (!b) throw new BaselineInputError('That baseline doesn’t exist.')
  const rows = must(await db().from('seo_baseline_values').select('baseline_id, source, metric, value, value_text, date_from, date_to').eq('baseline_id', b.id), 'Loading baseline numbers') as ValueRow[]
  const snapshots = toSnapshots(rows)
  return { ...summary(b, snapshots.map((s) => s.source)), snapshots }
}

const shortText = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null)

/**
 * mode 'new': save a new current baseline (the old one stays as history). mode 'fill': add the missing sources to the
 * current one. `sources` (optional) limits which sources are saved, e.g. one card's "Fill missing".
 */
export async function saveBaseline(siteId: string, raw: unknown): Promise<BaselineState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { mode?: unknown; label?: unknown; note?: unknown; sources?: unknown }
  if (b.mode !== 'new' && b.mode !== 'fill') throw new BaselineInputError('Pick “Save baseline” or “Fill missing”.')
  const only = Array.isArray(b.sources) ? b.sources.filter(isSource) : null
  const { live } = await liveSnapshots(siteId, c.id)
  const snaps = only ? live.filter((s) => only.includes(s.source)) : live
  if (!snaps.length) throw new BaselineInputError(only ? 'No numbers for that source yet.' : 'No numbers to save yet: connect Google, import the Semrush CSV or type in GBP first.')
  if (b.mode === 'fill') {
    const cur = must(await db().from('seo_baselines').select('id').eq('client_id', c.id).eq('is_current', true).maybeSingle(), 'Loading the baseline')
    if (!cur) throw new BaselineInputError('No baseline yet: use “Save baseline” first.')
  }
  must(
    await db().rpc('seo_save_baseline', {
      p_client_id: c.id,
      p_mode: b.mode,
      p_label: b.mode === 'new' ? shortText(b.label, 80) : null,
      p_note: b.mode === 'new' ? shortText(b.note, 500) : null,
      p_values: toRows(snaps),
    }),
    'Saving the baseline',
  )
  return baselineState(siteId)
}

/** For the Day 3 auto-tick: every required source is in the current baseline. */
export async function baselineComplete(clientId: string): Promise<boolean> {
  const cur = must(await db().from('seo_baselines').select('id').eq('client_id', clientId).eq('is_current', true).maybeSingle(), 'Loading the baseline') as { id: string } | null
  if (!cur) return false
  const [vals, grids] = await Promise.all([
    db().from('seo_baseline_values').select('source').eq('baseline_id', cur.id),
    db().from('seo_map_grids').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ])
  const saved = new Set((must(vals, 'Loading baseline numbers') as { source: string }[]).map((v) => v.source))
  must(grids, 'Loading map grids')
  const required = requiredSources((grids.count ?? 0) > 0, saved.has('whitespark') ? ['whitespark'] : [])
  return required.every((s) => saved.has(s))
}
