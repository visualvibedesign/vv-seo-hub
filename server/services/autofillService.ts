// Auto-fill (redesign step 6). Table: seo_autofill (0006). Step 6b = Day 2 plain-code rules (roles, services).
// Rules only SUGGEST ("Ready to review"). Approving applies a suggestion to the keyword, but only if the keyword
// still has no role / no service at that moment (never overwrites what Angel set). Rejecting changes nothing.
import { z } from 'zod'
import { scopeHit, suggestRoles, suggestScope, suggestServices, type KeywordLite, type ScopeWords, type ServiceRef, type Words } from '../../src/lib/autofillRules.js'
import type { AutofillDecision, AutofillItem, AutofillKind, AutofillRow, AutofillStatus, KeywordRole } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
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

/** The latest (not superseded) suggestion per kind for a client. */
export async function listAutofill(siteId: string): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const rows = must(
    await db().from('seo_autofill').select(COLS).eq('client_id', c.id).neq('status', 'superseded').order('created_at', { ascending: false }),
    'Loading auto-fill',
  ) as Row[]
  const latest = new Map<AutofillKind, Row>()
  for (const r of rows) if (!latest.has(r.kind)) latest.set(r.kind, r)
  return [...latest.values()].map(toRow)
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
export async function servicesOf(c: ClientRow): Promise<(ServiceRef & { category: string })[]> {
  const rows = must(await db().from('seo_client_services').select('id, name, seo_client_categories(code, name)').eq('client_id', c.id).order('sort'), 'Loading services') as unknown as {
    id: string
    name: string
    seo_client_categories: { code: string; name: string } | null
  }[]
  return rows.map((s) => ({ id: s.id, name: s.name, home: s.seo_client_categories?.code === 'Home', category: s.seo_client_categories?.name ?? '' }))
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
      await db().from('seo_keywords').select('id, keyword, role, service_id, status').eq('client_id', clientId).order('keyword').range(from, from + 999),
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
  decisions: z.array(z.object({ keywordId: z.string().uuid(), action: z.enum(['approve', 'reject']), value: z.string().max(100).optional() })).min(1).max(5000),
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
