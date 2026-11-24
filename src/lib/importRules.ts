// CSV import rules shared by the browser (wizard) and the server (import plan). No CSV library here.
// Rules (docs/phase-1-plan.md §3): volumes exactly as exported, skip exact duplicates only, flag missing data.
import type { ImportField, ImportReport, ImportSource } from '../types/seo.js'

// ---- Keywords ------------------------------------------------------------------------

/** The keyword as stored: trimmed, single spaces (letters/case kept as exported). */
export function cleanKeyword(k: string): string {
  return k.trim().replace(/\s+/g, ' ')
}

/** Exact-duplicate key: same text ignoring case and extra spaces (matches the DB check on keyword_key). */
export function keywordKey(k: string): string {
  return cleanKeyword(k).toLowerCase()
}

/** Street words that follow a house number ("2627 hylan blvd"). */
const STREET =
  'blvd|boulevard|ave|avenue|av|st|street|rd|road|dr|drive|ln|lane|pl|place|ct|court|hwy|highway|pkwy|parkway|way|ter|terrace|cir|circle|sq|square|tpke|turnpike|pike|trl|trail|loop|row|plz|plaza'
const ADDRESS = new RegExp(`(^|\\s)\\d{1,6}[a-z]?\\s+(?:[a-z0-9.'-]+\\s+){1,4}(${STREET})\\.?(\\s|$)`, 'i')

/**
 * "Looks like an address": a house number + up to 4 words + a street word (blvd, ave, st, rd…).
 * Such keywords are held back on import until Angel OKs them: a private address must never be stored.
 */
export function looksLikeAddress(k: string): boolean {
  return ADDRESS.test(cleanKeyword(k))
}

// ---- Numbers (Semrush + Sheet). Blank / "n/a" = null ("no data"), never 0. ----------------

/** "74,000" → 74000, "110" → 110, "0" → 0, "" / "n/a" / "-" → null. Ranges or decimals → null (not a Semrush volume). */
export function parseVolume(v: string | undefined): number | null {
  const s = (v ?? '').trim().replace(/,/g, '')
  return /^\d+$/.test(s) ? Number(s) : null
}

/** KD 0–100 (whole number) or null. */
export function parseKd(v: string | undefined): number | null {
  const s = (v ?? '').trim().replace(/%$/, '')
  if (!/^\d+(\.0+)?$/.test(s)) return null
  const n = Math.round(Number(s))
  return n >= 0 && n <= 100 ? n : null
}

/** CPC in USD ("2.22", "$2.22", "0.00") or null. */
export function parseCpc(v: string | undefined): number | null {
  const s = (v ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s) * 100) / 100 : null
}

/** Sheet "Role" → our role. Unknown → undefined (reported in the preview). */
export function parseRole(v: string | undefined): 'primary' | 'secondary' | 'faq' | 'near_me' | undefined {
  const s = (v ?? '').trim().toLowerCase()
  if (s === 'primary') return 'primary'
  if (s === 'secondary') return 'secondary'
  if (s === 'faq' || s === 'faq / content' || s === 'faq/content' || s === 'content') return 'faq'
  if (s === 'near me' || s === 'near_me') return 'near_me'
  return undefined
}

// ---- Sources, reports, column matching ------------------------------------------------------

export const SOURCE_LABEL: Record<ImportSource, string> = { kp: 'Keyword Planner', semrush: 'Semrush', sheet: 'Sheet (testing)' }

export const REPORTS: { report: ImportReport; source: ImportSource; label: string; hint: string }[] = [
  { report: 'kp_ideas', source: 'kp', label: 'Discover new keywords', hint: 'KP “Keyword Stats” export' },
  { report: 'kp_volumes', source: 'kp', label: 'Search volume and forecasts', hint: 'KP “Saved Keywords Stats” export' },
  { report: 'keyword_magic', source: 'semrush', label: 'Keyword Magic Tool', hint: 'broad-match / all-keywords export' },
  { report: 'keyword_overview', source: 'semrush', label: 'Keyword Overview (bulk)', hint: 'bulk export' },
  { report: 'keyword_gap', source: 'semrush', label: 'Keyword Gap', hint: 'gap.keywords export' },
  { report: 'master_db', source: 'sheet', label: 'Master Keyword Database', hint: 'Google Sheet tab as CSV (testing only)' },
]

export const sourceOf = (report: ImportReport): ImportSource => REPORTS.find((r) => r.report === report)!.source

/** Which fields each source uses (keyword is always required). */
export const SOURCE_FIELDS: Record<ImportSource, ImportField[]> = {
  kp: ['keyword', 'volume', 'segment'],
  semrush: ['keyword', 'volume', 'kd', 'cpc', 'intent'],
  sheet: ['keyword', 'role', 'service', 'intent', 'kp', 'volume', 'kd', 'cpc'],
}

export const FIELD_LABEL: Record<ImportField, string> = {
  keyword: 'Keyword',
  volume: 'Volume',
  kd: 'Keyword difficulty (KD)',
  cpc: 'CPC',
  intent: 'Intent',
  segment: 'Segment (KP location row)',
  role: 'Role',
  service: 'Service',
  kp: 'KP range',
}

/** Header names each field is matched to automatically (lowercase; "startsWith:" = prefix match). */
const ALIASES: Record<ImportSource, Partial<Record<ImportField, string[]>>> = {
  kp: { keyword: ['keyword'], volume: ['avg. monthly searches'], segment: ['segmentation'] },
  semrush: {
    keyword: ['keyword'],
    volume: ['volume', 'search volume'],
    kd: ['keyword difficulty', 'kd', 'kd %', 'kd%'],
    cpc: ['cpc (usd)', 'cpc', 'cpc ($)'],
    intent: ['intent', 'intents'],
  },
  sheet: {
    keyword: ['keyword'],
    role: ['role'],
    service: ['service'],
    intent: ['intent'],
    kp: ['startsWith:keyword planner vol', 'startsWith:kp vol', 'kp range'],
    volume: ['startsWith:semrush vol', 'volume'],
    kd: ['kd %', 'kd', 'keyword difficulty'],
    cpc: ['cpc ($)', 'cpc', 'cpc (usd)'],
  },
}

/** Auto-match columns: field → header (exact header text from the file). */
export function autoMatch(source: ImportSource, headers: string[]): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {}
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const field of SOURCE_FIELDS[source]) {
    for (const alias of ALIASES[source][field] ?? []) {
      const i = alias.startsWith('startsWith:') ? lower.findIndex((h) => h.startsWith(alias.slice(11))) : lower.indexOf(alias)
      if (i >= 0) {
        out[field] = headers[i]
        break
      }
    }
  }
  return out
}

/** Best guess of the report from the file's name, headers and title line. The person can change it. */
export function detectReport(fileName: string, headers: string[], titleLine: string): ImportReport {
  const h = headers.map((x) => x.trim().toLowerCase())
  const name = fileName.toLowerCase()
  if (h.includes('avg. monthly searches')) return h.includes('segmentation') || /saved keywords/i.test(titleLine) ? 'kp_volumes' : 'kp_ideas'
  if (h.includes('role') && h.includes('service')) return 'master_db'
  if (name.startsWith('gap.') || h.includes('competition density')) return 'keyword_gap'
  if (name.includes('_bulk_')) return 'keyword_overview'
  return 'keyword_magic'
}
