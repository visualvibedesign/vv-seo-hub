// Fixed lists for client setup (Sam's Day 1), shared by the pages and the server.
import type { AccountKind, AccountStatus, AreaCode, CategoryCode, ClientIndustry } from '../types/seo.js'

/** Industry templates (wizard step 2). What each fills in comes with the Templates step. */
export const INDUSTRIES: { key: ClientIndustry; label: string; hint: string }[] = [
  { key: 'waxing_beauty', label: 'Waxing & beauty salon', hint: 'Waxing, brows, lashes, facials.' },
  { key: 'med_spa', label: 'Med spa', hint: 'Injectables, laser, skin treatments.' },
  { key: 'home_services', label: 'Home services', hint: 'Contractors, cleaning, repairs, service-area businesses.' },
  { key: 'blank', label: 'Blank', hint: 'Start empty and fill everything in by hand.' },
]
export const INDUSTRY_KEYS = INDUSTRIES.map((i) => i.key)
export const industryLabel = (k: ClientIndustry | null) => INDUSTRIES.find((i) => i.key === k)?.label ?? null

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

/**
 * Day 1 account inventory (Sam's full list). Status + next action only: never passwords or keys.
 * `core` = the context pack's checklist (GSC, GA4, GBP, Semrush, Whitespark, Clarity): only these count toward
 * "accounts pending" and the guide's accounts tick (Angel, Nov 25). The rest sit under "More accounts".
 */
export const ACCOUNTS: { kind: AccountKind; label: string; hint: string; core: boolean }[] = [
  { kind: 'gsc', label: 'Search Console', hint: 'Domain property', core: true },
  { kind: 'ga4', label: 'GA4', hint: 'Goal: generate leads', core: true },
  { kind: 'gbp', label: 'Google Business Profile', hint: 'Manager access', core: true },
  { kind: 'semrush', label: 'Semrush', hint: 'Position Tracking, US (national), ~10 keywords', core: true },
  { kind: 'whitespark', label: 'Whitespark', hint: 'Geogrid: top 1–3 services, main city', core: true },
  { kind: 'clarity', label: 'Clarity', hint: 'Check privacy/consent first', core: true },
  { kind: 'domain_dns', label: 'Domain / DNS', hint: 'For Search Console TXT verification', core: false },
  { kind: 'hosting', label: 'Hosting', hint: '', core: false },
  { kind: 'platform', label: 'Website platform', hint: 'WordPress + Vibe Admin / Vibe SEO', core: false },
  { kind: 'cloudflare', label: 'Cloudflare', hint: 'If used', core: false },
  { kind: 'google_ads', label: 'Google Ads / Keyword Planner', hint: 'If used', core: false },
  { kind: 'ai_visibility', label: 'AI visibility tool', hint: 'Optional', core: false },
]
export const ACCOUNT_KINDS = ACCOUNTS.map((a) => a.kind)
export const CORE_ACCOUNT_KINDS = ACCOUNTS.filter((a) => a.core).map((a) => a.kind)

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = { ready: 'Ready', pending: 'Pending', n_a: 'N/A' }

/**
 * A client's sections (/clients/{site id}/<path>), grouped like the design's sidebar (docs/design/Sidebar.png,
 * Client.png): a few top items, then KEYWORDS, RESULTS, PAGES, LOCAL, SITE. `live` = built.
 * `tag` says when a section comes: 'P1' (phase 1, being built), 'P2'…'P4', 'Plugin' (needs the Vibe SEO
 * plugin), 'Later'. Only 'Later' shows in the sidebar; the others show on the section's "coming" card.
 */
export type ClientSection = { key: string; label: string; path: string; live: boolean; tag: string; group?: string }
export type ClientGroup = { key: string; label: string; items: ClientSection[] }

export const CLIENT_TOP: ClientSection[] = [
  { key: 'overview', label: 'Overview', path: '', live: true, tag: '' },
  { key: 'guide', label: 'Step-by-step guide', path: 'guide', live: true, tag: '' },
  { key: 'uploads', label: 'Uploads + auto-fill', path: 'uploads', live: true, tag: '' },
]

export const CLIENT_GROUPS: ClientGroup[] = [
  {
    key: 'keywords',
    label: 'Keywords',
    items: [
      { key: 'matrix', label: 'Matrix', path: 'keywords', live: true, tag: '' },
      { key: 'database', label: 'Database', path: 'keywords/database', live: true, tag: '' },
      { key: 'clusters', label: 'Clusters', path: 'keywords/clusters', live: true, tag: '' },
      { key: 'import', label: 'Import', path: 'keywords/import', live: true, tag: '' },
    ],
  },
  {
    key: 'results',
    label: 'Results',
    items: [
      { key: 'reports', label: 'Baseline + reports', path: 'reports', live: false, tag: 'P2' },
      { key: 'review', label: 'Day 10 review', path: 'review', live: false, tag: 'P2' },
    ],
  },
  {
    key: 'pages',
    label: 'Pages',
    items: [
      { key: 'pages', label: 'Sitemap + hotspots', path: 'pages', live: false, tag: 'P3' },
      { key: 'plan', label: 'Site plan', path: 'plan', live: false, tag: 'P3' },
      { key: 'briefs', label: 'Page briefs', path: 'briefs', live: false, tag: 'P3' },
    ],
  },
  {
    key: 'local',
    label: 'Local',
    items: [
      { key: 'gbp', label: 'GBP check', path: 'gbp', live: false, tag: 'P4' },
      { key: 'gbp-care', label: 'GBP care', path: 'gbp-care', live: false, tag: 'P4' },
      { key: 'links', label: 'Links', path: 'links', live: false, tag: 'P4' },
    ],
  },
  {
    key: 'site',
    label: 'Site',
    items: [
      { key: 'site', label: 'Connection + work log', path: 'site', live: false, tag: 'Plugin' },
      { key: 'notes', label: 'Notes & links', path: 'notes', live: false, tag: 'P1' },
      { key: 'conversions', label: 'Conversions', path: 'conversions', live: false, tag: 'Later' },
    ],
  },
]

/** Every client section, flat; grouped ones carry their group's label (for the breadcrumb). */
export const ALL_SECTIONS: ClientSection[] = [...CLIENT_TOP, ...CLIENT_GROUPS.flatMap((g) => g.items.map((s) => ({ ...s, group: g.label })))]

/** Hub pages (no client open). Clients are never listed in the sidebar (50+ clients): they live on All clients. */
export const HUB_SECTIONS: ClientSection[] = [
  { key: 'hub-overview', label: 'Overview', path: '/', live: true, tag: '' },
  { key: 'clients', label: 'All clients', path: '/clients', live: true, tag: '' },
  { key: 'templates', label: 'Templates', path: '/templates', live: true, tag: '' },
  { key: 'automation', label: 'Automation', path: '/automation', live: false, tag: 'P5' },
]

/** "Building now · phase 1", "Coming in phase 3", "Comes with the Vibe SEO plugin", "Coming later". */
export function comingLabel(s: ClientSection): string {
  if (s.tag === 'Later') return 'Coming later'
  if (s.tag === 'Plugin') return 'Comes with the Vibe SEO plugin'
  if (s.tag === 'P1') return 'Building now · phase 1'
  return `Coming in phase ${s.tag.slice(1)}`
}

/** What each not-yet-built section will hold (shown on its "coming" card). */
export const TAB_COMING: Record<string, string> = {
  guide: 'Sam’s 10 days as 9 steps for this client: tasks to tick, tools, a tip, a button to the right screen and Sam’s video. Progress is saved per client.',
  uploads: 'You upload, Claude fills, you approve. Each day lists the exact exports with “how to get this file” steps, one drop zone, what Claude filled (ready to review) and what needs you.',
  matrix: 'The 3×3 matrix: Home + S1–S3 × A1–A3, a primary keyword per cell with backups, N/A and Pending, plus Export tracked list.',
  clusters: 'One row per page: priority, primary keyword, secondary and FAQ keywords, and why. A keyword can only sit on one page.',
  reports: 'Baseline vs now: Semrush rankings, Search Console, GA4, GBP numbers, the map grid and a monthly report archive.',
  review: 'Day 10: start with the goal, compare like with like, work worth explaining, the six buckets, the client update and up to 3 next actions.',
  pages: 'Ideal sitemap (P1, P2… keep / improve / new) with the keyword owner per page and SEO hotspots: title, meta, H1, URL with live counters and a Google preview.',
  plan: 'How the pages connect (service first / location first / flat) and the redirects queue when a URL changes.',
  briefs: 'BrandScript once per client, then StoryBrand page copy (11 sections, V1 / V2). Only real facts, [brackets] for the rest.',
  gbp: 'Who’s in the map pack per service, the Whitespark top map factors and the public business details (private address never stored).',
  'gbp-care': 'Products (one per service page), the review email + tracker and a 13-week post calendar.',
  links: 'Citations in 3 waves (BrightLocal), Backlink Gap, local + premier links, and Sam’s Day 9 opportunity list.',
  site: 'Connect the site (coming soon): the per-site SEO Hub key, last check-in, push preview and the work log. Comes with the Vibe SEO plugin.',
  notes: 'Quick links to the client’s tools and the rules and decisions the team needs to remember.',
  conversions: 'Conversion insights (calls, forms, Clarity). Moves over from the agency hub later.',
  templates: 'One template per step of Sam’s 10 days (keyword research, 3×3 matrix, clusters, SEO hotspots, GBP posts, review email, citation waves). Set up once, applied to every new client.',
  automation: 'Slack alerts, the weekly SEO email, ClickUp lists and the Claude drafts queue. Nothing is published without a review.',
}
