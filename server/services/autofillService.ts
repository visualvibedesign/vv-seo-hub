// Auto-fill (redesign step 6). Table: seo_autofill (0006). Step 6b = Day 2 plain-code rules (roles, services).
// Rules only SUGGEST ("Ready to review"). Approving applies a suggestion to the keyword, but only if the keyword
// still has no role / no service at that moment (never overwrites what Angel set). Rejecting changes nothing.
import { z } from 'zod'
import { scopeHit, suggestRoles, suggestScope, suggestServices, type KeywordLite, type ScopeWords, type ServiceRef, type Words } from '../../src/lib/autofillRules.js'
import type { AutofillDecision, AutofillItem, AutofillKind, AutofillRow, AutofillStatus, KeywordRole } from '../../src/types/seo.js'
import { db, must, pagedRows } from '../clients/supabase.js'
import { clientRow, type ClientRow } from './clientService.js'

export class AutofillInputError extends Error {}

type Row = {
  id: string
  step: number
  kind: AutofillKind
  source: 'rules' | 'claude'
  status: AutofillStatus
  summary: string
  payload: { items: AutofillItem[]; unmatched: { keywordId: string; keyword: string }[] }
  applied_count: number | null
  created_at: string
  decided_at: string | null
}
const COLS = 'id, step, kind, source, status, summary, payload, applied_count, created_at, decided_at'

const toRow = (r: Row): AutofillRow => ({
  id: r.id,
  step: r.step,
  kind: r.kind,
  source: r.source,
  status: r.status,
  summary: r.summary,
  items: r.payload.items ?? [],
  unmatched: r.payload.unmatched ?? [],
  appliedCount: r.applied_count,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
})

async function client(siteId: string): Promise<ClientRow> {
  const c = await clientRow(siteId)
  if (!c) throw new AutofillInputError('That client doesn’t exist.')
  return c
}

/** All of a client's keyword ids right now (paged; a client can have thousands). */
async function liveKeywordIds(clientId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for await (const r of pagedRows<{ id: string }>((from, to) => db().from('seo_keywords').select('id').eq('client_id', clientId).order('id').range(from, to), 'Loading keywords')) ids.add(r.id)
  return ids
}

/** Open (ready) suggestions of a client and how many of their keywords no longer exist (e.g. removed with a deleted import). */
async function openWithGone(clientId: string): Promise<{ row: Row; gone: number }[]> {
  const rows = must(await db().from('seo_autofill').select(COLS).eq('client_id', clientId).eq('status', 'ready'), 'Loading auto-fill') as Row[]
  if (!rows.length) return []
  const live = await liveKeywordIds(clientId)
  return rows.map((row) => {
    const refs = new Set([...(row.payload.items ?? []), ...(row.payload.unmatched ?? [])].map((i) => i.keywordId))
    return { row, gone: [...refs].filter((id) => !live.has(id)).length }
  })
}

/**
 * The latest (not superseded) suggestion per kind for a client. Keywords that no longer exist (removed with a deleted
 * import) are left out of the open lists and their counts, and the row says how many were left out ("stale").
 */
export async function listAutofill(siteId: string): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const rows = must(
    await db().from('seo_autofill').select(COLS).eq('client_id', c.id).neq('status', 'superseded').order('created_at', { ascending: false }).limit(100), // latest per kind is all the screen needs
    'Loading auto-fill',
  ) as Row[]
  const latest = new Map<AutofillKind, Row>()
  for (const r of rows) if (!latest.has(r.kind)) latest.set(r.kind, r)
  const out = [...latest.values()].map(toRow)
  if (!out.some((r) => r.status === 'ready')) return out
  const live = await liveKeywordIds(c.id)
  return out.map((r) => {
    if (r.status !== 'ready') return r
    const items = r.items.filter((i) => live.has(i.keywordId))
    const unmatched = r.unmatched.filter((u) => live.has(u.keywordId))
    const gone = new Set([...r.items, ...r.unmatched].filter((i) => !live.has(i.keywordId)).map((i) => i.keywordId)).size
    if (!gone) return r
    const open = items.filter((i) => !i.decision).length
    return { ...r, items, unmatched, gone, summary: `${open} open on current keywords · ${unmatched.length} left as they are · ${gone} removed since (deleted import), not counted` }
  })
}

/**
 * Stale open suggestions: lists that point to keywords that no longer exist. `apply` = mark those lists superseded
 * (kept, not deleted; "Run again" makes a fresh one). Without `apply` it only counts (the dry run).
 */
export async function retireStale(siteId: string, apply: boolean): Promise<{ lists: number; gone: number; kinds: string[] }> {
  const c = await client(siteId)
  const stale = (await openWithGone(c.id)).filter((x) => x.gone > 0)
  if (apply && stale.length) {
    must(await db().from('seo_autofill').update({ status: 'superseded' }).in('id', stale.map((x) => x.row.id)).eq('status', 'ready'), 'Retiring stale suggestions')
  }
  return { lists: stale.length, gone: stale.reduce((n, x) => n + x.gone, 0), kinds: stale.map((x) => x.row.kind) }
}

/** The client's scope words + active area names (scope words are [] until migration 0008 runs). */
export async function scopeWordsOf(c: ClientRow): Promise<ScopeWords> {
  const areas = must(await db().from('seo_client_areas').select('name').eq('client_id', c.id).eq('status', 'active'), 'Loading areas') as { name: string | null }[]
  return { outOfScope: c.out_of_scope_words ?? [], neighbourhoods: c.neighbourhood_words ?? [], activeAreas: areas.map((a) => a.name ?? '').filter(Boolean) }
}

/** Keywords that hit a scope word: no role / service / intent suggestions for them (they go to the scope list). */
export const scopedIds = (keywords: KeywordLite[], s: ScopeWords) => new Set(keywords.filter((k) => scopeHit(k.keyword, s)).map((k) => k.id))

/** Keyword ids on the latest triage list (open or approved there; a rejected suggestion doesn't count). */
export async function triagedIds(clientId: string): Promise<Set<string>> {
  const rows = must(
    await db().from('seo_autofill').select('payload').eq('client_id', clientId).eq('kind', 'triage').in('status', ['ready', 'approved']).order('created_at', { ascending: false }).limit(1),
    'Loading the triage list',
  ) as { payload: { items?: AutofillItem[] } }[]
  return new Set((rows[0]?.payload.items ?? []).filter((i) => i.decision !== 'rejected').map((i) => i.keywordId))
}

/** The client's services; `home` = a Home-row service (the general term, a fallback). */
export async function servicesOf(c: ClientRow): Promise<(ServiceRef & { category: string; code: string })[]> {
  const rows = must(await db().from('seo_client_services').select('id, name, seo_client_categories(code, name)').eq('client_id', c.id).order('sort'), 'Loading services') as unknown as {
    id: string
    name: string
    seo_client_categories: { code: string; name: string } | null
  }[]
  return rows.map((s) => ({ id: s.id, name: s.name, home: s.seo_client_categories?.code === 'Home', category: s.seo_client_categories?.name ?? '', code: s.seo_client_categories?.code ?? '' }))
}

/** Words from the client's industry version of "Keyword research" (or the generic one). */
export async function templateWords(c: ClientRow): Promise<Words> {
  const rows = must(
    await db().from('seo_templates').select('industry, seo_template_items(kind, word_group, body)').eq('kind', 'keyword_research'),
    'Loading the keyword research template',
  ) as { industry: string | null; seo_template_items: { kind: string; word_group: string | null; body: string }[] }[]
  const t = rows.find((r) => r.industry === (c.industry ?? null)) ?? rows.find((r) => r.industry === null)
  const items = t?.seo_template_items ?? []
  const of = (g: string) => items.filter((i) => i.kind === 'word' && i.word_group === g).map((i) => i.body)
  return { money: of('money'), faq: of('faq'), service: of('service') }
}

export async function keywordsOf(clientId: string): Promise<KeywordLite[]> {
  const out: KeywordLite[] = []
  for (let from = 0; ; from += 1000) {
    const part = must(
      await db().from('seo_keywords').select('id, keyword, role, service_id, status').eq('client_id', clientId).order('keyword').order('id').range(from, from + 999),
      'Loading keywords',
    ) as { id: string; keyword: string; role: KeywordRole | null; service_id: string | null; status: string }[]
    out.push(...part.map((k) => ({ id: k.id, keyword: k.keyword, role: k.role, serviceId: k.service_id, status: k.status })))
    if (part.length < 1000) return out
  }
}

const summaryOf = (items: AutofillItem[], unmatched: unknown[], noun: string) => {
  const look = items.filter((i) => i.options.length > 1).length
  return `${items.length - look} suggestion${items.length - look === 1 ? '' : 's'} · ${look} need${look === 1 ? 's' : ''} a look · ${unmatched.length} with no ${noun}`
}

/**
 * Day 2 plain-code rules: roles + services, and (after migration 0008) the scope list: out-of-scope keywords →
 * suggest Rejected, neighbourhood keywords → suggest Later. Scope keywords get no role / service suggestion.
 * Replaces any open (ready) rules suggestion of the same kind.
 */
export async function runDay2Rules(siteId: string): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const [keywords, svc, words, scope] = await Promise.all([keywordsOf(c.id), servicesOf(c), templateWords(c), scopeWordsOf(c)])
  const skip = scopedIds(keywords, scope)
  const inScope = keywords.filter((k) => !skip.has(k.id))
  const roles = suggestRoles(inScope, words)
  const services2 = suggestServices(inScope, svc, words)
  const runs: { kind: AutofillKind; items: AutofillItem[]; unmatched: { keywordId: string; keyword: string }[]; noun: string; summary?: string }[] = [
    { kind: 'roles', items: roles.items as AutofillItem[], unmatched: roles.unmatched, noun: 'rule' },
    { kind: 'services', items: services2.items as AutofillItem[], unmatched: services2.unmatched, noun: 'service match' },
  ]
  // The scope list needs migration 0008 (columns + the 'scope' kind); before it, the row has no such column.
  if (c.out_of_scope_words !== undefined) {
    const sc = suggestScope(keywords, scope)
    const out = sc.items.filter((i) => i.category === 'out of scope').length
    runs.push({ kind: 'scope', items: sc.items, unmatched: [], noun: '', summary: `${out} out of scope → Rejected · ${sc.items.length - out} neighbourhood → Later` })
  }
  for (const r of runs) {
    // Only one open suggestion per client + kind: the previous open one is marked superseded (kept, not deleted).
    must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('client_id', c.id).eq('kind', r.kind).eq('status', 'ready'), 'Saving auto-fill')
    must(
      await db()
        .from('seo_autofill')
        .insert({
          client_id: c.id,
          step: 1,
          kind: r.kind,
          source: 'rules',
          status: 'ready',
          summary: r.summary ?? summaryOf(r.items, r.unmatched, r.noun),
          payload: { items: r.items, unmatched: r.unmatched },
          item_count: r.items.length,
        }),
      'Saving auto-fill',
    )
  }
  return listAutofill(siteId)
}

/** Which keyword column each kind fills on Approve. */
const TARGET: Partial<Record<AutofillKind, 'role' | 'service_id' | 'intent' | 'status'>> = {
  roles: 'role',
  services: 'service_id',
  services_ai: 'service_id',
  intent: 'intent',
  triage: 'status',
  scope: 'status',
}

const DecideSchema = z.object({
  siteId: z.string(),
  autofillId: z.string().uuid(),
  decisions: z.array(z.object({ keywordId: z.string().uuid(), action: z.enum(['approve', 'reject']), value: z.string().max(100).optional(), path: z.string().max(300).optional() })).min(1).max(5000),
})

/**
 * Approve / reject rows of one suggestion. Approve applies only if the keyword's role (or service) is STILL empty;
 * otherwise the row is marked "skipped". When every row is decided, the suggestion is closed (status approved).
 */
export async function decide(raw: unknown): Promise<AutofillRow[]> {
  const p = DecideSchema.safeParse(raw)
  if (!p.success) throw new AutofillInputError('Those decisions aren’t right.')
  const c = await client(p.data.siteId)
  const row = must(await db().from('seo_autofill').select(COLS).eq('id', p.data.autofillId).eq('client_id', c.id).maybeSingle(), 'Loading the suggestion') as Row | null
  if (!row) throw new AutofillInputError('That suggestion doesn’t exist.')
  if (row.status !== 'ready') throw new AutofillInputError('This suggestion was already closed or replaced by a newer run.')
  if (row.kind === 'matrix') return decideMatrix(c, row, p.data.decisions as AutofillDecision[], p.data.siteId)
  if (row.kind === 'clusters') return decideClusters(c, row, p.data.decisions as AutofillDecision[], p.data.siteId)
  const target = TARGET[row.kind]
  if (!target) throw new AutofillInputError('This kind can’t be approved here yet.')

  const items = row.payload.items
  const byId = new Map(items.map((i) => [i.keywordId, i]))
  // value → keyword ids to apply
  const toApply = new Map<string, string[]>()
  for (const d of p.data.decisions as AutofillDecision[]) {
    const item = byId.get(d.keywordId)
    if (!item) throw new AutofillInputError('A keyword isn’t part of this suggestion.')
    if (item.decision) continue // already decided
    if (d.action === 'reject') {
      item.decision = 'rejected'
      continue
    }
    const value = d.value ?? (item.options.length === 1 ? item.options[0].value : undefined)
    if (!value || !item.options.some((o) => o.value === value)) throw new AutofillInputError(`Pick one of the options for “${item.keyword}”.`)
    toApply.set(value, [...(toApply.get(value) ?? []), item.keywordId])
    item.applied = value
  }

  // Apply in batches per value. Guards = never overwrite what was set in the meantime:
  //   role / service / intent only while still empty (and never on a Rejected keyword);
  //   status (Later / Rejected) only while the keyword is still "keep".
  const column = target
  if (column === 'status' && [...toApply.keys()].some((v) => v !== 'later' && v !== 'rejected')) throw new AutofillInputError('Only Later or Rejected can be set here.')
  if (column === 'service_id') {
    const ids = [...toApply.keys()]
    if (ids.length) {
      const own = must(await db().from('seo_client_services').select('id').eq('client_id', c.id).in('id', ids), 'Checking services') as { id: string }[]
      if (own.length !== ids.length) throw new AutofillInputError('A suggested service isn’t this client’s.')
    }
  }
  for (const [value, ids] of toApply) {
    const base = db().from('seo_keywords').update({ [column]: value }).eq('client_id', c.id).in('id', ids)
    const guarded = column === 'status' ? base.eq('status', 'keep') : base.is(column, null).neq('status', 'rejected')
    const done = must(await guarded.select('id'), 'Applying the suggestions') as { id: string }[]
    const applied = new Set(done.map((d) => d.id))
    for (const id of ids) byId.get(id)!.decision = applied.has(id) ? 'approved' : 'skipped'
  }

  const open = items.some((i) => !i.decision)
  const approved = items.filter((i) => i.decision === 'approved').length
  must(
    await db()
      .from('seo_autofill')
      .update({
        payload: row.payload,
        applied_count: approved,
        ...(open ? {} : { status: 'approved', decided_at: new Date().toISOString() }),
      })
      .eq('id', row.id)
      .eq('status', 'ready'),
    'Saving the decisions',
  )
  return listAutofill(p.data.siteId)
}

/**
 * Matrix suggestions (Claude, 6c-3), one cell per item. Approve fills the cell ONLY if it still has no primary
 * (a cell Angel set in the meantime is "skipped"): primary + the suggested backups (add only), cell → target, and
 * the primary keyword gets the Primary role if it has none. Reject changes nothing.
 */
async function decideMatrix(c: ClientRow, row: Row, decisions: AutofillDecision[], siteId: string): Promise<AutofillRow[]> {
  const items = row.payload.items
  const byId = new Map(items.map((i) => [i.keywordId, i]))
  const [catsR, areasR] = await Promise.all([
    db().from('seo_client_categories').select('id, code').eq('client_id', c.id),
    db().from('seo_client_areas').select('id, code, status').eq('client_id', c.id),
  ])
  const cats = must(catsR, 'Loading categories') as { id: string; code: string }[]
  const areas = must(areasR, 'Loading areas') as { id: string; code: string; status: string }[]
  for (const d of decisions) {
    const item = byId.get(d.keywordId)
    if (!item) throw new AutofillInputError('A cell isn’t part of this suggestion.')
    if (item.decision) continue
    if (d.action === 'reject') {
      item.decision = 'rejected'
      continue
    }
    const [code, areaCode] = item.options[0].value.split('-')
    const cat = cats.find((k) => k.code === code)
    const area = areas.find((a) => a.code === areaCode)
    if (!cat || !area || area.status !== 'active') {
      item.decision = 'skipped'
      continue
    }
    // The keyword must still be this client's and not Rejected.
    const kw = must(await db().from('seo_keywords').select('id, status').eq('id', item.keywordId).eq('client_id', c.id).maybeSingle(), 'Checking the keyword') as { id: string; status: string } | null
    let cell = must(
      await db().from('seo_matrix_cells').select('id, state, seo_matrix_keywords(kind, keyword_id)').eq('category_id', cat.id).eq('area_id', area.id).maybeSingle(),
      'Loading the cell',
    ) as { id: string; state: string; seo_matrix_keywords: { kind: string; keyword_id: string }[] } | null
    if (!kw || kw.status === 'rejected' || (cell && (cell.state === 'n_a' || cell.seo_matrix_keywords.some((m) => m.kind === 'primary')))) {
      item.decision = 'skipped' // set (or N/A) in the meantime: never overwritten
      continue
    }
    if (!cell) {
      cell = { ...(must(await db().from('seo_matrix_cells').insert({ client_id: c.id, category_id: cat.id, area_id: area.id, state: 'target' }).select('id, state').single(), 'Saving the matrix') as { id: string; state: string }), seo_matrix_keywords: [] }
    } else must(await db().from('seo_matrix_cells').update({ state: 'target' }).eq('id', cell.id), 'Saving the matrix')
    const have = new Set(cell.seo_matrix_keywords.map((m) => m.keyword_id))
    if (have.has(item.keywordId)) must(await db().from('seo_matrix_keywords').delete().eq('cell_id', cell.id).eq('keyword_id', item.keywordId), 'Saving the matrix')
    must(await db().from('seo_matrix_keywords').insert({ cell_id: cell.id, keyword_id: item.keywordId, kind: 'primary', sort: 0 }), 'Saving the matrix')
    const backups = (item.backups ?? []).map((b) => b.keywordId).filter((id) => id !== item.keywordId && !have.has(id))
    if (backups.length) {
      const own = must(await db().from('seo_keywords').select('id').eq('client_id', c.id).in('id', backups), 'Checking backups') as { id: string }[]
      if (own.length) must(await db().from('seo_matrix_keywords').insert(own.map((b, i) => ({ cell_id: cell!.id, keyword_id: b.id, kind: 'backup', sort: i + 1 }))), 'Saving the matrix')
    }
    must(await db().from('seo_keywords').update({ role: 'primary' }).eq('id', item.keywordId).is('role', null), 'Setting the Primary role')
    item.decision = 'approved'
    item.applied = item.options[0].value
  }
  const open = items.some((i) => !i.decision)
  must(
    await db()
      .from('seo_autofill')
      .update({ payload: row.payload, applied_count: items.filter((i) => i.decision === 'approved').length, ...(open ? {} : { status: 'approved', decided_at: new Date().toISOString() }) })
      .eq('id', row.id)
      .eq('status', 'ready'),
    'Saving the decisions',
  )
  return listAutofill(siteId)
}

/** "/Web Design Bentonville AR/" → "/web-design-bentonville-ar/"; '' → null. Only a path, never a full address. */
function cleanPath(raw: string | null | undefined): string | null {
  const p = (raw ?? '').trim()
  if (!p) return null
  if (p === '/') return '/'
  const slug = p
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, '')
    .split('/')
    .map((part) => part.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('/')
  return slug ? `/${slug}/` : null
}

/**
 * Page suggestions (Claude, 6c-4a). Approve a NEW page → a planned page (priority not set) with the suggested URL
 * (or Angel's edit; "suggested" only if unchanged), its primary, secondaries and FAQs, each only if that keyword is
 * still on no page. Approve a leftover keyword → added to its page (an existing one, or a new page approved first),
 * only if still on no page. Existing pages' keywords and URLs are never changed. Reject changes nothing.
 */
async function decideClusters(c: ClientRow, row: Row, decisions: AutofillDecision[], siteId: string): Promise<AutofillRow[]> {
  const items = row.payload.items
  const byId = new Map(items.map((i) => [i.keywordId, i]))
  const site = c.site_url.replace(/\/+$/, '')
  const cats = must(await db().from('seo_client_categories').select('id, code').eq('client_id', c.id), 'Loading categories') as { id: string; code: string }[]
  const freeIds = async (ids: string[]) => {
    if (!ids.length) return new Set<string>()
    const own = must(await db().from('seo_keywords').select('id').eq('client_id', c.id).neq('status', 'rejected').in('id', ids), 'Checking keywords') as { id: string }[]
    const taken = must(await db().from('seo_page_keywords').select('keyword_id').in('keyword_id', ids), 'Checking pages') as { keyword_id: string }[]
    const on = new Set(taken.map((t) => t.keyword_id))
    return new Set(own.map((o) => o.id).filter((id) => !on.has(id)))
  }
  // Pages first, so a leftover can go on a page approved in the same click.
  const ordered = [...decisions].sort((a, b) => Number(!byId.get(a.keywordId)?.page) - Number(!byId.get(b.keywordId)?.page))
  for (const d of ordered) {
    const item = byId.get(d.keywordId)
    if (!item) throw new AutofillInputError('That suggestion isn’t part of this list.')
    if (item.decision) continue
    if (d.action === 'reject') {
      item.decision = 'rejected'
      continue
    }
    if (item.page) {
      const pg = item.page
      const free = await freeIds([item.keywordId, ...pg.secondaries.map((s) => s.keywordId), ...pg.faqs.map((f) => f.keywordId)])
      const cat = cats.find((k) => k.code === pg.category)
      if (!free.has(item.keywordId) || !cat) {
        item.decision = 'skipped' // its primary is on a page now (or gone): nothing created
        continue
      }
      const edited = d.path !== undefined ? cleanPath(d.path) : null
      const path = d.path !== undefined ? edited : pg.path
      const url = path ? site + path : null
      if (url) {
        const clash = must(await db().from('seo_pages').select('name').eq('client_id', c.id).eq('url', url).maybeSingle(), 'Checking the URL') as { name: string } | null
        if (clash) throw new AutofillInputError(`“${path}” is already the URL of “${clash.name}”. Edit the URL or leave it empty.`)
      }
      const last = must(await db().from('seo_pages').select('sort').eq('client_id', c.id).order('sort', { ascending: false }).limit(1), 'Loading pages') as { sort: number }[]
      const ins = await db()
        .from('seo_pages')
        .insert({ client_id: c.id, category_id: cat.id, name: pg.name, url, url_suggested: !!url && path === pg.path, status: 'planned', sort: (last[0]?.sort ?? 0) + 1 })
        .select('id')
        .single()
      if (ins.error && /url_suggested/.test(ins.error.message)) throw new AutofillInputError('Run supabase/migrations/0013_seo_page_url_suggested.sql in Supabase first (suggested URLs).')
      const page = must(ins, 'Adding the page') as { id: string }
      const links = [
        { keyword_id: item.keywordId, page_id: page.id, role: 'primary', sort: 0 },
        ...pg.secondaries.filter((s) => free.has(s.keywordId)).map((s, i) => ({ keyword_id: s.keywordId, page_id: page.id, role: 'secondary', sort: i + 1 })),
        ...pg.faqs.filter((f) => free.has(f.keywordId)).map((f, i) => ({ keyword_id: f.keywordId, page_id: page.id, role: 'faq', sort: i + 1 })),
      ]
      must(await db().from('seo_page_keywords').insert(links), 'Adding the page keywords')
      pg.pageId = page.id
      item.decision = 'approved'
      item.applied = page.id
      continue
    }
    if (item.assign) {
      const a = item.assign
      const pageId = a.pageId ?? items.find((i) => i.page?.cell === a.cell)?.page?.pageId ?? null
      if (!pageId) throw new AutofillInputError(`Approve the new page “${a.pageName}” first, then “${item.keyword}”.`)
      const free = await freeIds([item.keywordId])
      const pageOk = must(await db().from('seo_pages').select('id').eq('id', pageId).eq('client_id', c.id).maybeSingle(), 'Checking the page') as { id: string } | null
      if (!free.has(item.keywordId) || !pageOk) {
        item.decision = 'skipped'
        continue
      }
      must(await db().from('seo_page_keywords').insert({ keyword_id: item.keywordId, page_id: pageId, role: a.role, sort: 99 }), 'Adding the keyword to the page')
      item.decision = 'approved'
      item.applied = pageId
    }
  }
  const open = items.some((i) => !i.decision)
  must(
    await db()
      .from('seo_autofill')
      .update({ payload: row.payload, applied_count: items.filter((i) => i.decision === 'approved').length, ...(open ? {} : { status: 'approved', decided_at: new Date().toISOString() }) })
      .eq('id', row.id)
      .eq('status', 'ready'),
    'Saving the decisions',
  )
  return listAutofill(siteId)
}
