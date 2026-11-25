// Claude auto-fill tasks (redesign step 6c). Every run is: estimate (shown to Angel) → Angel clicks Run →
// one Claude call (logged in seo_ai_log) → saved in seo_autofill as "Ready to review" (approve / reject like 6b).
// What Claude sees: keyword text, volumes, the client's service names and area names. Never the client's name,
// address, account details or notes. Claude never changes exported numbers: intent is only suggested where
// Semrush left it empty. Keywords that hit a scope word (out of scope / neighbourhood) are never sent: they
// are on the plain-code scope list instead.
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import { AI_MODELS, AI_TASKS, costUsd, type AiTask } from '../../src/lib/aiModels.js'
import { hasServiceName, isOwnBrand, roleOptions, serviceOptions, type KeywordLite } from '../../src/lib/autofillRules.js'
import type { AutofillItem, AutofillKind, AutofillRow, CategoryCode } from '../../src/types/seo.js'
import { areaState } from '../../src/lib/clientSetup.js'
import { fill, stateName } from '../../src/lib/templates.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { AutofillInputError, keywordsOf, listAutofill, scopedIds, scopeWordsOf, servicesOf, templateWords, triagedIds } from './autofillService.js'
import { clientRow, type ClientRow } from './clientService.js'

export interface AiEstimate {
  task: AiTask
  model: string
  items: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  /** Nothing to send (e.g. every keyword already has an intent). */
  empty: boolean
  /** Keywords that qualify; a run sends at most AI_MAX_ITEMS of them (run again for the next ones). */
  total: number
  /** What `items` counts ("keyword", or "open cell" for the matrix). */
  noun: string
}

/** One Claude call per run, at most this many keywords (keeps the answer inside one call's output limit). */
export const AI_MAX_ITEMS = 300
const cap = (all: KeywordLite[]) => ({ list: all.slice(0, AI_MAX_ITEMS), total: all.length })

/** Which seo_autofill kind each Claude task saves as. */
const KIND: Partial<Record<AiTask, AutofillKind>> = { intent: 'intent', services: 'services_ai', triage: 'triage', matrix: 'matrix', clusters: 'clusters' }
const MODEL_LABEL = (task: AiTask) => AI_MODELS[AI_TASKS[task].model].label

async function client(siteId: string): Promise<ClientRow> {
  const c = await clientRow(siteId)
  if (!c) throw new AutofillInputError('That client doesn’t exist.')
  return c
}

type Unmatched = { keywordId: string; keyword: string }[]

/** A prepared run: what goes to Claude, and how its answer becomes suggestions. */
interface Prepared<T extends z.ZodType> {
  list: KeywordLite[]
  /** How many keywords qualified before the per-run cap (AI_MAX_ITEMS). */
  total: number
  system: string
  user: string
  schema: T
  /** Claude's answer → suggestions + keywords left as they are (with the summary line). */
  toItems: (data: z.infer<T>) => { items: AutofillItem[]; unmatched: Unmatched; summary: string }
  /** What the run is counted in when it isn't keywords (matrix: open cells). */
  count?: { items: number; total: number; noun: string }
  effort?: 'low' | 'medium' | 'high'
}

/** Keywords still "keep" or "later", minus scope-word keywords (those are on the scope list). */
async function candidates(c: ClientRow): Promise<KeywordLite[]> {
  const [kws, scope] = await Promise.all([keywordsOf(c.id), scopeWordsOf(c)])
  const skip = scopedIds(kws, scope)
  return kws.filter((k) => k.status !== 'rejected' && !skip.has(k.id))
}

/** Volumes as exported (Semrush number, else the KP range text), for the keywords about to be sent. */
async function volumes(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const rows = must(await db().from('seo_keywords').select('id, semrush_volume, kp_volume').in('id', ids.slice(i, i + 200)), 'Loading volumes') as {
      id: string
      semrush_volume: number | null
      kp_volume: string | null
    }[]
    for (const r of rows) out.set(r.id, r.semrush_volume != null ? String(r.semrush_volume) : (r.kp_volume ?? '-'))
  }
  return out
}

/** Answers keyed by the 1-based id we sent; anything else (unknown id, repeat) is dropped. */
function byId<A extends { id: number }>(list: KeywordLite[], answers: A[]): { pairs: [KeywordLite, A][]; missing: Unmatched } {
  const seen = new Set<number>()
  const pairs: [KeywordLite, A][] = []
  for (const a of answers) {
    const k = list[a.id - 1]
    if (!k || seen.has(a.id)) continue
    seen.add(a.id)
    pairs.push([k, a])
  }
  return { pairs, missing: list.filter((_, i) => !seen.has(i + 1)).map((k) => ({ keywordId: k.id, keyword: k.keyword })) }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const why = (task: AiTask, reason: string) => `Claude (${MODEL_LABEL(task)}): ${reason.slice(0, 80)}`

// ---- Intent (Haiku) -------------------------------------------------------------------------------

export const INTENTS = ['Informational', 'Navigational', 'Commercial', 'Transactional'] as const

const INTENT_SYSTEM = `You label search keywords for a local business SEO tool with Semrush's search intent.
Intents:
- Informational: wants to learn or understand something (how to, what is, why, vs, ideas, guide).
- Navigational: looking for a specific business, brand or website by name.
- Commercial: comparing or researching before buying (best, price, cost, reviews, near me comparisons).
- Transactional: ready to book or buy a service now (service + city, book, appointment).
Give exactly one intent per keyword id you are given, plus a reason of at most 8 words. Do not add keywords.`

const IntentOut = z.object({ items: z.array(z.object({ id: z.number().int(), intent: z.enum(INTENTS), reason: z.string() })) })

async function prepIntent(c: ClientRow): Promise<Prepared<typeof IntentOut>> {
  // Only where Semrush left intent empty (keywordsOf doesn't load intent: fetch the ids that need it).
  // Paged: a client can have thousands of keywords (PostgREST returns at most 1,000 rows per request).
  const empty = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const part = must(await db().from('seo_keywords').select('id').eq('client_id', c.id).is('intent', null).order('id').range(from, from + 999), 'Loading keywords') as { id: string }[]
    for (const r of part) empty.add(r.id)
    if (part.length < 1000) break
  }
  const { list, total } = cap((await candidates(c)).filter((k) => empty.has(k.id)))
  return {
    list,
    total,
    system: INTENT_SYSTEM,
    user: `Keywords (id | keyword):\n${list.map((k, i) => `${i + 1} | ${k.keyword}`).join('\n')}`,
    schema: IntentOut,
    toItems: (data) => {
      const { pairs, missing } = byId(list, data.items)
      const items = pairs.map(([k, a]) => ({ keywordId: k.id, keyword: k.keyword, options: [{ value: a.intent, rule: why('intent', a.reason) }], decision: null }))
      return { items, unmatched: missing, summary: `${plural(items.length, 'suggestion')} by Claude · ${missing.length} not answered` }
    },
  }
}

// ---- Leftover services (Haiku) ----------------------------------------------------------------------
// Keywords with no service that the plain-code rules couldn't match. Claude picks one of the client's services
// by number, or 0 = none fits (left empty, stays under Needs you).

const SERVICES_SYSTEM = `You match search keywords to a local business's services for an SEO tool.
You get the business's services (number | service | category) and keywords (id | keyword | monthly volume).
For each keyword id, give the number of the ONE service the searcher most likely wants, or 0 if none of the
services fits (a different service, a product, a job search, a place only, or unclear). Only use the numbers
listed. Add a reason of at most 8 words. Do not add keywords.`

const ServicesOut = z.object({ items: z.array(z.object({ id: z.number().int(), service: z.number().int(), reason: z.string() })) })

async function prepServices(c: ClientRow): Promise<Prepared<typeof ServicesOut>> {
  const [kws, svc, words, triaged] = await Promise.all([candidates(c), servicesOf(c), templateWords(c), triagedIds(c.id)])
  // Keywords on the triage list (competitor, neighbourhood, off-topic) aren't sent: run "No-rule keywords" first.
  const { list, total } = cap(kws.filter((k) => !k.serviceId && !triaged.has(k.id) && serviceOptions(k.keyword, svc, words).length === 0))
  const vol = await volumes(list.map((k) => k.id))
  return {
    list: svc.length ? list : [],
    total: svc.length ? total : 0,
    system: SERVICES_SYSTEM,
    user:
      `Services (number | service | category):\n${svc.map((s, i) => `${i + 1} | ${s.name} | ${s.category}`).join('\n')}\n\n` +
      `Keywords (id | keyword | monthly volume):\n${list.map((k, i) => `${i + 1} | ${k.keyword} | ${vol.get(k.id) ?? '-'}`).join('\n')}`,
    schema: ServicesOut,
    toItems: (data) => {
      const { pairs, missing } = byId(list, data.items)
      const items: AutofillItem[] = []
      const none: Unmatched = []
      for (const [k, a] of pairs) {
        const s = svc[a.service - 1]
        if (!s) none.push({ keywordId: k.id, keyword: k.keyword })
        else items.push({ keywordId: k.id, keyword: k.keyword, options: [{ value: s.id, rule: why('services', a.reason) }], decision: null })
      }
      return {
        items,
        unmatched: [...none, ...missing],
        summary: `${plural(items.length, 'suggestion')} by Claude · ${none.length} fit no service${missing.length ? ` · ${missing.length} not answered` : ''}`,
      }
    },
  }
}

// ---- Triage of no-rule keywords (Haiku) -------------------------------------------------------------
// Keywords with no role that no role rule matched (and no scope word). Claude says what they are: fits (keep,
// left alone), competitor brand → Rejected, neighbourhood → Later, off-topic → Rejected. Angel decides.

const TRIAGE = ['fits', 'competitor brand', 'neighbourhood', 'off-topic'] as const
const TRIAGE_STATUS = { fits: null, 'competitor brand': 'rejected', neighbourhood: 'later', 'off-topic': 'rejected' } as const

const TRIAGE_SYSTEM = `You sort search keywords for a local business SEO tool.
You get the business's services, the areas it targets, and keywords (id | keyword | monthly volume).
Keywords that name this business itself were already removed. For each keyword id pick one category:
- fits: someone looking for one of these services in or near these areas (keep it).
- competitor brand: names another business, chain or brand.
- neighbourhood: a town or neighbourhood that is not one of the listed areas (worth a page later, not now).
- off-topic: not about these services (a different service, a product, jobs, DIY, a place only).
Add a reason of at most 8 words. Do not add keywords.`

const TriageOut = z.object({ items: z.array(z.object({ id: z.number().int(), category: z.enum(TRIAGE), reason: z.string() })) })

async function prepTriage(c: ClientRow): Promise<Prepared<typeof TriageOut>> {
  const [kws, svc, words, scope] = await Promise.all([candidates(c), servicesOf(c), templateWords(c), scopeWordsOf(c)])
  // Keywords naming the client itself stay out (brand words, or the business name / domain): never a competitor.
  const brand = { brandWords: c.brand_words ?? [], name: c.name, siteUrl: c.site_url }
  // Keywords with one of the client's service names in them clearly fit: not sent either.
  const { list, total } = cap(
    kws.filter((k) => k.status === 'keep' && !k.role && roleOptions(k.keyword, words).length === 0 && !isOwnBrand(k.keyword, brand) && !hasServiceName(k.keyword, svc)),
  )
  const vol = await volumes(list.map((k) => k.id))
  return {
    list,
    total,
    system: TRIAGE_SYSTEM,
    user:
      `Services: ${svc.map((s) => s.name).join(', ') || '-'}\nAreas: ${scope.activeAreas.join(', ') || '-'}\n\n` +
      `Keywords (id | keyword | monthly volume):\n${list.map((k, i) => `${i + 1} | ${k.keyword} | ${vol.get(k.id) ?? '-'}`).join('\n')}`,
    schema: TriageOut,
    toItems: (data) => {
      const { pairs, missing } = byId(list, data.items)
      const items: AutofillItem[] = []
      const keep: Unmatched = []
      for (const [k, a] of pairs) {
        const status = TRIAGE_STATUS[a.category]
        if (!status) keep.push({ keywordId: k.id, keyword: k.keyword })
        else items.push({ keywordId: k.id, keyword: k.keyword, category: a.category, options: [{ value: status, rule: why('triage', a.reason) }], decision: null })
      }
      return {
        items,
        unmatched: [...keep, ...missing],
        summary: `${plural(items.length, 'suggestion')} by Claude · ${keep.length} look like they fit (left as is)${missing.length ? ` · ${missing.length} not answered` : ''}`,
      }
    },
  }
}

// ---- 3×3 matrix suggestions (Sonnet) ----------------------------------------------------------------
// Only OPEN cells are sent: an active area, not N/A, and no primary yet. A cell Angel set is never touched.
// Candidates per cell: the client's own keywords (Keep, no scope word, not already a primary elsewhere) that name
// one of that row's services (or are linked to one) AND the cell's city. Claude picks one primary + up to 3
// backups from those ids only, or none. Suggestions only: Angel approves cell by cell.

const MATRIX_SYSTEM = `You pick target keywords for a local business's SEO matrix: one page per service category × city.
For each cell you get candidate keywords as: id | keyword | Semrush volume (US estimate for the exact phrase) | Google Keyword Planner range (local).
Pick ONE primary per cell: the phrase a person ready to hire this service in this city most likely searches.
Prefer the service + city wording, then higher volume; a keyword with no volume can still win if it is the clearest local phrase.
Then up to 3 backups: close variants with the same intent, from the same cell's candidates.
Never use one keyword in two cells. If no candidate fits the service and the city, give primary 0.
Only use ids listed under that cell. Reason: at most 12 words.`

const MatrixOut = z.object({
  cells: z.array(z.object({ cell: z.string(), primary: z.number().int(), backups: z.array(z.number().int()), reason: z.string() })),
})

const MAX_CANDIDATES = 30

async function prepMatrix(c: ClientRow): Promise<Prepared<typeof MatrixOut>> {
  const [kws, svc, scope, catsR, areasR, cellsR] = await Promise.all([
    keywordsOf(c.id),
    servicesOf(c),
    scopeWordsOf(c),
    db().from('seo_client_categories').select('id, code, name').eq('client_id', c.id).in('code', ['Home', 'S1', 'S2', 'S3']),
    db().from('seo_client_areas').select('id, code, name, state, status').eq('client_id', c.id),
    db().from('seo_matrix_cells').select('category_id, area_id, state, seo_matrix_keywords(kind, keyword_id)').eq('client_id', c.id),
  ])
  const cats = (must(catsR, 'Loading categories') as { id: string; code: string; name: string }[]).sort((a, b) => ['Home', 'S1', 'S2', 'S3'].indexOf(a.code) - ['Home', 'S1', 'S2', 'S3'].indexOf(b.code))
  const areas = (must(areasR, 'Loading areas') as { id: string; code: string; name: string | null; state: string | null; status: string }[]).sort((a, b) => a.code.localeCompare(b.code))
  const cells = must(cellsR, 'Loading the matrix') as unknown as { category_id: string; area_id: string; state: string; seo_matrix_keywords: { kind: string; keyword_id: string }[] }[]
  // Any keyword already in the matrix (primary or backup) stays where it is: never suggested for a second cell.
  const taken = new Set(cells.flatMap((x) => x.seo_matrix_keywords.map((m) => m.keyword_id)))
  const skip = scopedIds(kws, scope)
  const pool = kws.filter((k) => k.status === 'keep' && !skip.has(k.id) && !taken.has(k.id))
  const volRows = new Map((await kpRanges(pool.map((k) => k.id))).map((r) => [r.id, r]))
  const volNum = (id: string) => volRows.get(id)?.semrush ?? 0

  type Open = { key: string; label: string; services: string[]; city: string; candidates: KeywordLite[] }
  const open: Open[] = []
  const noCandidates: string[] = []
  for (const k of cats) {
    const rowSvc = svc.filter((s) => s.code === k.code)
    const rowIds = new Set(rowSvc.map((s) => s.id))
    for (const a of areas) {
      if (a.status !== 'active' || !a.name) continue
      const cell = cells.find((x) => x.category_id === k.id && x.area_id === a.id)
      if (cell && (cell.state === 'n_a' || cell.seo_matrix_keywords.some((m) => m.kind === 'primary'))) continue
      const key = `${k.code}-${a.code}`
      const fits = pool.filter((kw) => (kw.serviceId ? rowIds.has(kw.serviceId) : hasServiceName(kw.keyword, rowSvc)) && hasServiceName(kw.keyword, [{ name: a.name! }]))
      if (!fits.length) {
        noCandidates.push(key)
        continue
      }
      const candidates = [...fits].sort((x, y) => volNum(y.id) - volNum(x.id)).slice(0, MAX_CANDIDATES)
      open.push({ key, label: `${k.code} ${k.name} × ${a.code} ${a.name}`, services: rowSvc.map((s) => s.name), city: [a.name, a.state || c.state].filter(Boolean).join(', '), candidates })
    }
  }
  // One global numbering so a pick can be checked against its own cell.
  const list: KeywordLite[] = []
  const idOf = new Map<string, number>()
  const blocks = open.map((o) => {
    const lines = o.candidates.map((k) => {
      if (!idOf.has(k.id)) {
        list.push(k)
        idOf.set(k.id, list.length)
      }
      const v = volRows.get(k.id)
      return `${idOf.get(k.id)} | ${k.keyword} | ${v?.semrush ?? '-'} | ${v?.kp ?? '-'}`
    })
    return `Cell ${o.key}: ${o.services.join(', ') || o.label} in ${o.city}\n${lines.join('\n')}`
  })

  return {
    list,
    total: list.length,
    count: { items: open.length, total: open.length, noun: 'open cell' },
    effort: 'medium',
    system: MATRIX_SYSTEM,
    user: blocks.join('\n\n'),
    schema: MatrixOut,
    toItems: (data) => {
      const items: AutofillItem[] = []
      const used = new Set<string>()
      const skipped: string[] = []
      for (const o of open) {
        const a = data.cells.find((x) => x.cell.trim().toUpperCase() === o.key.toUpperCase())
        const inCell = new Map(o.candidates.map((k) => [idOf.get(k.id)!, k]))
        const p = a ? inCell.get(a.primary) : undefined
        if (!a || !p || used.has(p.id)) {
          skipped.push(o.key)
          continue
        }
        used.add(p.id)
        const backups = [...new Set(a.backups)].map((n) => inCell.get(n)).filter((k): k is KeywordLite => !!k && k.id !== p.id).slice(0, 3)
        items.push({
          keywordId: p.id,
          keyword: p.keyword,
          cell: o.label,
          backups: backups.map((b) => ({ keywordId: b.id, keyword: b.keyword })),
          options: [{ value: o.key, rule: `${why('matrix', a.reason)}${backups.length ? ` · backups: ${backups.map((b) => b.keyword).join(', ')}` : ''}` }],
          decision: null,
        })
      }
      const none = [...skipped, ...noCandidates]
      return {
        items,
        unmatched: [],
        summary: `${plural(items.length, 'cell')} suggested by Claude${none.length ? ` · ${none.length} with no fitting keyword (${none.join(', ')})` : ''}`,
      }
    },
  }
}

// ---- Page (cluster) suggestions (Sonnet, 6c-4a) ------------------------------------------------------
// New pages: one per matrix cell whose primary is on no page yet (primary = the cell's primary, fixed in code).
// Leftovers: Keep keywords on no page (no scope word, not a cell primary), top 300 by volume → which page they fit.
// Checks in code: only ids that were sent, a keyword on one page only, existing pages' keywords never touched.
// Suggested URL = the template's URL pattern (state abbreviation), editable on Approve; existing URLs never changed.

const CLUSTERS_SYSTEM = `You plan the pages of a local business website for SEO. Each page targets one primary keyword.
Secondary keywords are close variants that support the same page; FAQ keywords are questions the page answers.
A keyword can be on ONE page only.
1. For each NEW page (one per matrix cell; its primary is fixed): give a short page name like "Web Design · Bentonville",
   up to 10 secondary ids and up to 5 FAQ ids, chosen from that cell's backups or the leftover list.
2. For each leftover keyword you did not use in step 1: the page it fits (an existing page id like P2, or a new page's
   cell like S1-A2) as "secondary" or "faq", or "none" if it fits no page.
Only use ids that are listed. Reasons: at most 10 words.`

const ClustersOut = z.object({
  pages: z.array(z.object({ cell: z.string(), name: z.string(), secondaries: z.array(z.number().int()), faqs: z.array(z.number().int()) })),
  assign: z.array(z.object({ id: z.number().int(), page: z.string(), role: z.enum(['secondary', 'faq', 'none']), reason: z.string() })),
})

/** The URL pattern ("/{service}-{city}-{st}/") from the client's SEO hotspots template (industry version, else generic). */
async function urlPattern(c: ClientRow): Promise<string | null> {
  const rows = must(await db().from('seo_templates').select('industry, seo_template_items(kind, body)').eq('kind', 'hotspots'), 'Loading the hotspots template') as {
    industry: string | null
    seo_template_items: { kind: string; body: string }[]
  }[]
  const t = rows.find((r) => r.industry === (c.industry ?? null)) ?? rows.find((r) => r.industry === null)
  return t?.seo_template_items.find((i) => i.kind === 'pattern' && i.body.trim().startsWith('/'))?.body.trim() ?? null
}

async function prepClusters(c: ClientRow): Promise<Prepared<typeof ClustersOut>> {
  const [kws, svc, scope, pattern, catsR, areasR, cellsR, pagesR] = await Promise.all([
    keywordsOf(c.id),
    servicesOf(c),
    scopeWordsOf(c),
    urlPattern(c),
    db().from('seo_client_categories').select('id, code, name').eq('client_id', c.id),
    db().from('seo_client_areas').select('id, code, name, state, status').eq('client_id', c.id),
    db().from('seo_matrix_cells').select('category_id, area_id, seo_matrix_keywords(kind, sort, keyword_id)').eq('client_id', c.id),
    db().from('seo_pages').select('id, name, url, seo_client_categories(code)').eq('client_id', c.id).limit(1000),
  ])
  const cats = must(catsR, 'Loading categories') as { id: string; code: string; name: string }[]
  const areas = must(areasR, 'Loading areas') as { id: string; code: string; name: string | null; state: string | null; status: string }[]
  const cells = must(cellsR, 'Loading the matrix') as unknown as { category_id: string; area_id: string; seo_matrix_keywords: { kind: string; sort: number; keyword_id: string }[] }[]
  const pages = must(pagesR, 'Loading pages') as unknown as { id: string; name: string; url: string | null; seo_client_categories: { code: string } | null }[]
  // Which keywords are on a page already (and each page's primary).
  const onPage = new Set<string>()
  const pagePrimary = new Map<string, string>()
  for (let i = 0; i < pages.length; i += 200) {
    const part = must(await db().from('seo_page_keywords').select('keyword_id, page_id, role').in('page_id', pages.slice(i, i + 200).map((p) => p.id)), 'Loading page keywords') as { keyword_id: string; page_id: string; role: string }[]
    for (const r of part) {
      onPage.add(r.keyword_id)
      if (r.role === 'primary') pagePrimary.set(r.page_id, r.keyword_id)
    }
  }
  const byId = new Map(kws.map((k) => [k.id, k]))
  const skip = scopedIds(kws, scope)
  const usable = (id: string) => {
    const k = byId.get(id)
    return !!k && k.status === 'keep' && !skip.has(id) && !onPage.has(id)
  }

  // New pages: cells with a primary that is on no page.
  type NewPage = { cell: string; category: string; categoryName: string; city: string; state: string; primary: KeywordLite; backups: KeywordLite[] }
  const newPages: NewPage[] = []
  const cellPrimaries = new Set<string>()
  for (const cell of cells) {
    const k = cats.find((x) => x.id === cell.category_id)
    const a = areas.find((x) => x.id === cell.area_id)
    const p = cell.seo_matrix_keywords.find((m) => m.kind === 'primary')
    if (!k || !a || !p) continue
    cellPrimaries.add(p.keyword_id)
    if (!usable(p.keyword_id)) continue
    const backups = cell.seo_matrix_keywords.filter((m) => m.kind === 'backup').sort((x, y) => x.sort - y.sort).map((m) => m.keyword_id).filter(usable).map((id) => byId.get(id)!)
    newPages.push({ cell: `${k.code}-${a.code}`, category: k.code, categoryName: k.name, city: a.name ?? '', state: areaState(a, c.state), primary: byId.get(p.keyword_id)!, backups })
  }
  newPages.sort((x, y) => x.cell.localeCompare(y.cell))
  const inNew = new Set(newPages.flatMap((p) => [p.primary.id, ...p.backups.map((b) => b.id)]))
  const volRows = new Map((await kpRanges(kws.map((k) => k.id).filter((id) => usable(id) && !cellPrimaries.has(id)))).map((r) => [r.id, r]))
  const { list: leftovers, total: leftoverTotal } = cap(
    kws.filter((k) => usable(k.id) && !cellPrimaries.has(k.id) && !inNew.has(k.id)).sort((x, y) => (volRows.get(y.id)?.semrush ?? 0) - (volRows.get(x.id)?.semrush ?? 0)),
  )
  // One numbering for every keyword the model may pick.
  const list: KeywordLite[] = []
  const num = new Map<string, number>()
  const idx = (k: KeywordLite) => {
    if (!num.has(k.id)) {
      list.push(k)
      num.set(k.id, list.length)
    }
    return num.get(k.id)!
  }
  const svcName = new Map(svc.map((s) => [s.id, s.name]))
  const line = (k: KeywordLite) => {
    const v = volRows.get(k.id)
    return `${idx(k)} | ${k.keyword} | ${k.role ?? '-'} | ${(k.serviceId && svcName.get(k.serviceId)) || '-'} | ${v?.semrush ?? '-'} | ${v?.kp ?? '-'}`
  }
  const existingLabel = new Map(pages.map((p, i) => [`P${i + 1}`, p]))
  const user = [
    `Services: ${cats.filter((k) => k.code !== 'FAQ').map((k) => `${k.code} ${k.name} (${svc.filter((s) => s.code === k.code).map((s) => s.name).join(', ') || '-'})`).join('; ')}`,
    `Areas: ${areas.filter((a) => a.status === 'active' && a.name).map((a) => `${a.code} ${a.name}`).join('; ') || '-'}`,
    `Existing pages (id | name | category | primary):\n${[...existingLabel].map(([id, p]) => `${id} | ${p.name} | ${p.seo_client_categories?.code ?? '-'} | ${byId.get(pagePrimary.get(p.id) ?? '')?.keyword ?? '-'}`).join('\n') || '-'}`,
    `New pages (cell | category | city | primary):\n${newPages.map((p) => `${p.cell} | ${p.categoryName} | ${p.city} | ${p.primary.keyword}${p.backups.length ? `\n  backups (id | keyword | role | service | Semrush | KP):\n${p.backups.map((b) => `  ${line(b)}`).join('\n')}` : ''}`).join('\n') || '-'}`,
    `Leftover keywords (id | keyword | role | service | Semrush | KP):\n${leftovers.map(line).join('\n') || '-'}`,
  ].join('\n\n')

  const pathFor = (p: NewPage) => {
    if (p.category === 'Home') return '/'
    if (!pattern) return null
    const service = svc.find((s) => s.code === p.category)?.name ?? p.categoryName
    return fill(pattern, { service, city: p.city, st: p.state, state: p.state ? stateName(p.state) : '', brand: c.name })
  }
  const items = newPages.length + leftovers.length
  return {
    list,
    total: newPages.length + leftoverTotal,
    count: { items, total: newPages.length + leftoverTotal, noun: newPages.length ? 'new page / keyword' : 'keyword' },
    effort: 'medium',
    system: CLUSTERS_SYSTEM,
    user,
    schema: ClustersOut,
    toItems: (data) => {
      const used = new Set<string>()
      const pick = (n: number, allowed: Set<string>) => {
        const k = list[n - 1]
        if (!k || used.has(k.id) || !allowed.has(k.id)) return null
        used.add(k.id)
        return { keywordId: k.id, keyword: k.keyword }
      }
      const items: AutofillItem[] = []
      const madePages = new Map<string, string>() // cell → page name
      for (const np of newPages) {
        used.add(np.primary.id)
        const a = data.pages.find((x) => x.cell.trim().toUpperCase() === np.cell.toUpperCase())
        const allowed = new Set([...np.backups.map((b) => b.id), ...leftovers.map((l) => l.id)])
        const secondaries = (a?.secondaries ?? []).map((n) => pick(n, allowed)).filter((x): x is { keywordId: string; keyword: string } => !!x).slice(0, 10)
        const faqs = (a?.faqs ?? []).map((n) => pick(n, allowed)).filter((x): x is { keywordId: string; keyword: string } => !!x).slice(0, 5)
        const name = (a?.name?.trim() || `${np.categoryName} · ${np.city}`).slice(0, 80)
        madePages.set(np.cell, name)
        items.push({
          keywordId: np.primary.id,
          keyword: np.primary.keyword,
          page: { cell: np.cell, category: np.category as CategoryCode, name, path: pathFor(np), secondaries, faqs },
          options: [{ value: `page:${np.cell}`, rule: `New page “${name}” (${np.cell}) · ${secondaries.length} secondary · ${faqs.length} FAQ` }],
          decision: null,
        })
      }
      const leftoverIds = new Set(leftovers.map((l) => l.id))
      let none = 0
      for (const a of data.assign) {
        const k = list[a.id - 1]
        if (!k || used.has(k.id) || !leftoverIds.has(k.id)) continue
        if (a.role === 'none') {
          none++
          continue
        }
        const target = a.page.trim().toUpperCase()
        const existing = existingLabel.get(target)
        const cell = newPages.find((p) => p.cell.toUpperCase() === target)?.cell ?? null
        if (!existing && !cell) continue
        used.add(k.id)
        const pageName = existing?.name ?? madePages.get(cell!)!
        items.push({
          keywordId: k.id,
          keyword: k.keyword,
          assign: { pageId: existing?.id ?? null, cell: existing ? null : cell, pageName, role: a.role },
          options: [{ value: existing ? `pageid:${existing.id}` : `cell:${cell}`, rule: `${why('clusters', a.reason)}` }],
          decision: null,
        })
      }
      const pagesN = items.filter((i) => i.page).length
      return {
        items,
        unmatched: [],
        summary: `${plural(pagesN, 'new page')} · ${plural(items.length - pagesN, 'keyword')} placed on a page · ${none} fit no page${leftoverTotal > leftovers.length ? ` · first ${leftovers.length} of ${leftoverTotal} leftovers` : ''}`,
      }
    },
  }
}

// ---- Day 1 from pasted text (Sonnet, 6c-4b) ----------------------------------------------------------
// Angel pastes kickoff notes or the client's Services page text. Only that text (plus the client's current category,
// service and area names, so Claude doesn't repeat them) is sent. The pasted text is NOT stored: only the suggestions
// (each with the short quote it came from) and the usual log row. Checks in code: the quote must really be in the text
// (no invented facts); addresses, phone numbers and emails are dropped; things the client already has are skipped.

export const DAY1_MAX_CHARS = 20_000

const DAY1_SYSTEM = `You read notes or a website's services page about a local business and pull out facts for its SEO setup.
Use ONLY what the text says. Never guess, never add anything that isn't in the text.
For every fact, copy the exact words from the text it came from into "quote" (a short part of one sentence).
Never output street addresses, phone numbers or email addresses.
- services: what the business offers. Put each in a category: Home = the one general service people search for;
  S1, S2, S3 = the main service groups, most important first. Give each group a short name (categoryName).
- notOffered: services the text says they do NOT offer, as short words (e.g. "men", "tattoo removal").
- areas: cities or towns they serve (with the state abbreviation if the text gives it).
- neighbourhoods: neighbourhoods or parts of a city they mention.
- kickoff: success after 12 months, why customers choose them (USP), their ideal client. Only if the text says it.
- brandWords: the business's own name as written in the text.
Leave a list empty when the text says nothing about it.`

const Quoted = z.object({ quote: z.string() })
const Day1Out = z.object({
  services: z.array(Quoted.extend({ name: z.string(), category: z.enum(['Home', 'S1', 'S2', 'S3']), categoryName: z.string() })),
  notOffered: z.array(Quoted.extend({ word: z.string() })),
  areas: z.array(Quoted.extend({ name: z.string(), state: z.string() })),
  neighbourhoods: z.array(Quoted.extend({ name: z.string() })),
  kickoff: z.array(Quoted.extend({ field: z.enum(['success12mo', 'usp', 'idealClient']), text: z.string() })),
  brandWords: z.array(Quoted.extend({ word: z.string() })),
})

const squash = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i

export async function prepDay1(c: ClientRow, input: string | undefined): Promise<Prepared<typeof Day1Out>> {
  const text = (input ?? '').trim()
  if (text.length > DAY1_MAX_CHARS) throw new AutofillInputError(`That text is too long (${DAY1_MAX_CHARS.toLocaleString('en-US')} characters max). Paste the part about services and areas.`)
  const [svc, catsR, areasR] = await Promise.all([
    servicesOf(c),
    db().from('seo_client_categories').select('code, name').eq('client_id', c.id),
    db().from('seo_client_areas').select('code, name, status').eq('client_id', c.id),
  ])
  const cats = must(catsR, 'Loading categories') as { code: string; name: string }[]
  const areas = must(areasR, 'Loading areas') as { code: string; name: string | null; status: string }[]
  const user = [
    `Already set (don't repeat): categories ${cats.filter((k) => k.code !== 'FAQ').map((k) => `${k.code} ${k.name || '-'}`).join('; ')} · services ${svc.map((s) => s.name).join(', ') || '-'} · areas ${areas.filter((a) => a.status === 'active' && a.name).map((a) => a.name).join(', ') || '-'}`,
    `Text:\n<<<\n${text}\n>>>`,
  ].join('\n\n')
  const haystack = squash(text)
  const hasSvc = new Set(svc.map((s) => s.name.toLowerCase()))
  const hasArea = new Set(areas.filter((a) => a.name).map((a) => a.name!.toLowerCase()))
  const words = (xs: string[] | undefined) => new Set((xs ?? []).map((x) => x.toLowerCase()))
  const scopeHas = words(c.out_of_scope_words)
  const hoodHas = words(c.neighbourhood_words)
  const brandHas = words(c.brand_words)
  const kickoffHas = { success12mo: !!c.success_12mo?.trim(), usp: !!c.usp?.trim(), idealClient: !!c.ideal_client?.trim() }
  const catName = new Map(cats.map((k) => [k.code, k.name]))

  return {
    list: [],
    total: text ? 1 : 0,
    count: { items: text ? 1 : 0, total: text ? 1 : 0, noun: 'pasted text' },
    effort: 'medium',
    system: DAY1_SYSTEM,
    user,
    schema: Day1Out,
    toItems: (data) => {
      const items: AutofillItem[] = []
      let dropped = 0
      // A fact counts only if its quote is really in the text, and it holds no address / phone / email.
      const ok = (quote: string, ...values: string[]) => {
        const q = squash(quote)
        const good = q.length >= 3 && haystack.includes(q) && !values.some((v) => looksLikeAddress(v) || PHONE.test(v) || EMAIL.test(v))
        if (!good) dropped++
        return good
      }
      const add = (setup: NonNullable<AutofillItem['setup']>, options: AutofillItem['options']) =>
        items.push({ keywordId: randomUUID(), keyword: setup.value, setup: { ...setup, quote: setup.quote.slice(0, 200) }, options, decision: null })
      const seen = new Set<string>()
      const once = (k: string) => (seen.has(k) ? false : (seen.add(k), true))
      for (const s of data.services) {
        const name = s.name.trim()
        if (!name || hasSvc.has(name.toLowerCase()) || !once(`svc:${name.toLowerCase()}`) || !ok(s.quote, name)) continue
        // Claude's category first; the other three so Angel can pick a different one.
        const order = [s.category, ...(['Home', 'S1', 'S2', 'S3'] as const).filter((x) => x !== s.category)]
        add(
          { group: 'services', field: 'service', value: name, category: s.category, categoryName: s.categoryName.trim().slice(0, 80), quote: s.quote },
          order.map((code, i) => ({ value: code, rule: i === 0 ? `Claude’s pick${catName.get(code)?.trim() && catName.get(code) !== code ? '' : ` (name: “${s.categoryName.trim()}”)`} · “${s.quote.slice(0, 90)}”` : 'or this category' })),
        )
      }
      for (const w of data.notOffered) {
        const word = w.word.trim().toLowerCase()
        if (!word || scopeHas.has(word) || !once(`no:${word}`) || !ok(w.quote, word)) continue
        add({ group: 'services', field: 'notOffered', value: word, quote: w.quote }, [{ value: 'notOffered', rule: `out of scope word · “${w.quote.slice(0, 90)}”` }])
      }
      for (const a of data.areas) {
        const name = a.name.trim()
        if (!name || hasArea.has(name.toLowerCase()) || !once(`area:${name.toLowerCase()}`) || !ok(a.quote, name)) continue
        add({ group: 'areas', field: 'area', value: name, state: a.state.trim().toUpperCase().slice(0, 4), quote: a.quote }, [{ value: 'area', rule: `area (fills A2/A3 if N/A) · “${a.quote.slice(0, 90)}”` }])
      }
      for (const n of data.neighbourhoods) {
        const name = n.name.trim().toLowerCase()
        if (!name || hoodHas.has(name) || !once(`hood:${name}`) || !ok(n.quote, name)) continue
        add({ group: 'areas', field: 'neighbourhood', value: name, quote: n.quote }, [{ value: 'neighbourhood', rule: `neighbourhood word · “${n.quote.slice(0, 90)}”` }])
      }
      for (const k of data.kickoff) {
        const t = k.text.trim().slice(0, 2000)
        if (!t || kickoffHas[k.field] || !once(`kick:${k.field}`) || !ok(k.quote, t)) continue
        add({ group: 'kickoff', field: k.field, value: t, quote: k.quote }, [{ value: k.field, rule: `“${k.quote.slice(0, 120)}”` }])
      }
      for (const b of data.brandWords) {
        const word = b.word.trim().toLowerCase()
        if (!word || brandHas.has(word) || !once(`brand:${word}`) || !ok(b.quote, word)) continue
        add({ group: 'kickoff', field: 'brandWord', value: word, quote: b.quote }, [{ value: 'brandWord', rule: `brand word · “${b.quote.slice(0, 90)}”` }])
      }
      return { items, unmatched: [], summary: `${plural(items.length, 'suggestion')} from your text${dropped ? ` · ${dropped} dropped (not in the text, or an address / phone / email)` : ''}` }
    },
  }
}

/** Semrush volume (number) and KP range (text) as stored, for the keywords about to be sent. */
async function kpRanges(ids: string[]): Promise<{ id: string; semrush: number | null; kp: string | null }[]> {
  const out: { id: string; semrush: number | null; kp: string | null }[] = []
  for (let i = 0; i < ids.length; i += 200) {
    out.push(...(must(await db().from('seo_keywords').select('id, semrush:semrush_volume, kp:kp_volume').in('id', ids.slice(i, i + 200)), 'Loading volumes') as typeof out))
  }
  return out
}

// ---- Shared -----------------------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prepare(c: ClientRow, task: AiTask, input?: string): Promise<Prepared<any>> {
  if (task === 'intent') return prepIntent(c)
  if (task === 'services') return prepServices(c)
  if (task === 'triage') return prepTriage(c)
  if (task === 'matrix') return prepMatrix(c)
  if (task === 'clusters') return prepClusters(c)
  if (task === 'day1') return prepDay1(c, input)
  throw new AutofillInputError('That auto-fill task isn’t built yet.')
}

/** Saves a Claude suggestion as Ready to review (the previous open one of that kind is marked superseded). */
async function saveSuggestion(c: ClientRow, kind: AutofillKind, out: { items: AutofillItem[]; unmatched: Unmatched; summary: string }, logId: string | null) {
  must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('client_id', c.id).eq('kind', kind).eq('status', 'ready'), 'Saving auto-fill')
  must(
    await db()
      .from('seo_autofill')
      .insert({
        client_id: c.id,
        step: 1,
        kind,
        source: 'claude',
        status: 'ready',
        summary: out.summary,
        payload: { items: out.items, unmatched: out.unmatched },
        item_count: out.items.length,
        ai_log_id: logId,
      }),
    'Saving auto-fill',
  )
}

// ---- Public: estimate + run -------------------------------------------------------------------------

export async function estimate(siteId: string, task: AiTask, input?: string): Promise<AiEstimate> {
  const c = await client(siteId)
  const p = await prepare(c, task, input)
  const t = AI_TASKS[task]
  const items = p.count?.items ?? p.list.length
  const noun = p.count?.noun ?? 'keyword'
  if (!items) return { task, model: MODEL_LABEL(task), items: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, empty: true, total: 0, noun }
  const inputTokens = (await countInputTokens(t.model, p.system, p.user)) + 400 // + the output schema
  const outputTokens = t.outBase + t.outPerItem * items // thinking + answer, a generous guess
  return { task, model: MODEL_LABEL(task), items, inputTokens, outputTokens, costUsd: costUsd(t.model, inputTokens, outputTokens), empty: false, total: p.count?.total ?? p.total, noun }
}

/** Read-only: exactly what a run would send (system + user text). For checks; never calls Claude. */
export async function promptFor(siteId: string, task: AiTask, input?: string): Promise<{ system: string; user: string }> {
  const p = await prepare(await client(siteId), task, input)
  return { system: p.system, user: p.user }
}

export async function run(siteId: string, task: AiTask, input?: string): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const kind = KIND[task]
  if (!kind && task !== 'day1') throw new AutofillInputError('That auto-fill task isn’t built yet.')
  const p = await prepare(c, task, input)
  const items = p.count?.items ?? p.list.length
  if (!items) throw new AutofillInputError('Nothing to send for this one.')
  const t = AI_TASKS[task]
  const { data, logId } = await callStructured({
    task: task === 'day1' ? 'day1.notes' : `day2.${task}`,
    clientId: c.id,
    model: t.model,
    system: p.system,
    user: p.user,
    schema: p.schema,
    effort: p.effort,
    maxTokens: Math.max(2000, t.outBase + t.outPerItem * items * 2),
  })
  const out = p.toItems(data)
  if (task === 'day1') {
    // One run → three lists (services, areas, kickoff), each Ready to review on its own.
    const groups: [AutofillKind, string][] = [['setup_services', 'services'], ['setup_areas', 'areas'], ['setup_kickoff', 'kickoff']]
    for (const [k, g] of groups) {
      const items = out.items.filter((i) => i.setup?.group === g)
      await saveSuggestion(c, k, { items, unmatched: [], summary: `${plural(items.length, 'suggestion')} from your text` }, logId)
    }
  } else await saveSuggestion(c, kind!, out, logId)
  return listAutofill(siteId)
}
