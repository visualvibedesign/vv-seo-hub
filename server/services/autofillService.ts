// Auto-fill (redesign step 6). Table: seo_autofill (0006). Step 6b = Day 2 plain-code rules (roles, services).
// Rules only SUGGEST ("Ready to review"). Approving applies a suggestion to the keyword, but only if the keyword
// still has no role / no service at that moment (never overwrites what Angel set). Rejecting changes nothing.
import { z } from 'zod'
import { suggestRoles, suggestServices, type KeywordLite, type Words } from '../../src/lib/autofillRules.js'
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

/** Words from the client's industry version of "Keyword research" (or the generic one). */
async function templateWords(c: ClientRow): Promise<Words> {
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

/** Day 2 plain-code rules: roles + services. Replaces any open (ready) rules suggestion of the same kind. */
export async function runDay2Rules(siteId: string): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const [keywords, services, words] = await Promise.all([
    keywordsOf(c.id),
    db().from('seo_client_services').select('id, name, seo_client_categories(code)').eq('client_id', c.id),
    templateWords(c),
  ])
  const svc = (must(services, 'Loading services') as unknown as { id: string; name: string; seo_client_categories: { code: string } | null }[]).map((s) => ({
    id: s.id,
    name: s.name,
    home: s.seo_client_categories?.code === 'Home',
  }))
  const roles = suggestRoles(keywords, words)
  const services2 = suggestServices(keywords, svc, words)
  const runs: { kind: AutofillKind; items: AutofillItem[]; unmatched: { keywordId: string; keyword: string }[]; noun: string }[] = [
    { kind: 'roles', items: roles.items as AutofillItem[], unmatched: roles.unmatched, noun: 'rule' },
    { kind: 'services', items: services2.items as AutofillItem[], unmatched: services2.unmatched, noun: 'service match' },
  ]
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
          summary: summaryOf(r.items, r.unmatched, r.noun),
          payload: { items: r.items, unmatched: r.unmatched },
          item_count: r.items.length,
        }),
      'Saving auto-fill',
    )
  }
  return listAutofill(siteId)
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
  if (row.kind !== 'roles' && row.kind !== 'services' && row.kind !== 'intent') throw new AutofillInputError('This kind can’t be approved here yet.')

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

  // Apply in batches per value; "is null" guard = never overwrite what was set in the meantime.
  const column = row.kind === 'roles' ? 'role' : row.kind === 'intent' ? 'intent' : 'service_id'
  if (row.kind === 'services') {
    const ids = [...toApply.keys()]
    if (ids.length) {
      const own = must(await db().from('seo_client_services').select('id').eq('client_id', c.id).in('id', ids), 'Checking services') as { id: string }[]
      if (own.length !== ids.length) throw new AutofillInputError('A suggested service isn’t this client’s.')
    }
  }
  for (const [value, ids] of toApply) {
    const done = must(
      await db().from('seo_keywords').update({ [column]: value }).eq('client_id', c.id).in('id', ids).is(column, null).select('id'),
      'Applying the suggestions',
    ) as { id: string }[]
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
