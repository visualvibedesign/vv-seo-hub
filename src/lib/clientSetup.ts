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

/**
 * A client's sections in the sidebar (/clients/{site id}/<path>), in the order of the agency hub's
 * workspace that SEO Hub replaces (Vibe SEO VVDA_SEO_Workspace). `tag` shows on sections not built yet.
 */
export type ClientSection = { key: string; label: string; path: string; live: boolean; tag: string; children?: ClientSection[] }

export const CLIENT_SECTIONS: ClientSection[] = [
  { key: 'overview', label: 'Overview', path: '', live: true, tag: '' },
  {
    key: 'keywords',
    label: 'Keywords',
    path: 'keywords',
    live: true,
    tag: '',
    children: [
      { key: 'matrix', label: 'Matrix', path: 'keywords', live: false, tag: 'Step 6' },
      { key: 'database', label: 'Database', path: 'keywords/database', live: true, tag: '' },
      { key: 'clusters', label: 'Clusters', path: 'keywords/clusters', live: false, tag: 'Step 7' },
      { key: 'import', label: 'Import', path: 'keywords/import', live: true, tag: '' },
    ],
  },
  { key: 'pages', label: 'Pages', path: 'pages', live: false, tag: 'P3' },
  { key: 'plan', label: 'Site plan', path: 'plan', live: false, tag: 'P3' },
  { key: 'reports', label: 'Reports', path: 'reports', live: false, tag: 'P2' },
  { key: 'conversions', label: 'Conversions', path: 'conversions', live: false, tag: 'Later' },
  { key: 'log', label: 'Work log', path: 'log', live: false, tag: 'P5' },
  { key: 'notes', label: 'Notes & links', path: 'notes', live: false, tag: 'P5' },
]

/** Every section and sub-section, flat (the "Keywords" parent left out: its page is Matrix). */
export const ALL_SECTIONS: ClientSection[] = CLIENT_SECTIONS.flatMap((s) => (s.children ? s.children : [s]))

/** "Coming in phase 3", "Coming later", "Coming in step 5". */
export function comingLabel(s: ClientSection): string {
  if (s.tag === 'Later') return 'Coming later'
  if (s.tag.startsWith('P')) return `Coming in phase ${s.tag.slice(1)}`
  return `Building now · phase 1, ${s.tag.toLowerCase()}`
}

/** What each not-yet-built section will hold (shown on its "coming" card). */
export const TAB_COMING: Record<string, string> = {
  matrix: 'The 3×3 matrix: Home + S1–S3 × A1–A3, a primary keyword per cell with backups, N/A and Pending.',
  database: 'The master keyword database: roles, services, both volumes, missing-data flags, Track toggle and the editable KP range with bulk-set.',
  clusters: 'One row per page: priority, primary keyword, secondary and FAQ keywords, and why. A keyword can only sit on one page.',
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
  { n: 1, title: 'Keywords', day: 'Day 2', phase: '1', tab: 'keywords/import' },
  { n: 2, title: 'Baseline', day: 'Day 3', phase: '2', tab: 'reports' },
  { n: 3, title: 'GBP check', day: 'Day 4', phase: '4' },
  { n: 4, title: 'Sitemap + hotspots', day: 'Day 5', phase: '3', tab: 'pages' },
  { n: 5, title: 'Page brief', day: 'Day 6', phase: '3' },
  { n: 6, title: 'GBP care', day: 'Day 7', phase: '4' },
  { n: 7, title: 'Link database', day: 'Days 8–9', phase: '4' },
  { n: 8, title: 'Results', day: 'Day 10 + monthly', phase: '2', tab: 'reports' },
]
