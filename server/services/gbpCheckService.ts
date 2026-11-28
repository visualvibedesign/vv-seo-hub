// Phase 4a · GBP check (Sam Day 4, docs/phase-4-plan.md, migration 0022):
// - Map pack per service S1–S3: the Maps search used + rows (rank, name, categories, reviews, rating, newest review),
//   plus the client's own row (is_client). Numbers exactly as typed; missing = null, never 0.
// - Whitespark top map factors: To check / OK / Needs work / N/A + note.
// - Business details: PUBLIC fields only. There is no address field anywhere: "address shown?" is yes / no.
//   Any text that looks like a street address (house number + street word) is refused.
import type { GbpCheckState, GbpFactor, GbpFactorKey, GbpFactorStatus, GbpProfile, MapCompetitor, MapSearch, MapServiceCode, ProfileCheckKey } from '../../src/types/seo.js'
import { DESCRIPTION_MAX, GBP_FACTORS, MAP_SERVICES, MAX_COMPETITORS, PROFILE_CHECKS } from '../../src/lib/gbpCheck.js'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import { db, must } from '../clients/supabase.js'
import { latestToday } from '../utils/dates.js'
import { clientRow } from './clientService.js'

export class GbpCheckInputError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new GbpCheckInputError('That client doesn’t exist.')
  return c
}

function service(v: unknown): MapServiceCode {
  if (!MAP_SERVICES.includes(v as MapServiceCode)) throw new GbpCheckInputError('Pick a service (S1, S2 or S3).')
  return v as MapServiceCode
}

/** Trimmed single-spaced text, null when empty; too long or address-like is refused (never cut silently). */
function text(v: unknown, what: string, max: number, keepLines = false): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new GbpCheckInputError(`${what}: text only.`)
  const t = keepLines ? v.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n').trim() : v.trim().replace(/\s+/g, ' ')
  if (!t) return null
  if (t.length > max) throw new GbpCheckInputError(`${what}: ${max} characters at most (now ${t.length}).`)
  if (t.split(/[\n,;|·]/).some((part) => looksLikeAddress(part))) throw new GbpCheckInputError(`${what}: that looks like a street address. A private address is never stored here.`)
  return t
}

function list(v: unknown, what: string, maxItems: number, maxLen: number): string[] {
  if (v === null || v === undefined) return []
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\n,]/) : null
  if (!arr) throw new GbpCheckInputError(`${what}: a list.`)
  const out = [...new Set(arr.map((x) => text(x, what, maxLen)).filter((x): x is string => !!x))]
  if (out.length > maxItems) throw new GbpCheckInputError(`${what}: ${maxItems} at most.`)
  return out
}

function day(v: unknown, what: string, allowFuture = false): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new GbpCheckInputError(`${what}: pick a date.`)
  if (!allowFuture && v > latestToday()) throw new GbpCheckInputError(`${what} can’t be in the future.`)
  return v
}

function whole(v: unknown, what: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new GbpCheckInputError(`${what}: a whole number from ${min} to ${max}, or leave it empty.`)
  return n
}

function rating(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1 || n > 5) throw new GbpCheckInputError('Rating: a number from 1 to 5 (like 4.8), or leave it empty.')
  return Math.round(n * 10) / 10
}

function link(v: unknown, what: string): string | null {
  const t = text(v, what, 300)
  if (t && !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(t)) throw new GbpCheckInputError(`${what}: a web address (like example.com/page).`)
  return t
}

// ---- Rows -----------------------------------------------------------------------------------------------------

type SearchRow = { category_code: MapServiceCode; search: string | null; checked_on: string | null; results_counted: number | null }
type CompRow = { id: string; category_code: MapServiceCode; is_client: boolean; rank: number | null; name: string; primary_category: string | null; additional_categories: string[]; reviews: number | null; rating: number | string | null; newest_review_on: string | null; note: string | null }
type ProfileRow = {
  business_name: string | null; website: string | null; phone: string | null; email: string | null; primary_category: string | null; additional_categories: string[]
  service_areas: string | null; hours: string | null; holiday_hours: string | null; socials: string[]; booking_url: string | null; review_url: string | null
  description: string | null; address_shown: boolean | null; profile_checks: GbpProfile['profileChecks']; checked_on: string | null; waiting_on_google: string | null; check_again_on: string | null
}

const compOut = (r: CompRow): MapCompetitor => ({
  id: r.id,
  category: r.category_code,
  isClient: r.is_client,
  rank: r.rank,
  name: r.name,
  primaryCategory: r.primary_category,
  additionalCategories: r.additional_categories ?? [],
  reviews: r.reviews,
  rating: r.rating === null ? null : Number(r.rating),
  newestReviewOn: r.newest_review_on,
  note: r.note,
})

const EMPTY_PROFILE: GbpProfile = {
  businessName: null, website: null, phone: null, email: null, primaryCategory: null, additionalCategories: [], serviceAreas: null, hours: null, holidayHours: null,
  socials: [], bookingUrl: null, reviewUrl: null, description: null, addressShown: null, profileChecks: {}, checkedOn: null, waitingOnGoogle: null, checkAgainOn: null,
}

const profileOut = (r: ProfileRow | null): GbpProfile =>
  r
    ? {
        businessName: r.business_name, website: r.website, phone: r.phone, email: r.email, primaryCategory: r.primary_category, additionalCategories: r.additional_categories ?? [],
        serviceAreas: r.service_areas, hours: r.hours, holidayHours: r.holiday_hours, socials: r.socials ?? [], bookingUrl: r.booking_url, reviewUrl: r.review_url,
        description: r.description, addressShown: r.address_shown, profileChecks: r.profile_checks ?? {}, checkedOn: r.checked_on, waitingOnGoogle: r.waiting_on_google, checkAgainOn: r.check_again_on,
      }
    : { ...EMPTY_PROFILE }

// ---- Read -----------------------------------------------------------------------------------------------------

export async function gbpCheckState(siteId: string): Promise<GbpCheckState> {
  const c = await client(siteId)
  const [cats, searches, comps, factors, profile, gbp] = await Promise.all([
    db().from('seo_client_categories').select('code, name').eq('client_id', c.id).in('code', MAP_SERVICES),
    db().from('seo_map_searches').select('category_code, search, checked_on, results_counted').eq('client_id', c.id),
    db().from('seo_map_competitors').select('*').eq('client_id', c.id).order('category_code').order('is_client').order('rank', { nullsFirst: false }).order('sort'),
    db().from('seo_gbp_factors').select('factor_key, status, note').eq('client_id', c.id),
    db().from('seo_gbp_profile').select('*').eq('client_id', c.id).maybeSingle(),
    db().from('seo_gbp_snapshots').select('reviews, rating, newest_review_on, period_to').eq('client_id', c.id).not('reviews', 'is', null).order('period_to', { ascending: false }).limit(1),
  ])
  const catRows = must(cats, 'Loading the services') as { code: MapServiceCode; name: string | null }[]
  const searchRows = must(searches, 'Loading the Maps searches') as SearchRow[]
  const factorRows = must(factors, 'Loading the map factors') as { factor_key: GbpFactorKey; status: GbpFactorStatus; note: string | null }[]
  const g = (must(gbp, 'Loading GBP numbers') as { reviews: number | null; rating: number | string | null; newest_review_on: string | null; period_to: string }[])[0]
  return {
    clientName: c.name,
    services: Object.fromEntries(MAP_SERVICES.map((k) => [k, catRows.find((r) => r.code === k)?.name?.trim() || null])) as GbpCheckState['services'],
    searches: MAP_SERVICES.map((k): MapSearch => {
      const r = searchRows.find((s) => s.category_code === k)
      return { category: k, search: r?.search ?? null, checkedOn: r?.checked_on ?? null, resultsCounted: r?.results_counted ?? null }
    }),
    competitors: (must(comps, 'Loading the map competitors') as CompRow[]).map(compOut),
    factors: GBP_FACTORS.map((f): GbpFactor => {
      const r = factorRows.find((x) => x.factor_key === f.key)
      return { key: f.key, status: r?.status ?? 'to_check', note: r?.note ?? null }
    }),
    profile: profileOut(must(profile, 'Loading the business details') as ProfileRow | null),
    fromGbp: g ? { reviews: g.reviews, rating: g.rating === null ? null : Number(g.rating), newestReviewOn: g.newest_review_on, periodTo: g.period_to } : null,
  }
}

// ---- Writes (each returns the whole state, like the Pages screens) --------------------------------------------

/** The Maps search used for one service: search text, date checked, results counted. */
export async function saveMapSearch(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  const row = {
    client_id: c.id,
    category_code: service(b.category),
    search: text(b.search, 'Maps search', 200),
    checked_on: day(b.checkedOn, 'Date checked'),
    results_counted: whole(b.resultsCounted, 'Results counted', 0, 20),
  }
  must(await db().from('seo_map_searches').upsert(row, { onConflict: 'client_id,category_code' }), 'Saving the Maps search')
  return gbpCheckState(siteId)
}

/** Adds or edits one map-pack row. The client's own row: at most one per service, name defaults to the client. */
export async function saveMapCompetitor(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  const id = b.id === null || b.id === undefined || b.id === '' ? null : String(b.id)
  if (id && !UUID.test(id)) throw new GbpCheckInputError('Pick a row to edit.')
  const category = service(b.category)
  const isClient = b.isClient === true
  const name = text(b.name, 'Business name', 120) ?? (isClient ? c.name.slice(0, 120) : null)
  if (!name) throw new GbpCheckInputError('Type the business name.')
  const rank = whole(b.rank, 'Rank', 1, 20) // the client's row: where it showed up, or empty ("—") if not in the pack
  const row = {
    client_id: c.id,
    category_code: category,
    is_client: isClient,
    rank,
    name,
    primary_category: text(b.primaryCategory, 'Primary category', 120),
    additional_categories: list(b.additionalCategories, 'Additional categories', 12, 120),
    reviews: whole(b.reviews, 'Reviews', 0, 1_000_000),
    rating: rating(b.rating),
    newest_review_on: day(b.newestReviewOn, 'Newest review'),
    note: text(b.note, 'Note', 300),
  }
  const existing = must(await db().from('seo_map_competitors').select('id, is_client, rank, name').eq('client_id', c.id).eq('category_code', category), 'Loading the map competitors') as { id: string; is_client: boolean; rank: number | null; name: string }[]
  const others = existing.filter((r) => r.id !== id)
  if (id && others.length === existing.length) throw new GbpCheckInputError('That row is gone. Reload the page.')
  if (isClient && others.some((r) => r.is_client)) throw new GbpCheckInputError(`${category} already has the client’s own row. Edit that one.`)
  if (!isClient && others.filter((r) => !r.is_client).length >= MAX_COMPETITORS) throw new GbpCheckInputError(`${category} has ${MAX_COMPETITORS} competitors already (Sam counts up to 10 unpaid results).`)
  if (!isClient && rank !== null && others.some((r) => !r.is_client && r.rank === rank)) throw new GbpCheckInputError(`Rank ${rank} is already used in ${category}.`)
  if (others.some((r) => r.is_client === isClient && r.name.toLowerCase() === name.toLowerCase())) throw new GbpCheckInputError(`“${name}” is already in ${category}.`)
  if (id) must(await db().from('seo_map_competitors').update(row).eq('client_id', c.id).eq('id', id), 'Saving the competitor')
  else must(await db().from('seo_map_competitors').insert({ ...row, sort: existing.length }), 'Adding the competitor')
  return gbpCheckState(siteId)
}

export async function deleteMapCompetitor(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const id = String(((raw ?? {}) as { id?: unknown }).id ?? '')
  if (!UUID.test(id)) throw new GbpCheckInputError('Pick a row to remove.')
  must(await db().from('seo_map_competitors').delete().eq('client_id', c.id).eq('id', id), 'Removing the competitor')
  return gbpCheckState(siteId)
}

const STATUSES: GbpFactorStatus[] = ['to_check', 'ok', 'needs_work', 'na']

export async function saveGbpFactor(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  if (!GBP_FACTORS.some((f) => f.key === b.factor)) throw new GbpCheckInputError('Pick a factor.')
  if (!STATUSES.includes(b.status as GbpFactorStatus)) throw new GbpCheckInputError('Status: To check, OK, Needs work or N/A.')
  must(
    await db().from('seo_gbp_factors').upsert({ client_id: c.id, factor_key: b.factor, status: b.status, note: text(b.note, 'Note', 300) }, { onConflict: 'client_id,factor_key' }),
    'Saving the factor',
  )
  return gbpCheckState(siteId)
}

/** Business details: the whole card is saved at once (an empty box clears that field). */
export async function saveGbpProfile(siteId: string, raw: unknown): Promise<GbpCheckState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Record<string, unknown>
  for (const k of Object.keys(b)) if (/address/i.test(k) && k !== 'addressShown') throw new GbpCheckInputError('A private address is never stored here. Only “address shown on GBP?” yes / no.')
  const description = text(b.description, 'Description', DESCRIPTION_MAX, true)
  if (description && /[—–]/.test(description)) throw new GbpCheckInputError('Description: no em or en dashes (Sam’s rule). Use a comma, a period or “and”.')
  const email = text(b.email, 'Email', 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GbpCheckInputError('Email: a public business email (like hello@example.com).')
  const phone = text(b.phone, 'Phone', 40)
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) throw new GbpCheckInputError('Phone: digits, spaces, + ( ) - only.')
  if (b.addressShown !== null && b.addressShown !== undefined && typeof b.addressShown !== 'boolean') throw new GbpCheckInputError('Address shown on GBP: yes or no.')
  const checksIn = (b.profileChecks ?? {}) as Record<string, unknown>
  if (typeof checksIn !== 'object' || Array.isArray(checksIn)) throw new GbpCheckInputError('Profile check: pick from the list.')
  const checks: GbpProfile['profileChecks'] = {}
  for (const [k, v] of Object.entries(checksIn)) {
    if (!PROFILE_CHECKS.some((p) => p.key === k)) throw new GbpCheckInputError('Profile check: pick from the list.')
    const x = (v ?? {}) as { done?: unknown; note?: unknown }
    checks[k as ProfileCheckKey] = { done: x.done === true, note: text(x.note, 'Profile check note', 200) }
  }
  const socials = list(b.socials, 'Social profiles', 10, 300)
  for (const s of socials) link(s, 'Social profiles')
  const row = {
    client_id: c.id,
    business_name: text(b.businessName, 'Business name', 160),
    website: link(b.website, 'Website'),
    phone,
    email,
    primary_category: text(b.primaryCategory, 'Primary category', 120),
    additional_categories: list(b.additionalCategories, 'Additional categories', 12, 120),
    service_areas: text(b.serviceAreas, 'Service areas', 500),
    hours: text(b.hours, 'Hours', 500, true),
    holiday_hours: text(b.holidayHours, 'Holiday hours', 300, true),
    socials,
    booking_url: link(b.bookingUrl, 'Booking link'),
    review_url: link(b.reviewUrl, 'Review link'),
    description,
    address_shown: (b.addressShown as boolean | null | undefined) ?? null,
    profile_checks: checks,
    checked_on: day(b.checkedOn, 'Date checked'),
    waiting_on_google: text(b.waitingOnGoogle, 'Waiting on Google', 300),
    check_again_on: day(b.checkAgainOn, 'Check again on', true),
  }
  must(await db().from('seo_gbp_profile').upsert(row, { onConflict: 'client_id' }), 'Saving the business details')
  return gbpCheckState(siteId)
}
