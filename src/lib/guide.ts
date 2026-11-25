// The step-by-step guide: Sam's 10-Day Rank Yourself process as 9 steps (docs/local-seo-playbook.md),
// the same for every client. Shared by the Guide page and the server (task keys + which ones tick themselves).
// Progress per client is in seo_guide_progress (migration 0003): only hand-ticked task keys are stored;
// `auto` tasks are worked out live from the client's data (server/services/guideService.ts).

export type GuideTask = {
  key: string
  label: string
  /** Ticks itself from the data; `hint` says what makes it tick. */
  auto?: boolean
  hint?: string
}

export type GuideStep = {
  n: number
  /** "Day 2", "Days 8–9", "Day 10 + monthly" */
  day: string
  /** Short label used in the client switcher and All clients ("Day 2 · Keywords"). */
  short: string
  title: string
  /** Title + one line on the client Overview's "Sam's 10 days" card (design Client.png). */
  overview: { title: string; blurb: string }
  why: string
  tasks: GuideTask[]
  tools: string
  tip: string
  /** Section to open (path under /clients/{site id}, see src/lib/clientSetup.ts). */
  open: { label: string; path: string }
  videos: { label: string; url: string }[]
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`

export const GUIDE: GuideStep[] = [
  {
    n: 0,
    day: 'Day 1',
    short: 'Setup',
    title: 'Client setup',
    overview: { title: 'Client setup', blurb: 'services, areas, accounts' },
    why: 'Know what matters before touching anything: the 3 services and areas that bring the most money.',
    tasks: [
      { key: 'services', label: 'Name Home + S1–S3 and the services under each', auto: true, hint: 'Ticks itself when Home and S1–S3 are named and S1–S3 each have a service.' },
      { key: 'areas', label: 'Set A1 (main area), and A2 / A3 or N/A', auto: true, hint: 'Ticks itself when A1 has a name.' },
      { key: 'accounts', label: 'Account checklist: nothing left Pending', auto: true, hint: 'Ticks itself when no account is Pending.' },
      { key: 'address', label: 'Confirm what stays private (a home studio’s address is never listed)' },
    ],
    tools: 'The client’s Services page · account checklist',
    tip: 'Pick the services and areas that bring the most money or are most wanted, not every service they offer.',
    open: { label: 'Client setup', path: 'strategy/setup' },
    videos: [{ label: 'Day 1', url: yt('euNC0aNL_Iw') }],
  },
  {
    n: 1,
    day: 'Day 2',
    short: 'Keywords',
    title: 'Keyword research',
    overview: { title: 'Keywords', blurb: 'keywords, matrix, clusters' },
    why: 'Every page target needs real search data behind it. Do SEO, not guess-SEO.',
    tasks: [
      { key: 'seeds', label: 'Build seeds from the Services page' },
      { key: 'kp', label: 'Keyword Planner: location = A1, download the CSV', auto: true, hint: 'Ticks itself when a Keyword Planner file is imported.' },
      { key: 'semrush', label: 'Semrush Keyword Magic per service, include = city, export', auto: true, hint: 'Ticks itself when a Semrush Keyword Magic file is imported.' },
      { key: 'import', label: 'Import the CSVs on Keywords › Import', auto: true, hint: 'Ticks itself when the client has keywords.' },
      { key: 'roles', label: 'Every keyword has a role', auto: true, hint: 'Ticks itself when no keyword is left as “Needs role”.' },
      { key: 'matrix', label: 'Pick a primary for each matrix cell' },
      { key: 'clusters', label: 'Group clusters: one page per cluster, no keyword on two pages' },
    ],
    tools: 'Keyword Planner · Semrush (US) · SEO Hub import',
    tip: 'Record volumes exactly as shown. KP ranges stay ranges, never the 50/500 stand-ins.',
    open: { label: 'Open Keywords', path: 'strategy/keywords/database' },
    videos: [{ label: 'Day 2', url: yt('P_5S33738yE') }],
  },
  {
    n: 2,
    day: 'Day 3',
    short: 'Baseline',
    title: 'Tracking + baseline',
    overview: { title: 'Baseline', blurb: 'Semrush, GSC, GA4, GBP, map grid' },
    why: 'Track before you touch anything, so every later change can be compared with where you started.',
    tasks: [
      { key: 'tracking', label: 'Semrush Position Tracking: US (national), the primary keywords', auto: true, hint: 'Ticks itself when keywords are marked Track on.' },
      { key: 'geogrid', label: 'Whitespark geogrid: top 1–3 services, main city, 5×5' },
      { key: 'gsc', label: 'Search Console: Domain property verified' },
      { key: 'ga4', label: 'GA4 installed, goal “Generate leads”' },
      { key: 'numbers', label: 'Starting numbers with dates: GSC, GA4, GBP, map grid' },
      { key: 'log', label: 'Start the change log' },
    ],
    tools: 'Semrush Position Tracking · Whitespark · Search Console · GA4 · GBP',
    tip: 'Missing or still-processing data is Pending, never 0. Screenshots with dates are fine.',
    open: { label: 'Baseline', path: 'baseline' },
    videos: [{ label: 'Day 3', url: yt('A6sGzviQfiM') }],
  },
  {
    n: 3,
    day: 'Day 4',
    short: 'GBP check',
    title: 'GBP check',
    overview: { title: 'GBP check', blurb: 'competitors, categories, reviews' },
    why: 'See who’s in the map pack for each service and what they do that the client doesn’t.',
    tasks: [
      { key: 'maps', label: 'Maps search per service (S1–S3), ads skipped' },
      { key: 'categories', label: 'Competitors’ primary + additional categories (Pleper)' },
      { key: 'reviews', label: 'Competitor reviews: count and newest dates' },
      { key: 'factors', label: 'Whitespark top map factors checklist' },
      { key: 'details', label: 'Business details: public facts match the website (private address hidden)' },
    ],
    tools: 'Google Maps (guest profile) · Pleper · Whitespark factors',
    tip: 'Check the last 3–5 review dates. If competitors get ~2 a quarter, a monthly ask of 2–3 beats them.',
    open: { label: 'GBP check', path: 'strategy/gbp' },
    videos: [{ label: 'Day 4', url: yt('oIAxdwHHYRY') }],
  },
  {
    n: 4,
    day: 'Day 5',
    short: 'Sitemap',
    title: 'Sitemap + hotspots',
    overview: { title: 'Sitemap + hotspots', blurb: 'pages, titles, metas, H1' },
    why: 'Give each priority search a destination: one page per keyword cluster.',
    tasks: [
      { key: 'structure', label: 'Pick the structure: service first, location first or flat' },
      { key: 'pages', label: 'Page list P1, P2…: keep / improve / new' },
      { key: 'owner', label: 'One keyword owner per page; check which page Google shows' },
      { key: 'hotspots', label: 'Hotspots: title 50–60, meta 150–160 ending with a CTA, H1, URL' },
      { key: 'brief', label: 'Pick the first page for Day 6' },
    ],
    tools: 'SEO Hub pages · Google search (owner check)',
    tip: 'If Google flips between two pages for one keyword, that’s cannibalization: de-optimize one.',
    open: { label: 'Sitemap + hotspots', path: 'strategy/pages' },
    videos: [{ label: 'Day 5', url: yt('jv-m3bOy-Ks') }],
  },
  {
    n: 5,
    day: 'Day 6',
    short: 'Page brief',
    title: 'Page brief + build',
    overview: { title: 'Page briefs', blurb: 'BrandScript + StoryBrand copy' },
    why: 'Build one useful page: SEO hotspots plus copy that answers what the customer actually asks.',
    tasks: [
      { key: 'brandscript', label: 'BrandScript A–P (once per client)' },
      { key: 'copy', label: 'Page copy: 11 StoryBrand sections, only real facts' },
      { key: 'review', label: 'SEO review: keyword in title, H1, opening and closing' },
      { key: 'links', label: 'Internal links in the body copy' },
      { key: 'index', label: 'Publish, then request indexing in Search Console' },
    ],
    tools: 'BrandScript · Elementor · Search Console',
    tip: 'Unknown facts stay in [brackets]. Never invent prices, guarantees or reviews.',
    open: { label: 'Page briefs', path: 'strategy/briefs' },
    videos: [{ label: 'Day 6', url: yt('DUMr4S5CIm0') }],
  },
  {
    n: 6,
    day: 'Day 7',
    short: 'GBP care',
    title: 'GBP care',
    overview: { title: 'GBP care', blurb: 'products, reviews, 13-week posts' },
    why: 'Keep the profile alive: services, products, reviews and a quarter of posts.',
    tasks: [
      { key: 'services', label: 'GBP services list cleaned up' },
      { key: 'products', label: 'One product per service page (720×720), linked to that page' },
      { key: 'reviews', label: 'Review email + tracker (ref, date, channel, result)' },
      { key: 'posts', label: '13 weekly posts scheduled (1200×900, UTM links)' },
      { key: 'routine', label: 'Care routine: weekly reviews, inquiries, posts' },
    ],
    tools: 'Google Business Profile · UTM links',
    tip: 'Ask for reviews right after the job. One follow-up after 1–3 days, never paid reviews.',
    open: { label: 'GBP care', path: 'strategy/gbp-care' },
    videos: [{ label: 'Day 7', url: yt('0YeOuk54oaU') }],
  },
  {
    n: 7,
    day: 'Days 8–9',
    short: 'Links',
    title: 'Links + citations',
    overview: { title: 'Link database', blurb: 'citations in 3 waves, backlinks' },
    why: 'Relevance gets you to page 3–7; authority gets you further. Build a natural backlink profile.',
    tasks: [
      { key: 'nap', label: 'NAP record (address hidden for home or service-area businesses)' },
      { key: 'wave1', label: 'BrightLocal wave 1 (rows 1, 4, 7…) + YP network' },
      { key: 'gap', label: 'Semrush Backlink Gap (up to 4 competitors)' },
      { key: 'opps', label: 'Opportunity list: premier links, sponsorships, SERP links' },
      { key: 'pace', label: 'Set the weekly link pace (2–10 a week)' },
    ],
    tools: 'BrightLocal · Semrush Backlink Gap',
    tip: 'Sent, Approved and Live stay separate. Live only after you’ve clicked the link and checked it.',
    open: { label: 'Link database', path: 'strategy/links' },
    videos: [
      { label: 'Day 8', url: yt('WIdB0gpFm5I') },
      { label: 'Day 9', url: yt('2B2uumZN7ak') },
    ],
  },
  {
    n: 8,
    day: 'Day 10 + monthly',
    short: 'Results',
    title: 'Report what changed',
    overview: { title: 'Results', blurb: 'compare with baseline' },
    why: 'Compare with the baseline, explain where things stand, and choose the next three actions.',
    tasks: [
      { key: 'compare', label: 'Compare like with like: same dates, filters, keywords' },
      { key: 'work', label: 'Work worth explaining (from the change log)' },
      { key: 'buckets', label: 'Six buckets: OK / Next / Later' },
      { key: 'update', label: 'Client update: past → present → future' },
      { key: 'actions', label: 'Up to 3 actions with an owner and a due date' },
    ],
    tools: 'Semrush · Search Console · GA4 · GBP · Whitespark',
    tip: 'Flat is flat. If one thing improved and another slipped, show both.',
    open: { label: 'Results', path: 'results' },
    videos: [{ label: 'Day 10', url: yt('y1NgXdpIMJM') }],
  },
]

export const GUIDE_STEPS = GUIDE.length

/** "Day 2 · Keywords"; all done → "Monthly". */
export function stepLabel(current: number): string {
  const s = GUIDE[current]
  return s ? `${s.day.replace(' + monthly', '')} · ${s.short}` : 'Monthly'
}

/** "Day 2"; all done → "Monthly". */
export function stepDay(current: number): string {
  const s = GUIDE[current]
  return s ? s.day.replace(' + monthly', '') : 'Monthly'
}

// ---- Two areas (Angel, Nov 26): Day 3 (baseline) and Day 10 (results) live in the client Overview; every other day is
// in the Strategy Builder. Step numbers never change (they are stored: guide progress, templates, auto-fill, note days).

/** Steps shown and ticked in the client Overview (Baseline, Results), not in the Strategy Builder's guide. */
export const OVERVIEW_STEPS: readonly number[] = [2, 8]
export const isOverviewStep = (n: number) => OVERVIEW_STEPS.includes(n)
/** The Strategy Builder's days: Day 1, 2, 4, 5, 6, 7, 8–9. */
export const STRATEGY_GUIDE = GUIDE.filter((s) => !isOverviewStep(s.n))

/** First Strategy Builder step not done (GUIDE_STEPS when all of them are). */
export function strategyCurrent(isDone: (n: number) => boolean): number {
  return STRATEGY_GUIDE.find((s) => !isDone(s.n))?.n ?? GUIDE_STEPS
}

/** The thin line for a step that lives in the Overview: "Day 3 · Tracking + baseline", "Day 10 · Results". */
export function overviewLine(n: number): string {
  const s = GUIDE[n]
  return `${s.day.replace(' + monthly', '')} · ${n === 8 ? 'Results' : s.title}`
}
