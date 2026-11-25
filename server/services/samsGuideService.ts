// Sam's Guide sheet import (docs/sams-guide-import-plan.md): DRY RUN (planSamsGuide, read-only) and APPLY
// (applySamsGuide, only on Angel's click; the server builds the plan again, never trusting the browser).
// Rules (Angel, Nov 25):
//   * keywords not in the database are created, marked "from Sheet"; address-like ones are held back
//   * volumes exactly as written, split into Semrush / KP / KD / CPC; they only fill EMPTY keyword fields.
//     KP "no data" is stored as "No data". Two parts of the sheet that disagree (incl. "n/a" vs a number) → nothing
//     filled, listed as a conflict
//   * matrix: an existing primary is kept unless Angel ticks "replace"; Pending / N/A kept; a hub row is a page
//   * Page 3 → Later (Rejected type → Rejected), no role, only while the keyword is still Keep.
//     "More areas" rows are not keywords: one note on the client
//   * competitors C1–C4: names only (brackets / addresses stripped, never stored)
//   * one Sam's Guide import per client (delete it in Import history to import again); the raw CSV is kept untouched
import { looksLikeAddress, keywordKey } from '../../src/lib/importRules.js'
import { parseSamsGuide, sameCompetitor, type RegisterRow, type SamsGuide, type SheetVolume } from '../../src/lib/samsGuide.js'
import type { SamsGuideConflict, SamsGuidePlan } from '../../src/types/seo.js'
import { DatabaseError, db, must } from '../clients/supabase.js'
import { clientRow, type ClientRow } from './clientService.js'

export class SamsGuideInputError extends Error {}

const BUCKET = 'seo-imports'
const CHUNK = 200

type Kw = { id: string; keyword: string; keyword_key: string; status: string; track: boolean; semrush_volume: number | null; kp_volume: string | null; kd: number | null; cpc: number | null }
type Cell = { id: string; category_id: string; area_id: string; state: string; note: string | null; seo_matrix_keywords: { kind: string; keyword_id: string; seo_keywords: { keyword_key: string } | null }[] }

const num = (s: string | null | undefined): number | null => {
  const t = (s ?? '').replace(/[$,\s]/g, '')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
const NO_VALUE = /^(n\/?a|no data|none|-|—)$/i
/** A volume value as one comparable token: a number, "none" (n/a / no data), or null (not written). */
const token = (s: string | null) => (!s ? null : num(s) != null ? String(num(s)) : NO_VALUE.test(s.trim()) ? 'none' : null)
const kpText = (s: string | null) => (!s ? null : /^no data$/i.test(s.trim()) ? 'No data' : /\d\s*[–-]\s*\d/.test(s) ? s.trim() : null)
const isAreaType = (type: string) => /\bareas?\b/i.test(type)

async function client(siteId: string): Promise<ClientRow> {
  const c = await clientRow(siteId)
  if (!c) throw new SamsGuideInputError('That client doesn’t exist.')
  return c
}

interface Mention {
  keyword: string
  from: Set<string>
  vols: SheetVolume[]
  /** History rows: where in the sheet, exactly as written. */
  sources: { segment: string; written: string; kd: number | null; cpc: number | null; raw: Record<string, unknown> }[]
}

/** Everything the dry run shows + what Apply needs (ids). Read-only. */
/** Matrix entries, new cells and competitor names a Sam's Guide import added (seo_imports.column_map.samsGuide). */
export interface SamsGuideAdded {
  matrix: { cell_id: string; keyword_id: string; kind: 'primary' | 'backup' }[]
  cells: string[]
  competitors: { code: string; name: string }[]
}

/** Whole-Sheet import options: pagesFromClusters = a Clusters tab in the same file decides pages (Angel, Nov 25). */
export interface SamsGuideOptions {
  pagesFromClusters?: boolean
  /** The .xlsx this tab came from (seo_imports.parent_import_id, migration 0015). */
  parentImportId?: string
}

async function build(c: ClientRow, csvText: string, opts: SamsGuideOptions = {}) {
  const g: SamsGuide = parseSamsGuide(csvText)
  if (!g.register.length && !g.pages.length) throw new SamsGuideInputError('This doesn’t look like a Sam’s Guide tab: no Page 2 register or Page 5 Top 10 found.')

  // Small per-client lists (a client has 9 cells, a few dozen pages). Keywords can be thousands: they're looked up
  // below by the sheet's own keywords only (PostgREST returns at most 1,000 rows per request).
  const [catsR, areasR, cellsR, pagesR, compR, prevR] = await Promise.all([
    db().from('seo_client_categories').select('id, code, name').eq('client_id', c.id),
    db().from('seo_client_areas').select('id, code, name, state, status').eq('client_id', c.id),
    db().from('seo_matrix_cells').select('id, category_id, area_id, state, note, seo_matrix_keywords(kind, keyword_id, seo_keywords(keyword_key))').eq('client_id', c.id),
    db().from('seo_pages').select('id, name, url, category_id').eq('client_id', c.id).limit(1000),
    db().from('seo_competitors').select('code, name').eq('client_id', c.id),
    db().from('seo_imports').select('id, created_at').eq('client_id', c.id).eq('report', 'sams_guide').limit(1),
  ])
  const cats = must(catsR, 'Loading categories') as { id: string; code: string; name: string }[]
  const areas = must(areasR, 'Loading areas') as { id: string; code: string; name: string | null; state: string | null; status: string }[]
  const cells = must(cellsR, 'Loading the matrix') as unknown as Cell[]
  const pages = must(pagesR, 'Loading pages') as { id: string; name: string; url: string | null; category_id: string }[]
  const comps = must(compR, 'Loading competitors') as { code: string; name: string }[]
  const prev = (must(prevR, 'Checking earlier imports') as { id: string; created_at: string }[])[0] ?? null
  const conflicts: SamsGuideConflict[] = []

  // ---- Every keyword mentioned (Page 2, Page 5, Page 3 except "More areas") -------------------------------
  const mentions = new Map<string, Mention>()
  const mention = (keyword: string, from: string, segment: string, line: number, vol?: SheetVolume) => {
    const key = keywordKey(keyword)
    if (!key) return
    const m = mentions.get(key) ?? { keyword: keyword.trim(), from: new Set<string>(), vols: [], sources: [] }
    m.from.add(from)
    if (vol?.written) {
      m.vols.push(vol)
      if (!m.sources.some((s) => s.segment === segment)) m.sources.push({ segment, written: vol.written, kd: num(vol.kd), cpc: num(vol.cpc), raw: { line, keyword: keyword.trim(), volume: vol.written, from } })
    }
    mentions.set(key, m)
  }
  for (const r of g.register) {
    if (r.primary) mention(r.primary, `Page 2 ${r.id}`, `Page 2 ${r.id}`, r.line, r.volume)
    for (const v of r.variants) mention(v.keyword, `Page 2 ${r.id} variant`, `Page 2 ${r.id} variant`, r.line, v.volume)
  }
  for (const p of g.pages) for (const k of p.keywords) mention(k.keyword, `Page 5 ${p.name}`, `Page 5 ${p.name}`, k.line, k.volume)
  const laterRows = g.later.filter((l) => !isAreaType(l.type))
  for (const l of laterRows) mention(l.keyword, `Page 3 ${l.type}`, `Page 3 ${l.type}`, l.line, l.volume)

  // The client's existing rows for exactly these keywords (chunked), and which page each is on.
  const kws: Kw[] = []
  const keys = [...mentions.keys()]
  for (let i = 0; i < keys.length; i += CHUNK) {
    kws.push(
      ...(must(
        await db().from('seo_keywords').select('id, keyword, keyword_key, status, track, semrush_volume, kp_volume, kd, cpc').eq('client_id', c.id).in('keyword_key', keys.slice(i, i + CHUNK)),
        'Loading keywords',
      ) as Kw[]),
    )
  }
  const byKey = new Map(kws.map((k) => [k.keyword_key, k]))
  const pageKws: { keyword_id: string; page_id: string; role: string }[] = []
  const kwIds = kws.map((k) => k.id)
  for (let i = 0; i < kwIds.length; i += CHUNK) {
    pageKws.push(...(must(await db().from('seo_page_keywords').select('keyword_id, page_id, role').in('keyword_id', kwIds.slice(i, i + CHUNK)), 'Loading page keywords') as typeof pageKws))
  }
  // Pages that already have a primary (so an import adds the sheet's #1 as secondary there, never a 2nd primary).
  const pageIds = pages.map((p) => p.id)
  const pagesWithPrimary = new Set<string>()
  for (let i = 0; i < pageIds.length; i += CHUNK) {
    for (const r of must(await db().from('seo_page_keywords').select('page_id').eq('role', 'primary').in('page_id', pageIds.slice(i, i + CHUNK)), 'Loading page keywords') as { page_id: string }[])
      pagesWithPrimary.add(r.page_id)
  }
  const pageName = new Map(pages.map((p) => [p.id, p.name]))
  const pageOfKw = new Map(pageKws.map((p) => [p.keyword_id, pageName.get(p.page_id) ?? 'another page']))

  // ---- New keywords, held back, volume fills (empty fields only), disagreements ---------------------------
  const heldBack: SamsGuidePlan['heldBack'] = []
  const newKeywords: SamsGuidePlan['newKeywords'] = []
  const fills: SamsGuidePlan['fills'] = []
  for (const [key, m] of mentions) {
    if (looksLikeAddress(m.keyword)) {
      heldBack.push({ keyword: m.keyword, why: 'Looks like a street address: never stored without your OK.' })
      continue
    }
    const ex = byKey.get(key)
    if (!ex) newKeywords.push({ keyword: m.keyword, from: [...m.from] })
    const distinct = (vals: (string | null)[]) => [...new Set(vals.filter((x): x is string => !!x))]
    const f: SamsGuidePlan['fills'][number] = { keyword: m.keyword, isNew: !ex }
    const field = (label: string, raw: (string | null)[], set: (v: string) => void) => {
      const vals = distinct(raw)
      if (vals.length > 1) {
        conflicts.push({ key: `vol:${key}:${label}`, kind: 'volume', text: `“${m.keyword}”: ${label} ${vals.join(' vs ').replace(/none/g, 'n/a')} in different parts of the sheet. Nothing filled.`, replaceable: false })
      } else if (vals.length === 1 && vals[0] !== 'none') set(vals[0])
    }
    field('Semrush', m.vols.map((v) => token(v.semrush)), (v) => ex?.semrush_volume == null && (f.semrush = Number(v)))
    field('KP', m.vols.map((v) => kpText(v.kp)), (v) => !ex?.kp_volume && (f.kp = v))
    field('KD', m.vols.map((v) => token(v.kd)), (v) => ex?.kd == null && (f.kd = Number(v)))
    field('CPC', m.vols.map((v) => token(v.cpc)), (v) => ex?.cpc == null && (f.cpc = Number(v)))
    if (f.semrush != null || f.kp || f.kd != null || f.cpc != null) fills.push(f)
  }
  const held = new Set(heldBack.map((h) => keywordKey(h.keyword)))

  // ---- Matrix cells (a hub row is a page, not a cell) -----------------------------------------------------
  const cat = (code: string) => cats.find((k) => k.code === code)
  const area = (code: string) => areas.find((a) => a.code === code)
  const notUnderstood = [...g.notUnderstood]
  const matrix: (SamsGuidePlan['matrix'][number] & { categoryId: string; areaId: string; cellId: string | null })[] = []
  for (const r of g.register.filter((x) => !x.hub)) {
    const k = cat(r.category)
    const a = r.area ? area(r.area) : undefined
    if (!k || !a) {
      notUnderstood.push({ line: r.line, section: 'Page 2', text: `${r.id}: no ${!k ? `category ${r.category}` : `area ${r.area}`} on this client` })
      continue
    }
    const state: 'target' | 'pending' | 'n_a' = a.status === 'n_a' || r.na ? 'n_a' : r.primary ? 'target' : 'pending'
    const cell = cells.find((x) => x.category_id === k.id && x.area_id === a.id)
    const current = cell?.seo_matrix_keywords.find((x) => x.kind === 'primary')?.seo_keywords?.keyword_key ?? null
    const primaryKey = r.primary ? keywordKey(r.primary) : null
    let action: string
    if (!r.primary) action = `${state === 'n_a' ? 'N/A' : 'Pending'}${r.variants.length ? ' + backups' : ''}`
    else if (!current) action = 'Set primary (role Primary if empty) + backups'
    else if (current === primaryKey) action = 'Same primary: add missing backups'
    else {
      action = 'Conflict: keeps the current primary unless you tick replace'
      conflicts.push({ key: `cell:${r.id}`, kind: 'matrix', text: `${r.id}: the cell already has “${current}” as primary; the sheet says “${r.primary}”.`, replaceable: true })
    }
    matrix.push({
      id: r.id,
      cell: `${r.category} ${k.name} × ${r.area} ${[a.name, a.state].filter(Boolean).join(', ')}`,
      state,
      primary: r.primary,
      backups: r.variants.map((v) => v.keyword).filter((v) => !held.has(keywordKey(v))),
      note: cell?.note ? '' : r.notes,
      action,
      categoryId: k.id,
      areaId: a.id,
      cellId: cell?.id ?? null,
    })
  }
  const track = g.register.filter((r) => r.track && r.primary && !held.has(keywordKey(r.primary))).map((r) => ({ keyword: r.primary!, already: !!byKey.get(keywordKey(r.primary!))?.track }))

  // ---- Pages: Page 5 lists, linked to a register row by their #1 keyword ---------------------------------
  const site = c.site_url.replace(/\/+$/, '')
  const host = site.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase()
  const regOf = (kw: string) => g.register.find((r) => r.primary && keywordKey(r.primary) === keywordKey(kw))
  const urlOf = (r: RegisterRow | undefined) => {
    if (!r?.pageNow.path) return null
    if (r.pageNow.host && r.pageNow.host.replace(/^www\./, '') !== host) return null
    return site + r.pageNow.path
  }
  const used = new Map<string, string>() // keyword key → page name in this sheet
  const planPages: (SamsGuidePlan['pages'][number] & { pageId: string | null; categoryId: string | null })[] = []
  const pageInfo = (name: string, reg: RegisterRow | undefined) => {
    const url = urlOf(reg)
    const category = reg ? (reg.pageNow.path === '/' ? 'Home' : reg.category) : ''
    const ex = pages.find((p) => (url && p.url === url) || p.name.toLowerCase() === name.toLowerCase())
    return { url, category, existing: !!ex, pageId: ex?.id ?? null, categoryId: cat(category)?.id ?? null }
  }
  const pageKeyword = (keyword: string, pageName: string, i: number) => {
    const key = keywordKey(keyword)
    const ex = byKey.get(key)
    const onPage = ex ? pageOfKw.get(ex.id) : undefined
    let action = 'Add'
    if (held.has(key)) action = 'Held back (address-like)'
    else if (used.has(key)) {
      action = `Conflict: also on “${used.get(key)}” in this sheet (stays there)`
      conflicts.push({ key: `dup:${key}`, kind: 'page', text: `“${keyword}” is on two pages in the sheet: “${used.get(key)}” and “${pageName}”. It stays on the first.`, replaceable: false })
    } else if (onPage && onPage.toLowerCase() !== pageName.toLowerCase()) {
      action = `Conflict: already on page “${onPage}”: moves only if you tick replace`
      conflicts.push({ key: `page:${key}`, kind: 'page', text: `“${keyword}” is already on page “${onPage}”; the sheet puts it on “${pageName}”.`, replaceable: true })
    }
    if (!action.startsWith('Held') && !used.has(key)) used.set(key, pageName)
    return { keyword, role: i === 0 ? ('primary' as const) : ('secondary' as const), action }
  }
  for (const p of g.pages) {
    const top = [...p.keywords].sort((a, b) => a.rank - b.rank)
    const reg = top[0] ? regOf(top[0].keyword) : undefined
    const info = pageInfo(p.name, reg)
    if (!info.categoryId) notUnderstood.push({ line: p.line, section: 'Page 5', text: `“${p.name}”: its #1 keyword isn’t a Page 2 primary, so its category is unknown (not imported)` })
    planPages.push({ name: p.name, ...info, status: info.url ? 'live' : 'planned', from: reg ? `Page 2 ${reg.id}` : 'Page 5 only', keywords: top.map((k, i) => pageKeyword(k.keyword, p.name, i)) })
  }
  for (const r of g.register.filter((x) => x.hub && x.primary)) {
    if (planPages.some((p) => p.from === `Page 2 ${r.id}`)) continue
    const info = pageInfo(r.id, r)
    planPages.push({ name: r.id, ...info, status: info.url ? 'live' : 'planned', from: `Page 2 ${r.id}`, keywords: [pageKeyword(r.primary!, r.id, 0)] })
  }

  // ---- Page 3: Later / Rejected (no role); "More areas" → one client note ---------------------------------
  const primaries = new Set(g.register.filter((r) => r.primary).map((r) => keywordKey(r.primary!)))
  const later: SamsGuidePlan['later'] = laterRows.map((l) => {
    const key = keywordKey(l.keyword)
    const ex = byKey.get(key)
    const label = l.status === 'later' ? 'Later' : 'Rejected'
    let action: string
    if (held.has(key)) action = 'Held back (address-like)'
    else if (used.has(key) || primaries.has(key)) {
      action = 'Conflict: it’s also a primary / page keyword in this sheet: stays Keep'
      conflicts.push({ key: `later:${key}`, kind: 'later', text: `“${l.keyword}” is on Page 3 (${l.type}) but also a primary / page keyword in the sheet. It stays Keep.`, replaceable: false })
    } else if (!ex) action = `Create as ${label}`
    else if (ex.status !== 'keep') action = `No change (already ${ex.status === 'later' ? 'Later' : 'Rejected'})`
    else action = `Set ${label}`
    return { keyword: l.keyword, type: l.type, status: l.status, action }
  })
  const areaLines = [...new Map(g.later.filter((l) => isAreaType(l.type)).map((l) => [l.line, l])).values()].map((l) => {
    const words = g.later.filter((x) => x.line === l.line).map((x) => x.keyword)
    return `${words.join(' / ')}${l.why ? ` (${l.why})` : ''}`
  })
  const areaNote = areaLines.length ? `Possible areas (Sam’s Guide, Page 3): ${areaLines.join('; ')}` : null
  // Already there = in the Notes feed (step 7) or still in the old one-box notes.
  const noteAlready =
    !!areaNote &&
    ((c.notes ?? '').includes(areaNote) ||
      (must(await db().from('seo_notes').select('id').eq('client_id', c.id).eq('body', areaNote).limit(1), 'Checking notes') as unknown[]).length > 0)

  // ---- Competitors: names only ---------------------------------------------------------------------------
  const competitors = g.competitors.map((x) => {
    const bad = !x.name || looksLikeAddress(x.name)
    const ex = comps.find((y) => y.code === x.code)
    let action = bad ? 'Refused: still looks like an address' : 'Save name only'
    if (!bad && ex && !sameCompetitor(ex.name, x.name!)) {
      action = `Conflict: ${x.code} is “${ex.name}” now: kept unless you tick replace`
      conflicts.push({ key: `comp:${x.code}`, kind: 'competitor', text: `${x.code} is “${ex.name}” now; the sheet says “${x.name}”.`, replaceable: true })
    } else if (!bad && ex) action = 'No change (same name)'
    return { code: x.code, name: bad ? null : x.name, written: x.written, action }
  })

  // A Clusters tab in the same Sheet decides pages: Sam's Guide Top 10 is shown, but adds no pages or page keywords.
  if (opts.pagesFromClusters) {
    for (let i = conflicts.length - 1; i >= 0; i--) if (conflicts[i].kind === 'page') conflicts.splice(i, 1)
    for (const p of planPages) p.keywords = p.keywords.map((k) => ({ ...k, action: 'Skipped: the Clusters tab decides pages' }))
  }

  const plan: SamsGuidePlan = {
    sheetClient: g.clientName,
    sameClient: !g.clientName || g.clientName.toLowerCase() === c.name.toLowerCase(),
    alreadyImported: prev ? prev.created_at : null,
    counts: {
      keywordsInSheet: mentions.size,
      newKeywords: newKeywords.length,
      existingKeywords: mentions.size - newKeywords.length - heldBack.length,
      heldBack: heldBack.length,
      fills: fills.length,
      matrixCells: matrix.length,
      track: track.filter((t) => !t.already).length,
      pages: opts.pagesFromClusters ? 0 : planPages.filter((p) => p.categoryId).length,
      pageKeywords: planPages.filter((p) => p.categoryId).reduce((n, p) => n + p.keywords.filter((k) => k.action === 'Add').length, 0),
      later: later.filter((l) => /^(Set|Create)/.test(l.action)).length,
      competitors: competitors.filter((x) => x.action === 'Save name only').length,
      conflicts: conflicts.length,
      notUnderstood: notUnderstood.length,
    },
    conflicts,
    newKeywords,
    heldBack,
    fills,
    matrix: matrix.map((m) => ({ id: m.id, cell: m.cell, state: m.state, primary: m.primary, backups: m.backups, note: m.note, action: m.action })),
    track,
    pages: planPages.map((p) => ({ name: p.name, url: p.url, category: p.category, status: p.status, existing: p.existing, from: p.from, keywords: p.keywords })),
    later,
    areaNote: areaNote && !noteAlready ? areaNote : null,
    competitors,
    skipped: g.skipped,
    notUnderstood,
  }
  return { plan, g, c, byKey, mentions, held, matrix, planPages, laterRows, cells, pagesWithPrimary, areaNote: plan.areaNote }
}

export async function planSamsGuide(siteId: string, csvText: string, opts: SamsGuideOptions = {}): Promise<SamsGuidePlan> {
  return (await build(await client(siteId), csvText, opts)).plan
}

const MAX_BYTES = 1024 * 1024

/** The file as uploaded (base64) → its bytes (kept untouched) + its text (read). */
export function decodeSheet(base64: unknown): { bytes: Buffer; text: string } {
  if (typeof base64 !== 'string' || !base64) throw new SamsGuideInputError('Choose the Sam’s Guide CSV first.')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length > MAX_BYTES) throw new SamsGuideInputError('That file is over 1 MB: a Sam’s Guide tab is much smaller. Check it’s the right file.')
  return { bytes, text: bytes.toString('utf8') }
}

/**
 * Applies the import (Angel clicked Apply after the dry run). `replace` = conflict keys Angel ticked.
 * Undo on failure: the new keywords, the import record and the raw file are removed (everything else only fills
 * empty fields, so running it again is safe).
 */
export async function applySamsGuide(siteId: string, file: { bytes: Buffer; text: string }, fileName: string, replace: string[], opts: SamsGuideOptions = {}): Promise<{ importId: string; plan: SamsGuidePlan }> {
  const c = await client(siteId)
  const b = await build(c, file.text, opts)
  const { plan } = b
  if (plan.alreadyImported) throw new SamsGuideInputError('This client already has a Sam’s Guide import. Delete it in Import history first to import again.')
  if (!plan.sameClient) throw new SamsGuideInputError(`This sheet is for “${plan.sheetClient}”, not ${c.name}.`)
  const tick = new Set(replace)
  const now = new Date().toISOString()

  // 1. Import record + the raw CSV, untouched
  const imp = must(
    await db()
      .from('seo_imports')
      .insert({
        client_id: c.id,
        source: 'sheet',
        report: 'sams_guide',
        file_name: fileName,
        rows_total: plan.counts.keywordsInSheet,
        rows_added: plan.counts.newKeywords,
        rows_merged: plan.counts.existingKeywords,
        rows_skipped: plan.counts.heldBack,
        note: 'Sam’s Guide sheet',
        ...(opts.parentImportId ? { parent_import_id: opts.parentImportId } : {}),
      })
      .select('id')
      .single(),
    'Saving the import',
  ) as { id: string }
  const createdIds: string[] = []
  // What this import adds to the matrix + competitors, saved on the import so "Delete this import" can undo it.
  const added: SamsGuideAdded = { matrix: [], cells: [], competitors: [] }
  let storagePath: string | null = null
  try {
    const bytes = file.bytes
    storagePath = `${c.site_id}/${imp.id}/${fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'sams-guide.csv'}`
    const up = await db().storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'text/csv', upsert: false })
    if (up.error) throw new DatabaseError(`Saving the raw file: ${up.error.message}`)
    must(await db().from('seo_imports').update({ storage_path: storagePath, file_size: bytes.length }).eq('id', imp.id), 'Saving the raw file')

    // 2. New keywords ("from Sheet"), with volumes as written; Page 3 ones get Later / Rejected
    const fillOf = new Map(plan.fills.map((f) => [keywordKey(f.keyword), f]))
    const statusOf = new Map(plan.later.filter((l) => l.action.startsWith('Create')).map((l) => [keywordKey(l.keyword), l.status]))
    const ids = new Map<string, string>([...b.byKey.values()].map((k) => [k.keyword_key, k.id]))
    const creates = plan.newKeywords.map((n) => {
      const key = keywordKey(n.keyword)
      const f = fillOf.get(key)
      return {
        client_id: c.id,
        keyword: n.keyword.trim().replace(/\s+/g, ' '),
        keyword_key: key,
        status: statusOf.get(key) ?? 'keep',
        semrush_volume: f?.semrush ?? null,
        kd: f?.kd ?? null,
        cpc: f?.cpc ?? null,
        ...(f?.kp ? { kp_volume: f.kp, kp_volume_by: 'sheet', kp_volume_at: now } : {}),
      }
    })
    for (let i = 0; i < creates.length; i += CHUNK) {
      const rows = must(await db().from('seo_keywords').insert(creates.slice(i, i + CHUNK)).select('id, keyword_key'), 'Adding keywords') as { id: string; keyword_key: string }[]
      for (const r of rows) {
        ids.set(r.keyword_key, r.id)
        createdIds.push(r.id)
      }
    }

    // 3. History: one row per keyword per place in the sheet, exactly as written
    const sources = [...b.mentions.entries()].flatMap(([key, m]) =>
      ids.has(key) ? m.sources.map((s) => ({ keyword_id: ids.get(key)!, import_id: imp.id, source: 'sheet', segment: s.segment.slice(0, 120), volume_raw: s.written, kd: s.kd != null && s.kd <= 100 ? Math.round(s.kd) : null, cpc: s.cpc, intent: null, raw: s.raw })) : [],
    )
    for (let i = 0; i < sources.length; i += CHUNK) must(await db().from('seo_keyword_sources').insert(sources.slice(i, i + CHUNK)), 'Saving the import history')

    // 4. Existing keywords: fill EMPTY fields only (each field guarded on "still empty")
    for (const f of plan.fills.filter((x) => !x.isNew)) {
      const id = ids.get(keywordKey(f.keyword))
      if (!id) continue
      if (f.semrush != null) must(await db().from('seo_keywords').update({ semrush_volume: f.semrush }).eq('id', id).is('semrush_volume', null), 'Filling volumes')
      if (f.kp) must(await db().from('seo_keywords').update({ kp_volume: f.kp, kp_volume_by: 'sheet', kp_volume_at: now }).eq('id', id).is('kp_volume', null), 'Filling volumes')
      if (f.kd != null) must(await db().from('seo_keywords').update({ kd: f.kd }).eq('id', id).is('kd', null), 'Filling volumes')
      if (f.cpc != null) must(await db().from('seo_keywords').update({ cpc: f.cpc }).eq('id', id).is('cpc', null), 'Filling volumes')
    }

    // 5. Track (only switches on)
    const trackIds = plan.track.filter((t) => !t.already).map((t) => ids.get(keywordKey(t.keyword))).filter((x): x is string => !!x)
    if (trackIds.length) must(await db().from('seo_keywords').update({ track: true }).in('id', trackIds).eq('client_id', c.id), 'Switching Track on')

    // 6. Matrix cells: state, note (if empty), primary (unless a conflict not ticked), backups (add only)
    for (const m of b.matrix) {
      // A conflict not ticked keeps the current primary; the sheet's backups are still added.
      const conflict = m.action.startsWith('Conflict')
      let cellId = m.cellId
      if (!cellId) {
        cellId = (must(await db().from('seo_matrix_cells').insert({ client_id: c.id, category_id: m.categoryId, area_id: m.areaId, state: m.state, note: m.note || null }).select('id').single(), 'Saving the matrix') as { id: string }).id
        added.cells.push(cellId)
      } else {
        const cur = b.cells.find((x) => x.id === cellId)!
        const upd: Record<string, unknown> = {}
        if (!cur.note && m.note) upd.note = m.note
        if (cur.state !== 'target' || (conflict && tick.has(`cell:${m.id}`))) upd.state = m.state
        if (Object.keys(upd).length) must(await db().from('seo_matrix_cells').update(upd).eq('id', cellId), 'Saving the matrix')
      }
      const cur = b.cells.find((x) => x.id === cellId)?.seo_matrix_keywords ?? []
      const have = new Set(cur.map((x) => x.keyword_id))
      const primaryId = m.primary ? ids.get(keywordKey(m.primary)) : undefined
      const setPrimary = !!primaryId && (!cur.some((x) => x.kind === 'primary') || (conflict && tick.has(`cell:${m.id}`)))
      if (setPrimary) {
        must(await db().from('seo_matrix_keywords').delete().eq('cell_id', cellId).eq('kind', 'primary'), 'Saving the matrix')
        must(await db().from('seo_matrix_keywords').delete().eq('cell_id', cellId).eq('keyword_id', primaryId!), 'Saving the matrix')
        must(await db().from('seo_matrix_keywords').insert({ cell_id: cellId, keyword_id: primaryId!, kind: 'primary', sort: 0 }), 'Saving the matrix')
        added.matrix.push({ cell_id: cellId!, keyword_id: primaryId!, kind: 'primary' })
        have.add(primaryId!)
        // The sheet's primaries are Angel's own picks: the keyword gets the Primary role (only if it has none yet).
        must(await db().from('seo_keywords').update({ role: 'primary' }).eq('id', primaryId!).is('role', null), 'Setting the Primary role')
      }
      const backups = m.backups.map((k) => ids.get(keywordKey(k))).filter((x): x is string => !!x && !have.has(x) && x !== primaryId)
      if (backups.length) {
        must(await db().from('seo_matrix_keywords').insert([...new Set(backups)].map((keyword_id, i) => ({ cell_id: cellId, keyword_id, kind: 'backup', sort: i + 1 }))), 'Saving the matrix')
        for (const keyword_id of new Set(backups)) added.matrix.push({ cell_id: cellId!, keyword_id, kind: 'backup' })
      }
    }

    // 7. Pages + their keywords (#1 = primary); a keyword on another page moves only if ticked
    let sort = 0
    for (const p of opts.pagesFromClusters ? [] : b.planPages) {
      if (!p.categoryId) continue
      let pageId = p.pageId
      if (!pageId) {
        pageId = (must(await db().from('seo_pages').insert({ client_id: c.id, category_id: p.categoryId, name: p.name, url: p.url, status: p.status, sort: sort++ }).select('id').single(), 'Adding pages') as { id: string }).id
      }
      const hasPrimary = b.pagesWithPrimary.has(pageId)
      const rows: { keyword_id: string; page_id: string; role: string; sort: number }[] = []
      p.keywords.forEach((k, i) => {
        const id = ids.get(keywordKey(k.keyword))
        if (!id) return
        const move = k.action.startsWith('Conflict: already on page') && tick.has(`page:${keywordKey(k.keyword)}`)
        if (k.action !== 'Add' && !move) return
        rows.push({ keyword_id: id, page_id: pageId!, role: k.role === 'primary' && !hasPrimary ? 'primary' : 'secondary', sort: i })
      })
      if (rows.length) must(await db().from('seo_page_keywords').upsert(rows, { onConflict: 'keyword_id' }), 'Adding page keywords')
    }

    // 8. Page 3: Later / Rejected on existing keywords, only while still Keep
    for (const l of plan.later.filter((x) => x.action.startsWith('Set'))) {
      const id = ids.get(keywordKey(l.keyword))
      if (id) must(await db().from('seo_keywords').update({ status: l.status }).eq('id', id).eq('status', 'keep'), 'Setting Later / Rejected')
    }

    // 9. Competitors: names only
    for (const x of plan.competitors) {
      if (!x.name) continue
      if (x.action === 'Save name only') {
        must(await db().from('seo_competitors').insert({ client_id: c.id, code: x.code, name: x.name }), 'Saving competitors')
        added.competitors.push({ code: x.code, name: x.name })
      }
      else if (x.action.startsWith('Conflict') && tick.has(`comp:${x.code}`)) must(await db().from('seo_competitors').update({ name: x.name }).eq('client_id', c.id).eq('code', x.code), 'Saving competitors')
    }

    // Record what was added (used by "Delete this import")
    must(await db().from('seo_imports').update({ column_map: { samsGuide: added } }).eq('id', imp.id), 'Saving the import')

    // 10. "More areas" → one Note in Notes & links (tagged Day 1, where areas are chosen)
    if (b.areaNote) {
      must(await db().from('seo_notes').insert({ client_id: c.id, kind: 'note', body: b.areaNote.slice(0, 4000), author: 'Sam’s Guide import', day: 0 }), 'Saving the client note')
    }
  } catch (err) {
    for (let i = 0; i < createdIds.length; i += CHUNK) await db().from('seo_keywords').delete().in('id', createdIds.slice(i, i + CHUNK))
    await db().from('seo_imports').delete().eq('id', imp.id)
    if (storagePath) await db().storage.from(BUCKET).remove([storagePath])
    throw err
  }
  return { importId: imp.id, plan }
}
