// Phase 2c · Semrush Position Tracking CSV (docs/phase-2-plan.md). Rank tracking stays in Semrush (US national); we
// only import its "Rankings Overview" export, exactly as exported. One row per keyword per date in seo_rank_snapshots
// (position empty = not in the top 100, never 0). Matched to the client's keywords by keyword key; the rest are listed.
// Export shape (checked on Anassa's file): a header block ("Report type: position_tracking_rankings_overview",
// "Period: 20261117 - 20261118"), then Keyword + per domain + date: "<domain>_<YYYYMMDD>" (position),
// "…_visibility", "…_type", "…_landing", plus "<domain>_difference", Tags, Intents, CPC, Search Volume, KD.
// Swapped page: the ranking URL isn't the page that owns the keyword (Clusters).
import Papa from 'papaparse'
import { cleanKeyword, keywordKey } from '../../src/lib/importRules.js'
import type { RankingsOverview, RankPlan, RankRow } from '../../src/types/seo.js'
import { db, DatabaseError, must, pagedRows } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class RankInputError extends Error {}

const BUCKET = 'seo-imports'
const MAX_BYTES = 3 * 1024 * 1024
const CHUNK = 500

type Parsed = {
  domain: string
  otherDomains: string[]
  dates: string[]
  period: string | null
  rows: { keyword: string; key: string; byDate: Map<string, { position: number | null; landing: string | null; visibility: number | null }> }[]
}

const host = (u: string) =>
  u
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, '')
    .split('/')[0]
const isoDay = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

/** "21" → 21; "-", "", "n/a", "0", ">100" → null (not in the top 100). */
function position(raw: string | undefined): number | null {
  const n = Number((raw ?? '').trim())
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null
}

export function parsePositionTracking(text: string, siteUrl: string): Parsed {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = clean.split(/\r?\n/)
  const headerAt = lines.findIndex((l) => /^"?keyword"?\s*,/i.test(l.trim()))
  const meta = lines.slice(0, Math.max(0, headerAt)).join('\n')
  if (headerAt < 0 || !/report type:\s*position_tracking/i.test(meta))
    throw new RankInputError('This isn’t a Semrush Position Tracking export. In Semrush: Position Tracking › Overview › Rankings Overview › Export › CSV.')
  const period = meta.match(/period:\s*([0-9]{8}\s*-\s*[0-9]{8})/i)?.[1] ?? null
  const table = Papa.parse<string[]>(lines.slice(headerAt).join('\n'), { skipEmptyLines: 'greedy' }).data
  const [header = [], ...body] = table
  // Position columns: "<domain>_<YYYYMMDD>"; their visibility / landing columns add a suffix.
  const cols = new Map<string, Map<string, { pos: number; vis?: number; land?: number }>>()
  header.forEach((h, i) => {
    const m = h.trim().match(/^(.+)_(\d{8})(?:_(visibility|type|landing))?$/)
    if (!m) return
    const [, domain, date, kind] = m
    const byDate = cols.get(domain) ?? new Map()
    const c = byDate.get(date) ?? { pos: -1 }
    if (!kind) c.pos = i
    else if (kind === 'visibility') c.vis = i
    else if (kind === 'landing') c.land = i
    byDate.set(date, c)
    cols.set(domain, byDate)
  })
  if (!cols.size) throw new RankInputError('No position columns found. Export the Rankings Overview table as CSV (not the Excel or PDF report).')
  const want = host(siteUrl)
  const domain = [...cols.keys()].find((d) => host(d) === want || host(d).endsWith(`.${want}`) || want.endsWith(`.${host(d)}`))
  if (!domain) throw new RankInputError(`This export tracks ${[...cols.keys()].map(host).join(', ')}, not ${want}. Open the right client, or export the right Semrush project.`)
  const dates = [...cols.get(domain)!.entries()].filter(([, c]) => c.pos >= 0).map(([d]) => d).sort()
  if (!dates.length) throw new RankInputError('The export has no position column for this site.')
  const seen = new Set<string>()
  const rows: Parsed['rows'] = []
  for (const r of body) {
    const keyword = cleanKeyword(r[0] ?? '')
    if (!keyword) continue
    const key = keywordKey(keyword)
    if (seen.has(key)) continue
    seen.add(key)
    const byDate = new Map<string, { position: number | null; landing: string | null; visibility: number | null }>()
    for (const d of dates) {
      const c = cols.get(domain)!.get(d)!
      const landing = c.land !== undefined ? (r[c.land] ?? '').trim() : ''
      const vis = c.vis !== undefined ? Number(r[c.vis]) : NaN
      byDate.set(isoDay(d), { position: position(r[c.pos]), landing: /^https?:\/\//i.test(landing) ? landing.slice(0, 500) : null, visibility: Number.isFinite(vis) ? vis : null })
    }
    rows.push({ keyword: keyword.slice(0, 200), key, byDate })
  }
  if (!rows.length) throw new RankInputError('The export has no keyword rows.')
  return { domain, otherDomains: [...cols.keys()].filter((d) => d !== domain), dates: dates.map(isoDay), period, rows }
}

function decode(base64: unknown): { bytes: Buffer; text: string } {
  if (typeof base64 !== 'string' || !base64) throw new RankInputError('Choose the Position Tracking CSV first.')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length > MAX_BYTES) throw new RankInputError('That file is over 3 MB. A Position Tracking export is much smaller: check it’s the right file.')
  return { bytes, text: bytes.toString('utf8') }
}

async function build(siteId: string, text: string) {
  const c = await clientRow(siteId)
  if (!c) throw new RankInputError('That client doesn’t exist.')
  const p = parsePositionTracking(text, c.site_url)
  // The client's keywords for exactly these keys (chunked: a client can have thousands).
  const ids = new Map<string, string>()
  const keys = p.rows.map((r) => r.key)
  for (let i = 0; i < keys.length; i += 200) {
    const part = must(await db().from('seo_keywords').select('id, keyword_key').eq('client_id', c.id).in('keyword_key', keys.slice(i, i + 200)), 'Matching keywords') as { id: string; keyword_key: string }[]
    for (const k of part) ids.set(k.keyword_key, k.id)
  }
  const existing = await db().from('seo_rank_snapshots').select('id', { count: 'exact', head: true }).eq('client_id', c.id).in('checked_on', p.dates)
  if (existing.error) throw new DatabaseError(`Checking earlier rankings: ${existing.error.message}`)
  const last = p.dates[p.dates.length - 1]
  const now = p.rows.map((r) => r.byDate.get(last)?.position ?? null)
  const ranked = now.filter((x): x is number => x !== null)
  const plan: RankPlan = {
    domain: p.domain,
    dates: p.dates,
    period: p.period,
    keywords: p.rows.length,
    matched: p.rows.filter((r) => ids.has(r.key)).length,
    unmatched: p.rows.filter((r) => !ids.has(r.key)).map((r) => r.keyword).slice(0, 200),
    latest: { date: last, ranked: ranked.length, top3: ranked.filter((x) => x <= 3).length, top10: ranked.filter((x) => x <= 10).length, avgPosition: ranked.length ? ranked.reduce((a, b) => a + b, 0) / ranked.length : null },
    replaces: existing.count ?? 0,
    otherDomains: p.otherDomains,
  }
  return { c, p, ids, plan }
}

export async function previewRanks(siteId: string, base64: unknown): Promise<RankPlan> {
  return (await build(siteId, decode(base64).text)).plan
}

/** Saves the import (raw file kept untouched) and one row per keyword per date; the same dates are replaced. */
export async function commitRanks(siteId: string, rawFileName: unknown, base64: unknown): Promise<{ importId: string; plan: RankPlan }> {
  const file = decode(base64)
  const { c, p, ids, plan } = await build(siteId, file.text)
  const fileName = typeof rawFileName === 'string' && rawFileName.trim() ? rawFileName.trim().slice(0, 200) : 'position-tracking.csv'
  const imp = must(
    await db()
      .from('seo_imports')
      .insert({ client_id: c.id, source: 'semrush', report: 'position_tracking', file_name: fileName, rows_total: p.rows.length, rows_added: p.rows.length * p.dates.length, rows_merged: plan.replaces, note: `Position Tracking · ${host(p.domain)} · ${p.dates.join(', ')}` })
      .select('id')
      .single(),
    'Saving the import',
  ) as { id: string }
  let storagePath: string | null = null
  try {
    storagePath = `${c.site_id}/${imp.id}/${fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'position-tracking.csv'}`
    const up = await db().storage.from(BUCKET).upload(storagePath, file.bytes, { contentType: 'text/csv', upsert: false })
    if (up.error) throw new DatabaseError(`Saving the raw file: ${up.error.message}`)
    must(await db().from('seo_imports').update({ storage_path: storagePath, file_size: file.bytes.length }).eq('id', imp.id), 'Saving the raw file')
    const rows = p.rows.flatMap((r) =>
      [...r.byDate.entries()].map(([day, v]) => ({
        client_id: c.id,
        import_id: imp.id,
        keyword_id: ids.get(r.key) ?? null,
        keyword: r.keyword,
        keyword_key: r.key,
        checked_on: day,
        position: v.position,
        landing_url: v.landing,
        visibility: v.visibility,
      })),
    )
    for (let i = 0; i < rows.length; i += CHUNK) must(await db().from('seo_rank_snapshots').upsert(rows.slice(i, i + CHUNK), { onConflict: 'client_id,keyword_key,checked_on' }), 'Saving the rankings')
  } catch (err) {
    await db().from('seo_imports').delete().eq('id', imp.id) // its snapshot rows go with it
    if (storagePath) await db().storage.from(BUCKET).remove([storagePath])
    throw err
  }
  return { importId: imp.id, plan }
}

// ---- Reading for the Overview ------------------------------------------------------------------------------------

const path = (u: string | null | undefined) => (u ?? '').replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase() || '/'

export async function rankingsOverview(siteId: string): Promise<RankingsOverview> {
  const c = await clientRow(siteId)
  if (!c) throw new RankInputError('That client doesn’t exist.')
  const empty: RankingsOverview = { latest: null, previous: null, lastImport: null, buckets: [], moves: [], rows: [], swapped: 0, avgPosition: null }
  const dates = must(await db().from('seo_rank_snapshots').select('checked_on').eq('client_id', c.id).order('checked_on', { ascending: false }).limit(1), 'Loading rankings') as { checked_on: string }[]
  const latest = dates[0]?.checked_on
  if (!latest) return empty
  const prevR = must(await db().from('seo_rank_snapshots').select('checked_on').eq('client_id', c.id).lt('checked_on', latest).order('checked_on', { ascending: false }).limit(1), 'Loading rankings') as { checked_on: string }[]
  const previous = prevR[0]?.checked_on ?? null
  type Snap = { keyword: string; keyword_key: string; keyword_id: string | null; checked_on: string; position: number | null; landing_url: string | null; import_id: string }
  const snaps: Snap[] = []
  for await (const r of pagedRows<Snap>(
    (a, b) => db().from('seo_rank_snapshots').select('keyword, keyword_key, keyword_id, checked_on, position, landing_url, import_id').eq('client_id', c.id).in('checked_on', previous ? [latest, previous] : [latest]).order('keyword_key').order('checked_on').range(a, b),
    'Loading rankings',
  ))
    snaps.push(r)
  const now = snaps.filter((s) => s.checked_on === latest)
  const before = new Map(snaps.filter((s) => s.checked_on === previous).map((s) => [s.keyword_key, s.position]))

  // Which page owns each keyword (Clusters), to flag a swapped page.
  const kwIds = [...new Set(now.map((s) => s.keyword_id).filter((x): x is string => !!x))]
  const owner = new Map<string, { name: string; url: string }>()
  for (let i = 0; i < kwIds.length; i += 200) {
    const part = must(await db().from('seo_page_keywords').select('keyword_id, seo_pages!inner(name, url)').in('keyword_id', kwIds.slice(i, i + 200)), 'Loading pages') as unknown as { keyword_id: string; seo_pages: { name: string; url: string | null } }[]
    for (const p of part) if (p.seo_pages.url) owner.set(p.keyword_id, { name: p.seo_pages.name, url: p.seo_pages.url })
  }

  const rows: RankRow[] = now
    .map((s) => {
      const own = s.keyword_id ? owner.get(s.keyword_id) : undefined
      const swapped = !!own && s.position !== null && !!s.landing_url && path(s.landing_url) !== path(own.url)
      return { keyword: s.keyword, position: s.position, prevPosition: before.has(s.keyword_key) ? (before.get(s.keyword_key) ?? null) : null, landingUrl: s.landing_url, swappedWith: swapped ? own! : null }
    })
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.keyword.localeCompare(b.keyword))
  const bucket = (pos: (number | null)[], lo: number, hi: number) => pos.filter((p) => p !== null && p >= lo && p <= hi).length
  const nowPos = now.map((s) => s.position)
  const prevPos = previous ? [...before.values()] : null
  const ranges: [string, number, number][] = [
    ['Top 3', 1, 3],
    ['4–10', 4, 10],
    ['11–20', 11, 20],
    ['21–50', 21, 50],
    ['51–100', 51, 100],
  ]
  const buckets = [
    ...ranges.map(([label, lo, hi]) => ({ label, now: bucket(nowPos, lo, hi), prev: prevPos ? bucket(prevPos, lo, hi) : null })),
    { label: 'Not in top 100', now: nowPos.filter((p) => p === null).length, prev: prevPos ? prevPos.filter((p) => p === null).length : null },
  ]
  const moves = previous
    ? rows
        .filter((r) => before.has(keywordKey(r.keyword)) && r.prevPosition !== r.position)
        .map((r) => ({ keyword: r.keyword, from: r.prevPosition, to: r.position, d: (r.prevPosition ?? 101) - (r.position ?? 101) }))
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
        .slice(0, 5)
        .map(({ keyword, from, to }) => ({ keyword, from, to }))
    : []
  const ranked = nowPos.filter((p): p is number => p !== null)
  const lastImportId = now[0]?.import_id
  const imp = lastImportId ? (must(await db().from('seo_imports').select('file_name, created_at').eq('id', lastImportId).maybeSingle(), 'Loading the import') as { file_name: string; created_at: string } | null) : null
  return {
    latest,
    previous,
    lastImport: imp ? { fileName: imp.file_name, at: imp.created_at } : null,
    buckets,
    moves,
    rows,
    swapped: rows.filter((r) => r.swappedWith).length,
    avgPosition: ranked.length ? ranked.reduce((a, b) => a + b, 0) / ranked.length : null,
  }
}
