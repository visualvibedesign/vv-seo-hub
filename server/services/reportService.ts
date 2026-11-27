// Phase 2f · Monthly reports (docs/phase-2-plan.md › Results). One report per client per month (seo_reports), titled
// "November 2026 report". Creating it freezes the month's numbers next to a copy of the current baseline (and which
// baseline it was), so "Start a new baseline" later never changes an old report. "Refresh numbers" re-reads the month
// while the report is a draft; a sent report is locked (it can be reopened).
//
// Month values (decided Nov 28):
//   Search Console + GA4 = the 28 days ending on the month's last pulled day (same length as the baseline's 28 days)
//   Semrush = the latest Position Tracking CSV dated inside the month
//   GBP = the period typed in for the month
//   Map grid = the latest scan inside the month (only once the client uses the map grid)
// Nothing for the month = listed in `missing` with the reason. Never 0, never an older month's number.
// Notes: `notes` holds approved text only; Claude's draft (step 3) waits in `notes_draft`.
import type { BaselineSnapshot, BaselineSource, Report, ReportAction, ReportActionKind, ReportNumbers, ReportsState, ReportSummary } from '../../src/types/seo.js'
import { db, must, pagedRows } from '../clients/supabase.js'
import { currentBaseline } from './baselineService.js'
import { clientRow } from './clientService.js'
import { googleWindow } from './metricsService.js'
import { latestToday } from '../utils/dates.js'

/** A problem the person can fix (400). */
export class ReportInputError extends Error {}

const ALWAYS: BaselineSource[] = ['gsc', 'ga4', 'semrush', 'gbp']
const KINDS: ReportActionKind[] = ['page', 'gbp', 'links', 'tracking', 'other']
const MAX_ACTIONS = 3
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const d12 = (d: string) => new Date(`${d}T12:00:00Z`)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
/** The team's today (server is UTC, the team is ahead of it): see server/utils/dates.ts. */
const todayIso = latestToday
const monthEnd = (m: string) => {
  const d = d12(m)
  return isoDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)))
}
const addMonths = (m: string, n: number) => {
  const d = d12(m)
  return isoDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)))
}
const monthName = (m: string) => d12(m).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const titleOf = (m: string) => `${monthName(m)} report`
const md = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "Nov 1 – Nov 28, 2026 · 28 days" for a window. */
function windowText(from: string | null, to: string | null): string | null {
  if (!from || !to) return null
  const days = Math.round((d12(to).getTime() - d12(from).getTime()) / 86_400_000) + 1
  return `${md(from)} – ${md(to)}, ${to.slice(0, 4)} · ${days} days`
}

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new ReportInputError('That client doesn’t exist.')
  return c
}

/** "2026-11" or "2026-11-01" → "2026-11-01"; never a future month. */
function parseMonth(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  const m = /^(\d{4})-(\d{2})(?:-01)?$/.exec(s)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new ReportInputError('Pick a month.')
  const month = `${m[1]}-${m[2]}-01`
  if (month > `${todayIso().slice(0, 7)}-01`) throw new ReportInputError('That month hasn’t started yet.')
  return month
}

/**
 * Reports start from the month the current baseline ends in (decided Nov 28): a month that ends before the baseline's
 * numbers end can't be compared "vs baseline". End = the latest date in the baseline (saved date if it has none).
 */
function firstReportMonth(b: { savedAt: string; snapshots: BaselineSnapshot[] }): string {
  const ends = b.snapshots.map((s) => s.to).filter((d): d is string => !!d)
  const end = ends.length ? ends.sort()[ends.length - 1] : b.savedAt.slice(0, 10)
  return `${end.slice(0, 7)}-01`
}

/** The current baseline, refusing a month before it. */
async function baselineFor(clientId: string, month: string) {
  const b = await currentBaseline(clientId)
  if (!b) throw new ReportInputError('Save a baseline first (Baseline page): every report compares with it.')
  const first = firstReportMonth(b)
  if (month < first) throw new ReportInputError(`Reports start from ${monthName(first)}, the month the baseline ends in. ${monthName(month)} is before the baseline.`)
  return b
}

// ---- The month's numbers ----------------------------------------------------------------------------------------

async function usesMapGrid(clientId: string): Promise<boolean> {
  const r = await db().from('seo_map_grids').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
  must(r, 'Loading map grids')
  return (r.count ?? 0) > 0
}

async function monthNumbers(clientId: string, month: string, baseline: ReportNumbers['baseline']): Promise<ReportNumbers> {
  const end = monthEnd(month)
  const name = monthName(month)
  const grid = (await usesMapGrid(clientId)) || baseline.snapshots.some((s) => s.source === 'whitespark')
  const sources: BaselineSource[] = grid ? [...ALWAYS, 'whitespark'] : [...ALWAYS]
  const snapshots: BaselineSnapshot[] = []
  const missing: ReportNumbers['missing'] = []

  const link = must(await db().from('seo_google_links').select('gsc_property, ga4_property').eq('client_id', clientId).maybeSingle(), 'Loading the Google link') as { gsc_property: string | null; ga4_property: string | null } | null
  const google = await googleWindow(clientId, 28, { from: month, to: end })
  if (google.gsc && google.gsc.totals.days > 0) {
    const t = google.gsc.totals
    snapshots.push({ source: 'gsc', from: google.gsc.from, to: google.gsc.to, values: { impressions: t.impressions, clicks: t.clicks, ctr: t.ctr, position: t.position }, texts: {} })
  } else missing.push({ source: 'gsc', reason: link?.gsc_property ? `No Search Console data pulled for ${name}` : 'Search Console not connected' })
  if (google.ga4 && google.ga4.totals.days > 0) {
    const t = google.ga4.totals
    snapshots.push({ source: 'ga4', from: google.ga4.from, to: google.ga4.to, values: { sessions: t.sessions, users: t.users, key_events: t.keyEvents, avg_engagement_sec: t.avgSeconds }, texts: {} })
  } else missing.push({ source: 'ga4', reason: link?.ga4_property ? `No GA4 data pulled for ${name}` : 'GA4 not connected' })

  // Semrush: the latest CSV date inside the month, all keywords on that date (position empty = not in the top 100).
  const csvDay = (must(await db().from('seo_rank_snapshots').select('checked_on').eq('client_id', clientId).gte('checked_on', month).lte('checked_on', end).order('checked_on', { ascending: false }).limit(1), 'Loading rankings') as { checked_on: string }[])[0]?.checked_on
  if (csvDay) {
    const pos: (number | null)[] = []
    for await (const r of pagedRows<{ position: number | null }>((a, b) => db().from('seo_rank_snapshots').select('position').eq('client_id', clientId).eq('checked_on', csvDay).order('keyword_key').range(a, b), 'Loading rankings')) pos.push(r.position)
    const ranked = pos.filter((p): p is number => p !== null)
    snapshots.push({
      source: 'semrush',
      from: csvDay,
      to: csvDay,
      values: { avg_position: ranked.length ? ranked.reduce((a, b) => a + b, 0) / ranked.length : null, top3: ranked.filter((p) => p <= 3).length, top10: ranked.filter((p) => p <= 10).length, top100: ranked.length, tracked: pos.length },
      texts: {},
    })
  } else missing.push({ source: 'semrush', reason: `No Semrush CSV dated in ${name}` })

  // GBP: the period typed for the month (a whole-month period first, else the latest period starting in the month).
  const gbp = must(await db().from('seo_gbp_snapshots').select('period_from, period_to, views, calls, directions, website_clicks, reviews, rating').eq('client_id', clientId).gte('period_from', month).lte('period_from', end).order('period_to', { ascending: false }), 'Loading GBP numbers') as { period_from: string; period_to: string; views: number | null; calls: number | null; directions: number | null; website_clicks: number | null; reviews: number | null; rating: number | string | null }[]
  const g = gbp.find((x) => x.period_from === month && x.period_to === end) ?? gbp[0]
  if (g) snapshots.push({ source: 'gbp', from: g.period_from, to: g.period_to, values: { views: g.views, calls: g.calls, directions: g.directions, website_clicks: g.website_clicks, reviews: g.reviews, rating: g.rating === null ? null : Number(g.rating) }, texts: {} })
  else missing.push({ source: 'gbp', reason: `GBP not typed in for ${name}` })

  if (grid) {
    const scan = (must(await db().from('seo_map_grids').select('id, keyword, scanned_on, grid_size, spacing').eq('client_id', clientId).gte('scanned_on', month).lte('scanned_on', end).order('scanned_on', { ascending: false }).order('created_at', { ascending: false }).limit(1), 'Loading map grids') as { id: string; keyword: string; scanned_on: string; grid_size: number; spacing: string | null }[])[0]
    if (scan) {
      const pts = must(await db().from('seo_map_grid_points').select('rank').eq('grid_id', scan.id), 'Loading map grid points') as { rank: number | null }[]
      const found = pts.map((p) => p.rank).filter((r): r is number => r !== null)
      const points = scan.grid_size * scan.grid_size
      const texts: Record<string, string> = { keyword: scan.keyword.slice(0, 60), grid: `${scan.grid_size}×${scan.grid_size}` }
      if (scan.spacing) texts.spacing = scan.spacing.slice(0, 60)
      snapshots.push({ source: 'whitespark', from: scan.scanned_on, to: scan.scanned_on, values: { avg_rank: found.length ? found.reduce((a, b) => a + b, 0) / found.length : null, top3: found.filter((r) => r <= 3).length, found: found.length, points }, texts })
    } else missing.push({ source: 'whitespark', reason: `No map grid scan in ${name}` })
  }

  const order = (s: BaselineSource) => sources.indexOf(s)
  return {
    month,
    baseline,
    snapshots: snapshots.sort((a, b) => order(a.source) - order(b.source)),
    missing: missing.sort((a, b) => order(a.source) - order(b.source)),
    sources,
    frozenAt: new Date().toISOString(),
  }
}

// ---- Rows → API shapes --------------------------------------------------------------------------------------------

type ReportRow = {
  id: string
  client_id: string
  month: string
  status: 'draft' | 'sent'
  numbers: ReportNumbers
  notes: string | null
  notes_draft: string | null
  sent_on: string | null
  baseline_id: string | null
  notes_draft_at: string | null
  notes_approved_at: string | null
  updated_at: string
}
type ActionRow = { id: string; kind: ReportActionKind; body: string; owner: string | null; due: string | null; done: boolean; sort: number }
const REPORT_COLS = 'id, client_id, month, status, numbers, notes, notes_draft, sent_on, baseline_id, notes_draft_at, notes_approved_at, updated_at'

function toSummary(r: ReportRow): ReportSummary {
  const gsc = r.numbers?.snapshots?.find((s) => s.source === 'gsc')
  return { id: r.id, month: r.month, title: titleOf(r.month), status: r.status, sentOn: r.sent_on, dates: gsc ? windowText(gsc.from, gsc.to) : null, hasNotes: !!r.notes, hasDraft: !!r.notes_draft, updatedAt: r.updated_at }
}

async function loadReport(clientId: string, id: unknown): Promise<ReportRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new ReportInputError('That report doesn’t exist.')
  const r = must(await db().from('seo_reports').select(REPORT_COLS).eq('client_id', clientId).eq('id', id).maybeSingle(), 'Loading the report') as ReportRow | null
  if (!r) throw new ReportInputError('That report doesn’t exist.')
  return r
}

async function toReport(r: ReportRow): Promise<Report> {
  const actions = must(await db().from('seo_report_actions').select('id, kind, body, owner, due, done, sort').eq('report_id', r.id).order('sort'), 'Loading next actions') as ActionRow[]
  return {
    ...toSummary(r),
    baselineId: r.baseline_id,
    numbers: r.numbers,
    notes: r.notes,
    notesDraft: r.notes_draft,
    notesDraftAt: r.notes_draft_at,
    notesApprovedAt: r.notes_approved_at,
    actions: actions.map((a): ReportAction => ({ id: a.id, kind: a.kind, body: a.body, owner: a.owner, due: a.due, done: a.done })),
  }
}

// ---- Read ---------------------------------------------------------------------------------------------------------

/** Reports list, the months "Create report" can offer, and Search Console clicks per month. */
export async function reportsState(siteId: string): Promise<ReportsState> {
  const c = await client(siteId)
  const thisMonth = `${todayIso().slice(0, 7)}-01`
  const first6 = addMonths(thisMonth, -5)
  const [list, baseline, link] = await Promise.all([
    db().from('seo_reports').select(REPORT_COLS).eq('client_id', c.id).order('month', { ascending: false }),
    currentBaseline(c.id),
    db().from('seo_google_links').select('gsc_property').eq('client_id', c.id).maybeSingle(),
  ])
  const reports = (must(list, 'Loading reports') as ReportRow[]).map(toSummary)
  const have = new Set(reports.map((r) => r.month))
  const firstMonth = baseline ? firstReportMonth(baseline) : null
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, -i)).map((m) => ({ month: m, title: titleOf(m), exists: have.has(m), current: m === thisMonth, beforeBaseline: !firstMonth || m < firstMonth }))

  // Clicks per calendar month (oldest first). Before the first pulled day = unknown (null), never 0.
  const byMonth = new Map<string, number>()
  let firstDay: string | null = null
  let lastDay: string | null = null
  if ((must(link, 'Loading the Google link') as { gsc_property: string | null } | null)?.gsc_property) {
    for await (const r of pagedRows<{ day: string; value: string | number }>((a, b) => db().from('seo_metric_daily').select('day, value').eq('client_id', c.id).eq('source', 'gsc').eq('metric', 'clicks').gte('day', first6).order('day').range(a, b), 'Loading clicks')) {
      const m = `${r.day.slice(0, 7)}-01`
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(r.value))
      lastDay = r.day
    }
    const f = must(await db().from('seo_metric_daily').select('day').eq('client_id', c.id).eq('source', 'gsc').order('day').limit(1), 'Reading the history') as { day: string }[]
    firstDay = f[0]?.day ?? null
  }
  const clicksByMonth = Array.from({ length: 6 }, (_, i) => addMonths(first6, i)).map((m) => {
    const known = !!firstDay && monthEnd(m) >= firstDay && (!lastDay || m <= lastDay)
    return { month: m, clicks: known ? (byMonth.get(m) ?? 0) : null, partial: known && (!lastDay || lastDay < monthEnd(m) || (!!firstDay && firstDay > m)) }
  })

  return { reports, months, clicksByMonth, hasBaseline: !!baseline, firstMonth }
}

export async function reportById(siteId: string, id: unknown): Promise<Report> {
  const c = await client(siteId)
  return toReport(await loadReport(c.id, id))
}

// ---- Write --------------------------------------------------------------------------------------------------------

/** Creates the report for a month: freezes the month's numbers + a copy of the current baseline. */
export async function createReport(siteId: string, raw: unknown): Promise<Report> {
  const c = await client(siteId)
  const month = parseMonth((raw as { month?: unknown } | null)?.month)
  const b = await baselineFor(c.id, month)
  const exists = must(await db().from('seo_reports').select('id').eq('client_id', c.id).eq('month', month).maybeSingle(), 'Loading reports')
  if (exists) throw new ReportInputError(`The ${titleOf(month)} already exists: open it from the list.`)
  const numbers = await monthNumbers(c.id, month, { id: b.id, label: b.label, savedAt: b.savedAt, snapshots: b.snapshots })
  const row = must(await db().from('seo_reports').insert({ client_id: c.id, month, status: 'draft', numbers, baseline_id: b.id }).select(REPORT_COLS).single(), 'Saving the report') as ReportRow
  return toReport(row)
}

/** Re-reads the month's numbers (draft only). The baseline copy stays the one the report was made with. */
export async function refreshReport(siteId: string, raw: unknown): Promise<Report> {
  const c = await client(siteId)
  const r = await loadReport(c.id, (raw as { id?: unknown } | null)?.id)
  if (r.status === 'sent') throw new ReportInputError('This report was sent: reopen it as a draft to refresh its numbers.')
  const numbers = await monthNumbers(c.id, r.month, r.numbers.baseline)
  const row = must(await db().from('seo_reports').update({ numbers }).eq('id', r.id).select(REPORT_COLS).single(), 'Saving the report') as ReportRow
  return toReport(row)
}

/** Draft → Sent (with the sent date, default today) or back to Draft. */
export async function setReportStatus(siteId: string, raw: unknown): Promise<Report> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; status?: unknown; sentOn?: unknown }
  const r = await loadReport(c.id, b.id)
  if (b.status !== 'draft' && b.status !== 'sent') throw new ReportInputError('Pick Draft or Sent.')
  let sentOn: string | null = null
  if (b.status === 'sent') {
    sentOn = typeof b.sentOn === 'string' && b.sentOn ? b.sentOn : todayIso()
    if (!DAY_RE.test(sentOn) || Number.isNaN(Date.parse(`${sentOn}T12:00:00Z`))) throw new ReportInputError('Sent on: pick a date.')
    if (sentOn > todayIso()) throw new ReportInputError('Sent on can’t be in the future.')
    if (sentOn < r.month) throw new ReportInputError('Sent on is before the report’s month.')
  }
  const row = must(await db().from('seo_reports').update({ status: b.status, sent_on: sentOn }).eq('id', r.id).select(REPORT_COLS).single(), 'Saving the report') as ReportRow
  return toReport(row)
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

/**
 * Replaces the report's next actions (up to 3, in order). Ticking done works on sent reports too (it's follow-up).
 * The new rows go in first and the old ones are removed after, so a failed save never loses the list.
 */
export async function saveReportActions(siteId: string, raw: unknown): Promise<Report> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; actions?: unknown }
  const r = await loadReport(c.id, b.id)
  if (!Array.isArray(b.actions)) throw new ReportInputError('No actions sent.')
  if (b.actions.length > MAX_ACTIONS) throw new ReportInputError(`Up to ${MAX_ACTIONS} next actions.`)
  const rows = b.actions.map((a: unknown, i: number) => {
    const x = (a ?? {}) as Record<string, unknown>
    const kind = KINDS.includes(x.kind as ReportActionKind) ? (x.kind as ReportActionKind) : 'other'
    const body = clean(x.body, 300)
    if (!body) throw new ReportInputError(`Action ${i + 1}: write what needs doing.`)
    let due: string | null = null
    if (typeof x.due === 'string' && x.due) {
      if (!DAY_RE.test(x.due) || Number.isNaN(Date.parse(`${x.due}T12:00:00Z`))) throw new ReportInputError(`Action ${i + 1}: due date isn’t a date.`)
      due = x.due
    }
    return { report_id: r.id, kind, body, owner: clean(x.owner, 60) || null, due, done: x.done === true, sort: i }
  })
  const old = must(await db().from('seo_report_actions').select('id').eq('report_id', r.id), 'Loading next actions') as { id: string }[]
  if (rows.length) must(await db().from('seo_report_actions').insert(rows), 'Saving next actions')
  if (old.length) must(await db().from('seo_report_actions').delete().in('id', old.map((o) => o.id)), 'Saving next actions')
  return toReport(r)
}

/** What a report for this month would freeze, without saving (Create dialog: shows dates + what's missing). */
export async function previewReport(siteId: string, rawMonth: unknown): Promise<ReportNumbers> {
  const c = await client(siteId)
  const month = parseMonth(rawMonth)
  const b = await baselineFor(c.id, month)
  return monthNumbers(c.id, month, { id: b.id, label: b.label, savedAt: b.savedAt, snapshots: b.snapshots })
}
