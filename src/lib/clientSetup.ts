// Fixed lists for client setup (Sam's Day 1), shared by the pages and the server.
import type { AccountKind, AccountStatus, AreaCode, CategoryCode } from '../types/seo.js'

/** Matrix rows first (Home + S1–S3), then FAQ (help pages: a cluster category, not a matrix row). */
export const CATEGORY_CODES: CategoryCode[] = ['Home', 'S1', 'S2', 'S3', 'FAQ']
export const AREA_CODES: AreaCode[] = ['A1', 'A2', 'A3']

export const CATEGORY_HINT: Record<CategoryCode, string> = {
  Home: 'The general search the home page targets (e.g. “Waxing”).',
  S1: 'Top service category: most money or most wanted.',
  S2: 'Second service category.',
  S3: 'Third service category.',
  FAQ: 'Help pages (FAQs, First timers). Not a matrix row.',
}

export const DEFAULT_FAQ_NAME = 'FAQ & help pages'

/** Day 1 account inventory. Status + next action only: never passwords or keys. */
export const ACCOUNTS: { kind: AccountKind; label: string; hint: string }[] = [
  { kind: 'domain_dns', label: 'Domain / DNS', hint: 'For Search Console TXT verification' },
  { kind: 'hosting', label: 'Hosting', hint: '' },
  { kind: 'platform', label: 'Website platform', hint: 'WordPress + Vibe Admin / Vibe SEO' },
  { kind: 'gbp', label: 'Google Business Profile', hint: 'Manager access' },
  { kind: 'gsc', label: 'Search Console', hint: 'Domain property' },
  { kind: 'ga4', label: 'Google Analytics (GA4)', hint: 'Goal: generate leads' },
  { kind: 'semrush', label: 'Semrush Position Tracking', hint: 'US (national), ~10 keywords' },
  { kind: 'whitespark', label: 'Whitespark geogrid', hint: 'Top 1–3 services, main city' },
  { kind: 'clarity', label: 'Microsoft Clarity', hint: 'Check privacy/consent first' },
  { kind: 'cloudflare', label: 'Cloudflare', hint: 'If used' },
  { kind: 'google_ads', label: 'Google Ads / Keyword Planner', hint: 'If used' },
  { kind: 'ai_visibility', label: 'AI visibility tool', hint: 'Optional' },
]
export const ACCOUNT_KINDS = ACCOUNTS.map((a) => a.kind)

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = { ready: 'Ready', pending: 'Pending', n_a: 'N/A' }

/** The hub workspace tabs SEO Hub replaces (Vibe SEO VVDA_SEO_Workspace), in the hub's order. */
export const CLIENT_TABS: { key: string; label: string; path: string; phase: string; live: boolean }[] = [
  { key: 'overview', label: 'Overview', path: '', phase: '1', live: true },
  { key: 'keywords', label: 'Keywords', path: 'keywords', phase: '1', live: false },
  { key: 'pages', label: 'Pages', path: 'pages', phase: '3', live: false },
  { key: 'plan', label: 'Site plan', path: 'plan', phase: '3', live: false },
  { key: 'reports', label: 'Reports', path: 'reports', phase: '2', live: false },
  { key: 'conversions', label: 'Conversions', path: 'conversions', phase: 'later', live: false },
  { key: 'log', label: 'Work log', path: 'log', phase: '5', live: false },
  { key: 'notes', label: 'Notes & links', path: 'notes', phase: '5', live: false },
]

/** What each not-yet-built tab will hold (shown on its "coming" card). */
export const TAB_COMING: Record<string, string> = {
  keywords: 'Keyword database, CSV import, 3×3 matrix and clusters. Being built now (phase 1, steps 4–8).',
  pages: 'Page list with keep / improve / new, keyword owner per page and SEO hotspots (title, meta, H1, URL).',
  plan: 'Ideal sitemap: site structure, page IDs and internal links. Later the redirects queue.',
  reports: 'Baseline vs results: Semrush rankings, Search Console, GA4, GBP numbers and the map grid.',
  conversions: 'Conversion insights (calls, forms, Clarity). Moves over from the agency hub later.',
  log: 'Every change pushed to the site through the Vibe SEO plugin, plus what we did each month.',
  notes: 'Goals, targets, notes and useful links for this client.',
}

/** Sam's process as one flow per client (context pack "Sam's process → SEO Hub steps"). */
export const SAM_STEPS: { n: number; title: string; day: string; phase: string; tab?: string }[] = [
  { n: 0, title: 'Client setup', day: 'Day 1', phase: '1' },
  { n: 1, title: 'Keywords', day: 'Day 2', phase: '1', tab: 'keywords' },
  { n: 2, title: 'Baseline', day: 'Day 3', phase: '2', tab: 'reports' },
  { n: 3, title: 'GBP check', day: 'Day 4', phase: '4' },
  { n: 4, title: 'Sitemap + hotspots', day: 'Day 5', phase: '3', tab: 'pages' },
  { n: 5, title: 'Page brief', day: 'Day 6', phase: '3' },
  { n: 6, title: 'GBP care', day: 'Day 7', phase: '4' },
  { n: 7, title: 'Link database', day: 'Days 8–9', phase: '4' },
  { n: 8, title: 'Results', day: 'Day 10 + monthly', phase: '2', tab: 'reports' },
]
