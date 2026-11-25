// Claude auto-fill tasks (redesign step 6c). Every run is: estimate (shown to Angel) → Angel clicks Run →
// one Claude call (logged in seo_ai_log) → saved in seo_autofill as "Ready to review" (approve / reject like 6b).
// What Claude sees: keyword text, volumes, the client's service names and area names. Never the client's name,
// address, account details or notes. Claude never changes exported numbers: intent is only suggested where
// Semrush left it empty. Keywords that hit a scope word (out of scope / neighbourhood) are never sent: they
// are on the plain-code scope list instead.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd, type AiTask } from '../../src/lib/aiModels.js'
import { hasServiceName, isOwnBrand, roleOptions, serviceOptions, type KeywordLite } from '../../src/lib/autofillRules.js'
import type { AutofillItem, AutofillKind, AutofillRow } from '../../src/types/seo.js'
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
}

/** Which seo_autofill kind each Claude task saves as. */
const KIND: Partial<Record<AiTask, AutofillKind>> = { intent: 'intent', services: 'services_ai', triage: 'triage' }
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
  system: string
  user: string
  schema: T
  /** Claude's answer → suggestions + keywords left as they are (with the summary line). */
  toItems: (data: z.infer<T>) => { items: AutofillItem[]; unmatched: Unmatched; summary: string }
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
  const empty = new Set(
    (must(await db().from('seo_keywords').select('id').eq('client_id', c.id).is('intent', null), 'Loading keywords') as { id: string }[]).map((r) => r.id),
  )
  const list = (await candidates(c)).filter((k) => empty.has(k.id))
  return {
    list,
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
  const list = kws.filter((k) => !k.serviceId && !triaged.has(k.id) && serviceOptions(k.keyword, svc, words).length === 0)
  const vol = await volumes(list.map((k) => k.id))
  return {
    list: svc.length ? list : [],
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
  const list = kws.filter(
    (k) => k.status === 'keep' && !k.role && roleOptions(k.keyword, words).length === 0 && !isOwnBrand(k.keyword, brand) && !hasServiceName(k.keyword, svc),
  )
  const vol = await volumes(list.map((k) => k.id))
  return {
    list,
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

// ---- Shared -----------------------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prepare(c: ClientRow, task: AiTask): Promise<Prepared<any>> {
  if (task === 'intent') return prepIntent(c)
  if (task === 'services') return prepServices(c)
  if (task === 'triage') return prepTriage(c)
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

export async function estimate(siteId: string, task: AiTask): Promise<AiEstimate> {
  const c = await client(siteId)
  const p = await prepare(c, task)
  const t = AI_TASKS[task]
  const items = p.list.length
  if (!items) return { task, model: MODEL_LABEL(task), items: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, empty: true }
  const inputTokens = (await countInputTokens(t.model, p.system, p.user)) + 400 // + the output schema
  const outputTokens = t.outBase + t.outPerItem * items // thinking + answer, a generous guess
  return { task, model: MODEL_LABEL(task), items, inputTokens, outputTokens, costUsd: costUsd(t.model, inputTokens, outputTokens), empty: false }
}

export async function run(siteId: string, task: AiTask): Promise<AutofillRow[]> {
  const c = await client(siteId)
  const kind = KIND[task]
  if (!kind) throw new AutofillInputError('That auto-fill task isn’t built yet.')
  const p = await prepare(c, task)
  if (!p.list.length) throw new AutofillInputError('Nothing to send for this one.')
  const t = AI_TASKS[task]
  const { data, logId } = await callStructured({
    task: `day2.${task}`,
    clientId: c.id,
    model: t.model,
    system: p.system,
    user: p.user,
    schema: p.schema,
    maxTokens: Math.max(2000, t.outBase + t.outPerItem * p.list.length * 2),
  })
  await saveSuggestion(c, kind, p.toItems(data), logId)
  return listAutofill(siteId)
}
