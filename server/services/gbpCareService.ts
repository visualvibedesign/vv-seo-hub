// Phase 4b · GBP care (Sam Day 7, docs/phase-4-plan.md, migration 0023):
// - Products: one per service page (from the sitemap), linking to that page (never Home). "Page not live yet" comes
//   from the page's own status. The 720×720 image is a yes / no tick: no image is stored.
// - Reviews: target per round (default 5), the review email filled from the client's Review email template (plain
//   fill: {brand}, {city}, {state} + the GBP review link), and a tracker that keeps ONLY a short ref, date, channel,
//   result and one follow-up date. Refs with an email or a phone number are refused (the database refuses them too).
// - Posts: 13 weeks from a start date; the link is the page URL + UTM (worked out here, never typed). A post can't
//   be Scheduled / Live without text, or link to a page that isn't live.
import type { CarePage, GbpCareSettings, GbpCareState, GbpPost, GbpProduct, PageStatus, PageType, PostsDraft, PostStatus, ProductDraft, ReviewChannel, ReviewRequest, ReviewResult } from '../../src/types/seo.js'
import { CARE_ROUTINE, DEFAULT_REVIEW_TARGET, POST_BODY_MAX, POST_WEEKS, refProblem, utmLink, weekDate } from '../../src/lib/gbpCare.js'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import { db, must } from '../clients/supabase.js'
import { latestToday } from '../utils/dates.js'
import { clientRow } from './clientService.js'

export class GbpCareInputError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new GbpCareInputError('That client doesn’t exist.')
  return c
}

function text(v: unknown, what: string, max: number, keepLines = false): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new GbpCareInputError(`${what}: text only.`)
  const t = keepLines ? v.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim().replace(/[ \t]+/g, ' ')).join('\n').replace(/\n{3,}/g, '\n\n').trim() : v.trim().replace(/\s+/g, ' ')
  if (!t) return null
  if (t.length > max) throw new GbpCareInputError(`${what}: ${max} characters at most (now ${t.length}).`)
  if (t.split(/[\n,;|·]/).some((p) => looksLikeAddress(p))) throw new GbpCareInputError(`${what}: that looks like a street address. A private address is never stored here.`)
  return t
}

function day(v: unknown, what: string, opts: { required?: boolean; future?: boolean } = {}): string | null {
  if (v === null || v === undefined || v === '') {
    if (opts.required) throw new GbpCareInputError(`${what}: pick a date.`)
    return null
  }
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new GbpCareInputError(`${what}: pick a date.`)
  if (!opts.future && v > latestToday()) throw new GbpCareInputError(`${what} can’t be in the future.`)
  return v
}

function pick<T extends string>(v: unknown, list: readonly T[], what: string): T {
  if (!list.includes(v as T)) throw new GbpCareInputError(`${what}: pick from the list.`)
  return v as T
}

// ---- Rows -----------------------------------------------------------------------------------------------------

type PageRow = { id: string; page_code: string | null; name: string; page_type: PageType | null; status: PageStatus; url: string | null; url_target: string | null; sort: number }
type ProductRow = { id: string; page_id: string | null; name: string; description: string | null; image_ready: boolean; status: GbpProduct['status'] }
type RequestRow = { id: string; customer_ref: string; asked_on: string; channel: ReviewChannel; result: ReviewResult; follow_up_on: string | null }
type PostRow = { id: string; week: number; post_on: string | null; topic: string | null; takeaway: string | null; body: string | null; cta: string; page_id: string | null; link_url: string | null; image_need: string | null; status: PostStatus }
type CareRow = { review_target: number; round_started_on: string | null; posts_start_on: string | null; next_post_batch_on: string | null; care_checks: Record<string, boolean> }

/** The page's URL: the live URL, else the target permalink on the client's site. */
function pageUrl(p: PageRow, siteUrl: string): string | null {
  if (p.url) return p.url
  if (!p.url_target) return null
  try {
    return new URL(p.url_target, siteUrl).toString()
  } catch {
    return null
  }
}

const careOut = (r: CareRow | null): GbpCareSettings => ({
  reviewTarget: r?.review_target ?? DEFAULT_REVIEW_TARGET,
  roundStartedOn: r?.round_started_on ?? null,
  postsStartOn: r?.posts_start_on ?? null,
  nextPostBatchOn: r?.next_post_batch_on ?? null,
  careChecks: r?.care_checks ?? {},
})

// ---- Review email (plain fill from the client's template) -----------------------------------------------------

type TItem = { kind: string; body: string }

async function reviewTemplate(clientId: string, industry: string | null): Promise<{ name: string; items: TItem[] }> {
  const applied = must(await db().from('seo_client_templates').select('name, snapshot').eq('client_id', clientId).eq('kind', 'review_email').order('applied_at', { ascending: false }).limit(1), 'Loading the review email template') as { name: string; snapshot: { items?: TItem[] } }[]
  if (applied[0]?.snapshot?.items?.length) return { name: applied[0].name, items: applied[0].snapshot.items }
  const built = must(await db().from('seo_templates').select('name, industry, seo_template_items(sort, kind, body)').eq('kind', 'review_email').eq('built_in', true), 'Loading the review email template') as { name: string; industry: string | null; seo_template_items: (TItem & { sort: number })[] }[]
  const t = built.find((x) => industry && x.industry === industry) ?? built.find((x) => !x.industry) ?? built[0]
  return t ? { name: t.name, items: [...t.seo_template_items].sort((a, b) => a.sort - b.sort) } : { name: 'Review request email', items: [] }
}

function fillEmail(items: TItem[], vals: { brand: string; city: string | null; state: string | null; reviewUrl: string | null }) {
  const missing = new Set<string>()
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = k === 'brand' ? vals.brand : k === 'city' ? vals.city : k === 'state' || k === 'st' ? vals.state : null
      if (!v) missing.add(k)
      return v ?? `[${k}]`
    })
  const lines = items.filter((i) => i.kind === 'text').map((i) => {
    if (/review link/i.test(i.body)) {
      if (!vals.reviewUrl) missing.add('review link (GBP check › Business details)')
      return `Leave a Google review: ${vals.reviewUrl ?? '[review link]'}\n(QR code attached)`
    }
    return fill(i.body)
  })
  const subject = lines[0] ?? `Thank you from ${vals.brand}`
  return { subject, body: lines.join('\n\n'), missing: [...missing] }
}

/** Claude's open ("Ready to review") draft of one kind, or null. */
export async function openCareDraft(clientId: string, kind: 'gbp_products' | 'gbp_posts'): Promise<{ id: string; created_at: string; payload: Record<string, unknown> } | null> {
  const r = must(await db().from('seo_autofill').select('id, payload, created_at').eq('client_id', clientId).eq('kind', kind).eq('status', 'ready').order('created_at', { ascending: false }).limit(1), 'Loading the draft') as { id: string; created_at: string; payload: Record<string, unknown> }[]
  return r[0] ?? null
}

// ---- Read -----------------------------------------------------------------------------------------------------

export async function gbpCareState(siteId: string): Promise<GbpCareState> {
  const c = await client(siteId)
  const careR = must(await db().from('seo_gbp_care').select('*').eq('client_id', c.id).maybeSingle(), 'Loading GBP care') as CareRow | null
  const care = careOut(careR)
  const [pagesR, productsR, requestsR, postsR, profileR, tmpl, pDraft, wDraft] = await Promise.all([
    db().from('seo_pages').select('id, page_code, name, page_type, status, url, url_target, sort').eq('client_id', c.id),
    db().from('seo_gbp_products').select('id, page_id, name, description, image_ready, status').eq('client_id', c.id).order('sort'),
    db().from('seo_review_requests').select('id, customer_ref, asked_on, channel, result, follow_up_on').eq('client_id', c.id).order('asked_on', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    care.postsStartOn ? db().from('seo_gbp_posts').select('*').eq('client_id', c.id).eq('quarter_start', care.postsStartOn) : Promise.resolve({ data: [], error: null }),
    db().from('seo_gbp_profile').select('review_url').eq('client_id', c.id).maybeSingle(),
    reviewTemplate(c.id, c.industry ?? null),
    openCareDraft(c.id, 'gbp_products'),
    openCareDraft(c.id, 'gbp_posts'),
  ])
  const code = (p: PageRow) => Number((p.page_code ?? '').replace(/\D/g, '')) || 999
  const pageRows = (must(pagesR, 'Loading the pages') as PageRow[]).sort((a, b) => code(a) - code(b) || a.sort - b.sort)
  const toPage = (p: PageRow): CarePage => ({ id: p.id, code: p.page_code, name: p.name, type: p.page_type, status: p.status, url: pageUrl(p, c.site_url) })
  const requests = (must(requestsR, 'Loading review requests') as RequestRow[]).map((r): ReviewRequest => ({ id: r.id, customerRef: r.customer_ref, askedOn: r.asked_on, channel: r.channel, result: r.result, followUpOn: r.follow_up_on }))
  const postRows = must(postsR, 'Loading posts') as PostRow[]
  const profile = must(profileR, 'Loading the review link') as { review_url: string | null } | null
  return {
    clientName: c.name,
    city: c.city,
    care,
    servicePages: pageRows.filter((p) => p.page_type === 'service').map(toPage),
    pages: [...pageRows].sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live')).map(toPage),
    products: (must(productsR, 'Loading products') as ProductRow[]).map((p) => ({ id: p.id, pageId: p.page_id, name: p.name, description: p.description, imageReady: p.image_ready, status: p.status })),
    requests,
    reviewed: requests.filter((r) => r.result === 'reviewed' && (!care.roundStartedOn || r.askedOn >= care.roundStartedOn)).length,
    productDraft: pDraft ? ({ id: pDraft.id, createdAt: pDraft.created_at, ...pDraft.payload } as ProductDraft) : null,
    // A posts draft only shows for the quarter it was made for
    postsDraft: wDraft && wDraft.payload.quarterStart === care.postsStartOn ? ({ id: wDraft.id, createdAt: wDraft.created_at, ...wDraft.payload } as PostsDraft) : null,
    reviewEmail: { templateName: tmpl.name, ...fillEmail(tmpl.items, { brand: c.name, city: c.city, state: c.state, reviewUrl: profile?.review_url ?? null }) },
    posts: care.postsStartOn
      ? Array.from({ length: POST_WEEKS }, (_, i): GbpPost => {
          const week = i + 1
          const r = postRows.find((p) => p.week === week)
          return r
            ? { week, id: r.id, postOn: r.post_on, topic: r.topic, takeaway: r.takeaway, body: r.body, cta: r.cta, pageId: r.page_id, linkUrl: r.link_url, imageNeed: r.image_need, status: r.status }
            : { week, id: null, postOn: weekDate(care.postsStartOn!, week), topic: null, takeaway: null, body: null, cta: 'Learn more', pageId: null, linkUrl: null, imageNeed: null, status: 'not_drafted' }
        })
      : [],
  }
}

// ---- Writes (each returns the whole state) ---------------------------------------------------------------------

export async function saveCare(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  const target = Number(b.reviewTarget ?? DEFAULT_REVIEW_TARGET)
  if (!Number.isInteger(target) || target < 1 || target > 50) throw new GbpCareInputError('Review target: a whole number from 1 to 50.')
  const checksIn = (b.careChecks ?? {}) as Record<string, unknown>
  if (typeof checksIn !== 'object' || Array.isArray(checksIn)) throw new GbpCareInputError('Care routine: pick from the list.')
  const checks: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(checksIn)) {
    if (!CARE_ROUTINE.some((x) => x.key === k)) throw new GbpCareInputError('Care routine: pick from the list.')
    if (v === true) checks[k] = true
  }
  const row = {
    client_id: c.id,
    review_target: target,
    round_started_on: day(b.roundStartedOn, 'Round started'),
    posts_start_on: day(b.postsStartOn, 'Posts start', { future: true }),
    next_post_batch_on: day(b.nextPostBatchOn, 'Next post batch', { future: true }),
    care_checks: checks,
  }
  must(await db().from('seo_gbp_care').upsert(row, { onConflict: 'client_id' }), 'Saving GBP care')
  return gbpCareState(siteId)
}

async function pagesOf(clientId: string) {
  return must(await db().from('seo_pages').select('id, page_code, name, page_type, status, url, url_target, sort').eq('client_id', clientId), 'Loading the pages') as PageRow[]
}

/** Adds or edits one product. A product links to a service page (never Home); one product per page. */
export async function saveProduct(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  const id = b.id ? String(b.id) : null
  if (id && !UUID.test(id)) throw new GbpCareInputError('Pick a product to edit.')
  const pageId = b.pageId ? String(b.pageId) : null
  const pages = await pagesOf(c.id)
  const page = pageId ? pages.find((p) => p.id === pageId) : null
  if (pageId && !page) throw new GbpCareInputError('That page doesn’t exist. Reload the page.')
  if (page && page.page_type === 'home') throw new GbpCareInputError('A product links to its service page, not Home (Sam, Day 7).')
  const name = text(b.name, 'Product name', 120) ?? page?.name.slice(0, 120) ?? null
  if (!name) throw new GbpCareInputError('Type the product name.')
  const row = {
    page_id: page?.id ?? null,
    name,
    description: text(b.description, 'Description', 1000, true),
    image_ready: b.imageReady === true,
    status: b.status === undefined ? 'not_added' : pick(b.status, ['not_added', 'added'] as const, 'Status'),
  }
  const existing = must(await db().from('seo_gbp_products').select('id, page_id').eq('client_id', c.id), 'Loading products') as { id: string; page_id: string | null }[]
  if (id && !existing.some((e) => e.id === id)) throw new GbpCareInputError('That product is gone. Reload the page.')
  if (row.page_id && existing.some((e) => e.page_id === row.page_id && e.id !== id)) throw new GbpCareInputError('That page already has a product. Edit that one.')
  if (id) must(await db().from('seo_gbp_products').update(row).eq('client_id', c.id).eq('id', id), 'Saving the product')
  else must(await db().from('seo_gbp_products').insert({ ...row, client_id: c.id, sort: existing.length }), 'Adding the product')
  return gbpCareState(siteId)
}

export async function deleteProduct(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const id = String(((raw ?? {}) as { id?: unknown }).id ?? '')
  if (!UUID.test(id)) throw new GbpCareInputError('Pick a product to remove.')
  must(await db().from('seo_gbp_products').delete().eq('client_id', c.id).eq('id', id), 'Removing the product')
  return gbpCareState(siteId)
}

const CHANNELS = ['email', 'text', 'in_person', 'other'] as const
const RESULTS = ['waiting', 'reviewed', 'no_reply', 'declined'] as const

/** Logs or edits a review request. Only ref, date, channel, result and one follow-up date are kept. */
export async function saveRequest(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  for (const k of Object.keys(b)) if (!['siteId', 'id', 'customerRef', 'askedOn', 'channel', 'result', 'followUpOn'].includes(k)) throw new GbpCareInputError('The tracker keeps only a ref, date, channel, result and one follow-up date.')
  const id = b.id ? String(b.id) : null
  if (id && !UUID.test(id)) throw new GbpCareInputError('Pick a request to edit.')
  const ref = typeof b.customerRef === 'string' ? b.customerRef.trim().replace(/\s+/g, ' ') : ''
  const problem = refProblem(ref)
  if (problem) throw new GbpCareInputError(problem)
  const askedOn = day(b.askedOn, 'Date asked', { required: true })!
  const followUpOn = day(b.followUpOn, 'Follow-up', { future: true })
  if (followUpOn && followUpOn < askedOn) throw new GbpCareInputError('The follow-up is before the date asked.')
  const row = { customer_ref: ref, asked_on: askedOn, channel: pick(b.channel, CHANNELS, 'Channel'), result: b.result === undefined ? 'waiting' : pick(b.result, RESULTS, 'Result'), follow_up_on: followUpOn }
  if (id) {
    const r = must(await db().from('seo_review_requests').update(row).eq('client_id', c.id).eq('id', id).select('id'), 'Saving the request') as { id: string }[]
    if (!r.length) throw new GbpCareInputError('That request is gone. Reload the page.')
  } else must(await db().from('seo_review_requests').insert({ ...row, client_id: c.id }), 'Logging the request')
  return gbpCareState(siteId)
}

export async function deleteRequest(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const id = String(((raw ?? {}) as { id?: unknown }).id ?? '')
  if (!UUID.test(id)) throw new GbpCareInputError('Pick a request to remove.')
  must(await db().from('seo_review_requests').delete().eq('client_id', c.id).eq('id', id), 'Removing the request')
  return gbpCareState(siteId)
}

const STATUSES = ['not_drafted', 'drafted', 'approved', 'scheduled', 'live'] as const

/** Saves one week of the current quarter (care.postsStartOn). The link is the page URL + UTM, worked out here. */
export async function savePost(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const care = careOut(must(await db().from('seo_gbp_care').select('*').eq('client_id', c.id).maybeSingle(), 'Loading GBP care') as CareRow | null)
  if (!care.postsStartOn) throw new GbpCareInputError('Pick the posts start date first.')
  const b = (raw ?? {}) as Record<string, unknown>
  const week = Number(b.week)
  if (!Number.isInteger(week) || week < 1 || week > POST_WEEKS) throw new GbpCareInputError(`Week: 1 to ${POST_WEEKS}.`)
  const body = text(b.body, 'Post text', POST_BODY_MAX, true)
  const status = b.status === undefined ? (body ? 'drafted' : 'not_drafted') : pick(b.status, STATUSES, 'Status')
  const pageId = b.pageId ? String(b.pageId) : null
  const page = pageId ? (await pagesOf(c.id)).find((p) => p.id === pageId) : null
  if (pageId && !page) throw new GbpCareInputError('That page doesn’t exist. Reload the page.')
  if (status !== 'not_drafted' && !body) throw new GbpCareInputError('Write the post text first (or keep it “Not drafted”).')
  if ((status === 'scheduled' || status === 'live') && page && page.status !== 'live') throw new GbpCareInputError(`“${page.name}” isn’t live yet. Link a live page before scheduling.`)
  const postOn = day(b.postOn, 'Post date', { future: true }) ?? weekDate(care.postsStartOn, week)
  const row = {
    client_id: c.id,
    quarter_start: care.postsStartOn,
    week,
    post_on: postOn,
    topic: text(b.topic, 'Topic', 120),
    takeaway: text(b.takeaway, 'Takeaway', 300),
    body,
    cta: text(b.cta, 'Button', 40) ?? 'Learn more',
    page_id: page?.id ?? null,
    link_url: page ? utmLink(pageUrl(page, c.site_url)) : null,
    image_need: text(b.imageNeed, 'Image need', 200),
    status,
  }
  must(await db().from('seo_gbp_posts').upsert(row, { onConflict: 'client_id,quarter_start,week' }), 'Saving the post')
  return gbpCareState(siteId)
}

/** Clears one week of the current quarter (the slot goes back to empty / Not drafted). */
export async function clearPost(siteId: string, raw: unknown): Promise<GbpCareState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { quarterStart?: unknown; week?: unknown }
  const week = Number(b.week)
  if (!Number.isInteger(week) || week < 1 || week > POST_WEEKS) throw new GbpCareInputError(`Week: 1 to ${POST_WEEKS}.`)
  const start = day(b.quarterStart, 'Quarter start', { required: true, future: true })!
  must(await db().from('seo_gbp_posts').delete().eq('client_id', c.id).eq('quarter_start', start).eq('week', week), 'Clearing the post')
  return gbpCareState(siteId)
}
