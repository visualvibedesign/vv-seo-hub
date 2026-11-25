// Sam's Guide sheet import (docs/sams-guide-import-plan.md). This file is the DRY RUN only: it reads the client's
// data and says what an import would do. Nothing is written here. Applying comes after Angel checks the dry run.
// Rules (Angel, Nov 25):
//   * keywords not in the database are created, marked "from Sheet"; address-like ones are held back
//   * volumes exactly as written, split into Semrush / KP / KD / CPC; they only fill EMPTY keyword fields
//   * matrix: an existing primary is kept unless Angel ticks "replace"; Pending / N/A kept; a hub row is a page
//   * Page 3 → Later (Rejected type → Rejected), no role; only while the keyword is still Keep
//   * competitors C1–C4: names only (brackets / addresses stripped, never stored)
import { looksLikeAddress, keywordKey } from '../../src/lib/importRules.js'
import { parseSamsGuide, type RegisterRow, type SamsGuide, type SheetVolume } from '../../src/lib/samsGuide.js'
import { db, must } from '../clients/supabase.js'
import { clientRow, type ClientRow } from './clientService.js'

export class SamsGuideInputError extends Error {}

type Kw = { id: string; keyword: string; keyword_key: string; status: string; track: boolean; semrush_volume: number | null; kp_volume: string | null; kd: number | null; cpc: number | null }

export interface KeywordFill {
  keyword: string
  isNew: boolean
  semrush?: number
  kp?: string
  kd?: number
  cpc?: number
  /** Two parts of the sheet disagree: nothing filled for that field. */
  disagree: string[]
}

export interface SamsGuidePlan {
  sheetClient: string | null
  sameClient: boolean
  counts: Record<string, number>
  newKeywords: { keyword: string; from: string[] }[]
  heldBack: { keyword: string; why: string }[]
  fills: KeywordFill[]
  matrix: { id: string; cell: string; state: 'target' | 'pending' | 'n_a'; primary: string | null; backups: string[]; note: string; action: string }[]
  track: { keyword: string; already: boolean }[]
  pages: { name: string; url: string | null; category: string; status: 'live' | 'planned'; existing: boolean; from: string; keywords: { keyword: string; role: 'primary' | 'secondary'; action: string }[] }[]
  later: { keyword: string; type: string; status: 'later' | 'rejected'; action: string }[]
  competitors: { code: string; name: string | null; written: string; action: string }[]
  skipped: SamsGuide['skipped']
  notUnderstood: SamsGuide['notUnderstood']
}

const num = (s: string | null | undefined): number | null => {
  const t = (s ?? '').replace(/[$,\s]/g, '')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
const isKpRange = (s: string | null) => !!s && (/\d\s*[–-]\s*\d/.test(s) || /^no data$/i.test(s.trim()))

async function client(siteId: string): Promise<ClientRow> {
  const c = await clientRow(siteId)
  if (!c) throw new SamsGuideInputError('That client doesn’t exist.')
  return c
}

export async function planSamsGuide(siteId: string, csvText: string): Promise<SamsGuidePlan> {
  const c = await client(siteId)
  const g = parseSamsGuide(csvText)
  if (!g.register.length && !g.pages.length) throw new SamsGuideInputError('This doesn’t look like a Sam’s Guide tab: no Page 2 register or Page 5 Top 10 found.')

  const [kwsR, catsR, areasR, cellsR, pagesR, pageKwR] = await Promise.all([
    db().from('seo_keywords').select('id, keyword, keyword_key, status, track, semrush_volume, kp_volume, kd, cpc').eq('client_id', c.id),
    db().from('seo_client_categories').select('id, code, name').eq('client_id', c.id),
    db().from('seo_client_areas').select('id, code, name, state, status').eq('client_id', c.id),
    db().from('seo_matrix_cells').select('id, category_id, area_id, state, note, seo_matrix_keywords(kind, seo_keywords(keyword_key))').eq('client_id', c.id),
    db().from('seo_pages').select('id, name, url').eq('client_id', c.id),
    db().from('seo_page_keywords').select('keyword_id, page_id, seo_pages!inner(client_id, name)').eq('seo_pages.client_id', c.id),
  ])
  const kws = must(kwsR, 'Loading keywords') as Kw[]
  const cats = must(catsR, 'Loading categories') as { id: string; code: string; name: string }[]
  const areas = must(areasR, 'Loading areas') as { id: string; code: string; name: string | null; state: string | null; status: string }[]
  const cells = must(cellsR, 'Loading the matrix') as unknown as { id: string; category_id: string; area_id: string; state: string; note: string | null; seo_matrix_keywords: { kind: string; seo_keywords: { keyword_key: string } | null }[] }[]
  const pages = must(pagesR, 'Loading pages') as { id: string; name: string; url: string | null }[]
  const pageKws = must(pageKwR, 'Loading page keywords') as unknown as { keyword_id: string; seo_pages: { name: string } }[]
  const byKey = new Map(kws.map((k) => [k.keyword_key, k]))
  const pageOfKw = new Map(pageKws.map((p) => [p.keyword_id, p.seo_pages.name]))

  // ---- Every keyword mentioned, with where it came from and its volumes as written ----------------------
  const mentions = new Map<string, { keyword: string; from: Set<string>; vols: SheetVolume[] }>()
  const mention = (keyword: string, from: string, vol?: SheetVolume) => {
    const key = keywordKey(keyword)
    if (!key) return
    const m = mentions.get(key) ?? { keyword: keyword.trim(), from: new Set<string>(), vols: [] }
    m.from.add(from)
    if (vol && vol.written) m.vols.push(vol)
    mentions.set(key, m)
  }
  for (const r of g.register) {
    if (r.primary) mention(r.primary, `Page 2 ${r.id}`, r.volume)
    for (const v of r.variants) mention(v.keyword, `Page 2 ${r.id} variant`, v.volume)
  }
  for (const p of g.pages) for (const k of p.keywords) mention(k.keyword, `Page 5 ${p.name}`, k.volume)
  for (const l of g.later) mention(l.keyword, `Page 3 ${l.type}`, l.volume)

  const heldBack: SamsGuidePlan['heldBack'] = []
  const newKeywords: SamsGuidePlan['newKeywords'] = []
  const fills: KeywordFill[] = []
  for (const [key, m] of mentions) {
    if (looksLikeAddress(m.keyword)) {
      heldBack.push({ keyword: m.keyword, why: 'Looks like a street address: never stored without your OK.' })
      continue
    }
    const existing = byKey.get(key)
    if (!existing) newKeywords.push({ keyword: m.keyword, from: [...m.from] })
    // One value per field across the sheet; two different values = disagree (nothing filled).
    const pick = (vals: (string | null)[]) => [...new Set(vals.filter((x): x is string => !!x).map((x) => x.trim()))]
    const f: KeywordFill = { keyword: m.keyword, isNew: !existing, disagree: [] }
    const sem = pick(m.vols.map((v) => (num(v.semrush) != null ? v.semrush : null)))
    const kp = pick(m.vols.map((v) => (isKpRange(v.kp) ? v.kp : null)))
    const kd = pick(m.vols.map((v) => (num(v.kd) != null ? v.kd : null)))
    const cpc = pick(m.vols.map((v) => (num(v.cpc) != null ? v.cpc : null)))
    if (sem.length > 1) f.disagree.push(`Semrush ${sem.join(' / ')}`)
    else if (sem.length && existing?.semrush_volume == null) f.semrush = num(sem[0])!
    if (kp.length > 1) f.disagree.push(`KP ${kp.join(' / ')}`)
    else if (kp.length && !existing?.kp_volume) f.kp = kp[0]
    if (kd.length > 1) f.disagree.push(`KD ${kd.join(' / ')}`)
    else if (kd.length && existing?.kd == null) f.kd = num(kd[0])!
    if (cpc.length > 1) f.disagree.push(`CPC ${cpc.join(' / ')}`)
    else if (cpc.length && existing?.cpc == null) f.cpc = num(cpc[0])!
    if (f.semrush != null || f.kp || f.kd != null || f.cpc != null || f.disagree.length) fills.push(f)
  }
  const held = new Set(heldBack.map((h) => keywordKey(h.keyword)))

  // ---- Matrix (cells only; a hub row is a page) ---------------------------------------------------------
  const cat = (code: string) => cats.find((k) => k.code === code)
  const area = (code: string) => areas.find((a) => a.code === code)
  const matrix: SamsGuidePlan['matrix'] = []
  const notUnderstood = [...g.notUnderstood]
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
    const action = !r.primary
      ? `${state === 'n_a' ? 'N/A' : 'Pending'}${r.variants.length ? ' + backups' : ''}`
      : !current
        ? 'Set primary + backups'
        : current === primaryKey
          ? 'Same primary: add missing backups'
          : `CONFLICT: cell already has “${current}”. Kept unless you tick replace`
    matrix.push({
      id: r.id,
      cell: `${r.category} ${k.name} × ${r.area} ${[a.name, a.state].filter(Boolean).join(', ')}`,
      state,
      primary: r.primary,
      backups: r.variants.map((v) => v.keyword).filter((v) => !held.has(keywordKey(v))),
      note: cell?.note ? '' : r.notes,
      action,
    })
  }
  const track = g.register
    .filter((r) => r.track && r.primary)
    .map((r) => ({ keyword: r.primary!, already: !!byKey.get(keywordKey(r.primary!))?.track }))

  // ---- Pages: Page 5 lists, linked to a register row by their #1 keyword (URL from "Page that serves it now")
  const site = c.site_url.replace(/\/+$/, '')
  const host = site.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase()
  const regOf = (kw: string) => g.register.find((r) => r.primary && keywordKey(r.primary) === keywordKey(kw))
  const urlOf = (r: RegisterRow | undefined) => {
    if (!r?.pageNow.path) return null
    if (r.pageNow.host && r.pageNow.host.replace(/^www\./, '') !== host) return null
    return site + r.pageNow.path
  }
  const used = new Map<string, string>() // keyword key → page name (a keyword is on one page only)
  const planPages: SamsGuidePlan['pages'] = []
  const pageFor = (name: string, reg: RegisterRow | undefined) => {
    const url = urlOf(reg)
    const category = reg ? (reg.pageNow.path === '/' ? 'Home' : reg.category) : ''
    const existing = pages.find((p) => (url && p.url === url) || p.name.toLowerCase() === name.toLowerCase())
    return { url, category, existing: !!existing }
  }
  for (const p of g.pages) {
    const top = [...p.keywords].sort((a, b) => a.rank - b.rank)
    const reg = top[0] ? regOf(top[0].keyword) : undefined
    const info = pageFor(p.name, reg)
    if (!info.category) notUnderstood.push({ line: p.line, section: 'Page 5', text: `“${p.name}”: its #1 keyword isn’t a Page 2 primary, so its category/URL is unknown` })
    planPages.push({
      name: p.name,
      ...info,
      status: info.url ? 'live' : 'planned',
      from: reg ? `Page 2 ${reg.id}` : 'Page 5 only',
      keywords: top.map((k, i) => {
        const key = keywordKey(k.keyword)
        const ex = byKey.get(key)
        const onPage = ex ? pageOfKw.get(ex.id) : undefined
        const action = held.has(key)
          ? 'Held back (address-like)'
          : used.has(key)
            ? `CONFLICT: already on “${used.get(key)}” in this sheet: left there`
            : onPage && onPage !== p.name
              ? `CONFLICT: already on page “${onPage}”: left there`
              : 'Add'
        if (action === 'Add') used.set(key, p.name)
        return { keyword: k.keyword, role: i === 0 ? ('primary' as const) : ('secondary' as const), action }
      }),
    })
  }
  // Hub rows with no Page 5 list still become a page target (primary only).
  for (const r of g.register.filter((x) => x.hub && x.primary)) {
    if (planPages.some((p) => p.from === `Page 2 ${r.id}`)) continue
    const info = pageFor(`${r.id}`, r)
    planPages.push({ name: r.id, ...info, status: info.url ? 'live' : 'planned', from: `Page 2 ${r.id}`, keywords: [{ keyword: r.primary!, role: 'primary', action: 'Add' }] })
  }

  // ---- Page 3: Later / Rejected (no role) ----------------------------------------------------------------
  const onPageOrCell = new Set([...used.keys(), ...g.register.filter((r) => r.primary).map((r) => keywordKey(r.primary!))])
  const later: SamsGuidePlan['later'] = g.later.map((l) => {
    const key = keywordKey(l.keyword)
    const ex = byKey.get(key)
    const action = held.has(key)
      ? 'Held back (address-like)'
      : onPageOrCell.has(key)
        ? 'CONFLICT: it’s also a primary / page keyword in this sheet: left as Keep'
        : !ex
          ? `Create as ${l.status === 'later' ? 'Later' : 'Rejected'}`
          : ex.status !== 'keep'
            ? `No change (already ${ex.status === 'later' ? 'Later' : 'Rejected'})`
            : `Set ${l.status === 'later' ? 'Later' : 'Rejected'}`
    return { keyword: l.keyword, type: l.type, status: l.status, action }
  })

  // ---- Competitors: names only ---------------------------------------------------------------------------
  const competitors = g.competitors.map((x) => {
    const bad = !x.name || looksLikeAddress(x.name)
    return { code: x.code, name: bad ? null : x.name, written: x.written, action: bad ? 'Refused: still looks like an address' : 'Save name only' }
  })

  const sameClient = !g.clientName || g.clientName.toLowerCase() === c.name.toLowerCase()
  return {
    sheetClient: g.clientName,
    sameClient,
    counts: {
      keywordsInSheet: mentions.size,
      newKeywords: newKeywords.length,
      existingKeywords: mentions.size - newKeywords.length - heldBack.length,
      heldBack: heldBack.length,
      fills: fills.filter((f) => f.semrush != null || f.kp || f.kd != null || f.cpc != null).length,
      disagreements: fills.filter((f) => f.disagree.length).length,
      matrixCells: matrix.length,
      matrixConflicts: matrix.filter((m) => m.action.startsWith('CONFLICT')).length,
      track: track.filter((t) => !t.already).length,
      pages: planPages.length,
      pageKeywords: planPages.reduce((n, p) => n + p.keywords.filter((k) => k.action === 'Add').length, 0),
      later: later.filter((l) => l.action.startsWith('Set') || l.action.startsWith('Create')).length,
      competitors: competitors.filter((x) => x.name).length,
      notUnderstood: notUnderstood.length,
    },
    newKeywords,
    heldBack,
    fills,
    matrix,
    track,
    pages: planPages,
    later,
    competitors,
    skipped: g.skipped,
    notUnderstood,
  }
}
