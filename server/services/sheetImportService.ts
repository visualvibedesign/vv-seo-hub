// Whole client Sheet (.xlsx) import (migration 0015, docs/client-sheet-import-plan.md). An EXTRA way in: raw exports,
// Sam's Guide, Clusters and Master DB single-tab imports all keep working. This file adds no import rules of its own:
// each recognised tab runs the existing importer (same dry run, same rules). Only the Competitors tab is new (names only).
//   Tabs are recognised by their title and headers, never by the tab's name (works for any client's Sheet).
//   Order: Master DB → Sam's Guide → Clusters → Competitors. Each tab is its own import, linked to the .xlsx row.
//   Clusters wins pages: with a Clusters tab, Sam's Guide Top 10 adds no pages (differences are listed).
//   Master DB from a Sheet never replaces a filled number (no "use the new numbers" here): it only fills empty fields.
import Papa from 'papaparse'
import { isOwnBrand } from '../../src/lib/autofillRules.js'
import { autoMatch, cleanKeyword, keywordKey, looksLikeAddress } from '../../src/lib/importRules.js'
import { competitorKey, competitorName, domainOf, parseSamsGuide, sameCompetitor } from '../../src/lib/samsGuide.js'
import { readXlsx, XlsxError, XLSX_MAX_BYTES, type XlsxTab } from '../../src/lib/xlsx.js'
import type { ImportPayload, ImportRow, SheetApplyResult, SheetCompetitor, SheetOwner, SheetPlan, SheetTabKind, SheetTabPlan } from '../../src/types/seo.js'
import { db, DatabaseError, must } from '../clients/supabase.js'
import { clientRow, type ClientRow } from './clientService.js'
import { ClusterInputError, importClustersCsv } from './clusterService.js'
import { commitImport, ImportInputError, previewImportKeys } from './importService.js'
import { applySamsGuide, planSamsGuide, SamsGuideInputError } from './samsGuideService.js'

export class SheetInputError extends Error {}

const BUCKET = 'seo-imports'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ORDER: SheetTabKind[] = ['master_db', 'sams_guide', 'clusters', 'competitors']
const KIND_LABEL: Record<SheetTabKind, string> = { master_db: 'Master Keyword Database', sams_guide: 'Sam’s Guide', clusters: 'Clusters', competitors: 'Competitors', unused: 'Not used yet' }
const CODES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'] // new names fill empty C1–C4 first, then C5–C9

// ---- Reading -----------------------------------------------------------------------------------------------

/** The uploaded file (base64) → its bytes (kept untouched) + its tabs (values only). */
function decode(base64: unknown): { bytes: Buffer; tabs: XlsxTab[] } {
  if (typeof base64 !== 'string' || !base64) throw new SheetInputError('Choose the .xlsx file first.')
  if (base64.length > Math.ceil((XLSX_MAX_BYTES * 4) / 3) + 8) throw new SheetInputError('That file is over 3 MB. The cap is 3 MB.')
  const bytes = Buffer.from(base64, 'base64')
  try {
    return { bytes, tabs: readXlsx(new Uint8Array(bytes)) }
  } catch (e) {
    if (e instanceof XlsxError) throw new SheetInputError(e.message)
    throw e
  }
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const lower = (r: string[]) => r.map((x) => clean(x).toLowerCase())
/** Rows without the empty ones at the end (a Sheet's formatting can leave hundreds). */
const trimmed = (rows: string[][]) => {
  let n = rows.length
  while (n > 0 && !rows[n - 1].some((c) => clean(c))) n--
  return rows.slice(0, n)
}
const toCsv = (rows: string[][]) => Papa.unparse(rows, { newline: '\n' })

/** First row (within the top 15) that passes `test`, or -1. */
const headerAt = (rows: string[][], test: (h: string[]) => boolean) => rows.slice(0, 15).findIndex((r) => test(lower(r)))

const isMasterHeader = (h: string[]) => h.includes('keyword') && h.includes('role') && h.includes('service')
const isClustersHeader = (h: string[]) => ['category', 'page', 'priority'].every((x) => h.includes(x)) && h.some((x) => x.startsWith('primary keyword'))
const isCompetitorHeader = (h: string[]) => /^(business|business name|competitor|competitors|name)$/.test(h[0] ?? '') && h.filter(Boolean).length >= 2

/** What a tab is, from its title and headers. */
function recognise(rows: string[][]): { kind: SheetTabKind; why: string; at: number } {
  const m = headerAt(rows, isMasterHeader)
  if (m >= 0) return { kind: 'master_db', why: 'Header row has Keyword, Role and Service', at: m }
  const c = headerAt(rows, isClustersHeader)
  if (c >= 0) return { kind: 'clusters', why: 'Header row has Category, Page, Priority and Primary keyword', at: c }
  try {
    const g = parseSamsGuide(toCsv(rows))
    if (g.register.length || g.pages.length) return { kind: 'sams_guide', why: `Page 2 register (${g.register.length} rows) / Page 5 Top 10 (${g.pages.length} pages) found`, at: 0 }
  } catch {
    /* not a Sam's Guide */
  }
  const title = rows.slice(0, 3).map((r) => clean(r.find((x) => clean(x)))).join(' ')
  const compAt = rows.slice(0, 40).findIndex((r) => isCompetitorHeader(lower(r)))
  if (/competitor/i.test(title) && compAt >= 0) return { kind: 'competitors', why: `Competitor title and a “${clean(rows[compAt][0])}” table`, at: compAt }
  return { kind: 'unused', why: 'Not used yet: no table SEO Hub reads (only Master DB, Sam’s Guide, Clusters and Competitors are imported)', at: -1 }
}

// ---- Per-tab plans (existing importers) ---------------------------------------------------------------------

/** Master DB tab → the same payload the single-file Sheet import sends (columns matched the same way). */
function masterPayload(siteId: string, fileName: string, rows: string[][], at: number): ImportPayload {
  const headers = rows[at].map((h) => clean(h))
  const map = autoMatch('sheet', headers)
  const idx = (f: keyof typeof map) => (map[f] ? headers.indexOf(map[f]!) : -1)
  const out: ImportRow[] = []
  for (const r of rows.slice(at + 1)) {
    const get = (f: keyof typeof map) => (idx(f) >= 0 ? (r[idx(f)] ?? '').trim() : undefined)
    const keyword = cleanKeyword(get('keyword') ?? '')
    if (!keyword) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, i) => (raw[h || `Column ${i + 1}`] = r[i] ?? ''))
    out.push({ keyword, volume: get('volume'), kd: get('kd'), cpc: get('cpc'), intent: get('intent'), role: get('role'), service: get('service'), kp: get('kp'), raw })
  }
  return { siteId, source: 'sheet', report: 'master_db', fileName, location: '', filter: '', columnMap: map, totals: [], rows: out, useNew: [], allowAddresses: [] }
}

/** Competitors tab: the first table's first column, names only, until the first blank row. */
function competitorNames(rows: string[][], at: number): string[] {
  const out: string[] = []
  for (const r of rows.slice(at + 1)) {
    const first = clean(r[0])
    if (!first) break
    out.push(first)
  }
  return out.slice(0, 30)
}

/** Is this name / domain this client? (brand words, business name, website domain; capitals, punctuation, https / www ignored) */
function isThisClient(c: ClientRow, text: string): boolean {
  const t = clean(text)
  if (!t) return false
  return isOwnBrand(t, { brandWords: c.brand_words ?? [], name: c.name, siteUrl: c.site_url }) || sameCompetitor(t, c.name) || sameCompetitor(t, c.site_url)
}

/**
 * Whose Sheet is this? Before the dry run is trusted (Angel, Nov 26: an Anassa Sheet dropped on Visual Vibe gave no
 * warning). Signals, for any client: the Competitors "(us)" row, Sam's Guide title, the tab titles ("Baseline rankings ·
 * Name", "On-page fixes · domain.com"), the file name, and whether the keywords name this client's city / areas.
 * A name counts as "another business" when it's a "(us)" row, the Sam's Guide client, a domain, or in 2+ tab titles.
 */
function ownerCheck(c: ClientRow, fileName: string, list: { rows: string[][] }[], placeWords: string[], keywords: string[], samsClient: string | null): SheetOwner {
  const positives: string[] = []
  const others = new Map<string, { name: string; strong: boolean; count: number }>()
  const note = (name: string, strong: boolean) => {
    const n = clean(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '))
    if (!n || n.length > 80) return
    if (isThisClient(c, n)) return void positives.push(n)
    const key = competitorKey(n)
    if (!key) return
    const o = others.get(key) ?? { name: n, strong: false, count: 0 }
    o.count++
    o.strong = o.strong || strong || !!domainOf(n)
    others.set(key, o)
  }
  for (const t of list) {
    // "(us)" rows: the business the Sheet is about
    for (const r of t.rows.slice(0, 200)) for (const cell of r.slice(0, 3)) if (/\(us\)/i.test(cell)) note(cell, true)
    // Tab title: "Competitor review · Name (City)", "Ideal sitemap · domain.com", "Sam's Guide · Keyword research: Name"
    const title = clean(t.rows.find((r) => r.some((x) => clean(x)))?.find((x) => clean(x)))
    const part = title.includes(':') ? title.split(':').pop()! : title.includes(' · ') ? title.split(' · ').pop()! : ''
    if (part && part.split(/\s+/).length <= 8) note(part, false)
  }
  if (samsClient) note(samsClient, true)
  if (isThisClient(c, fileName.replace(/\.xlsx$/i, '').replace(/[_–-]+/g, ' '))) positives.push(fileName)
  const strong = [...others.values()].filter((o) => o.strong || o.count >= 2)
  // Keywords: do they name this client's city / areas? (only when there are enough to tell)
  const places = placeWords.map((w) => w.toLowerCase()).filter((w) => w.length >= 3)
  const withPlace = keywords.filter((k) => places.some((p) => ` ${k.toLowerCase()} `.includes(` ${p} `))).length
  const placeLow = places.length > 0 && keywords.length >= 20 && withPlace / keywords.length < 0.05
  const reasons: string[] = []
  for (const o of strong) reasons.push(`The Sheet names “${o.name}”${o.count > 1 ? ` (${o.count} places)` : ''}.`)
  if (placeLow) reasons.push(`Only ${withPlace} of ${keywords.length} keywords name ${placeWords.slice(0, 3).join(' / ')}.`)
  const matches = positives.length > 0 || (!strong.length && !placeLow)
  return { matches, otherName: matches ? null : (strong[0]?.name ?? null), reasons: matches ? [] : reasons }
}

function planCompetitors(c: ClientRow, written: string[], taken: Map<string, string>): SheetCompetitor[] {
  const free = CODES.filter((code) => !taken.has(code))
  const seen: string[] = []
  return written.map((w) => {
    const name = competitorName(w)
    const key = competitorKey(name)
    const base = { key: `comp:${key}`, written: w, name: name || null, code: null as string | null, approvable: false }
    if (!name || !key) return { ...base, name: null, action: 'Skipped: no name' }
    // The client itself only when the name is this client's; a "(us)" row naming another business is never saved.
    if (isThisClient(c, name)) return { ...base, action: 'Skipped: the client itself' }
    if (/\(us\)/i.test(w)) return { ...base, action: `Skipped: the “(us)” row is ${name}, not this client` }
    if (looksLikeAddress(name)) return { ...base, name: null, action: 'Refused: looks like an address' }
    if (seen.some((x) => sameCompetitor(x, name))) return { ...base, action: 'Skipped: listed twice' }
    seen.push(name)
    // Same competitor ignoring capitals, punctuation, https / www and LLC / Inc / Co ("Breezy Rose Beauty" = breezyrosebeauty.com)
    const have = [...taken].find(([, n]) => sameCompetitor(n, name))?.[0]
    if (have) return { ...base, code: have, action: `Already there (${have})` }
    const code = free.shift()
    if (!code) return { ...base, action: 'No room: C1–C9 are all used' }
    return { ...base, code, approvable: true, action: `New → ${code}` }
  })
}

interface Built {
  c: ClientRow
  plan: SheetPlan
  tabs: { tab: XlsxTab; rows: string[][]; plan: SheetTabPlan; at: number; payload?: ImportPayload }[]
  pagesFromClusters: boolean
}

async function build(siteId: string, fileName: string, tabs: XlsxTab[]): Promise<Built> {
  const c = await clientRow(siteId)
  if (!c) throw new SheetInputError('That client doesn’t exist.')
  const base = fileName.replace(/\.xlsx$/i, '').slice(0, 120) || 'client-sheet'

  // 1. Recognise every tab; only the first tab of each kind is used.
  const used = new Set<SheetTabKind>()
  const list: Built['tabs'] = tabs.map((tab) => {
    const rows = trimmed(tab.rows)
    const r = recognise(rows)
    let blocked: string | null = null
    if (r.kind !== 'unused') {
      if (used.has(r.kind)) blocked = `Another tab is already used as ${KIND_LABEL[r.kind]}.`
      used.add(r.kind)
    }
    return { tab, rows, at: r.at, plan: { name: tab.name, kind: r.kind, why: r.why + (tab.hidden ? ' · hidden tab' : ''), rows: rows.length, blocked } as SheetTabPlan }
  })
  const active = (kind: SheetTabKind) => list.find((t) => t.plan.kind === kind && !t.plan.blocked)
  const pagesFromClusters = !!active('clusters')
  const newKeys = new Set<string>()

  // 2. Dry runs, in apply order (later tabs see what earlier ones would add).
  const mdb = active('master_db')
  if (mdb) {
    try {
      mdb.payload = masterPayload(siteId, `${base} › ${mdb.tab.name}.csv`, mdb.rows, mdb.at)
      const r = await previewImportKeys(mdb.payload)
      mdb.plan.masterDb = r.preview
      r.newKeys.forEach((k) => newKeys.add(k))
    } catch (e) {
      if (!(e instanceof ImportInputError)) throw e
      mdb.plan.blocked = e.message
    }
  }
  const sg = active('sams_guide')
  if (sg) {
    try {
      const p = await planSamsGuide(siteId, toCsv(sg.rows), { pagesFromClusters })
      sg.plan.samsGuide = p
      if (p.alreadyImported) sg.plan.blocked = `${c.name} already has a Sam’s Guide import (${new Date(p.alreadyImported).toLocaleDateString('en-US')}). Delete it in Import history to import this tab.`
      else if (!p.sameClient) sg.plan.blocked = `This Sam’s Guide is for “${p.sheetClient}”, not ${c.name}.`
      else p.newKeywords.forEach((k) => newKeys.add(keywordKey(k.keyword)))
    } catch (e) {
      if (!(e instanceof SamsGuideInputError)) throw e
      sg.plan.blocked = e.message
    }
  }
  const cl = active('clusters')
  let clusterRun: Awaited<ReturnType<typeof importClustersCsv>> | null = null
  if (cl) {
    try {
      const r = (clusterRun = await importClustersCsv(siteId, toCsv(cl.rows.slice(cl.at)), false, { pretendKeys: newKeys }))
      cl.plan.clusters = {
        pages: r.pages.map((p) => ({ category: p.category, name: p.name, url: p.url, priority: p.priority, status: p.status, primary: p.keywords.find((k) => k.role === 'primary')?.keyword ?? null, keywords: p.keywords.length })),
        unmatched: r.unmatched,
        onTwoPages: r.onTwoPages,
      }
    } catch (e) {
      if (!(e instanceof ClusterInputError)) throw e
      cl.plan.blocked = e.message
    }
  }
  const cp = active('competitors')
  if (cp) {
    const existing = must(await db().from('seo_competitors').select('code, name').eq('client_id', c.id), 'Loading competitors') as { code: string; name: string }[]
    const taken = new Map(existing.map((x) => [x.code, x.name]))
    // Sam's Guide (applied first) saves its C1–C4 names into empty codes.
    if (sg?.plan.samsGuide && !sg.plan.blocked) for (const x of sg.plan.samsGuide.competitors) if (x.name && x.action === 'Save name only' && !taken.has(x.code)) taken.set(x.code, x.name)
    cp.plan.competitors = planCompetitors(c, competitorNames(cp.rows, cp.at), taken)
  }

  // 3. Cross-tab check: a keyword on different pages in Sam's Guide Top 10 and the Clusters tab (Clusters wins).
  const crossCheck: SheetPlan['crossCheck'] = []
  if (sg?.plan.samsGuide && clusterRun) {
    const cr = clusterRun
    const label = (name: string, url: string | null) => (url ? `${name} (${url.replace(/^https?:\/\/[^/]+/, '') || '/'})` : name)
    const inClusters = new Map<string, { page: string; url: string | null }>()
    for (const p of cr?.pages ?? []) for (const k of p.keywords) inClusters.set(keywordKey(k.keyword), { page: label(p.name, p.url), url: p.url })
    const path = (u: string | null) => (u ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '').toLowerCase()
    for (const p of sg.plan.samsGuide.pages)
      for (const k of p.keywords) {
        const other = inClusters.get(keywordKey(k.keyword))
        if (!other) continue
        const same = p.url && other.url ? path(p.url) === path(other.url) : other.page.toLowerCase().startsWith(p.name.toLowerCase())
        if (!same) crossCheck.push({ keyword: k.keyword, samsGuide: label(p.name, p.url), clusters: other.page })
      }
  }

  const rank = (k: SheetTabKind) => (k === 'unused' ? ORDER.length : ORDER.indexOf(k)) // used tabs in apply order, then the rest
  const sorted = [...list].sort((x, y) => rank(x.plan.kind) - rank(y.plan.kind))
  // 4. Whose Sheet is it? (before the dry run is trusted)
  const areas = must(await db().from('seo_client_areas').select('name, status').eq('client_id', c.id), 'Loading areas') as { name: string | null; status: string }[]
  const placeWords = [c.city, ...areas.filter((a) => a.status === 'active').map((a) => a.name), ...(c.neighbourhood_words ?? [])]
    .filter((w): w is string => !!w)
    .filter((w, i, all) => all.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i)
  const keywords = mdb?.payload?.rows.map((r) => r.keyword) ?? []
  const samsClient = sg ? (sg.plan.samsGuide?.sheetClient ?? parseSamsGuide(toCsv(sg.rows)).clientName) : null
  const owner = ownerCheck(c, fileName, list, placeWords, keywords, samsClient)

  return { c, plan: { fileName, owner, tabs: sorted.map((t) => t.plan), crossCheck: crossCheck.slice(0, 200) }, tabs: list, pagesFromClusters }
}

const fileNameOf = (raw: unknown) => (typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 200) : 'client-sheet.xlsx')

/** Dry run: what each tab would do. Nothing is saved. */
export async function previewSheet(siteId: string, rawFileName: unknown, base64: unknown): Promise<SheetPlan> {
  const { tabs } = decode(base64)
  return (await build(siteId, fileNameOf(rawFileName), tabs)).plan
}

/**
 * Apply (Angel clicked Apply after the dry run). The plan is built again from the same bytes. `replace` = Sam's Guide
 * conflicts ticked; `competitors` = new competitor names ticked (comp:<key>). Tabs run in order; if one fails, the
 * ones before it stay applied and the failed one undoes itself (each importer's own undo), later ones don't run.
 */
export async function applySheet(siteId: string, rawFileName: unknown, base64: unknown, replace: string[], approved: string[], confirmOwner = false): Promise<SheetApplyResult> {
  const fileName = fileNameOf(rawFileName)
  const { bytes, tabs } = decode(base64)
  const b = await build(siteId, fileName, tabs)
  if (!b.plan.owner.matches && !confirmOwner)
    throw new SheetInputError(`This Sheet looks like it’s for ${b.plan.owner.otherName ?? "another client"}, not ${b.c.name}. Tick “Yes, it’s for this client” to import it anyway.`)
  const work = b.tabs.filter((t) => t.plan.kind !== 'unused' && !t.plan.blocked).sort((x, y) => ORDER.indexOf(x.plan.kind) - ORDER.indexOf(y.plan.kind))
  if (!work.length) throw new SheetInputError('Nothing in this file can be imported (see each tab’s reason).')
  const base = fileName.replace(/\.xlsx$/i, '').slice(0, 120) || 'client-sheet'
  const c = b.c

  // 1. The .xlsx itself: an import row + the file, untouched.
  const parent = must(
    await db()
      .from('seo_imports')
      .insert({ client_id: c.id, source: 'sheet', report: 'client_sheet', file_name: fileName, rows_total: work.length, note: `Whole Sheet: ${work.map((t) => `${KIND_LABEL[t.plan.kind]} (“${t.tab.name}”)`).join(', ')}` })
      .select('id')
      .single(),
    'Saving the import',
  ) as { id: string }
  const storagePath = `${c.site_id}/${parent.id}/${fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'client-sheet.xlsx'}`
  const up = await db().storage.from(BUCKET).upload(storagePath, bytes, { contentType: XLSX_TYPE, upsert: false })
  if (up.error) {
    await db().from('seo_imports').delete().eq('id', parent.id)
    throw new DatabaseError(`Saving the .xlsx: ${up.error.message}`)
  }
  must(await db().from('seo_imports').update({ storage_path: storagePath, file_size: bytes.length }).eq('id', parent.id), 'Saving the .xlsx')

  // 2. Each tab, in order.
  const results: SheetApplyResult['tabs'] = b.plan.tabs.map((t) => ({
    name: t.name,
    kind: t.kind,
    status: t.kind === 'unused' || t.blocked ? 'skipped' : 'not_run',
    message: t.kind === 'unused' ? 'Not used yet' : t.blocked ?? '',
  }))
  const set = (name: string, status: SheetApplyResult['tabs'][number]['status'], message: string) => {
    const r = results.find((x) => x.name === name)!
    r.status = status
    r.message = message
  }
  let applied = 0
  for (const t of work) {
    const csv = toCsv(t.plan.kind === 'clusters' ? t.rows.slice(t.at) : t.rows) // the tab as read (Clusters: from its header row)
    const tabFile = `${base} › ${t.tab.name}.csv`
    try {
      if (t.plan.kind === 'master_db') {
        const r = await commitImport(t.payload!, { base64: Buffer.from(csv, 'utf8').toString('base64'), type: 'text/csv' }, { parentImportId: parent.id })
        set(t.tab.name, 'applied', `${r.preview.newKeywords} new keywords · ${r.preview.filled} filled · ${r.preview.kpFilled} KP ranges filled`)
      } else if (t.plan.kind === 'sams_guide') {
        const r = await applySamsGuide(siteId, { bytes: Buffer.from(csv, 'utf8'), text: csv }, tabFile, replace, { pagesFromClusters: b.pagesFromClusters, parentImportId: parent.id })
        const n = r.plan.counts
        set(t.tab.name, 'applied', `${n.newKeywords} new keywords · ${n.matrixCells} matrix cells${b.pagesFromClusters ? '' : ` · ${n.pages} pages`} · ${n.later} Later/Rejected`)
      } else if (t.plan.kind === 'clusters') {
        const r = await importClustersCsv(siteId, csv, true, { record: { parentImportId: parent.id, fileName: tabFile, bytes: Buffer.from(csv, 'utf8') } })
        set(t.tab.name, 'applied', `${r.pages.length} pages`)
      } else if (t.plan.kind === 'competitors') {
        const ok = new Set(approved)
        const add = (t.plan.competitors ?? []).filter((x) => x.approvable && x.code && x.name && ok.has(x.key))
        if (!add.length) {
          set(t.tab.name, 'skipped', 'No new names ticked')
          continue
        }
        const imp = must(
          await db()
            .from('seo_imports')
            .insert({ client_id: c.id, source: 'sheet', report: 'competitors', file_name: tabFile, rows_total: (t.plan.competitors ?? []).length, rows_added: add.length, column_map: { added: add.map((x) => ({ code: x.code, name: x.name })) }, note: 'Competitors tab: names only', parent_import_id: parent.id })
            .select('id')
            .single(),
          'Saving the import',
        ) as { id: string }
        try {
          must(await db().from('seo_competitors').insert(add.map((x) => ({ client_id: c.id, code: x.code, name: x.name! }))), 'Saving competitor names')
        } catch (err) {
          await db().from('seo_imports').delete().eq('id', imp.id)
          throw err
        }
        const path = `${c.site_id}/${imp.id}/${tabFile.replace(/[^\w.-]+/g, '_').slice(0, 120)}`
        const fu = await db().storage.from(BUCKET).upload(path, Buffer.from(csv, 'utf8'), { contentType: 'text/csv', upsert: false })
        if (!fu.error) await db().from('seo_imports').update({ storage_path: path, file_size: Buffer.byteLength(csv) }).eq('id', imp.id)
        set(t.tab.name, 'applied', `${add.length} names: ${add.map((x) => `${x.code} ${x.name}`).join(', ')}`)
      }
      applied++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      set(t.tab.name, 'failed', `${msg} This tab was undone; the tabs before it stay applied.`)
      break
    }
  }

  // Nothing applied: the .xlsx row and file go too (nothing points at them).
  if (!applied) {
    await db().from('seo_imports').delete().eq('id', parent.id)
    await db().storage.from(BUCKET).remove([storagePath])
    return { importId: null, tabs: results }
  }
  return { importId: parent.id, tabs: results }
}
