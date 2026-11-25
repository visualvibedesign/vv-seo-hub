// Clusters (redesign step 4c): one page per keyword cluster, a keyword on one page only (seo_page_keywords PK).
// Tables (from 0001): seo_pages + seo_page_keywords. Works for ANY client.
//
// importClustersCsv(): reads a Sheet "Clusters" tab exported as CSV (columns: Category, Page, Priority,
// Primary keyword, Volume · KD, Secondary keywords, FAQ / content ideas, Why). Rules:
//   * Only ADDS pages + page links. Never creates, changes or deletes keywords.
//   * A keyword in the CSV that isn't in the client's keywords is listed as unmatched and skipped.
//   * "(suggested)" primaries are kept as text in the page's notes when unmatched (no keyword is created).
//   * Refuses to run if the client already has pages (nothing is overwritten).
import Papa from 'papaparse'
import { keywordKey } from '../../src/lib/importRules.js'
import type { CategoryCode, ClusterKeyword, ClusterPage, PageStatus } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class ClusterInputError extends Error {}

type PageRole = 'primary' | 'secondary' | 'faq'

export interface ClusterPlanPage {
  category: CategoryCode
  name: string
  url: string | null
  priority: 'high' | 'medium' | 'low' | null
  status: PageStatus
  why: string
  ideas: string[]
  keywords: { keyword: string; role: PageRole; id: string | null }[]
}

export interface ClusterImportResult {
  pages: ClusterPlanPage[]
  /** Keywords in the CSV that aren't in the client's keywords (skipped, not created). */
  unmatched: { page: string; role: PageRole; keyword: string }[]
  /** Keywords listed on two pages: kept on the first page only. */
  onTwoPages: { keyword: string; kept: string; skipped: string }[]
  committed: boolean
}

const CAT = /^(Home|S1|S2|S3|FAQ)\b/i

/** "- service price (1,600 · 15)" → "service price"; "—" / "" → null. */
function cleanListItem(line: string): string | null {
  const t = line.replace(/^\s*[-•*]\s*/, '').trim()
  if (!t || t === '—' || t === '-') return null
  return t.replace(/\s*\((?:[^()]*\d[^()]*|suggested)\)\s*$/i, '').trim() || null
}

/** A content idea, not a keyword ("Link to /faqs/ and /first-timers/"). */
const isIdea = (t: string) => /^link\b/i.test(t) || t.includes('/')

function statusOf(why: string, page: string, category: CategoryCode): PageStatus {
  if (/scheduled|built, not live/i.test(why)) return 'scheduled'
  if (/not live yet|planned|to build|new page/i.test(why)) return 'planned'
  if (/\blive\b|existing page/i.test(why) || page.startsWith('/') || category === 'Home') return 'live'
  return 'planned'
}

/** "/main-service/" → "Main service"; "/faqs/" → "FAQs". */
function nameFromPath(path: string): string {
  const slug = path.replace(/^\/+|\/+$/g, '').split('/').pop() ?? path
  if (/^faqs?$/i.test(slug)) return 'FAQs'
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : path
}

export async function importClustersCsv(siteId: string, csvText: string, commit: boolean): Promise<ClusterImportResult> {
  const c = await clientRow(siteId)
  if (!c) throw new ClusterInputError('That client doesn’t exist.')

  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText // drop a byte-order mark
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const [header, ...body] = parsed.data
  const col = (re: RegExp) => header.findIndex((h) => re.test(h))
  const ix = {
    category: col(/^category$/i),
    page: col(/^page$/i),
    priority: col(/^priority$/i),
    primary: col(/^primary keyword/i),
    secondary: col(/^secondary/i),
    faq: col(/^faq|content ideas/i),
    why: col(/^why$/i),
  }
  if (Object.values(ix).some((i) => i < 0)) throw new ClusterInputError('This doesn’t look like a Clusters export (Category, Page, Priority, Primary keyword, Secondary, FAQ, Why).')

  // Page rows: from the top until the first row whose Category isn't Home / S1–S3 / FAQ (the notes below).
  const rows: string[][] = []
  for (const r of body) {
    if (!CAT.test((r[ix.category] ?? '').trim())) break
    rows.push(r)
  }

  const [kwRows, existingPages] = await Promise.all([
    (async () => {
      const out: { id: string; keyword_key: string }[] = []
      for (let from = 0; ; from += 1000) {
        const part = must(await db().from('seo_keywords').select('id, keyword_key').eq('client_id', c.id).order('id').range(from, from + 999), 'Loading keywords') as { id: string; keyword_key: string }[]
        out.push(...part)
        if (part.length < 1000) return out
      }
    })(),
    db().from('seo_pages').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
  ])
  if ((existingPages.count ?? 0) > 0) throw new ClusterInputError(`This client already has ${existingPages.count} pages. Nothing was imported (pages are never overwritten).`)
  const byKey = new Map(kwRows.map((k) => [k.keyword_key, k.id]))
  const site = c.site_url.replace(/\/+$/, '')

  const unmatched: ClusterImportResult['unmatched'] = []
  const onTwoPages: ClusterImportResult['onTwoPages'] = []
  const owner = new Map<string, string>() // keyword id → page name
  const pages: ClusterPlanPage[] = rows.map((r) => {
    const category = (r[ix.category].trim().match(CAT)![1].toUpperCase().replace('HOME', 'Home') as CategoryCode)
    const pageCell = r[ix.page].trim()
    const why = (r[ix.why] ?? '').trim()
    const url = pageCell.startsWith('/') ? site + pageCell : category === 'Home' && /^home/i.test(pageCell) ? site + '/' : null
    const name = pageCell.startsWith('/') ? nameFromPath(pageCell) : pageCell
    const p: ClusterPlanPage = {
      category,
      name,
      url,
      priority: (['high', 'medium', 'low'].includes(r[ix.priority].trim().toLowerCase()) ? r[ix.priority].trim().toLowerCase() : null) as ClusterPlanPage['priority'], // blank = not set yet ("Medium (default)", migration 0012)
      status: statusOf(why, pageCell, category),
      why,
      ideas: [],
      keywords: [],
    }
    const add = (raw: string, role: PageRole) => {
      const kw = cleanListItem(raw)
      if (!kw) return
      if (role !== 'primary' && isIdea(kw)) return void p.ideas.push(kw)
      const id = byKey.get(keywordKey(kw)) ?? null
      if (!id) {
        unmatched.push({ page: name, role, keyword: kw })
        if (role === 'primary') p.ideas.unshift(`Primary (suggested, no keyword data yet): ${kw}`)
        return
      }
      const other = owner.get(id)
      if (other) return void onTwoPages.push({ keyword: kw, kept: other, skipped: name })
      owner.set(id, name)
      p.keywords.push({ keyword: kw, role, id })
    }
    add(r[ix.primary] ?? '', 'primary')
    for (const line of (r[ix.secondary] ?? '').split(/\r?\n/)) add(line, 'secondary')
    for (const line of (r[ix.faq] ?? '').split(/\r?\n/)) add(line, 'faq')
    return p
  })

  if (commit && pages.length) {
    const cats = must(await db().from('seo_client_categories').select('id, code').eq('client_id', c.id), 'Loading categories') as { id: string; code: CategoryCode }[]
    const catId = new Map(cats.map((k) => [k.code, k.id]))
    const missing = [...new Set(pages.map((p) => p.category))].filter((code) => !catId.has(code))
    if (missing.length) throw new ClusterInputError(`This client has no ${missing.join(', ')} category. Nothing was imported.`)
    const sortIn = new Map<string, number>()
    const createdIds: string[] = []
    try {
      // One page at a time so each page's keyword links follow it (18-ish rows: fine).
      for (const p of pages) {
        const sort = sortIn.get(p.category) ?? 0
        sortIn.set(p.category, sort + 1)
        const page = must(
          await db()
            .from('seo_pages')
            .insert({ client_id: c.id, category_id: catId.get(p.category), name: p.name, url: p.url, priority: p.priority, status: p.status, why: p.why || null, content_ideas: p.ideas, sort })
            .select('id')
            .single(),
          `Adding the page “${p.name}”`,
        ) as { id: string }
        createdIds.push(page.id)
        if (p.keywords.length)
          must(
            await db().from('seo_page_keywords').insert(p.keywords.map((k, i) => ({ keyword_id: k.id, page_id: page.id, role: k.role, sort: i }))),
            `Linking keywords to “${p.name}”`,
          )
      }
    } catch (err) {
      // Undo only what this import just added (its own new pages; links go with them), so it can simply run again.
      if (createdIds.length) await db().from('seo_pages').delete().in('id', createdIds)
      throw err
    }
  }
  return { pages, unmatched, onTwoPages, committed: commit }
}

/** Every page with its keywords, in category order (Home, S1–S3, FAQ) then the page order. */
export async function listClusters(siteId: string): Promise<ClusterPage[]> {
  const c = await clientRow(siteId)
  if (!c) throw new ClusterInputError('That client doesn’t exist.')
  // url_suggested comes with migration 0013; until it runs, the list loads without it (every URL counts as real).
  const cols = 'id, name, url, priority, status, why, content_ideas, sort, seo_client_categories(code), seo_page_keywords(role, sort, seo_keywords(id, keyword, semrush_volume, kd, kp_volume))'
  let res: { data: unknown; error: { message: string } | null } = await db().from('seo_pages').select(cols + ', url_suggested').eq('client_id', c.id)
  if (res.error && /url_suggested/.test(res.error.message)) res = await db().from('seo_pages').select(cols).eq('client_id', c.id)
  const rows = must(res, 'Loading the clusters') as unknown as {
    url_suggested?: boolean
    id: string
    name: string
    url: string | null
    priority: ClusterPage['priority']
    status: PageStatus
    why: string | null
    content_ideas: string[]
    sort: number
    seo_client_categories: { code: CategoryCode } | null
    seo_page_keywords: { role: ClusterKeyword['role']; sort: number; seo_keywords: { id: string; keyword: string; semrush_volume: number | null; kd: number | null; kp_volume: string | null } | null }[]
  }[]
  const ORDER: CategoryCode[] = ['Home', 'S1', 'S2', 'S3', 'FAQ']
  const ROLE_ORDER = { primary: 0, secondary: 1, faq: 2 }
  return rows
    .map((r) => ({
      id: r.id,
      category: r.seo_client_categories?.code ?? 'FAQ',
      name: r.name,
      url: r.url,
      urlSuggested: !!r.url_suggested,
      priority: r.priority,
      status: r.status,
      why: r.why,
      ideas: r.content_ideas ?? [],
      sort: r.sort,
      keywords: r.seo_page_keywords
        .filter((k) => k.seo_keywords)
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.sort - b.sort)
        .map((k) => ({ id: k.seo_keywords!.id, keyword: k.seo_keywords!.keyword, role: k.role, semrushVolume: k.seo_keywords!.semrush_volume, kd: k.seo_keywords!.kd, kpVolume: k.seo_keywords!.kp_volume })),
    }))
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.sort - b.sort)
    .map((p) => { const { sort, ...rest } = p; void sort; return rest })
}
