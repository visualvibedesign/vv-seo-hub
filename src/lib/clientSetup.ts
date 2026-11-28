// Fixed lists for client setup (Sam's Day 1), shared by the pages and the server.
import type { AccountKind, AccountStatus, AreaCode, CategoryCode } from '../types/seo.js'

// Industries are a database list (seo_industries, migration 0009): src/hooks/useIndustries.ts.

/** An area's state code, or the client's main state when the area has none ("" only if both are empty). */
export const areaState = (area: { state?: string | null } | null | undefined, clientState: string | null | undefined) => (area?.state || clientState || '').trim()

/** Matrix rows first (Home + S1–S3), then FAQ (help pages: a cluster category, not a matrix row). */
export const CATEGORY_CODES: CategoryCode[] = ['Home', 'S1', 'S2', 'S3', 'FAQ']
export const AREA_CODES: AreaCode[] = ['A1', 'A2', 'A3']

export const CATEGORY_HINT: Record<CategoryCode, string> = {
  Home: 'The general search the home page targets (the main service, as people search it).',
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
export const ACCOUNTS: { kind: AccountKind; label: string; hint: string; core: boolean; home?: string }[] = [
  { kind: 'gsc', label: 'Search Console', hint: 'Domain property', core: true, home: 'https://search.google.com/search-console' },
  { kind: 'ga4', label: 'GA4', hint: 'Goal: generate leads', core: true, home: 'https://analytics.google.com/' },
  { kind: 'gbp', label: 'Google Business Profile', hint: 'Manager access', core: true, home: 'https://business.google.com/' },
  { kind: 'semrush', label: 'Semrush', hint: 'Position Tracking, US (national), ~10 keywords', core: true, home: 'https://www.semrush.com/projects/' },
  { kind: 'whitespark', label: 'Whitespark', hint: 'Geogrid: top 1–3 services, main city', core: true, home: 'https://app.whitespark.ca/' },
  { kind: 'clarity', label: 'Clarity', hint: 'Check privacy/consent first', core: true, home: 'https://clarity.microsoft.com/projects' },
  { kind: 'domain_dns', label: 'Domain / DNS', hint: 'For Search Console TXT verification', core: false },
  { kind: 'hosting', label: 'Hosting', hint: '', core: false },
  { kind: 'platform', label: 'Website platform', hint: 'WordPress + Vibe Admin / Vibe SEO', core: false },
  { kind: 'cloudflare', label: 'Cloudflare', hint: 'If used', core: false, home: 'https://dash.cloudflare.com/' },
  { kind: 'google_ads', label: 'Google Ads / Keyword Planner', hint: 'If used', core: false, home: 'https://ads.google.com/aw/keywordplanner/home' },
  { kind: 'ai_visibility', label: 'AI visibility tool', hint: 'Optional', core: false },
]
/** Two-letter icon per account tool (plain initials would clash: Clarity / Cloudflare, GA4 / Google Ads). */
export const ACCOUNT_ICON: Record<AccountKind, string> = { gsc: 'SC', ga4: 'GA', gbp: 'GB', semrush: 'SR', whitespark: 'WS', clarity: 'MC', domain_dns: 'DN', hosting: 'HO', platform: 'WP', cloudflare: 'CF', google_ads: 'KP', ai_visibility: 'AI' }
export const ACCOUNT_KINDS = ACCOUNTS.map((a) => a.kind)
export const CORE_ACCOUNT_KINDS = ACCOUNTS.filter((a) => a.core).map((a) => a.kind)

/**
 * Where "Open" goes: the client's own saved link, else the tool's main page (`home`). Website platform falls back
 * to the client's site. Null = nothing to open yet (Domain / DNS, Hosting, AI visibility until a link is saved).
 */
export function accountOpenUrl(kind: AccountKind, link: string | null | undefined, siteUrl: string): string | null {
  if (link) return link
  if (kind === 'platform') return siteUrl || null
  return ACCOUNTS.find((a) => a.kind === kind)?.home ?? null
}

/** A per-client account link: '' = fine (none). Links only, never logins: https, no user:pass@, no secrets in it. */
export function accountLinkProblem(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (s.length > 500) return 'That link is too long (500 characters max).'
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return 'That doesn’t look like a link. Paste the full address (https://…).'
  }
  if (u.protocol !== 'https:') return 'Use an https:// link.'
  if (u.username || u.password) return 'Links only: no username or password in it.'
  if (/(pass(word)?|pwd|token|secret|api[_-]?key|access[_-]?key)=/i.test(u.search + u.hash)) return 'That link carries a password or key. Paste the plain page link instead.'
  if (/\s/.test(s)) return 'A link can’t have spaces in it.'
  return ''
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = { ready: 'Ready', pending: 'Pending', n_a: 'N/A' }

/**
 * A client has two areas (Angel, Nov 26), both on the same client and data:
 *   - Overview (/clients/{site id}/…): results + quick access, the default page when you open a client. Day 3
 *     (Baseline) and Day 10 (Results) live here, with the site connection and Notes & links.
 *   - Strategy Builder (/clients/{site id}/strategy/…): the work, Sam's days 1, 2, 4, 5, 6, 7, 8–9.
 * `path` = the path under /clients/{site id}. `live` = built. `tag` says when a section comes: 'P1'…'P5', 'Plugin'
 * (needs the Vibe SEO plugin), 'Later'. Only 'Later' shows in the sidebar; the rest show on the "coming" card.
 * A Strategy group's `step` = its guide step (src/lib/guide.ts), so the current day opens by itself.
 */
export type ClientArea = 'overview' | 'strategy'
export type ClientSection = { key: string; label: string; path: string; live: boolean; tag: string; group?: string; area?: ClientArea }
export type ClientGroup = { key: string; label: string; step: number; items: ClientSection[] }

/** /clients/{site id}[/path] */
export const clientPath = (siteId: string, path = '') => `/clients/${siteId}${path ? `/${path.replace(/^\/+/, '')}` : ''}`
/** /clients/{site id}/strategy[/path] */
export const strategyPath = (siteId: string, path = '') => clientPath(siteId, path ? `strategy/${path.replace(/^\/+/, '')}` : 'strategy')

/** Overview area: results + quick access. */
export const OVERVIEW_SECTIONS: ClientSection[] = [
  { key: 'overview', label: 'Overview', path: '', live: true, tag: '', area: 'overview' },
  { key: 'baseline', label: 'Baseline', path: 'baseline', live: true, tag: 'P2', area: 'overview' },
  { key: 'results', label: 'Results', path: 'results', live: true, tag: 'P2', area: 'overview' },
  { key: 'site-check', label: 'Site check', path: 'site-check', live: true, tag: 'P3', area: 'overview' },
  { key: 'site', label: 'Site connection', path: 'site', live: true, tag: 'Plugin', area: 'overview' },
  { key: 'notes', label: 'Notes & links', path: 'notes', live: true, tag: '', area: 'overview' },
  { key: 'conversions', label: 'Conversions', path: 'conversions', live: false, tag: 'Later', area: 'overview' },
]

/** Strategy Builder: the top items, then one group per Sam day. */
export const STRATEGY_TOP: ClientSection[] = [
  { key: 'strategy', label: 'Strategy home', path: 'strategy', live: true, tag: '', area: 'strategy' },
  { key: 'guide', label: 'Step-by-step guide', path: 'strategy/guide', live: true, tag: '', area: 'strategy' },
  { key: 'uploads', label: 'Uploads + auto-fill', path: 'strategy/uploads', live: true, tag: '', area: 'strategy' },
]

export const STRATEGY_GROUPS: ClientGroup[] = [
  { key: 'day1', label: 'Day 1 · Setup', step: 0, items: [{ key: 'setup', label: 'Client setup', path: 'strategy/setup', live: true, tag: '' }] },
  {
    key: 'keywords',
    label: 'Day 2 · Keywords',
    step: 1,
    items: [
      { key: 'matrix', label: 'Matrix', path: 'strategy/keywords', live: true, tag: '' },
      { key: 'database', label: 'Database', path: 'strategy/keywords/database', live: true, tag: '' },
      { key: 'clusters', label: 'Clusters', path: 'strategy/keywords/clusters', live: true, tag: '' },
      { key: 'import', label: 'Import', path: 'strategy/keywords/import', live: true, tag: '' },
    ],
  },
  { key: 'day4', label: 'Day 4 · GBP check', step: 3, items: [{ key: 'gbp', label: 'GBP check', path: 'strategy/gbp', live: false, tag: 'P4' }] },
  {
    key: 'day5',
    label: 'Day 5 · Sitemap',
    step: 4,
    items: [
      { key: 'pages', label: 'Sitemap + hotspots', path: 'strategy/pages', live: true, tag: '' },
      { key: 'plan', label: 'Site plan', path: 'strategy/plan', live: true, tag: '' },
    ],
  },
  { key: 'day6', label: 'Day 6 · Page briefs', step: 5, items: [{ key: 'briefs', label: 'Page briefs', path: 'strategy/briefs', live: true, tag: '' }] },
  { key: 'day7', label: 'Day 7 · GBP care', step: 6, items: [{ key: 'gbp-care', label: 'GBP care', path: 'strategy/gbp-care', live: false, tag: 'P4' }] },
  { key: 'day89', label: 'Days 8–9 · Links', step: 7, items: [{ key: 'links', label: 'Link database', path: 'strategy/links', live: false, tag: 'P4' }] },
]

/** Every client section, flat; grouped ones carry their group's label (for the breadcrumb). */
export const ALL_SECTIONS: ClientSection[] = [
  ...OVERVIEW_SECTIONS,
  ...STRATEGY_TOP,
  ...STRATEGY_GROUPS.flatMap((g) => g.items.map((s) => ({ ...s, group: g.label, area: 'strategy' as const }))),
]

/** Old client paths (before the Overview / Strategy Builder split) → the new path. Unknown → '' (the Overview). */
export function legacyClientPath(rest: string, search: string): string {
  const p = rest.replace(/^\/+|\/+$/g, '')
  const day = new URLSearchParams(search).get('day')
  if (p === 'edit') return 'strategy/setup'
  if (p === 'reports' || p === 'review') return 'results'
  if (p === 'uploads' && day === 'day3') return 'baseline'
  if (p === 'uploads' && day === 'day10') return 'results'
  if (/^(guide|uploads|keywords(\/.*)?|gbp|gbp-care|pages|plan|briefs|links)$/.test(p)) return `strategy/${p}`
  return ''
}

/** Hub pages (no client open). Clients are never listed in the sidebar (50+ clients): they live on Clients. */
export const HUB_SECTIONS: ClientSection[] = [
  { key: 'hub-overview', label: 'Overview', path: '/', live: true, tag: '' },
  { key: 'clients', label: 'Clients', path: '/clients', live: true, tag: '' },
  { key: 'templates', label: 'Templates', path: '/templates', live: true, tag: '' },
  { key: 'settings', label: 'Settings', path: '/settings', live: true, tag: '' },
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
  strategy: 'Sam’s days for this client: progress, services and areas.',
  setup: 'Services, areas, scope and brand words.',
  baseline: 'The starting point: Semrush Position Tracking, Search Console and GA4 snapshots, GBP numbers and the Whitespark map grid. The uploads and numbers come in phase 2.',
  results: 'Results vs the baseline: rankings, Search Console, GA4, GBP and the map grid, and the monthly report. Comes in phase 2.',
  settings: 'Industries, Claude usage (cost per client) and Automation (phase 5). Building next.',
  automation: 'Slack alerts, the weekly SEO email, ClickUp lists and the Claude drafts queue. Nothing is published without a review.',
}
