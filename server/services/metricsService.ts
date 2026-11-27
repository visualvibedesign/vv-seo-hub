// Phase 2b · Google numbers (docs/phase-2-plan.md). The pull stores Search Console + GA4 numbers exactly as Google
// returns them (seo_metric_daily: one row per client / source / metric / day; a day Google doesn't return = no row,
// never 0) and the top searches / pages per range (seo_metric_top, replaced on each pull). The Overview reads them
// for 28 days / 3 months / 12 months, each compared with the period of the same length just before.
// First pull: ~16 months (Search Console keeps 16). Later pulls: the last 10 days (Google revises recent days).
import type { Ga4Totals, GscTotals, MetricRange, MetricsOverview, MetricsSyncResult } from '../../src/types/seo.js'
import { google, GoogleApiError, GoogleConfigError } from '../clients/google.js'
import { db, must, pagedRows } from '../clients/supabase.js'
import { clientRow } from './clientService.js'
import { GoogleInputError } from './googleService.js'

const DAY = 86_400_000
const FIRST_PULL_DAYS = 480
const REPULL_DAYS = 10
const RANGE_DAYS: Record<MetricRange, number> = { '28d': 28, '3m': 90, '12m': 365 }
const CHUNK = 500

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`)
const addDays = (d: string, n: number) => iso(dayMs(d) + n * DAY)
const errText = (e: unknown) => (e instanceof GoogleApiError || e instanceof GoogleConfigError ? e.message : e instanceof Error ? e.message : 'Unknown error')

type Link = { client_id: string; gsc_property: string | null; ga4_property: string | null; last_sync_at: string | null; last_sync_ok: boolean | null; last_error: string | null }
type DailyRow = { client_id: string; source: 'gsc' | 'ga4'; metric: string; day: string; value: number }

async function linkFor(siteId: string): Promise<{ clientId: string; link: Link | null }> {
  const c = await clientRow(siteId)
  if (!c) throw new GoogleInputError('That client doesn’t exist.')
  const link = must(await db().from('seo_google_links').select('client_id, gsc_property, ga4_property, last_sync_at, last_sync_ok, last_error').eq('client_id', c.id).maybeSingle(), 'Loading the Google link') as Link | null
  return { clientId: c.id, link }
}

async function lastDay(clientId: string, source: 'gsc' | 'ga4'): Promise<string | null> {
  const r = must(await db().from('seo_metric_daily').select('day').eq('client_id', clientId).eq('source', source).order('day', { ascending: false }).limit(1), 'Reading the last pull') as { day: string }[]
  return r[0]?.day ?? null
}

/** The current baseline's Search Console end date (the dashed marker on the chart); null until a baseline is saved (2e). */
async function baselineDay(clientId: string): Promise<string | null> {
  const b = must(await db().from('seo_baselines').select('id, saved_at').eq('client_id', clientId).eq('is_current', true).maybeSingle(), 'Loading the baseline') as { id: string; saved_at: string } | null
  if (!b) return null
  const v = must(await db().from('seo_baseline_values').select('date_to').eq('baseline_id', b.id).eq('source', 'gsc').not('date_to', 'is', null).order('date_to', { ascending: false }).limit(1), 'Loading the baseline') as { date_to: string }[]
  return v[0]?.date_to ?? b.saved_at.slice(0, 10)
}

/** The first day pulled (the start of the history SEO Hub has). */
async function firstDay(clientId: string, source: 'gsc' | 'ga4'): Promise<string | null> {
  const r = must(await db().from('seo_metric_daily').select('day').eq('client_id', clientId).eq('source', source).order('day').limit(1), 'Reading the history') as { day: string }[]
  return r[0]?.day ?? null
}

async function upsertDaily(rows: DailyRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK)
    must(await db().from('seo_metric_daily').upsert(rows.slice(i, i + CHUNK).map((r) => ({ ...r, pulled_at: new Date().toISOString() })), { onConflict: 'client_id,source,metric,day' }), 'Saving the numbers')
}

type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }
const gscQuery = (property: string, body: Record<string, unknown>) =>
  google<{ rows?: GscRow[] }>(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, body).then((r) => r.rows ?? [])

/** Pulls one client's Search Console + GA4 numbers. Errors per source are kept (and saved on the link). */
export async function syncClient(siteId: string): Promise<MetricsSyncResult> {
  const { clientId, link } = await linkFor(siteId)
  if (!link || (!link.gsc_property && !link.ga4_property)) throw new GoogleInputError('Connect Search Console or GA4 first.')
  const out: MetricsSyncResult = { gscDays: 0, ga4Days: 0, topRows: 0, errors: [] }
  const yesterday = iso(Date.now() - DAY)

  const gscProp = link.gsc_property
  if (gscProp) {
    try {
      const last = await lastDay(clientId, 'gsc')
      const start = last ? addDays(last, -REPULL_DAYS) : iso(Date.now() - FIRST_PULL_DAYS * DAY)
      const rows = await gscQuery(gscProp, { startDate: start, endDate: yesterday, dimensions: ['date'], rowLimit: 25000 })
      const daily: DailyRow[] = rows.flatMap((r) => {
        const day = r.keys?.[0]
        if (!day) return []
        return (['clicks', 'impressions', 'ctr', 'position'] as const).map((metric) => ({ client_id: clientId, source: 'gsc' as const, metric, day, value: r[metric] }))
      })
      await upsertDaily(daily)
      out.gscDays = rows.length
      // Top searches / pages for each range, ending on the last day Google has (the period before, for position change).
      const end = (await lastDay(clientId, 'gsc')) ?? yesterday
      const tops: Record<string, unknown>[] = []
      // All three ranges at once (9 small requests).
      await Promise.all(Object.values(RANGE_DAYS).map(async (n) => {
        const from = addDays(end, -(n - 1))
        const prevTo = addDays(from, -1)
        const prevFrom = addDays(prevTo, -(n - 1))
        const [q, prevQ, pages] = await Promise.all([
          // 250: Google returns searches by clicks, so a short list would miss high-impression searches with no clicks.
          gscQuery(gscProp, { startDate: from, endDate: end, dimensions: ['query'], rowLimit: 250 }),
          gscQuery(gscProp, { startDate: prevFrom, endDate: prevTo, dimensions: ['query'], rowLimit: 250 }),
          gscQuery(gscProp, { startDate: from, endDate: end, dimensions: ['page'], rowLimit: 25 }),
        ])
        const row = (dimension: 'query' | 'page', pf: string, pt: string) => (r: GscRow) => ({
          client_id: clientId,
          dimension,
          period_from: pf,
          period_to: pt,
          label: (r.keys?.[0] ?? '').slice(0, 500),
          clicks: Math.round(r.clicks),
          impressions: Math.round(r.impressions),
          ctr: r.ctr,
          position: r.position,
        })
        tops.push(...q.map(row('query', from, end)), ...prevQ.map(row('query', prevFrom, prevTo)), ...pages.map(row('page', from, end)))
      }))
      must(await db().from('seo_metric_top').delete().eq('client_id', clientId), 'Replacing the top lists')
      const clean = tops.filter((t) => t.label)
      const seen = new Set<string>()
      const unique = clean.filter((t) => {
        const k = `${t.dimension}|${t.period_from}|${t.period_to}|${t.label}`
        return seen.has(k) ? false : (seen.add(k), true)
      })
      for (let i = 0; i < unique.length; i += CHUNK) must(await db().from('seo_metric_top').insert(unique.slice(i, i + CHUNK)), 'Saving the top lists')
      out.topRows = unique.length
    } catch (e) {
      out.errors.push(`Search Console: ${errText(e)}`)
    }
  }

  if (link.ga4_property) {
    try {
      const last = await lastDay(clientId, 'ga4')
      const start = last ? addDays(last, -REPULL_DAYS) : iso(Date.now() - FIRST_PULL_DAYS * DAY)
      const metrics = ['sessions', 'engagedSessions', 'totalUsers', 'keyEvents', 'averageSessionDuration'] as const
      const names: Record<(typeof metrics)[number], string> = { sessions: 'sessions', engagedSessions: 'engaged_sessions', totalUsers: 'users', keyEvents: 'key_events', averageSessionDuration: 'avg_engagement_sec' }
      // GA4 is slow on long daily reports (480 days > 30 s, 90 days ≈ 1.5 s): ask in 90-day windows, all at once.
      const windows: [string, string][] = []
      for (let s = start; s <= yesterday; s = addDays(s, 90)) windows.push([s, addDays(s, 89) < yesterday ? addDays(s, 89) : yesterday])
      type Ga4Rows = { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }
      const parts = await Promise.all(
        windows.map(([from, to]) =>
          google<Ga4Rows>(`https://analyticsdata.googleapis.com/v1beta/${link.ga4_property}:runReport`, {
            dateRanges: [{ startDate: from, endDate: to }],
            dimensions: [{ name: 'date' }],
            metrics: metrics.map((name) => ({ name })),
            dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
            limit: 1000,
          }),
        ),
      )
      const r = { rows: parts.flatMap((p) => p.rows ?? []) }
      const daily: DailyRow[] = r.rows.flatMap((row) => {
        const d = row.dimensionValues[0]?.value ?? ''
        if (!/^\d{8}$/.test(d)) return []
        const day = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        return metrics.map((m, i) => ({ client_id: clientId, source: 'ga4' as const, metric: names[m], day, value: Number(row.metricValues[i]?.value ?? 0) }))
      })
      await upsertDaily(daily)
      out.ga4Days = r.rows.length
    } catch (e) {
      out.errors.push(`GA4: ${errText(e)}`)
    }
  }

  await db()
    .from('seo_google_links')
    .update({ last_sync_at: new Date().toISOString(), last_sync_ok: out.errors.length === 0, last_error: out.errors.join(' · ').slice(0, 500) || null })
    .eq('client_id', clientId)
  return out
}

/** The daily cron: every client with Google linked, one after the other. One client's error never stops the rest. */
export async function syncAll(): Promise<{ clients: number; failed: number }> {
  const links = must(await db().from('seo_google_links').select('client_id, seo_clients!inner(site_id, status)'), 'Loading Google links') as unknown as { seo_clients: { site_id: string; status: string } }[]
  let failed = 0
  for (const l of links.filter((x) => x.seo_clients.status !== 'archived')) {
    try {
      const r = await syncClient(l.seo_clients.site_id)
      if (r.errors.length) failed++
    } catch {
      failed++
    }
  }
  return { clients: links.length, failed }
}

// ---- Reading for the Overview ------------------------------------------------------------------------------------

const sum = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) : null
}

function gscTotals(byDay: Map<string, Record<string, number>>, from: string, to: string): GscTotals {
  const days = [...byDay.entries()].filter(([d]) => d >= from && d <= to).map(([, v]) => v)
  const clicks = sum(days.map((d) => d.clicks))
  const impressions = sum(days.map((d) => d.impressions))
  const weighted = sum(days.map((d) => (d.position !== undefined && d.impressions !== undefined ? d.position * d.impressions : null)))
  return {
    clicks,
    impressions,
    ctr: clicks !== null && impressions ? clicks / impressions : null,
    position: weighted !== null && impressions ? weighted / impressions : null,
    days: days.length,
  }
}

function ga4Totals(byDay: Map<string, Record<string, number>>, from: string, to: string): Ga4Totals {
  const days = [...byDay.entries()].filter(([d]) => d >= from && d <= to).map(([, v]) => v)
  const sessions = sum(days.map((d) => d.sessions))
  const dur = sum(days.map((d) => (d.avg_engagement_sec !== undefined && d.sessions !== undefined ? d.avg_engagement_sec * d.sessions : null)))
  return {
    sessions,
    engagedSessions: sum(days.map((d) => d.engaged_sessions)),
    users: sum(days.map((d) => d.users)),
    keyEvents: sum(days.map((d) => d.key_events)),
    avgSeconds: dur !== null && sessions ? dur / sessions : null,
    days: days.length,
  }
}

const monthStart = (d: string) => `${d.slice(0, 7)}-01`

type Window<T> = { from: string; to: string; totals: T } | null

/**
 * The last `n` days each Google source has (ending on its own last pulled day), with the same totals the Overview
 * shows. Used by Baseline (the frozen copy) and "Baseline vs now". null = not linked or nothing pulled yet.
 */
export async function googleWindow(clientId: string, n = 28): Promise<{ gsc: Window<GscTotals>; ga4: Window<Ga4Totals> }> {
  const link = must(await db().from('seo_google_links').select('gsc_property, ga4_property').eq('client_id', clientId).maybeSingle(), 'Loading the Google link') as { gsc_property: string | null; ga4_property: string | null } | null
  const one = async <T>(source: 'gsc' | 'ga4', linked: boolean, totals: (m: Map<string, Record<string, number>>, from: string, to: string) => T): Promise<Window<T>> => {
    if (!linked) return null
    const to = await lastDay(clientId, source)
    if (!to) return null
    const from = addDays(to, -(n - 1))
    const byDay = new Map<string, Record<string, number>>()
    for await (const r of pagedRows<{ metric: string; day: string; value: string | number }>(
      (a, b) => db().from('seo_metric_daily').select('metric, day, value').eq('client_id', clientId).eq('source', source).gte('day', from).lte('day', to).order('metric').order('day').range(a, b),
      'Loading the numbers',
    )) {
      const d = byDay.get(r.day) ?? {}
      d[r.metric] = Number(r.value)
      byDay.set(r.day, d)
    }
    return { from, to, totals: totals(byDay, from, to) }
  }
  const [gsc, ga4] = await Promise.all([one('gsc', !!link?.gsc_property, gscTotals), one('ga4', !!link?.ga4_property, ga4Totals)])
  return { gsc, ga4 }
}

export async function metricsOverview(siteId: string, range: MetricRange): Promise<MetricsOverview> {
  const { clientId, link } = await linkFor(siteId)
  const n = RANGE_DAYS[range]
  const out: MetricsOverview = {
    range,
    linked: { gsc: !!link?.gsc_property, ga4: !!link?.ga4_property },
    lastSyncAt: link?.last_sync_at ?? null,
    lastSyncOk: link?.last_sync_ok ?? null,
    lastError: link?.last_error ?? null,
    gsc: null,
    ga4: null,
  }
  if (!link) return out
  const since = iso(Date.now() - (2 * n + 7) * DAY)
  const bySource = { gsc: new Map<string, Record<string, number>>(), ga4: new Map<string, Record<string, number>>() }
  for await (const r of pagedRows<{ source: 'gsc' | 'ga4'; metric: string; day: string; value: string | number }>(
    (from, to) => db().from('seo_metric_daily').select('source, metric, day, value').eq('client_id', clientId).gte('day', since).order('source').order('metric').order('day').range(from, to),
    'Loading the numbers',
  )) {
    const m = bySource[r.source]
    const d = m.get(r.day) ?? {}
    d[r.metric] = Number(r.value)
    m.set(r.day, d)
  }

  // Search Console: the range ends on the last day Google has (it runs ~2–3 days behind).
  // Google leaves out days with nothing in them: inside the pulled history those are 0; before it, "no data" (null).
  const first = { gsc: await firstDay(clientId, 'gsc'), ga4: await firstDay(clientId, 'ga4') }
  const gscDays = [...bySource.gsc.keys()].sort()
  if (link.gsc_property && gscDays.length) {
    const to = gscDays[gscDays.length - 1]
    const from = addDays(to, -(n - 1))
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(n - 1))
    const known = (d: string) => !!first.gsc && d >= first.gsc
    const series: NonNullable<MetricsOverview['gsc']>['series'] = []
    if (range === '12m') {
      // Weekly points (Monday-free: 7-day blocks ending on `to`) so the line stays readable.
      for (let end = to; end >= from; end = addDays(end, -7)) {
        const start = addDays(end, -6) < from ? from : addDays(end, -6)
        const t = gscTotals(bySource.gsc, start, end)
        series.unshift({ day: start, clicks: known(start) ? (t.clicks ?? 0) : null, impressions: known(start) ? (t.impressions ?? 0) : null, ctr: t.ctr, position: t.position })
      }
    } else {
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const v = bySource.gsc.get(d)
        series.push({ day: d, clicks: known(d) ? (v?.clicks ?? 0) : null, impressions: known(d) ? (v?.impressions ?? 0) : null, ctr: v?.ctr ?? null, position: v?.position ?? null })
      }
    }
    // Only this range's lists (ending on the last pulled day, or its previous period), read in pages: the lists can
    // pass 1,000 rows and the database returns at most 1,000 per request.
    type TopRow = { dimension: 'query' | 'page'; period_from: string; period_to: string; label: string; clicks: number; impressions: number; ctr: number; position: number }
    const top: TopRow[] = []
    for await (const r of pagedRows<TopRow>(
      (a, b) =>
        db()
          .from('seo_metric_top')
          .select('dimension, period_from, period_to, label, clicks, impressions, ctr, position')
          .eq('client_id', clientId)
          .in('period_from', [from, prevFrom])
          .order('dimension')
          .order('period_to')
          .order('label')
          .range(a, b),
      'Loading top searches',
    ))
      top.push(r)
    // Top lists were pulled for each range ending on the last pulled day: pick the ones of this range's length.
    const len = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY) + 1
    const curQ = top.filter((t) => t.dimension === 'query' && len(t.period_from, t.period_to) === n).sort((a, b) => b.period_to.localeCompare(a.period_to))
    const latestTo = curQ[0]?.period_to
    const qNow = curQ.filter((t) => t.period_to === latestTo)
    const qPrev = new Map(curQ.filter((t) => t.period_to !== latestTo).map((t) => [t.label, Number(t.position)]))
    const pages = top.filter((t) => t.dimension === 'page' && len(t.period_from, t.period_to) === n && t.period_to === latestTo)
    out.gsc = {
      from,
      to,
      prevFrom,
      prevTo,
      comparable: !!first.gsc && first.gsc <= prevFrom,
      baselineDay: await baselineDay(clientId),
      now: gscTotals(bySource.gsc, from, to),
      prev: gscTotals(bySource.gsc, prevFrom, prevTo),
      series,
      queries: qNow
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
        .map((t) => ({ label: t.label, clicks: t.clicks, impressions: t.impressions, ctr: Number(t.ctr), position: Number(t.position), prevPosition: qPrev.get(t.label) ?? null })),
      pages: pages.sort((a, b) => b.clicks - a.clicks).map((t) => ({ label: t.label, clicks: t.clicks, impressions: t.impressions })),
    }
  }

  // GA4: the range ends on the last day GA4 has (yesterday).
  const gaDays = [...bySource.ga4.keys()].sort()
  if (link.ga4_property && gaDays.length) {
    const to = gaDays[gaDays.length - 1]
    const from = addDays(to, -(n - 1))
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(n - 1))
    const knownGa = (d: string) => !!first.ga4 && d >= first.ga4
    const bars: NonNullable<MetricsOverview['ga4']>['bars'] = []
    if (range === '28d') {
      for (let d = from; d <= to; d = addDays(d, 1)) bars.push({ label: d.slice(5), from: d, to: d, sessions: knownGa(d) ? (bySource.ga4.get(d)?.sessions ?? 0) : null })
    } else if (range === '3m') {
      for (let end = to; end >= from; end = addDays(end, -7)) {
        const start = addDays(end, -6) < from ? from : addDays(end, -6)
        const t = ga4Totals(bySource.ga4, start, end)
        bars.unshift({ label: start.slice(5), from: start, to: end, sessions: knownGa(start) ? (t.sessions ?? 0) : null })
      }
    } else {
      for (let m = monthStart(from); m <= to; m = monthStart(addDays(m, 32))) {
        const end = addDays(monthStart(addDays(m, 32)), -1)
        const s = m < from ? from : m
        const e = end > to ? to : end
        const t = ga4Totals(bySource.ga4, s, e)
        bars.push({ label: new Date(`${m}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), from: s, to: e, sessions: knownGa(s) ? (t.sessions ?? 0) : null })
      }
    }
    out.ga4 = { from, to, comparable: !!first.ga4 && first.ga4 <= prevFrom, now: ga4Totals(bySource.ga4, from, to), prev: ga4Totals(bySource.ga4, prevFrom, prevTo), bars }
  }
  return out
}
