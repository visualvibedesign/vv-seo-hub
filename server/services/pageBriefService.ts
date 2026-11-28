// Phase 3 step 6 · Page brief (Sam Days 5–6): the Day 5 worksheet + StoryBrand page copy, V1 (header + footer) or V2
// (all 11 sections), one brief per page (seo_page_briefs, migration 0021). Works for ANY client.
//
// - pageBrief(): page basics + hotspots, the brief, and Claude's open draft for this page.
// - savePageBrief(): version, worksheet, sections (text + To write / Drafted / Done); saving approves this page's draft.
// - skipBriefDraft(): drops this page's draft.
// - estimate / draft (Claude, task "page_copy"): from the BrandScript, the page's keywords + hotspots, the business
//   basics and the other pages (for internal links). Only supplied facts; reviews, numbers, prices etc. stay
//   [placeholders]; the path is exactly 3 steps. Drafts for all pages live in one "Ready to review" row per client
//   (seo_autofill kind 'page_copy', payload.drafts keyed by page id).
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import { BRAND_FIELDS, BRAND_KEYS } from '../../src/lib/brandscript.js'
import { SECTION_KEYS, SECTIONS, sectionsFor, WORKSHEET, WORKSHEET_KEYS } from '../../src/lib/brief.js'
import type { BriefVersion, PageBrief, PageBriefDraft, SectionKey, SectionStatus, WorksheetKey } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { clientDetail, clientRow } from './clientService.js'
import { pagesState, pathOf } from './pagesService.js'

/** A problem the person can fix (400). */
export class PageBriefInputError extends Error {}

const TASK = 'page_copy' as const
const KIND = 'page_copy' as const
const STEP = 5 // Day 6
const MAX_SECTION = 3000
const MAX_FIELD = 800
const UUID = /^[0-9a-f-]{36}$/i
const STATUSES: SectionStatus[] = ['to_write', 'drafted', 'done']

type Sections = Partial<Record<SectionKey, { text: string; status: SectionStatus }>>
type Worksheet = Partial<Record<WorksheetKey, string>>
type DraftsRow = { id: string; payload: { drafts: Record<string, PageBriefDraft>; saved?: number }; created_at: string }

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new PageBriefInputError('That client doesn’t exist.')
  return c
}

const pageIdOf = (raw: unknown) => {
  const id = (raw as { pageId?: unknown } | null)?.pageId
  if (typeof id !== 'string' || !UUID.test(id)) throw new PageBriefInputError('Pick a page.')
  return id
}
const versionOf = (v: unknown): BriefVersion => (v === 'v2' ? 'v2' : 'v1')

async function openRow(clientId: string): Promise<DraftsRow | null> {
  const r = must(await db().from('seo_autofill').select('id, payload, created_at').eq('client_id', clientId).eq('kind', KIND).eq('status', 'ready').order('created_at', { ascending: false }).limit(1), 'Loading drafts') as DraftsRow[]
  return r[0] ?? null
}

/** Takes one page's draft off the open row; the row closes (approved / rejected) when none is left. */
async function closeDraft(clientId: string, pageId: string, how: 'saved' | 'skipped') {
  const open = await openRow(clientId)
  if (!open || !open.payload.drafts?.[pageId]) return
  const drafts = { ...open.payload.drafts }
  delete drafts[pageId]
  const saved = (open.payload.saved ?? 0) + (how === 'saved' ? 1 : 0)
  const left = Object.keys(drafts).length
  if (left) must(await db().from('seo_autofill').update({ payload: { drafts, saved }, item_count: left, summary: `Page copy for ${left} page${left === 1 ? '' : 's'} · Ready to review` }).eq('id', open.id).eq('status', 'ready'), 'Saving drafts')
  else must(await db().from('seo_autofill').update({ payload: { drafts, saved }, status: saved ? 'approved' : 'rejected', decided_at: new Date().toISOString(), applied_count: saved }).eq('id', open.id).eq('status', 'ready'), 'Saving drafts')
}

export async function pageBrief(siteId: string, raw: unknown): Promise<PageBrief> {
  const c = await client(siteId)
  const pageId = pageIdOf(raw)
  const [st, briefRes, brandRes, open] = await Promise.all([
    pagesState(siteId),
    db().from('seo_page_briefs').select('version, worksheet, sections, updated_at').eq('page_id', pageId).eq('client_id', c.id).maybeSingle(),
    db().from('seo_brandscripts').select('answers, confirmed_at').eq('client_id', c.id).maybeSingle(),
    openRow(c.id),
  ])
  const p = st.pages.find((x) => x.id === pageId)
  if (!p) throw new PageBriefInputError('That page doesn’t exist.')
  const b = must(briefRes, 'Loading the brief') as { version: BriefVersion; worksheet: Worksheet; sections: Sections; updated_at: string } | null
  const brand = must(brandRes, 'Loading the BrandScript') as { answers: Record<string, string>; confirmed_at: string | null } | null
  return {
    page: { id: p.id, code: p.code, name: p.name, type: p.type, seoTitle: p.seoTitle, metaDescription: p.metaDescription, h1: p.h1, url: p.urlTarget ?? (p.url ? pathOf(p.url) : null), primary: p.keywords.find((k) => k.role === 'primary')?.keyword ?? null },
    version: b?.version ?? 'v1',
    worksheet: b?.worksheet ?? {},
    sections: b?.sections ?? {},
    updatedAt: b?.updated_at ?? null,
    draft: open?.payload.drafts?.[pageId] ?? null,
    brandFilled: BRAND_KEYS.filter((k) => brand?.answers?.[k]?.trim()).length,
    brandConfirmed: !!brand?.confirmed_at,
  }
}

export async function savePageBrief(siteId: string, raw: unknown): Promise<PageBrief> {
  const c = await client(siteId)
  const pageId = pageIdOf(raw)
  const b = (raw ?? {}) as { version?: unknown; worksheet?: unknown; sections?: unknown }
  const page = must(await db().from('seo_pages').select('id').eq('id', pageId).eq('client_id', c.id).maybeSingle(), 'Loading the page')
  if (!page) throw new PageBriefInputError('That page doesn’t exist.')
  const worksheet: Worksheet = {}
  const ws = (b.worksheet ?? {}) as Record<string, unknown>
  for (const k of WORKSHEET_KEYS) {
    const v = typeof ws[k] === 'string' ? (ws[k] as string).replace(/\r\n/g, '\n').trim() : ''
    if (!v) continue
    if (v.length > MAX_FIELD) throw new PageBriefInputError(`${WORKSHEET.find((w) => w.key === k)?.label} is too long (over ${MAX_FIELD} characters).`)
    worksheet[k] = v
  }
  const sections: Sections = {}
  const ss = (b.sections ?? {}) as Record<string, { text?: unknown; status?: unknown }>
  for (const k of SECTION_KEYS) {
    const x = ss[k]
    const text = typeof x?.text === 'string' ? x.text.replace(/\r\n/g, '\n').trim() : ''
    const status = STATUSES.includes(x?.status as SectionStatus) ? (x!.status as SectionStatus) : text ? 'drafted' : 'to_write'
    if (!text && status === 'to_write') continue
    if (text.length > MAX_SECTION) throw new PageBriefInputError(`Section ${k} (${SECTIONS.find((s) => s.key === k)?.label}) is too long (over ${MAX_SECTION} characters).`)
    sections[k] = { text, status }
  }
  must(await db().from('seo_page_briefs').upsert({ page_id: pageId, client_id: c.id, version: versionOf(b.version), worksheet, sections }, { onConflict: 'page_id' }), 'Saving the brief')
  await closeDraft(c.id, pageId, 'saved')
  return pageBrief(siteId, { pageId })
}

export async function skipBriefDraft(siteId: string, raw: unknown): Promise<PageBrief> {
  const c = await client(siteId)
  const pageId = pageIdOf(raw)
  await closeDraft(c.id, pageId, 'skipped')
  return pageBrief(siteId, { pageId })
}

// ---- Claude draft -------------------------------------------------------------------------------------------------

const SYSTEM = `You write StoryBrand landing-page copy for one page of a small local business website, plus the page's brief, for an agency team that edits it before anything is published.

Rules:
- The customer is the hero; the business is the guide. Plain, local, specific wording. No hype words, no emoji.
- Use only the facts given (business basics, BrandScript, keywords, hotspots). Never invent services, prices, guarantees, reviews, testimonials, years, awards, team names, numbers or results. Anything unknown goes in [brackets], e.g. "[Client review: name, quote]" or "[Price from the pricing page]".
- Work the primary keyword into the header naturally and related keywords into the body where they fit; never stuff them. Keyword volumes are not given and must not be invented.
- Header: an eyebrow "Service in City, Full State", a short headline, a subheadline with a semantic triple ("X is a ___ that …"), and a call to action from the BrandScript's next action.
- Path: exactly 3 simple steps.
- Footer: phone, email, hours, booking link and the areas served: only what is given, otherwise [placeholders].
- Never write, ask for or leave a placeholder for a street address (many businesses are service-area only and their address is private): use the city and the areas served instead, in the footer and everywhere else.
- Internal links: in the brief, suggest which listed pages should link here and which this page links to (parent, children, FAQ, contact). Don't over-mention other cities on this page.
- Only write the sections you are asked for. Separate lines inside a section with line breaks; no markdown symbols.
- In notes: what the owner must supply and any assumption you made. End the notes with: "Here's the rough draft. Would you like to make any changes?"`

const sectionSchema = Object.fromEntries(SECTION_KEYS.map((k) => [`s${k}`, z.string().describe(`Section ${k}; empty if not asked for`)])) as Record<`s${SectionKey}`, z.ZodString>
const worksheetSchema = Object.fromEntries(WORKSHEET_KEYS.map((k) => [k, z.string()])) as Record<WorksheetKey, z.ZodString>
const Out = z.object({ ...sectionSchema, ...worksheetSchema, notes: z.string() })

async function prompt(siteId: string, raw: unknown) {
  const c = await client(siteId)
  const pageId = pageIdOf(raw)
  const version = versionOf((raw as { version?: unknown } | null)?.version)
  const [d, st, brandRes] = await Promise.all([clientDetail(c), pagesState(siteId), db().from('seo_brandscripts').select('answers, confirmed_at').eq('client_id', c.id).maybeSingle()])
  const p = st.pages.find((x) => x.id === pageId)
  if (!p) throw new PageBriefInputError('That page doesn’t exist.')
  const brand = must(brandRes, 'Loading the BrandScript') as { answers: Record<string, string>; confirmed_at: string | null } | null
  const want = sectionsFor(version)
  const lines: string[] = []
  lines.push(`Business: ${d.name}`, `Website: ${st.siteUrl}`, `City: ${d.city || '[unknown]'}${d.state ? `, ${d.state}` : ''}`)
  const services = d.categories.filter((k) => k.name.trim()).map((k) => `${k.name}${k.services.length ? ` (${k.services.map((s) => s.name).join(', ')})` : ''}`)
  if (services.length) lines.push(`Services: ${services.join('; ')}`)
  const areas = d.areas.filter((a) => a.status === 'active' && a.name).map((a) => a.name)
  if (areas.length) lines.push(`Areas served: ${areas.join(', ')}`)
  const filled = BRAND_FIELDS.filter((f) => brand?.answers?.[f.key]?.trim())
  lines.push('', `BrandScript (${filled.length} of 16 filled${brand?.confirmed_at ? ', confirmed by the owner' : ', not confirmed yet'}):`)
  lines.push(...(filled.length ? filled.map((f) => `${f.key} ${f.label}: ${brand!.answers[f.key]}`) : ['[No BrandScript yet: keep claims general and use [placeholders]]']))
  lines.push('', `This page: ${p.code ?? ''} ${p.name} · ${p.type ?? 'type not set'} page · ${p.action ?? ''}`)
  lines.push(`- URL: ${p.urlTarget ?? (p.url ? pathOf(p.url) : '[not set]')}`)
  lines.push(`- Hotspots: title "${p.seoTitle ?? '[not set]'}", meta "${p.metaDescription ?? '[not set]'}", H1 "${p.h1 ?? '[not set]'}"`)
  const kw = (role: string) => p.keywords.filter((k) => k.role === role).map((k) => k.keyword)
  lines.push(`- Primary keyword: ${kw('primary').join('; ') || 'none'}`, `- Secondary keywords: ${kw('secondary').slice(0, 15).join('; ') || 'none'}`, `- FAQ ideas: ${[...kw('faq'), ...p.ideas].slice(0, 8).join('; ') || 'none'}`)
  const parent = p.parentId ? st.pages.find((x) => x.id === p.parentId) : null
  if (parent) lines.push(`- Parent page: ${parent.code ?? ''} ${parent.name}`)
  lines.push('', 'Other pages on the site (for internal links):', ...st.pages.filter((x) => x.id !== p.id).map((x) => `- ${x.code ?? ''} ${x.name} (${x.urlTarget ?? (x.url ? pathOf(x.url) : 'not live')})`))
  lines.push('', `Write version ${version.toUpperCase()}: sections ${want.map((s) => `${s.key} ${s.label}`).join(', ')}. Leave the other sections empty.`, ...want.map((s) => `- Section ${s.key} ${s.label}: ${s.hint}`))
  lines.push('', 'Also fill the brief fields:', ...WORKSHEET.map((w) => `- ${w.key}: ${w.label} (${w.hint})`))
  return { c, p, version, want, user: lines.join('\n') }
}

export async function estimatePageCopy(siteId: string, raw: unknown): Promise<{ model: string; inputTokens: number; outputTokens: number; costUsd: number }> {
  const { want, user } = await prompt(siteId, raw)
  const t = AI_TASKS[TASK]
  const inputTokens = (await countInputTokens(t.model, SYSTEM, user)) + 400
  const outputTokens = t.outBase + t.outPerItem * want.length
  return { model: AI_MODELS[t.model].label, inputTokens, outputTokens, costUsd: costUsd(t.model, inputTokens, outputTokens) }
}

export async function draftPageCopy(siteId: string, raw: unknown): Promise<PageBrief> {
  const { c, p, version, want, user } = await prompt(siteId, raw)
  const t = AI_TASKS[TASK]
  const { data, logId } = await callStructured({ task: TASK, clientId: c.id, model: t.model, system: SYSTEM, user, schema: Out, maxTokens: 6000 + 900 * want.length, effort: 'medium' })
  const sections: PageBriefDraft['sections'] = {}
  for (const s of want) {
    const v = data[`s${s.key}`]?.trim()
    if (v) sections[s.key] = v.slice(0, MAX_SECTION) // only the sections asked for
  }
  const worksheet: PageBriefDraft['worksheet'] = {}
  for (const k of WORKSHEET_KEYS) {
    const v = data[k]?.trim()
    if (v) worksheet[k] = v.slice(0, MAX_FIELD)
  }
  if (!Object.keys(sections).length) throw new PageBriefInputError('Claude returned no page copy. Nothing was saved; try again.')
  const draft: PageBriefDraft = { sections, worksheet, notes: data.notes?.trim().slice(0, 2000) || null, version, createdAt: new Date().toISOString() }
  const open = await openRow(c.id)
  const drafts = { ...(open?.payload.drafts ?? {}), [p.id]: draft }
  if (open) must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('id', open.id).eq('status', 'ready'), 'Saving drafts')
  const n = Object.keys(drafts).length
  must(
    await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: KIND, source: 'claude', status: 'ready', summary: `Page copy for ${n} page${n === 1 ? '' : 's'} · Ready to review`, payload: { drafts, saved: open?.payload.saved ?? 0 }, item_count: n, ai_log_id: logId }),
    'Saving drafts',
  )
  return pageBrief(siteId, { pageId: p.id })
}
