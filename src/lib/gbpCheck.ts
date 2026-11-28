// Phase 4a · GBP check (Sam Day 4) helpers shared by the server and the GBP check screen.
// Numbers: plain code only, from what was typed. Missing stays null ("—"), never 0.
import type { GbpFactorKey, MapCompetitor, MapServiceCode, ProfileCheckKey } from '../types/seo.js'

export const MAP_SERVICES: MapServiceCode[] = ['S1', 'S2', 'S3']

/** Up to 10 unpaid results per service (Sam: "count reviews for up to 10 unpaid results"). */
export const MAX_COMPETITORS = 10

/** Whitespark Local Search Ranking Factors: the top map factors Sam checks on Day 4 (number = Whitespark rank). */
export const GBP_FACTORS: { key: GbpFactorKey; no: number; label: string }[] = [
  { key: 'primary_category', no: 1, label: 'Primary GBP category' },
  { key: 'name_keywords', no: 3, label: 'Keywords in the real business name' },
  { key: 'open_hours', no: 5, label: 'Open at time of search (hours + holiday hours)' },
  { key: 'address_shown', no: 7, label: 'Address showing on GBP' },
  { key: 'additional_categories', no: 8, label: 'Additional GBP categories' },
  { key: 'reviews_text', no: 9, label: 'Number of reviews with text' },
  { key: 'review_recency', no: 11, label: 'Review recency' },
  { key: 'website_match', no: 15, label: 'Website name, phone match GBP' },
]

/** Day 4 worksheet 4 · profile check. */
export const PROFILE_CHECKS: { key: ProfileCheckKey; label: string }[] = [
  { key: 'name_hours', label: 'Name + hours (holiday hours too)' },
  { key: 'categories', label: 'Categories (only what they really do)' },
  { key: 'description', label: 'Description (750 characters, no em dashes, ends with a call to action)' },
  { key: 'attributes', label: 'Attributes / identifiers' },
  { key: 'main_services', label: 'Main services (remove ones Google auto-added)' },
  { key: 'contact_tested', label: 'Phone, website + booking link tested' },
  { key: 'photos', label: 'Photos, logo 720×720, cover 1024×576' },
]

export const DESCRIPTION_MAX = 750

const DAY_MS = 86_400_000
const dayNo = (d: string) => Date.parse(`${d}T12:00:00Z`) / DAY_MS

/**
 * Map pack numbers for one service (competitor rows only, top 10 by rank):
 * - avgReviews: total reviews ÷ rows with a review count (Sam: total ÷ results counted). null if none typed.
 * - pace: a ballpark of reviews per month. Each competitor's newest review N days before the check date ≈ one review
 *   per N days ≈ 30 ÷ N a month; the median over competitors with a date. null if no dates.
 * - goal: a monthly review ask that beats the pace: pace rounded up + 1, at least 2, at most 10
 *   (Sam: ~2 a quarter → ask 2–3 a month; fast-job industries 5–10+).
 */
export function mapPackStats(rows: MapCompetitor[], checkedOn: string | null, today: string) {
  const comps = rows
    .filter((r) => !r.isClient)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, MAX_COMPETITORS)
  const counted = comps.filter((r) => r.reviews !== null)
  const avgReviews = counted.length ? Math.round(counted.reduce((s, r) => s + (r.reviews ?? 0), 0) / counted.length) : null
  const ref = dayNo(checkedOn ?? today)
  const perMonth = comps
    .filter((r) => r.newestReviewOn)
    .map((r) => 30 / Math.max(1, ref - dayNo(r.newestReviewOn!)))
    .sort((a, b) => a - b)
  let pace: number | null = null
  if (perMonth.length) {
    const m = Math.floor(perMonth.length / 2)
    const median = perMonth.length % 2 ? perMonth[m] : (perMonth[m - 1] + perMonth[m]) / 2
    pace = Math.round(median * 10) / 10
  }
  const goal = pace === null ? null : Math.min(10, Math.max(2, Math.ceil(pace) + 1))
  return { counted: counted.length, avgReviews, datesUsed: perMonth.length, pace, goal }
}
