// Phase 3 step 5 · BrandScript (StoryBrand A–P, Sam Day 6): written once per client (seo_brandscripts, migration
// 0021) and reused for page copy, GBP posts and social captions. Works for ANY client.
//
// - brandScript(): the answers, "confirmed" date and Claude's open draft (seo_autofill kind 'brandscript').
// - saveBrandScript(): saves the answers; changing any answer clears "confirmed" (read it aloud again). Saving also
//   closes Claude's open draft as approved (Angel used / edited it).
// - confirmBrandScript(): "Read aloud and confirmed".
// - skipBrandDraft(): drops Claude's draft.
// - estimate / draft (Claude, task "brandscript"): from Day 1 setup only (name, site, city + state, services, areas,
//   ideal client, what makes them different, 12-month success). Never the address, accounts or free-form notes.
//   Never invents services, prices, guarantees, testimonials or results: unknown = [bracketed question].
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import { BRAND_FIELDS, BRAND_KEYS } from '../../src/lib/brandscript.js'
import type { BrandKey, BrandScript } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { clientDetail, clientRow } from './clientService.js'

/** A problem the person can fix (400). */
export class BrandScriptInputError extends Error {}

const TASK = 'brandscript' as const
const KIND = 'brandscript' as const
const STEP = 5 // Day 6
const MAX = 600 // characters per answer

type Answers = Partial<Record<BrandKey, string>>

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new BrandScriptInputError('That client doesn’t exist.')
  return c
}

function cleanAnswers(raw: unknown): Answers {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: Answers = {}
  for (const k of BRAND_KEYS) {
    const v = src[k]
    if (typeof v !== 'string') continue
    const t = v.replace(/\r\n/g, '\n').trim()
    if (!t) continue
    if (t.length > MAX) throw new BrandScriptInputError(`${k} is too long (over ${MAX} characters).`)
    out[k] = t
  }
  return out
}

type DraftRow = { id: string; payload: { answers: Answers; notes: string | null }; created_at: string }
async function openDraft(clientId: string): Promise<DraftRow | null> {
  const r = must(await db().from('seo_autofill').select('id, payload, created_at').eq('client_id', clientId).eq('kind', KIND).eq('status', 'ready').order('created_at', { ascending: false }).limit(1), 'Loading the draft') as DraftRow[]
  return r[0] ?? null
}

export async function brandScript(siteId: string): Promise<BrandScript> {
  const c = await client(siteId)
  const [row, draft] = await Promise.all([
    db().from('seo_brandscripts').select('answers, confirmed_at, updated_at').eq('client_id', c.id).maybeSingle(),
    openDraft(c.id),
  ])
  const r = must(row, 'Loading the BrandScript') as { answers: Answers; confirmed_at: string | null; updated_at: string } | null
  return {
    answers: r?.answers ?? {},
    confirmedAt: r?.confirmed_at ?? null,
    updatedAt: r?.updated_at ?? null,
    draft: draft ? { answers: draft.payload.answers ?? {}, notes: draft.payload.notes ?? null, createdAt: draft.created_at } : null,
  }
}

export async function saveBrandScript(siteId: string, raw: unknown): Promise<BrandScript> {
  const c = await client(siteId)
  const answers = cleanAnswers((raw as { answers?: unknown } | null)?.answers)
  const before = must(await db().from('seo_brandscripts').select('answers, confirmed_at').eq('client_id', c.id).maybeSingle(), 'Loading the BrandScript') as { answers: Answers; confirmed_at: string | null } | null
  const same = !!before && BRAND_KEYS.every((k) => (before.answers?.[k] ?? '') === (answers[k] ?? ''))
  must(
    await db().from('seo_brandscripts').upsert({ client_id: c.id, answers, confirmed_at: same ? (before?.confirmed_at ?? null) : null }, { onConflict: 'client_id' }),
    'Saving the BrandScript',
  )
  const draft = await openDraft(c.id)
  if (draft) must(await db().from('seo_autofill').update({ status: 'approved', decided_at: new Date().toISOString(), applied_count: 1 }).eq('id', draft.id).eq('status', 'ready'), 'Saving the draft')
  return brandScript(siteId)
}

export async function confirmBrandScript(siteId: string, raw: unknown): Promise<BrandScript> {
  const c = await client(siteId)
  const on = (raw as { confirmed?: unknown } | null)?.confirmed !== false
  const r = must(await db().from('seo_brandscripts').select('answers').eq('client_id', c.id).maybeSingle(), 'Loading the BrandScript') as { answers: Answers } | null
  if (on && (!r || !BRAND_KEYS.some((k) => r.answers?.[k]))) throw new BrandScriptInputError('Save the BrandScript first.')
  if (r) must(await db().from('seo_brandscripts').update({ confirmed_at: on ? new Date().toISOString() : null }).eq('client_id', c.id), 'Saving the BrandScript')
  return brandScript(siteId)
}

export async function skipBrandDraft(siteId: string): Promise<BrandScript> {
  const c = await client(siteId)
  const draft = await openDraft(c.id)
  if (draft) must(await db().from('seo_autofill').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', draft.id).eq('status', 'ready'), 'Saving the draft')
  return brandScript(siteId)
}

// ---- Claude draft -------------------------------------------------------------------------------------------------

const SYSTEM = `You draft a StoryBrand BrandScript (A to P) for a small local business, for an agency team that checks it with the owner before using it on the website, Google Business Profile and social posts.

Write each field in one or two short plain sentences, in the business's voice, with the customer as the hero and the business as the guide.

Rules:
- Use only the facts given. Never invent services, prices, guarantees, testimonials, reviews, years in business, awards, team names or results.
- Where a fact is needed but not given, write a short question in [brackets] instead, e.g. "[How many years in business?]".
- The plan (I, J, K) is exactly three simple steps the customer takes (for example: book a call, get a plan, launch).
- N is the main call to action; O is a smaller first step (a guide, a checklist, a free review…) only if it fits; otherwise a [bracketed question].
- Plain local wording, no hype words, no emoji.
- In notes, list the assumptions you made and the questions the owner should answer.`

const Out = z.object({
  A: z.string(), B: z.string(), C: z.string(), D: z.string(), E: z.string(), F: z.string(), G: z.string(), H: z.string(),
  I: z.string(), J: z.string(), K: z.string(), L: z.string(), M: z.string(), N: z.string(), O: z.string(), P: z.string(),
  notes: z.string(),
})

async function prompt(siteId: string) {
  const c = await client(siteId)
  const d = await clientDetail(c)
  const current = must(await db().from('seo_brandscripts').select('answers').eq('client_id', c.id).maybeSingle(), 'Loading the BrandScript') as { answers: Answers } | null
  const lines: string[] = []
  lines.push(`Business: ${d.name}`, `Website: ${d.siteUrl}`, `City: ${d.city || '[unknown]'}${d.state ? `, ${d.state}` : ''}`)
  const services = d.categories.filter((k) => k.name.trim()).map((k) => `${k.name}${k.services.length ? ` (${k.services.map((s) => s.name).join(', ')})` : ''}`)
  if (services.length) lines.push(`Services: ${services.join('; ')}`)
  const areas = d.areas.filter((a) => a.status === 'active' && a.name).map((a) => a.name)
  if (areas.length) lines.push(`Areas served: ${areas.join(', ')}`)
  lines.push(`Ideal client (Day 1): ${d.idealClient?.trim() || '[not answered yet]'}`)
  lines.push(`What makes them different (Day 1): ${d.usp?.trim() || '[not answered yet]'}`)
  lines.push(`Success in 12 months (Day 1): ${d.success12mo?.trim() || '[not answered yet]'}`)
  const have = BRAND_FIELDS.filter((f) => current?.answers?.[f.key])
  if (have.length) lines.push('', 'Answers already written (keep their facts, improve the wording only):', ...have.map((f) => `${f.key} ${f.label}: ${current!.answers[f.key]}`))
  lines.push('', 'Fields:', ...BRAND_FIELDS.map((f) => `${f.key} ${f.label}: ${f.hint}`))
  return { c, user: lines.join('\n') }
}

export async function estimateBrandScript(siteId: string): Promise<{ model: string; inputTokens: number; outputTokens: number; costUsd: number }> {
  const { user } = await prompt(siteId)
  const t = AI_TASKS[TASK]
  const inputTokens = (await countInputTokens(t.model, SYSTEM, user)) + 250
  return { model: AI_MODELS[t.model].label, inputTokens, outputTokens: t.outBase, costUsd: costUsd(t.model, inputTokens, t.outBase) }
}

export async function draftBrandScript(siteId: string): Promise<BrandScript> {
  const { c, user } = await prompt(siteId)
  const t = AI_TASKS[TASK]
  const { data, logId } = await callStructured({ task: TASK, clientId: c.id, model: t.model, system: SYSTEM, user, schema: Out, maxTokens: 6000, effort: 'medium' })
  const answers: Answers = {}
  for (const k of BRAND_KEYS) {
    const v = data[k]?.replace(/\s+/g, ' ').trim()
    if (v) answers[k] = v.slice(0, MAX)
  }
  if (!Object.keys(answers).length) throw new BrandScriptInputError('Claude returned an empty BrandScript. Nothing was saved; try again.')
  const old = await openDraft(c.id)
  if (old) must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('id', old.id).eq('status', 'ready'), 'Saving the draft')
  must(
    await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: KIND, source: 'claude', status: 'ready', summary: `BrandScript draft · ${Object.keys(answers).length} of 16 · Ready to review`, payload: { answers, notes: data.notes?.trim().slice(0, 1500) || null }, item_count: Object.keys(answers).length, ai_log_id: logId }),
    'Saving the draft',
  )
  return brandScript(siteId)
}
