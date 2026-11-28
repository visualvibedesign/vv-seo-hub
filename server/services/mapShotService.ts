// Phase 4a step 4 · Map-pack rows read from a Google Maps / Pleper screenshot by Claude, saved as "Ready to review"
// (seo_autofill kind 'map_competitors', migration 0022). Nothing is in the competitor list until Angel checks the rows
// and approves; approving goes through the same rules as typing a row in (gbpCheckService).
//
// Privacy (CLAUDE.md): the image is used for ONE Claude call and never stored or logged. Claude's answer has fields
// for name, categories, reviews, rating and newest review only: no address, phone or website field, so none can be
// saved. A "name" that looks like a street address is dropped.
// Honesty: anything unclear is empty (never 0, never a guess). Ads / "Sponsored" results are skipped.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import { MAP_SERVICES, MAX_COMPETITORS } from '../../src/lib/gbpCheck.js'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import type { GbpCheckState, MapServiceCode, MapShotRead, MapShotRow, ScreenshotEstimate } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { latestToday } from '../utils/dates.js'
import { callStructured, countInputTokens } from './aiService.js'
import { clientRow } from './clientService.js'
import { checkCompetitor, competitorRow, existingRows, type ExistingRow, GbpCheckInputError, gbpCheckState, openMapRead } from './gbpCheckService.js'
import { imageOf } from './screenshotService.js'

const TASK = 'map_competitors' as const
const KIND = 'map_competitors' as const
const STEP = 3 // Day 4 · GBP check
const DAY = /^\d{4}-\d{2}-\d{2}$/

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new GbpCheckInputError('That client doesn’t exist.')
  return c
}

function service(v: unknown): MapServiceCode {
  if (!MAP_SERVICES.includes(v as MapServiceCode)) throw new GbpCheckInputError('Pick a service (S1, S2 or S3).')
  return v as MapServiceCode
}

const SYSTEM = `You read the local results list from a screenshot of a Google Maps search (sometimes with the PlePer or GMB Everywhere Chrome extension showing each business's categories), for an SEO agency that types them into its tool. A person checks your answer before it is used.

For each UNPAID business in the list, top to bottom, read exactly as shown:
- rank: its position among the unpaid results (1 = first unpaid result). Skip ads ("Sponsored", "Ad") completely and don't count them.
- name: the business name exactly as shown.
- primaryCategory: the main category (the one shown under the name, or the PlePer "primary" category).
- additionalCategories: other categories only if PlePer / GMB Everywhere lists them; otherwise an empty list.
- reviews: the review count (the number in brackets next to the stars). rating: the star rating (like 4.8).
- newestReviewOn: YYYY-MM-DD only if an exact date with the year is clearly shown for the newest review; otherwise null. Never turn "2 weeks ago" into a date.

Rules:
- Copy numbers exactly. If something is cut off, blurry or not shown, use null (or an empty list). Never use 0 for something you can't see.
- Never copy addresses, phone numbers, websites, hours or review text. There are no fields for them.
- Skip a row whose name is cut off or unreadable, and say so in notes.
- searchShown: the text in the Maps search box, exactly, or null if not visible.
- notes: short notes on what you skipped or couldn't read (for example "2 ads skipped", "row 6 cut off").
- isMapsList: false if this isn't a Google Maps (or Google local results) list of businesses.
- At most 20 rows.`

const USER = 'Read the unpaid businesses from this Google Maps screenshot.'

const ReadOut = z.object({
  isMapsList: z.boolean(),
  searchShown: z.string().nullable(),
  rows: z.array(
    z.object({
      rank: z.number().nullable(),
      name: z.string(),
      primaryCategory: z.string().nullable(),
      additionalCategories: z.array(z.string()),
      reviews: z.number().nullable(),
      rating: z.number().nullable(),
      newestReviewOn: z.string().nullable(),
    }),
  ),
  notes: z.array(z.string()),
})
type ReadOutT = z.infer<typeof ReadOut>

const short = (v: string | null | undefined, max: number) => {
  const t = (v ?? '').trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, max) : null
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Claude's answer → what we keep. Bad values become empty (never fixed up); address-like names are dropped. */
export function cleanMapRead(o: ReadOutT, clientName: string): { searchShown: string | null; rows: MapShotRow[]; notes: string[] } {
  const notes = o.notes.map((n) => short(n, 160)).filter((n): n is string => !!n).slice(0, 10)
  const me = norm(clientName)
  const rows: MapShotRow[] = []
  const seen = new Set<string>()
  for (const r of o.rows.slice(0, 20)) {
    const name = short(r.name, 120)
    if (!name) continue
    if (looksLikeAddress(name)) {
      notes.push('A row that looked like an address was left out.')
      continue
    }
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const okDate = r.newestReviewOn && DAY.test(r.newestReviewOn) && new Date(`${r.newestReviewOn}T12:00:00Z`).toISOString().slice(0, 10) === r.newestReviewOn && r.newestReviewOn <= latestToday()
    const cats = r.additionalCategories.map((x) => short(x, 120)).filter((x): x is string => !!x && !looksLikeAddress(x))
    rows.push({
      rank: Number.isInteger(r.rank) && r.rank! >= 1 && r.rank! <= 20 ? r.rank : null,
      name,
      primaryCategory: short(r.primaryCategory, 120),
      additionalCategories: [...new Set(cats)].slice(0, 12),
      reviews: Number.isInteger(r.reviews) && r.reviews! >= 0 && r.reviews! <= 1_000_000 ? r.reviews : null,
      rating: typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating * 10) / 10 : null,
      newestReviewOn: okDate ? r.newestReviewOn : null,
      looksLikeClient: !!me && (norm(name) === me || norm(name).includes(me) || (norm(name).length > 3 && me.includes(norm(name)))),
    })
  }
  return { searchShown: short(o.searchShown, 200), rows, notes }
}

/** Before the call: input tokens (free count, image included) + a generous output guess. */
export async function estimateMapShot(siteId: string, raw: unknown): Promise<ScreenshotEstimate> {
  await client(siteId)
  const image = imageOf((raw as { image?: unknown } | null)?.image)
  const t = AI_TASKS[TASK]
  const inputTokens = (await countInputTokens(t.model, SYSTEM, USER, image)) + 400 // + the output schema
  return { model: AI_MODELS[t.model].label, inputTokens, outputTokens: t.outBase, costUsd: costUsd(t.model, inputTokens, t.outBase) }
}

/** One Claude call on the image → saved as "Ready to review" for one service (an earlier open read is superseded). */
export async function readMapShot(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { image?: unknown; category?: unknown }
  const category = service(b.category)
  const image = imageOf(b.image)
  const { data, logId } = await callStructured({ task: TASK, clientId: c.id, model: AI_TASKS[TASK].model, system: SYSTEM, user: USER, image, schema: ReadOut, maxTokens: 6000, effort: 'low' })
  if (!data.isMapsList) throw new GbpCheckInputError('That doesn’t look like a Google Maps results list. Nothing was saved. Search the service in Google Maps and screenshot the list.')
  const payload = { category, ...cleanMapRead(data, c.name) }
  if (!payload.rows.length) throw new GbpCheckInputError('No businesses could be read from that screenshot. Nothing was saved. Try a sharper or less cropped one.')
  const summary = `Maps screenshot · ${category} · ${payload.rows.length} businesses${payload.searchShown ? ` · “${payload.searchShown}”` : ''}`.slice(0, 300)
  must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('client_id', c.id).eq('kind', KIND).eq('status', 'ready'), 'Saving the screenshot read')
  must(await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: KIND, source: 'claude', status: 'ready', summary, payload, item_count: payload.rows.length, ai_log_id: logId }), 'Saving the screenshot read')
  return gbpCheckState(siteId)
}

async function openRead(clientId: string, id: unknown): Promise<MapShotRead> {
  const r = await openMapRead(clientId)
  if (!r || r.id !== id) throw new GbpCheckInputError('That screenshot read was already approved or discarded. Reload the page.')
  return r
}

/**
 * Angel's checked rows go in through the normal competitor rules. A row whose name is already in the list (same kind:
 * competitor / client) updates that row, keeping its values where the reviewed row is empty; a new name is added.
 * Everything is checked first: if one row breaks a rule, nothing is saved.
 */
export async function approveMapShot(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { id?: unknown; rows?: unknown }
  const read = await openRead(c.id, b.id)
  if (!Array.isArray(b.rows) || !b.rows.length) throw new GbpCheckInputError('Keep at least one row, or discard the read.')
  if (b.rows.length > MAX_COMPETITORS + 1) throw new GbpCheckInputError(`Keep ${MAX_COMPETITORS} competitors at most (+ your row).`)
  const rows = b.rows.map((r) => competitorRow(c.name, { ...(r as object), category: read.category }))
  const existing = await existingRows(c.id, read.category)
  const full = must(await db().from('seo_map_competitors').select('*').eq('client_id', c.id).eq('category_code', read.category), 'Loading the map competitors') as Record<string, unknown>[]

  // Plan + check every row against the list as it will be (no writes yet).
  let list: ExistingRow[] = existing.map((r) => ({ ...r }))
  const plan: { id: string | null; row: ReturnType<typeof competitorRow> }[] = []
  for (const row of rows) {
    const match = list.find((r) => r.is_client === row.is_client && r.name.toLowerCase() === row.name.toLowerCase())
    const id = match && existing.some((e) => e.id === match.id) ? match.id : null
    let merged = row
    if (id) {
      const old = full.find((f) => f.id === id)!
      merged = {
        ...row,
        rank: row.rank ?? (old.rank as number | null),
        primary_category: row.primary_category ?? (old.primary_category as string | null),
        additional_categories: row.additional_categories.length ? row.additional_categories : ((old.additional_categories as string[]) ?? []),
        reviews: row.reviews ?? (old.reviews as number | null),
        rating: row.rating ?? (old.rating === null ? null : Number(old.rating)),
        newest_review_on: row.newest_review_on ?? (old.newest_review_on as string | null),
        note: row.note ?? (old.note as string | null),
      }
    }
    checkCompetitor(merged, list.filter((r) => r.id !== id))
    if (id) list = list.map((r) => (r.id === id ? { ...r, rank: merged.rank, name: merged.name } : r))
    else list.push({ id: `new-${plan.length}`, is_client: merged.is_client, rank: merged.rank, name: merged.name })
    plan.push({ id, row: merged })
  }

  let sort = existing.length
  for (const p of plan) {
    if (p.id) must(await db().from('seo_map_competitors').update(p.row).eq('client_id', c.id).eq('id', p.id), 'Saving the competitors')
    else must(await db().from('seo_map_competitors').insert({ ...p.row, client_id: c.id, sort: sort++ }), 'Saving the competitors')
  }
  must(await db().from('seo_autofill').update({ status: 'approved', decided_at: new Date().toISOString(), applied_count: plan.length }).eq('id', read.id).eq('status', 'ready'), 'Saving the screenshot read')
  return gbpCheckState(siteId)
}

/** Throws the read away (kept as rejected for the log, counts nowhere). */
export async function discardMapShot(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const read = await openRead(c.id, (raw as { id?: unknown } | null)?.id)
  must(await db().from('seo_autofill').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', read.id).eq('status', 'ready'), 'Saving the screenshot read')
  return gbpCheckState(siteId)
}
