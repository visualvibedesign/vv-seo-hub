// Phase 3 · Pages (Sam Days 5–6): the ideal sitemap + SEO hotspots on top of the Clusters pages (seo_pages,
// migration 0021). Works for ANY client: codes, types and keep / improve / new come from the client's own pages.
//
// - pagesState(): pages with code (P1…), type, parent, keep / improve / new, hotspots, target URL, and the
//   "swapped" flag (Google ranks another URL for the page's keyword, from the latest Position Tracking CSV).
// - backfillPages(): fills ONLY empty code / type / keep-improve-new from what the page already says (dry run first).
//   Home → home, S1–S3 → service, FAQ → supporting; live → keep, planned / scheduled → new; codes P1… in page order.
// - saveHotspots(): title / meta / H1 / target URL (+ code, type, action). When a LIVE page's target URL differs
//   from its current URL, a redirect old → new is queued (one open per page; a later change updates it).
// - addPage(): a planned "new" page in a category, optionally owning one primary keyword (never moved off another page).
// - setStructure(): service first / location first / flat.
// - setParent(): a page under another one (Site plan tree); never itself, never a loop.
// - setRedirectStatus(): Queued → Sent to site → Live, moved by hand (sending to the site comes with phase 5).
import type { CategoryCode, HotspotsInput, PageAction, PagesBackfillPlan, PagesState, PageType, RedirectStatus, SitePage, SiteRedirect, SiteStructure } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { listClusters } from './clusterService.js'
import { clientRow } from './clientService.js'
import { rankingsOverview } from './rankService.js'

/** A problem the person can fix (400). */
export class PagesInputError extends Error {}

const TYPES: PageType[] = ['home', 'service', 'location', 'supporting']
const ACTIONS: PageAction[] = ['keep', 'improve', 'new']
const STRUCTURES: SiteStructure[] = ['service_first', 'location_first', 'flat']
const CODE = /^P[0-9]{1,3}$/

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new PagesInputError('That client doesn’t exist.')
  return c
}

type ExtraRow = { id: string; page_code: string | null; page_type: PageType | null; parent_id: string | null; page_action: PageAction | null; seo_title: string | null; meta_description: string | null; h1: string | null; url_target: string | null; hotspots_at: string | null }
const EXTRA_COLS = 'id, page_code, page_type, parent_id, page_action, seo_title, meta_description, h1, url_target, hotspots_at'

/** The path of a URL ("https://x.com/web-design/" → "/web-design"), for comparing pages and redirects. */
export function pathOf(url: string | null | undefined): string | null {
  if (!url) return null
  const p = url.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '')
  const clean = ('/' + p.replace(/^\/+/, '')).replace(/\/+$/, '')
  return clean === '' ? '/' : clean.toLowerCase()
}

const typeFromCategory = (c: CategoryCode): PageType => (c === 'Home' ? 'home' : c === 'FAQ' ? 'supporting' : 'service')
const actionFromStatus = (s: string): PageAction => (s === 'live' ? 'keep' : 'new')

export async function pagesState(siteId: string): Promise<PagesState> {
  const c = await client(siteId)
  const [pages, extraRes, ranks, redirectRes] = await Promise.all([
    listClusters(siteId),
    db().from('seo_pages').select(EXTRA_COLS).eq('client_id', c.id),
    rankingsOverview(siteId).catch(() => null), // no CSV yet = no swapped flags
    db().from('seo_redirects').select('id, page_id, old_url, new_url, why, status, updated_at').eq('client_id', c.id).order('created_at', { ascending: false }),
  ])
  const extra = new Map((must(extraRes, 'Loading pages') as ExtraRow[]).map((r) => [r.id, r]))
  // Swapped: Google ranks a different URL for a keyword owned by this page (rankService decides ownership).
  const swapped = new Map<string, string>()
  for (const row of ranks?.rows ?? []) {
    if (!row.swappedWith || !row.landingUrl) continue
    const owner = pages.find((p) => pathOf(p.url) === pathOf(row.swappedWith!.url) || p.name === row.swappedWith!.name)
    if (owner && !swapped.has(owner.id)) swapped.set(owner.id, pathOf(row.landingUrl) ?? row.landingUrl)
  }
  const out: SitePage[] = pages.map((p) => {
    const x = extra.get(p.id)
    return {
      ...p,
      code: x?.page_code ?? null,
      type: x?.page_type ?? null,
      parentId: x?.parent_id ?? null,
      action: x?.page_action ?? null,
      seoTitle: x?.seo_title ?? null,
      metaDescription: x?.meta_description ?? null,
      h1: x?.h1 ?? null,
      urlTarget: x?.url_target ?? null,
      hotspotsAt: x?.hotspots_at ?? null,
      swappedUrl: swapped.get(p.id) ?? null,
    }
  })
  // Page order on the sitemap: by code (P1, P2…) when set, else the Clusters order.
  const num = (p: SitePage) => (p.code ? Number(p.code.slice(1)) : Number.MAX_SAFE_INTEGER)
  out.sort((a, b) => num(a) - num(b))
  const cs = c as unknown as { site_structure?: SiteStructure }
  return {
    structure: cs.site_structure ?? 'service_first',
    siteUrl: c.site_url,
    state: c.state ?? null,
    pages: out,
    needsBackfill: out.filter((p) => !p.code || !p.type || !p.action).length,
    redirects: (must(redirectRes, 'Loading redirects') as { id: string; page_id: string | null; old_url: string; new_url: string; why: string | null; status: RedirectStatus; updated_at: string }[]).map((r): SiteRedirect => {
      const pg = out.find((p) => p.id === r.page_id)
      return { id: r.id, pageId: r.page_id, pageCode: pg?.code ?? null, pageName: pg?.name ?? null, oldUrl: r.old_url, newUrl: r.new_url, why: r.why, status: r.status, updatedAt: r.updated_at }
    }),
  }
}

/** Fill empty code / type / action from what each page already says. Dry run unless `apply`. Never overwrites. */
export async function backfillPages(siteId: string, apply: boolean): Promise<PagesBackfillPlan> {
  const c = await client(siteId)
  const pages = await listClusters(siteId) // Clusters order: Home, S1–S3, FAQ, then page order
  const extra = new Map((must(await db().from('seo_pages').select(EXTRA_COLS).eq('client_id', c.id), 'Loading pages') as ExtraRow[]).map((r) => [r.id, r]))
  const used = new Set([...extra.values()].map((r) => r.page_code).filter((x): x is string => !!x))
  let next = 1
  const nextCode = () => {
    while (used.has(`P${next}`)) next++
    const code = `P${next}`
    used.add(code)
    return code
  }
  const changes: PagesBackfillPlan['changes'] = []
  for (const p of pages) {
    const x = extra.get(p.id)
    const code = x?.page_code ? null : nextCode()
    const type = x?.page_type ? null : typeFromCategory(p.category)
    const action = x?.page_action ? null : actionFromStatus(p.status)
    if (code || type || action) changes.push({ pageId: p.id, name: p.name, code, type, action })
  }
  if (apply) {
    for (const ch of changes) {
      const patch: Record<string, string> = {}
      if (ch.code) patch.page_code = ch.code
      if (ch.type) patch.page_type = ch.type
      if (ch.action) patch.page_action = ch.action
      must(await db().from('seo_pages').update(patch).eq('id', ch.pageId).eq('client_id', c.id), 'Saving pages')
    }
  }
  return { changes, applied: apply }
}

const text = (v: unknown, max: number, what: string): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new PagesInputError(`${what}: text only.`)
  const t = v.replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (t.length > max) throw new PagesInputError(`${what} is too long (over ${max} characters).`)
  return t
}

/** "/Brazilian Wax NY" → "/brazilian-wax-ny/"; a full URL keeps only its path. */
function cleanTargetUrl(v: unknown): string | null {
  const t = text(v, 300, 'URL')
  if (!t) return null
  const path = t.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '')
  const slug = path
    .toLowerCase()
    .split('/')
    .map((s) => s.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/')
  return slug ? `/${slug}/` : '/'
}

export async function saveHotspots(siteId: string, raw: unknown): Promise<PagesState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Partial<Record<keyof HotspotsInput, unknown>>
  if (typeof b.pageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.pageId)) throw new PagesInputError('That page doesn’t exist.')
  const page = must(await db().from('seo_pages').select('id, name, url, status, page_code, url_target').eq('id', b.pageId).eq('client_id', c.id).maybeSingle(), 'Loading the page') as { id: string; name: string; url: string | null; status: string; page_code: string | null; url_target: string | null } | null
  if (!page) throw new PagesInputError('That page doesn’t exist.')
  const code = b.code === null || b.code === undefined || b.code === '' ? null : String(b.code).trim().toUpperCase()
  if (code && !CODE.test(code)) throw new PagesInputError('Page code: P followed by a number, like P2.')
  if (code && code !== page.page_code) {
    const taken = must(await db().from('seo_pages').select('id').eq('client_id', c.id).eq('page_code', code).neq('id', page.id).limit(1), 'Checking the code') as { id: string }[]
    if (taken.length) throw new PagesInputError(`${code} is already used by another page.`)
  }
  const type = b.type === null || b.type === undefined ? null : (b.type as PageType)
  if (type && !TYPES.includes(type)) throw new PagesInputError('Pick a page type.')
  const action = b.action === null || b.action === undefined ? null : (b.action as PageAction)
  if (action && !ACTIONS.includes(action)) throw new PagesInputError('Pick keep, improve or new.')
  const urlTarget = cleanTargetUrl(b.urlTarget)
  const patch = {
    page_code: code,
    page_type: type,
    page_action: action,
    seo_title: text(b.seoTitle, 120, 'SEO title'),
    meta_description: text(b.metaDescription, 320, 'Meta description'),
    h1: text(b.h1, 160, 'H1'),
    url_target: urlTarget,
    hotspots_at: null as string | null,
  }
  // "Hotspots saved" only when there's something in them (clearing every field = no hotspots).
  if (patch.seo_title || patch.meta_description || patch.h1 || (urlTarget && pathOf(urlTarget) !== pathOf(page.url))) patch.hotspots_at = new Date().toISOString()
  must(await db().from('seo_pages').update(patch).eq('id', page.id).eq('client_id', c.id), 'Saving the hotspots')

  // A live page moving to a new URL needs a redirect (old → new), sent to the site later (phase 5).
  const oldPath = pathOf(page.url)
  const newPath = pathOf(urlTarget)
  if (page.status === 'live' && oldPath && newPath && oldPath !== newPath) {
    const open = must(await db().from('seo_redirects').select('id').eq('client_id', c.id).eq('page_id', page.id).eq('status', 'queued').limit(1), 'Loading redirects') as { id: string }[]
    const why = `${code ?? page.name} URL now matches the keyword`.slice(0, 200)
    if (open[0]) must(await db().from('seo_redirects').update({ old_url: oldPath, new_url: urlTarget!, why }).eq('id', open[0].id), 'Saving the redirect')
    else must(await db().from('seo_redirects').insert({ client_id: c.id, page_id: page.id, old_url: oldPath, new_url: urlTarget!, why }), 'Saving the redirect')
  } else if (page.status === 'live' && oldPath && (!newPath || newPath === oldPath)) {
    // Target cleared or set back to the current URL: the page stays where it is, so a still-queued redirect for it
    // is no longer needed (sent / live ones are kept as history).
    must(await db().from('seo_redirects').delete().eq('client_id', c.id).eq('page_id', page.id).eq('status', 'queued'), 'Saving the redirect')
  }
  return pagesState(siteId)
}

export async function addPage(siteId: string, raw: unknown): Promise<PagesState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { name?: unknown; category?: unknown; type?: unknown; keywordId?: unknown }
  const name = text(b.name, 120, 'Page name')
  if (!name) throw new PagesInputError('Give the page a name.')
  const cat = must(await db().from('seo_client_categories').select('id, code').eq('client_id', c.id).eq('code', String(b.category ?? '')).maybeSingle(), 'Loading categories') as { id: string; code: CategoryCode } | null
  if (!cat) throw new PagesInputError('Pick the category (Home, S1–S3 or FAQ).')
  const type = (TYPES as string[]).includes(String(b.type)) ? (b.type as PageType) : typeFromCategory(cat.code)
  let keywordId: string | null = null
  if (typeof b.keywordId === 'string' && b.keywordId) {
    const kw = must(await db().from('seo_keywords').select('id, keyword').eq('id', b.keywordId).eq('client_id', c.id).maybeSingle(), 'Loading the keyword') as { id: string; keyword: string } | null
    if (!kw) throw new PagesInputError('That keyword doesn’t exist.')
    const owner = must(await db().from('seo_page_keywords').select('page_id, seo_pages(name)').eq('keyword_id', kw.id).maybeSingle(), 'Checking the keyword') as { page_id: string; seo_pages: { name: string } | null } | null
    if (owner) throw new PagesInputError(`“${kw.keyword}” already belongs to ${owner.seo_pages?.name ?? 'another page'}. Move it in Clusters first.`)
    keywordId = kw.id
  }
  const existing = must(await db().from('seo_pages').select('page_code, sort').eq('client_id', c.id), 'Loading pages') as { page_code: string | null; sort: number }[]
  const used = new Set(existing.map((p) => p.page_code).filter(Boolean))
  let n = 1
  while (used.has(`P${n}`)) n++
  const sort = existing.reduce((m, p) => Math.max(m, p.sort), 0) + 1
  const row = must(
    await db().from('seo_pages').insert({ client_id: c.id, category_id: cat.id, name, status: 'planned', sort, page_code: `P${n}`, page_type: type, page_action: 'new' }).select('id').single(),
    'Adding the page',
  ) as { id: string }
  if (keywordId) must(await db().from('seo_page_keywords').insert({ keyword_id: keywordId, page_id: row.id, role: 'primary', sort: 0 }), 'Adding the keyword')
  return pagesState(siteId)
}

export async function setStructure(siteId: string, raw: unknown): Promise<PagesState> {
  const c = await client(siteId)
  const s = (raw as { structure?: unknown } | null)?.structure
  if (!STRUCTURES.includes(s as SiteStructure)) throw new PagesInputError('Pick service first, location first or flat.')
  must(await db().from('seo_clients').update({ site_structure: s }).eq('id', c.id), 'Saving the site structure')
  return pagesState(siteId)
}

const UUID = /^[0-9a-f-]{36}$/i

/** Puts a page under another one (or back on top with parentId null). Never under itself or its own child. */
export async function setParent(siteId: string, raw: unknown): Promise<PagesState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { pageId?: unknown; parentId?: unknown }
  if (typeof b.pageId !== 'string' || !UUID.test(b.pageId)) throw new PagesInputError('That page doesn’t exist.')
  const parentId = b.parentId === null || b.parentId === undefined || b.parentId === '' ? null : String(b.parentId)
  if (parentId && !UUID.test(parentId)) throw new PagesInputError('That parent page doesn’t exist.')
  const rows = must(await db().from('seo_pages').select('id, parent_id').eq('client_id', c.id), 'Loading pages') as { id: string; parent_id: string | null }[]
  const byId = new Map(rows.map((r) => [r.id, r]))
  if (!byId.has(b.pageId)) throw new PagesInputError('That page doesn’t exist.')
  if (parentId) {
    if (!byId.has(parentId)) throw new PagesInputError('That parent page doesn’t exist.')
    if (parentId === b.pageId) throw new PagesInputError('A page can’t sit under itself.')
    // Walk up from the new parent: reaching this page means it would sit under its own child.
    for (let at: string | null = parentId, n = 0; at && n < 50; at = byId.get(at)?.parent_id ?? null, n++) {
      if (at === b.pageId) throw new PagesInputError('That would put the page under one of its own children.')
    }
  }
  must(await db().from('seo_pages').update({ parent_id: parentId }).eq('id', b.pageId).eq('client_id', c.id), 'Saving the page')
  return pagesState(siteId)
}

/** Moves a redirect along: Queued → Sent to site → Live (any of the three, by hand). */
export async function setRedirectStatus(siteId: string, raw: unknown): Promise<PagesState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; status?: unknown }
  if (typeof b.id !== 'string' || !UUID.test(b.id)) throw new PagesInputError('That redirect doesn’t exist.')
  if (!['queued', 'sent', 'live'].includes(String(b.status))) throw new PagesInputError('Pick Queued, Sent to site or Live.')
  const r = must(await db().from('seo_redirects').update({ status: b.status }).eq('id', b.id).eq('client_id', c.id).select('id'), 'Saving the redirect') as { id: string }[]
  if (!r.length) throw new PagesInputError('That redirect doesn’t exist.')
  return pagesState(siteId)
}
