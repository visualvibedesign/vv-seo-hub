// Claude auto-fill tasks (redesign step 6c). Every run is: estimate (shown to Angel) → Angel clicks Run →
// one Claude call (logged in seo_ai_log) → saved in seo_autofill as "Ready to review" (approve / reject like 6b).
// What Claude sees: keyword text (and later volumes, services, areas). Never the private address, account
// details or notes. Claude never changes exported numbers: intent is only suggested where Semrush left it empty.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd, type AiTask } from '../../src/lib/aiModels.js'
import type { AutofillItem, AutofillRow } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { AutofillInputError, keywordsOf, listAutofill } from './autofillService.js'
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

async function client(siteId: string): Promise<ClientRow> {
  const c = await clientRow(siteId)
  if (!c) throw new AutofillInputError('That client doesn’t exist.')
  return c
}

// ---- Intent (Haiku) -------------------------------------------------------------------------------

export const INTENTS = ['Informational', 'Navigational', 'Commercial', 'Transactional'] as const

const INTENT_SYSTEM = `You label search keywords for a local business SEO tool with Semrush's search intent.
Intents:
- Informational: wants to learn or understand something (how, what, aftercare, vs, does it hurt).
- Navigational: looking for a specific business, brand or website by name.
- Commercial: comparing or researching before buying (best, price, cost, reviews, near me comparisons).
- Transactional: ready to book or buy a service now (service + city, book, appointment).
Give exactly one intent per keyword id you are given, plus a reason of at most 8 words. Do not add keywords.`

const IntentOut = z.object({
  items: z.array(z.object({ id: z.number().int(), intent: z.enum(INTENTS), reason: z.string() })),
})

async function intentInput(c: ClientRow) {
  const kws = (await keywordsOf(c.id)).filter((k) => k.status !== 'rejected')
  // Only where Semrush left intent empty (keywordsOf doesn't load intent: fetch the ids that need it).
  const empty = new Set(
    (must(await db().from('seo_keywords').select('id').eq('client_id', c.id).is('intent', null), 'Loading keywords') as { id: string }[]).map((r) => r.id),
  )
  const list = kws.filter((k) => empty.has(k.id))
  const user = `Keywords (id | keyword):\n${list.map((k, i) => `${i + 1} | ${k.keyword}`).join('\n')}`
  return { list, user }
}

async function estimateFor(task: AiTask, system: string, user: string, items: number): Promise<AiEstimate> {
  const t = AI_TASKS[task]
  if (!items) return { task, model: AI_MODELS[t.model].label, items: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, empty: true }
  const inputTokens = (await countInputTokens(t.model, system, user)) + 400 // + the output schema
  const outputTokens = t.outBase + t.outPerItem * items // thinking + answer, a generous guess
  return { task, model: AI_MODELS[t.model].label, items, inputTokens, outputTokens, costUsd: costUsd(t.model, inputTokens, outputTokens), empty: false }
}

/** Saves a Claude suggestion as Ready to review (the previous open one of that kind is marked superseded). */
async function saveSuggestion(c: ClientRow, kind: 'intent', items: AutofillItem[], unmatched: { keywordId: string; keyword: string }[], logId: string | null) {
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
        summary: `${items.length} suggestion${items.length === 1 ? '' : 's'} by Claude · ${unmatched.length} not answered`,
        payload: { items, unmatched },
        item_count: items.length,
        ai_log_id: logId,
      }),
    'Saving auto-fill',
  )
}

// ---- Public: estimate + run -------------------------------------------------------------------------

export async function estimate(siteId: string, task: AiTask): Promise<AiEstimate> {
  const c = await client(siteId)
  if (task === 'intent') {
    const { list, user } = await intentInput(c)
    return estimateFor('intent', INTENT_SYSTEM, user, list.length)
  }
  throw new AutofillInputError('That auto-fill task isn’t built yet.')
}

export async function run(siteId: string, task: AiTask): Promise<AutofillRow[]> {
  const c = await client(siteId)
  if (task !== 'intent') throw new AutofillInputError('That auto-fill task isn’t built yet.')
  const { list, user } = await intentInput(c)
  if (!list.length) throw new AutofillInputError('Every keyword already has an intent. Nothing to send.')
  const t = AI_TASKS.intent
  const { data, logId } = await callStructured({
    task: 'day2.intent',
    clientId: c.id,
    model: t.model,
    system: INTENT_SYSTEM,
    user,
    schema: IntentOut,
    maxTokens: Math.max(2000, t.outBase + t.outPerItem * list.length * 2),
  })
  // Keep only answers for ids we sent, one per keyword; anything else is dropped.
  const seen = new Set<number>()
  const items: AutofillItem[] = []
  for (const a of data.items) {
    const k = list[a.id - 1]
    if (!k || seen.has(a.id)) continue
    seen.add(a.id)
    items.push({ keywordId: k.id, keyword: k.keyword, options: [{ value: a.intent, rule: `Claude (${AI_MODELS[t.model].label}): ${a.reason.slice(0, 80)}` }], decision: null })
  }
  const unmatched = list.filter((_, i) => !seen.has(i + 1)).map((k) => ({ keywordId: k.id, keyword: k.keyword }))
  await saveSuggestion(c, 'intent', items, unmatched, logId)
  return listAutofill(siteId)
}
