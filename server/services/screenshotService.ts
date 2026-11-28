// Phase 2g · Numbers read from a screenshot by Claude, saved as "Ready to review" (seo_autofill kind 'gbp_screenshot',
// migration 0020). Nothing counts until Angel approves it in the GBP form; approving goes through the normal GBP save.
//
// Privacy (CLAUDE.md): the image is used for ONE Claude call and never stored or logged (a GBP screenshot can show the
// address / phone). Claude's answer has fields for the period and the numbers only, so nothing else can be saved.
// Honesty: a number Claude can't read clearly is empty (never 0, never a guess). The period is only kept when both
// dates are clear and valid; otherwise it's empty and Angel picks it in the review form.
// Map grid screenshots ('map_screenshot') come later, after Angel's sample.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import type { GbpScreenshotRead, GbpSnapshot, ScreenshotEstimate } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { latestToday } from '../utils/dates.js'
import { callStructured, countInputTokens, type AiImage } from './aiService.js'
import { clientRow } from './clientService.js'
import { saveGbp } from './localService.js'

/** A problem the person can fix (400). */
export class ScreenshotInputError extends Error {}

const TASK = 'gbp_screenshot' as const
const KIND = 'gbp_screenshot' as const
const STEP = 2 // Day 3: the numbers step
const MAX_BYTES = 3_000_000 // decoded; the browser shrinks first (Vercel's request limit is 4.5 MB of base64)
const DAY = /^\d{4}-\d{2}-\d{2}$/

const NUM_FIELDS = ['views', 'viewsSearchDesktop', 'viewsSearchMobile', 'viewsMapsDesktop', 'viewsMapsMobile', 'calls', 'websiteClicks', 'directions'] as const
type NumField = (typeof NUM_FIELDS)[number]
const FIELD_LABEL: Record<NumField | 'period', string> = {
  period: 'Period',
  views: 'Profile views',
  viewsSearchDesktop: 'Google Search · desktop',
  viewsSearchMobile: 'Google Search · mobile',
  viewsMapsDesktop: 'Google Maps · desktop',
  viewsMapsMobile: 'Google Maps · mobile',
  calls: 'Calls',
  websiteClicks: 'Website clicks',
  directions: 'Directions',
}

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new ScreenshotInputError('That client doesn’t exist.')
  return c
}

/** The uploaded image: a JPEG / PNG / WebP under the size limit, checked by its first bytes (not just its name). */
export function imageOf(raw: unknown): AiImage {
  const x = (raw ?? {}) as { mediaType?: unknown; data?: unknown }
  const type = x.mediaType
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') throw new ScreenshotInputError('Pick a PNG, JPG or WebP screenshot.')
  const data = typeof x.data === 'string' ? x.data.replace(/^data:[^,]*,/, '').replace(/\s/g, '') : ''
  if (!data || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new ScreenshotInputError('The screenshot couldn’t be read. Pick it again.')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length < 1000) throw new ScreenshotInputError('That image is too small to read.')
  if (bytes.length > MAX_BYTES) throw new ScreenshotInputError('That image is too big (over 3 MB). Crop it and try again.')
  const head = bytes.subarray(0, 12)
  const ok =
    type === 'image/jpeg'
      ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      : type === 'image/png'
        ? head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
        : head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!ok) throw new ScreenshotInputError('That file isn’t the image type it says it is. Pick the screenshot again.')
  return { mediaType: type, data }
}

const SYSTEM = `You read the numbers from a screenshot of a Google Business Profile "Performance" page, for an agency that types them into its reporting tool. A person checks your answer before it is used.

Read only these, exactly as shown: the period, total profile views (people who viewed the profile), the four-way views breakdown (Google Search desktop / mobile, Google Maps desktop / mobile), calls, website clicks, directions (direction requests).

Rules:
- Copy each number exactly as shown (no rounding, no adding up). If a number isn't visible, is cut off, blurry or ambiguous, use null. Never use 0 for something you can't see; use 0 only when the screenshot clearly shows 0.
- Ignore anything else on the page: business name, address, phone, reviews, posts, charts without numbers.
- Period: copy the period text exactly as shown into periodShown. Fill periodFrom / periodTo (YYYY-MM-DD) only if the screenshot clearly shows the whole period including the year (for example "Oct 2026" = 2026-10-01 to 2026-10-31, or "Sep 1 – Sep 30, 2026"). If the year, the month or a day isn't clearly shown, leave both null. Never guess the period from today's date.
- List in unread every field you couldn't read clearly (use: period, views, viewsSearchDesktop, viewsSearchMobile, viewsMapsDesktop, viewsMapsMobile, calls, websiteClicks, directions).
- isGbpPerformance: false if this isn't a Google Business Profile Performance screenshot.`

const USER = 'Read the numbers from this Google Business Profile Performance screenshot.'

const num = z.number().nullable()
const ReadOut = z.object({
  isGbpPerformance: z.boolean(),
  periodShown: z.string().nullable().describe('The period text exactly as shown, or null'),
  periodFrom: z.string().nullable().describe('YYYY-MM-DD, only when the full period with its year is clearly shown'),
  periodTo: z.string().nullable().describe('YYYY-MM-DD, only when the full period with its year is clearly shown'),
  views: num,
  viewsSearchDesktop: num,
  viewsSearchMobile: num,
  viewsMapsDesktop: num,
  viewsMapsMobile: num,
  calls: num,
  websiteClicks: num,
  directions: num,
  unread: z.array(z.string()).describe('Fields that could not be read clearly'),
})
type ReadOutT = z.infer<typeof ReadOut>

/** Claude's answer → what we keep. Bad numbers / dates become empty and are listed as unread (never fixed up). */
function clean(o: ReadOutT): GbpScreenshotRead['values'] & { periodShown: string | null; unread: string[] } {
  const unread = new Set(o.unread.filter((u): u is NumField | 'period' => u in FIELD_LABEL))
  const values = {} as Record<NumField, number | null>
  for (const f of NUM_FIELDS) {
    const v = o[f]
    if (v === null) values[f] = null
    else if (Number.isInteger(v) && v >= 0 && v <= 100_000_000) values[f] = v
    else {
      values[f] = null
      unread.add(f)
    }
  }
  let from = o.periodFrom
  let to = o.periodTo
  const valid = (d: string | null) => !!d && DAY.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d
  if (!valid(from) || !valid(to) || from! > to! || to! > latestToday() || unread.has('period')) {
    from = null
    to = null
    unread.add('period')
  }
  return { periodFrom: from, periodTo: to, ...values, periodShown: o.periodShown ? o.periodShown.trim().slice(0, 60) : null, unread: [...unread] }
}

type Row = { id: string; summary: string; payload: ReturnType<typeof clean>; created_at: string }
const toRead = (r: Row): GbpScreenshotRead => {
  const { periodShown, unread, ...values } = r.payload
  return { id: r.id, createdAt: r.created_at, summary: r.summary, periodShown, unread, unreadLabels: unread.map((u) => FIELD_LABEL[u as NumField | 'period'] ?? u), values }
}

/** The open ("Ready to review") GBP read for a client (by site id), or null. Added to the `local` state by the API. */
export async function gbpReadFor(siteId: string): Promise<GbpScreenshotRead | null> {
  const c = await client(siteId)
  return openGbpRead(c.id)
}

async function openGbpRead(clientId: string): Promise<GbpScreenshotRead | null> {
  const r = must(await db().from('seo_autofill').select('id, summary, payload, created_at').eq('client_id', clientId).eq('kind', KIND).eq('status', 'ready').order('created_at', { ascending: false }).limit(1), 'Loading the screenshot read') as Row[]
  return r[0] ? toRead(r[0]) : null
}

/** Before the call: input tokens (free count, image included) + a generous output guess. */
export async function estimateGbpShot(siteId: string, raw: unknown): Promise<ScreenshotEstimate> {
  await client(siteId)
  const image = imageOf((raw as { image?: unknown } | null)?.image)
  const t = AI_TASKS[TASK]
  const inputTokens = (await countInputTokens(t.model, SYSTEM, USER, image)) + 300 // + the output schema
  return { model: AI_MODELS[t.model].label, inputTokens, outputTokens: t.outBase, costUsd: costUsd(t.model, inputTokens, t.outBase) }
}

/** One Claude call on the image → saved as "Ready to review" (the previous open read is superseded). Image not kept. */
export async function readGbpShot(siteId: string, raw: unknown): Promise<GbpScreenshotRead> {
  const c = await client(siteId)
  const image = imageOf((raw as { image?: unknown } | null)?.image)
  const { data, logId } = await callStructured({ task: TASK, clientId: c.id, model: AI_TASKS[TASK].model, system: SYSTEM, user: USER, image, schema: ReadOut, maxTokens: 4000, effort: 'low' })
  if (!data.isGbpPerformance) throw new ScreenshotInputError('That doesn’t look like a GBP Performance screenshot. Nothing was saved. Take it from GBP › Performance and try again.')
  const payload = clean(data)
  const read = NUM_FIELDS.filter((f) => payload[f] !== null).length
  if (!read) throw new ScreenshotInputError('No numbers could be read from that screenshot. Nothing was saved. Try a sharper or less cropped one.')
  const period = payload.periodFrom && payload.periodTo ? `${payload.periodFrom} to ${payload.periodTo}` : 'period not read (pick it)'
  const summary = `GBP screenshot · ${period} · ${payload.views ?? '—'} views · ${payload.calls ?? '—'} calls`.slice(0, 300)
  must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('client_id', c.id).eq('kind', KIND).eq('status', 'ready'), 'Saving the screenshot read')
  const row = must(
    await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: KIND, source: 'claude', status: 'ready', summary, payload, item_count: read, ai_log_id: logId }).select('id, summary, payload, created_at').single(),
    'Saving the screenshot read',
  ) as Row
  return toRead(row)
}

async function openRow(clientId: string, id: unknown): Promise<Row> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new ScreenshotInputError('That screenshot read doesn’t exist.')
  const r = must(await db().from('seo_autofill').select('id, summary, payload, created_at, status').eq('client_id', clientId).eq('kind', KIND).eq('id', id).maybeSingle(), 'Loading the screenshot read') as (Row & { status: string }) | null
  if (!r) throw new ScreenshotInputError('That screenshot read doesn’t exist.')
  if (r.status !== 'ready') throw new ScreenshotInputError('That screenshot read was already approved or discarded.')
  return r
}

/** Angel's checked numbers (the GBP form) go through the normal GBP save; then the read is marked approved. */
export async function approveGbpShot(siteId: string, raw: unknown): Promise<GbpSnapshot> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; input?: unknown }
  const r = await openRow(c.id, b.id)
  const snapshot = await saveGbp(siteId, b.input) // same checks as typing it in (period, numbers, rating)
  must(await db().from('seo_autofill').update({ status: 'approved', decided_at: new Date().toISOString(), applied_count: 1 }).eq('id', r.id).eq('status', 'ready'), 'Saving the screenshot read')
  return snapshot
}

/** Throws the read away (kept as rejected for the log, counts nowhere). */
export async function discardGbpShot(siteId: string, raw: unknown): Promise<{ ok: true }> {
  const c = await client(siteId)
  const r = await openRow(c.id, (raw as { id?: unknown } | null)?.id)
  must(await db().from('seo_autofill').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'ready'), 'Saving the screenshot read')
  return { ok: true }
}
