// Phase 4b step 4 · Claude drafts for GBP care (Sam Day 7), saved as "Ready to review" (seo_autofill kinds
// 'gbp_products' and 'gbp_posts', migration 0023). Nothing changes until Angel checks and approves; approving goes
// through the normal saves (gbpCareService), so the same rules apply. Every call is logged (seo_ai_log).
//
// - Products: 2–3 sentences per service page, from that page's facts (name, main keyword, hotspots, page brief) and
//   the BrandScript. Never prices, claims or facts that aren't given: unknown = [bracketed question].
// - Posts: a 13-week plan from the client's GBP posts template, the LIVE pages (a post only links to a live page),
//   the BrandScript, the areas, and last quarter's topics (so nothing repeats). Full text for the first N weeks
//   (Sam: first 3, then batch) or all 13. Weeks already Approved / Scheduled / Live are kept and never overwritten.
// Never the address, accounts or free-form notes.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import { POST_BODY_MAX, POST_WEEKS } from '../../src/lib/gbpCare.js'
import { BRAND_FIELDS } from '../../src/lib/brandscript.js'
import type { CareEstimate, GbpCareState, PageStatus, PageType, PostStatus } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { clientDetail, clientRow } from './clientService.js'
import { GbpCareInputError, gbpCareState, openCareDraft, savePost, saveProduct } from './gbpCareService.js'

const STEP = 6 // Day 7
const LOCKED: PostStatus[] = ['approved', 'scheduled', 'live']

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new GbpCareInputError('That client doesn’t exist.')
  return c
}

const clean = (v: string | null | undefined, max: number) => {
  const t = (v ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return t ? t.slice(0, max) : null
}

type Page = { id: string; page_code: string | null; name: string; page_type: PageType | null; status: PageStatus; url: string | null; seo_title: string | null; meta_description: string | null; h1: string | null }

/** Shared facts: the business, its services / areas, the BrandScript, and the pages with their main keyword. */
async function facts(siteId: string) {
  const c = await client(siteId)
  const d = await clientDetail(c)
  const [pagesR, brandR, briefsR] = await Promise.all([
    db().from('seo_pages').select('id, page_code, name, page_type, status, url, seo_title, meta_description, h1').eq('client_id', c.id),
    db().from('seo_brandscripts').select('answers').eq('client_id', c.id).maybeSingle(),
    db().from('seo_page_briefs').select('page_id, worksheet, sections').eq('client_id', c.id),
  ])
  const code = (p: Page) => Number((p.page_code ?? '').replace(/\D/g, '')) || 999
  const pages = (must(pagesR, 'Loading the pages') as Page[]).sort((a, b) => code(a) - code(b))
  const kw = pages.length
    ? (must(await db().from('seo_page_keywords').select('page_id, seo_keywords(keyword)').in('page_id', pages.map((p) => p.id)).eq('role', 'primary'), 'Loading keywords') as unknown as { page_id: string; seo_keywords: { keyword: string } | null }[])
    : []
  const primary = (id: string) => kw.find((k) => k.page_id === id)?.seo_keywords?.keyword ?? null
  const brand = (must(brandR, 'Loading the BrandScript') as { answers: Record<string, string> } | null)?.answers ?? {}
  const briefs = must(briefsR, 'Loading the page briefs') as { page_id: string; worksheet: Record<string, string>; sections: Record<string, { text?: string }> }[]
  const lines: string[] = [`Business: ${d.name}`, `Website: ${d.siteUrl}`, `City: ${d.city || '[unknown]'}${d.state ? `, ${d.state}` : ''}`]
  const areas = d.areas.filter((a) => a.status === 'active' && a.name).map((a) => a.name)
  if (areas.length) lines.push(`Areas served: ${areas.join(', ')}`)
  if (d.usp?.trim()) lines.push(`What makes them different: ${d.usp.trim()}`)
  const bs = BRAND_FIELDS.filter((f) => brand[f.key]).map((f) => `${f.key} ${f.label}: ${brand[f.key]}`)
  lines.push('', bs.length ? 'BrandScript (approved facts and voice):' : 'BrandScript: [not written yet]', ...bs)
  return { c, d, pages, primary, briefs, header: lines }
}

function pageFacts(p: Page, primary: string | null, brief?: { worksheet: Record<string, string>; sections: Record<string, { text?: string }> }) {
  const out = [`${p.page_code ?? '·'} · ${p.name} (${p.status === 'live' ? 'live' : 'not live yet'})`]
  if (primary) out.push(`  Main keyword: ${primary}`)
  if (p.h1) out.push(`  H1: ${p.h1}`)
  if (p.meta_description) out.push(`  Meta description: ${p.meta_description}`)
  if (brief?.worksheet?.customerNeed) out.push(`  Customer need: ${brief.worksheet.customerNeed}`)
  if (brief?.worksheet?.proof) out.push(`  Proof (real): ${brief.worksheet.proof}`)
  const header = brief?.sections?.['1']?.text
  if (header) out.push(`  Page header copy: ${header.slice(0, 600)}`)
  return out.join('\n')
}

function estimateOf(task: 'gbp_products' | 'gbp_posts', inputTokens: number, out: number): CareEstimate {
  const t = AI_TASKS[task]
  return { model: AI_MODELS[t.model].label, inputTokens, outputTokens: out, costUsd: costUsd(t.model, inputTokens, out) }
}

async function supersede(clientId: string, kind: 'gbp_products' | 'gbp_posts') {
  must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('client_id', clientId).eq('kind', kind).eq('status', 'ready'), 'Saving the draft')
}

// ---- Products ---------------------------------------------------------------------------------------------------

const PRODUCTS_SYSTEM = `You write Google Business Profile product descriptions for a small local business, one per service page, for an agency that checks them before adding them to the profile. Each product links to its service page.

Rules:
- 2–3 short sentences (under 500 characters), for people, in the business's voice. Say what the service is, who it's for and the area, then a soft next step.
- Use only the facts given (page, keyword, brief, BrandScript). Never invent prices, guarantees, years, awards, reviews, results or features. If something needed isn't given, write a short [bracketed question].
- name: a short product name (the service, up to 60 characters), not keyword-stuffed.
- No em dashes or en dashes, no emoji, no hype words.
- Use the page code exactly as given.
- notes: assumptions and questions for the owner.`

const ProductsOut = z.object({ items: z.array(z.object({ code: z.string(), name: z.string(), description: z.string() })), notes: z.string() })

async function productsPrompt(siteId: string) {
  const f = await facts(siteId)
  const service = f.pages.filter((p) => p.page_type === 'service')
  if (!service.length) throw new GbpCareInputError('No service pages yet. Add them in Sitemap + hotspots first.')
  const user = [...f.header, '', 'Service pages (one product each):', ...service.map((p) => pageFacts(p, f.primary(p.id), f.briefs.find((b) => b.page_id === p.id)))].join('\n')
  return { ...f, service, user }
}

export async function estimateProducts(siteId: string): Promise<CareEstimate> {
  const { user, service } = await productsPrompt(siteId)
  const t = AI_TASKS.gbp_products
  const out = t.outBase + t.outPerItem * service.length
  return estimateOf('gbp_products', (await countInputTokens(t.model, PRODUCTS_SYSTEM, user)) + 200, out)
}

export async function draftProducts(siteId: string): Promise<GbpCareState> {
  const { c, service, user } = await productsPrompt(siteId)
  const t = AI_TASKS.gbp_products
  const { data, logId } = await callStructured({ task: 'gbp_products', clientId: c.id, model: t.model, system: PRODUCTS_SYSTEM, user, schema: ProductsOut, maxTokens: 8000, effort: 'medium' })
  const items: { pageId: string; code: string | null; name: string; description: string }[] = []
  for (const it of data.items) {
    const p = service.find((x) => x.page_code === it.code.trim())
    if (!p || items.some((i) => i.pageId === p.id)) continue
    const name = clean(it.name, 120)
    const description = clean(it.description?.replace(/\s*[—–]\s*/g, ', '), 1000)
    if (name && description) items.push({ pageId: p.id, code: p.page_code, name, description })
  }
  if (!items.length) throw new GbpCareInputError('Claude didn’t return any usable descriptions. Nothing was saved; try again.')
  await supersede(c.id, 'gbp_products')
  must(await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: 'gbp_products', source: 'claude', status: 'ready', summary: `GBP product descriptions · ${items.length} pages · Ready to review`, payload: { items, notes: clean(data.notes, 1500) }, item_count: items.length, ai_log_id: logId }), 'Saving the draft')
  return gbpCareState(siteId)
}

/** Angel's checked items: each fills (or creates) that page's product; image / Added ticks are kept. */
export async function approveProducts(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; items?: unknown }
  const draft = await openCareDraft(c.id, 'gbp_products')
  if (!draft || draft.id !== b.id) throw new GbpCareInputError('That draft was already used or dropped. Reload the page.')
  if (!Array.isArray(b.items) || !b.items.length) throw new GbpCareInputError('Keep at least one description, or skip the draft.')
  const products = must(await db().from('seo_gbp_products').select('id, page_id, image_ready, status').eq('client_id', c.id), 'Loading products') as { id: string; page_id: string | null; image_ready: boolean; status: string }[]
  const items = (b.items as { pageId?: unknown; name?: unknown; description?: unknown }[]).map((i) => {
    const ex = products.find((p) => p.page_id === i.pageId)
    return { id: ex?.id ?? null, pageId: i.pageId, name: i.name, description: i.description, imageReady: ex?.image_ready ?? false, status: ex?.status ?? 'not_added' }
  })
  for (const i of items) if (typeof i.description === 'string' && /[—–]/.test(i.description)) throw new GbpCareInputError('No em or en dashes in a description. Use a comma or a period.')
  for (const i of items) await saveProduct(siteId, i)
  must(await db().from('seo_autofill').update({ status: 'approved', decided_at: new Date().toISOString(), applied_count: items.length }).eq('id', draft.id).eq('status', 'ready'), 'Saving the draft')
  return gbpCareState(siteId)
}

// ---- Posts ------------------------------------------------------------------------------------------------------

const POSTS_SYSTEM = `You plan a quarter (13 weekly posts) of Google Business Profile posts for a small local business, for an agency that reviews every post before scheduling it.

Follow the business's post template (Sam's cycle): introduce the business, then one post per service (area 1 first), a real project or process, the team, a call-to-action post; then repeat for the next area until 13 weeks are planned.

For each week give: topic (short), takeaway (what the reader learns or gets, one sentence), pageCode (the page the "Learn more" button opens: ONLY a code from the live pages list; null if none fits), imageNeed (a real photo to take or pick, 1200×900, never AI images), and body.

Rules:
- body: write the full post only for the weeks you are asked to write; for the other weeks body is null (they are batched later). A post is 60–180 words, plain and useful, with the service and the city or area named naturally, ending with a line that leads to the button. No URL in the text (the button carries the link).
- Use only the facts given. Never invent offers, discounts, prices, events, dates, deadlines, reviews, testimonials, results, team names or awards. Where a real detail is needed, write a short [bracketed question].
- Don't repeat last quarter's topics.
- Weeks marked "kept" are already approved: plan around them and still return them with their topic, body null.
- No em dashes or en dashes, no emoji, no hashtags, no hype words.
- notes: missing inputs (photos, projects, reviews…) and questions for the owner.`

const PostsOut = z.object({
  weeks: z.array(z.object({ week: z.number(), topic: z.string(), takeaway: z.string().nullable(), pageCode: z.string().nullable(), imageNeed: z.string().nullable(), body: z.string().nullable() })),
  notes: z.string(),
})

async function postsPrompt(siteId: string, rawFull: unknown) {
  const full = rawFull === POST_WEEKS || rawFull === 13 ? POST_WEEKS : 3
  const f = await facts(siteId)
  const care = must(await db().from('seo_gbp_care').select('posts_start_on').eq('client_id', f.c.id).maybeSingle(), 'Loading GBP care') as { posts_start_on: string | null } | null
  const start = care?.posts_start_on
  if (!start) throw new GbpCareInputError('Pick the posts start date first.')
  const live = f.pages.filter((p) => p.status === 'live')
  if (!live.length) throw new GbpCareInputError('No live pages yet: a post’s “Learn more” must open a live page.')
  const [cur, prev, tmpl] = await Promise.all([
    db().from('seo_gbp_posts').select('week, topic, status').eq('client_id', f.c.id).eq('quarter_start', start),
    db().from('seo_gbp_posts').select('quarter_start, week, topic').eq('client_id', f.c.id).lt('quarter_start', start).order('quarter_start', { ascending: false }).limit(26),
    postsTemplate(f.c.id, f.c.industry ?? null),
  ])
  const kept = (must(cur, 'Loading posts') as { week: number; topic: string | null; status: PostStatus }[]).filter((p) => LOCKED.includes(p.status))
  const prevRows = must(prev, 'Loading last quarter') as { quarter_start: string; week: number; topic: string | null }[]
  const lastQ = prevRows.filter((r) => r.quarter_start === prevRows[0]?.quarter_start && r.topic)
  const user = [
    ...f.header,
    '',
    'Post template:',
    ...tmpl.map((t) => `- ${t}`),
    '',
    'Live pages (the only pages a post may link to):',
    ...live.map((p) => pageFacts(p, f.primary(p.id), f.briefs.find((b) => b.page_id === p.id))),
    '',
    lastQ.length ? `Last quarter's topics (don't repeat): ${lastQ.map((r) => r.topic).join('; ')}` : 'Last quarter: none (first quarter).',
    kept.length ? `Kept weeks (already approved): ${kept.map((k) => `week ${k.week}: ${k.topic ?? '[no topic]'}`).join('; ')}` : 'Kept weeks: none.',
    '',
    `Week 1 is ${start}, then one post a week. Write the full body for weeks 1 to ${full} (skip kept weeks); body null for the rest.`,
  ].join('\n')
  return { ...f, start, live, kept, full, user }
}

async function postsTemplate(clientId: string, industry: string | null): Promise<string[]> {
  const applied = must(await db().from('seo_client_templates').select('snapshot').eq('client_id', clientId).eq('kind', 'gbp_posts').order('applied_at', { ascending: false }).limit(1), 'Loading the posts template') as { snapshot: { items?: { body: string }[] } }[]
  if (applied[0]?.snapshot?.items?.length) return applied[0].snapshot.items.map((i) => i.body)
  const built = must(await db().from('seo_templates').select('industry, seo_template_items(sort, body)').eq('kind', 'gbp_posts').eq('built_in', true), 'Loading the posts template') as { industry: string | null; seo_template_items: { sort: number; body: string }[] }[]
  const t = built.find((x) => industry && x.industry === industry) ?? built.find((x) => !x.industry) ?? built[0]
  return t ? [...t.seo_template_items].sort((a, b) => a.sort - b.sort).map((i) => i.body) : []
}

export async function estimatePosts(siteId: string, raw: unknown): Promise<CareEstimate> {
  const { user, full } = await postsPrompt(siteId, (raw as { fullWeeks?: unknown } | null)?.fullWeeks)
  const t = AI_TASKS.gbp_posts
  const out = Math.round(t.outBase * (full === POST_WEEKS ? 1 : 0.45))
  return estimateOf('gbp_posts', (await countInputTokens(t.model, POSTS_SYSTEM, user)) + 250, out)
}

export async function draftPosts(siteId: string, raw: unknown): Promise<GbpCareState> {
  const { c, start, live, kept, user, full } = await postsPrompt(siteId, (raw as { fullWeeks?: unknown } | null)?.fullWeeks)
  const t = AI_TASKS.gbp_posts
  const { data, logId } = await callStructured({ task: 'gbp_posts', clientId: c.id, model: t.model, system: POSTS_SYSTEM, user, schema: PostsOut, maxTokens: 16000, effort: 'medium' })
  const weeks: { week: number; topic: string; takeaway: string | null; body: string | null; pageId: string | null; imageNeed: string | null }[] = []
  for (const w of data.weeks) {
    if (!Number.isInteger(w.week) || w.week < 1 || w.week > POST_WEEKS || weeks.some((x) => x.week === w.week) || kept.some((k) => k.week === w.week)) continue
    const topic = clean(w.topic, 120)
    if (!topic) continue
    const page = w.pageCode ? live.find((p) => p.page_code === w.pageCode!.trim()) : null
    const body = w.week <= full ? clean(w.body?.replace(/\s*[—–]\s*/g, ', '), POST_BODY_MAX) : null
    weeks.push({ week: w.week, topic, takeaway: clean(w.takeaway, 300), body, pageId: page?.id ?? null, imageNeed: clean(w.imageNeed, 200) })
  }
  weeks.sort((a, b) => a.week - b.week)
  if (!weeks.length) throw new GbpCareInputError('Claude didn’t return a usable plan. Nothing was saved; try again.')
  await supersede(c.id, 'gbp_posts')
  must(await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: 'gbp_posts', source: 'claude', status: 'ready', summary: `GBP posts · ${weeks.length} weeks planned, ${weeks.filter((w) => w.body).length} written · Ready to review`, payload: { quarterStart: start, weeks, notes: clean(data.notes, 1500) }, item_count: weeks.length, ai_log_id: logId }), 'Saving the draft')
  return gbpCareState(siteId)
}

/** Angel's checked weeks go in through the normal post save (Drafted when there's text). Kept weeks are refused. */
export async function approvePosts(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; weeks?: unknown }
  const draft = await openCareDraft(c.id, 'gbp_posts')
  if (!draft || draft.id !== b.id) throw new GbpCareInputError('That draft was already used or dropped. Reload the page.')
  if (!Array.isArray(b.weeks) || !b.weeks.length) throw new GbpCareInputError('Keep at least one week, or skip the draft.')
  const start = draft.payload.quarterStart as string
  const cur = must(await db().from('seo_gbp_posts').select('week, status, cta, post_on').eq('client_id', c.id).eq('quarter_start', start), 'Loading posts') as { week: number; status: PostStatus; cta: string; post_on: string | null }[]
  const weeks = b.weeks as { week?: unknown; topic?: unknown; takeaway?: unknown; body?: unknown; pageId?: unknown; imageNeed?: unknown }[]
  for (const w of weeks) {
    const ex = cur.find((x) => x.week === w.week)
    if (ex && LOCKED.includes(ex.status)) throw new GbpCareInputError(`Week ${w.week} is already ${ex.status}: it isn’t replaced. Untick it.`)
    if (typeof w.body === 'string' && /[—–]/.test(w.body)) throw new GbpCareInputError(`Week ${w.week}: no em or en dashes. Use a comma or a period.`)
  }
  for (const w of weeks) {
    const ex = cur.find((x) => x.week === w.week)
    const body = typeof w.body === 'string' && w.body.trim() ? w.body : null
    await savePost(siteId, { week: w.week, topic: w.topic, takeaway: w.takeaway, body, pageId: w.pageId || null, imageNeed: w.imageNeed, cta: ex?.cta, postOn: ex?.post_on ?? null, status: body ? 'drafted' : 'not_drafted' })
  }
  must(await db().from('seo_autofill').update({ status: 'approved', decided_at: new Date().toISOString(), applied_count: weeks.length }).eq('id', draft.id).eq('status', 'ready'), 'Saving the draft')
  return gbpCareState(siteId)
}

export async function skipCareDraft(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const kind = (raw as { kind?: unknown } | null)?.kind
  if (kind !== 'gbp_products' && kind !== 'gbp_posts') throw new GbpCareInputError('Pick a draft to skip.')
  const draft = await openCareDraft(c.id, kind)
  if (draft) must(await db().from('seo_autofill').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', draft.id).eq('status', 'ready'), 'Saving the draft')
  return gbpCareState(siteId)
}
