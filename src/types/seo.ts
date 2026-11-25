// Shared shapes between the browser and /api (server imports these as types only).
// Mirrors supabase/migrations/0001_seo_phase1.sql. No address fields anywhere, on purpose.

export type CategoryCode = 'Home' | 'S1' | 'S2' | 'S3' | 'FAQ'
export type AreaCode = 'A1' | 'A2' | 'A3'
export type AreaStatus = 'active' | 'n_a'
export type ClientStatus = 'active' | 'paused' | 'archived'
export type AccountStatus = 'ready' | 'pending' | 'n_a'
export type AccountKind =
  | 'domain_dns'
  | 'hosting'
  | 'platform'
  | 'gbp'
  | 'gsc'
  | 'ga4'
  | 'semrush'
  | 'whitespark'
  | 'clarity'
  | 'cloudflare'
  | 'google_ads'
  | 'ai_visibility'

export interface ClientService {
  id: string
  name: string
  sort: number
}

export interface ClientCategory {
  id: string
  code: CategoryCode
  name: string
  inMatrix: boolean
  services: ClientService[]
}

export interface ClientArea {
  id: string
  code: AreaCode
  name: string | null
  state: string | null
  status: AreaStatus
}

export interface ClientAccount {
  id: string
  kind: AccountKind
  status: AccountStatus
  nextAction: string | null
  note: string | null
  /** This client's own page in the tool (migration 0010). Links only, never logins. */
  link: string | null
  updatedAt: string
}

/** Industry template picked in the Add client wizard (seo_clients.industry, migration 0002). */
export type ClientIndustry = string

/** One industry from seo_industries (migration 0009). Angel adds more; none needs its own template versions. */
export interface Industry {
  key: ClientIndustry
  label: string
  hint: string | null
  sort: number
  builtIn: boolean
}

/** One line of a bulk "Add clients" CSV, as mapped (text as typed). */
export interface BulkClientRow {
  line: number
  name: string
  url: string
  city: string
  state: string
  industry: string
}

/** What the server says about a line: new (added on save), already a client, twice in the file, or a problem. */
export interface BulkClientCheck extends BulkClientRow {
  status: 'new' | 'exists' | 'repeat' | 'problem'
  note: string
  siteUrl: string | null
  siteId: string | null
  /** Matched industry key; null = none (Blank-style: generic templates). */
  industryKey: string | null
  industryLabel: string | null
  /** The industry isn't in the list yet: it's added on save. */
  industryNew: boolean
}

export interface ClientCounts {
  /** Services across Home + S1–S3 (0 = "Needs services"). */
  services: number
  keywords: number
  imports: number
  pages: number
  lastImportAt: string | null
  /** Keywords with Track on (Semrush Position Tracking). */
  tracked: number
  /** Keywords with no role yet ("Needs role"). */
  needsRole: number
  /** Account checklist rows still Pending. */
  accountsPending: number
  /** Latest of: client edited, last import, last keyword change. */
  lastWorkedAt: string
}

export interface ClientSummary {
  siteId: string
  siteUrl: string
  name: string
  city: string | null
  state: string | null
  status: ClientStatus
  industry: ClientIndustry | null
  categories: { code: CategoryCode; name: string }[]
  counts: ClientCounts
  guide: GuideSummary
}

export interface ClientDetail extends ClientSummary {
  idealClient: string | null
  usp: string | null
  success12mo: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  categories: ClientCategory[]
  areas: ClientArea[]
  accounts: ClientAccount[]
  /** Words for services the client doesn't offer (migration 0008; [] before it runs). */
  outOfScopeWords: string[]
  /** Neighbourhoods inside the client's area that aren't an area of their own (migration 0008). */
  neighbourhoodWords: string[]
  /** The client's own brand words (migration 0009; [] = business name + site domain are used). */
  brandWords: string[]
}

/** What the Add / Edit client form sends. Services keep their id when renamed or moved. */
export interface ClientInput {
  siteUrl: string
  name: string
  city: string
  state: string
  idealClient: string
  usp: string
  success12mo: string
  notes: string
  status: ClientStatus
  industry: ClientIndustry | null
  categories: { code: CategoryCode; name: string; services: { id?: string; name: string }[] }[]
  areas: { code: AreaCode; name: string; state: string; status: AreaStatus }[]
  /** Add client only (wizard step 4): starting status per account. Edits happen on the Overview checklist. */
  accounts?: { kind: AccountKind; status: AccountStatus; link?: string }[]
  /** Edit client only (migration 0008). Left out = unchanged. */
  outOfScopeWords?: string[]
  neighbourhoodWords?: string[]
  /** Edit client only (migration 0009). Left out = unchanged. */
  brandWords?: string[]
}

export interface SiteIdCheck {
  siteUrl: string
  siteId: string
  /** Name of another client that already has this site id. */
  takenBy: string | null
}

// ---- CSV imports (phase 1, step 4) ---------------------------------------------------

export type ImportSource = 'kp' | 'semrush' | 'sheet'
export type ImportReport = 'kp_ideas' | 'kp_volumes' | 'keyword_magic' | 'keyword_overview' | 'keyword_gap' | 'master_db' | 'clusters' | 'sams_guide' | 'competitors' | 'client_sheet'

/** Fields a CSV column can be matched to. */
export type ImportField = 'keyword' | 'volume' | 'kd' | 'cpc' | 'intent' | 'segment' | 'role' | 'service' | 'kp'

/** One CSV row after column matching. Values stay as exported (text); `raw` is the whole row. */
export interface ImportRow {
  keyword: string
  volume?: string
  kd?: string
  cpc?: string
  intent?: string
  segment?: string
  role?: string
  service?: string
  kp?: string
  raw: Record<string, string>
}

export interface ImportPayload {
  siteId: string
  source: ImportSource
  report: ImportReport
  fileName: string
  location: string
  filter: string
  columnMap: Partial<Record<ImportField, string>>
  /** KP file totals (rows with no keyword, e.g. "All" / a county row): kept on the import, not shown in the table. */
  totals: { segment: string; volume: string }[]
  rows: ImportRow[]
  /** keyword keys whose different Semrush numbers should replace the filled ones ("Use the new numbers"). */
  useNew?: string[]
  /** Address-like keyword keys Angel OKd to import anyway (everything else that looks like an address is held back). */
  allowAddresses?: string[]
}

export type NumberField = 'semrush_volume' | 'kd' | 'cpc'

export interface ImportDifference {
  key: string
  keyword: string
  changes: { field: NumberField; current: number; incoming: number }[]
}

export interface ImportPreview {
  rows: number
  unique: number
  newKeywords: number
  existing: number
  skippedDuplicates: number
  duplicateExamples: string[]
  /** existing keywords that get an empty Semrush number / KD / CPC / intent filled in */
  filled: number
  /** Sheet only: KP ranges filled into empty ones */
  kpFilled: number
  /** Sheet only: KP ranges left alone because one was typed (or already there) */
  kpKept: number
  differences: ImportDifference[]
  unmatchedServices: string[]
  unknownRoles: string[]
  /** new keywords with no Semrush volume (flagged as missing data) */
  newWithoutVolume: number
  sampleNew: string[]
  /** Keywords that look like a street address: held back, not imported unless allowed. */
  addresses: string[]
}

export interface ImportRecord {
  id: string
  source: ImportSource
  report: ImportReport
  fileName: string
  location: string | null
  filter: string | null
  rowsTotal: number
  rowsAdded: number
  rowsMerged: number
  rowsSkipped: number
  totals: { segment: string; volume: string }[]
  hasFile: boolean
  note: string | null
  /** The .xlsx this tab import came from (whole-Sheet import). */
  parentImportId: string | null
  createdAt: string
}

/** What "Delete this import" would remove (shown in the confirm before anything is deleted). */
export interface DeleteImportCheck {
  fileName: string
  historyRows: number
  /** keywords that only came from this import (they go) */
  keywordsRemoved: number
  /** keywords also in another import (they stay; only this import's history rows go) */
  keywordsKept: number
  /** of the removed: ones with a typed KP range, a role or a service */
  removedWithEdits: number
  /** of the removed: ones used in the matrix or clusters */
  removedInUse: number
  hasFile: boolean
  /** An .xlsx: how many tab imports go with it. */
  tabImports: number
  /** Plain-English extras for the confirm (e.g. pages from a Clusters tab stay). */
  notes: string[]
}

// ---- Keyword database (phase 1, step 5) ----------------------------------------------

export type KeywordRole = 'primary' | 'secondary' | 'faq' | 'near_me'
export type KeywordStatus = 'keep' | 'later' | 'rejected'

/** One keyword as the Database page shows it. Numbers exactly as stored; null = no data (never 0). */
export interface KeywordItem {
  id: string
  keyword: string
  role: KeywordRole | null
  /** Primary of a matrix cell or of a page right now (a Primary role without either is flagged). */
  isPrimarySomewhere: boolean
  serviceId: string | null
  intent: string | null
  /** KP range as text ("10–100", "No data", "Not checked"); null = not set yet. */
  kpVolume: string | null
  kpVolumeBy: 'typed' | 'sheet' | null
  /** Keyword Planner CSV stand-in (e.g. "50"), shown greyed as a hint, never used as the value. */
  kpStandIn: string | null
  semrushVolume: number | null
  kd: number | null
  cpc: number | null
  track: boolean
  status: KeywordStatus
  notes: string | null
  sources: ImportSource[]
  createdAt: string
}

/** What a single edit or the bulk bar changes. Only the keys present are changed. */
export interface KeywordChanges {
  kpVolume?: string | null
  role?: KeywordRole | null
  serviceId?: string | null
  track?: boolean
  status?: KeywordStatus
  notes?: string | null
}

export interface KeywordUpdateRequest {
  siteId: string
  ids: string[]
  changes: KeywordChanges
  /** Bulk KP range: replace ranges that are already set (asked first). */
  overwriteKp?: boolean
}

/** needsConfirm: how many selected keywords already have a different KP range (nothing saved yet). */
export type KeywordUpdateResult = { updated: number } | { needsConfirm: number }

// ---- Step-by-step guide (redesign step 3, migration 0003) ------------------------------

export type GuideStatus = 'not_started' | 'in_progress' | 'done'

export interface GuideStepState {
  step: number
  status: GuideStatus
  /** Task keys ticked by hand. */
  tasksDone: string[]
  /** Auto task keys that the data says are done right now. */
  autoDone: string[]
  startedAt: string | null
  doneAt: string | null
}

export interface GuideState {
  /** First step that isn't done (9 = all done → monthly). */
  current: number
  doneCount: number
  steps: GuideStepState[]
}

/** Short guide summary on every client (switcher, All clients, Overview). */
export interface GuideSummary {
  current: number
  doneCount: number
  /** Step numbers marked done (for the 9-part progress bar). */
  doneSteps: number[]
}

// ---- 3×3 matrix (redesign step 4b; tables seo_matrix_cells + seo_matrix_keywords from 0001) -------------

export type PageStatus = 'live' | 'scheduled' | 'planned'

export interface MatrixKeyword {
  id: string
  keyword: string
  role: KeywordRole | null
  semrushVolume: number | null
  kpVolume: string | null
  /** The page that owns this keyword (Clusters), if any. */
  page: { name: string; status: PageStatus } | null
}

export interface MatrixCell {
  category: CategoryCode
  area: AreaCode
  /** n_a = the area is N/A; pending = no primary picked yet; target = has a primary. */
  state: 'target' | 'n_a' | 'pending'
  primary: MatrixKeyword | null
  backups: MatrixKeyword[]
}

export interface MatrixState {
  rows: { code: CategoryCode; name: string; cells: MatrixCell[] }[]
  areas: { code: AreaCode; name: string | null; state: string | null; status: AreaStatus }[]
}

export interface MatrixCellInput {
  siteId: string
  category: CategoryCode
  area: AreaCode
  primaryId: string | null
  backupIds: string[]
}

// ---- Clusters (redesign step 4c; seo_pages + seo_page_keywords from 0001) -------------------------------

export interface ClusterKeyword {
  id: string
  keyword: string
  role: 'primary' | 'secondary' | 'faq'
  semrushVolume: number | null
  kd: number | null
  kpVolume: string | null
}

export interface ClusterPage {
  id: string
  category: CategoryCode
  name: string
  url: string | null
  /** The URL is only a suggestion (template pattern), not confirmed yet (migration 0013). */
  urlSuggested: boolean
  /** null = not set yet (shown as "Medium (default)"; migration 0012). */
  priority: 'high' | 'medium' | 'low' | null
  status: PageStatus
  why: string | null
  ideas: string[]
  keywords: ClusterKeyword[]
}

// ---- Templates (redesign step 5; migrations 0004 + 0005) ---------------------------------------------

export type TemplateKind = 'keyword_research' | 'matrix' | 'clusters' | 'hotspots' | 'gbp_posts' | 'review_email' | 'citation_waves'
export type TemplateItemKind = 'pattern' | 'word' | 'rule' | 'export' | 'text'
export type WordGroup = 'money' | 'faq' | 'service'

export interface TemplateItem {
  kind: TemplateItemKind
  wordGroup: WordGroup | null
  body: string
}

export interface Template {
  id: string
  kind: TemplateKind
  name: string
  samStep: number
  /** null = all industries */
  industry: ClientIndustry | null
  description: string
  builtIn: boolean
  updatedAt: string
  items: TemplateItem[]
  /** Clients it was applied to (latest first). */
  applied: { siteId: string; name: string; appliedAt: string }[]
}

export interface TemplateInput {
  id?: string
  kind: TemplateKind
  name: string
  samStep: number
  industry: ClientIndustry | null
  description: string
  items: TemplateItem[]
}

// ---- Auto-fill (redesign step 6; migration 0006) ---------------------------------------------------------

export type AutofillKind = 'setup_services' | 'setup_areas' | 'setup_kickoff' | 'roles' | 'services' | 'services_ai' | 'intent' | 'triage' | 'scope' | 'matrix' | 'clusters'
export type AutofillStatus = 'ready' | 'approved' | 'rejected' | 'superseded'

export interface AutofillOption {
  value: string
  rule: string
}

export interface AutofillItem {
  keywordId: string
  keyword: string
  /** One option = a suggestion; more = "needs a look" (two rules disagree). */
  options: AutofillOption[]
  decision: 'approved' | 'rejected' | 'skipped' | null
  applied?: string
  /** Triage / scope only: why (out of scope, neighbourhood, competitor brand, off-topic). */
  category?: string
  /** Matrix only: the cell ("S1 Web Design × A2 Bentonville") and the suggested backups. */
  cell?: string
  backups?: { keywordId: string; keyword: string }[]
  /** Page suggestions (6c-4a): a NEW page for a matrix cell (keywordId = its primary). */
  page?: {
    cell: string
    category: CategoryCode
    name: string
    /** Suggested path from the template's URL pattern ("/web-design-bentonville-ar/"), editable on Approve. */
    path: string | null
    secondaries: { keywordId: string; keyword: string }[]
    faqs: { keywordId: string; keyword: string }[]
    /** Set on Approve: the page that was created. */
    pageId?: string
  }
  /** Page suggestions (6c-4a): put a leftover keyword on a page (existing, or a new one from this list). */
  assign?: { pageId: string | null; cell: string | null; pageName: string; role: 'secondary' | 'faq' }
  /** Day 1 from pasted text (6c-4b): one fact, with the words it came from. keywordId is just an item id here. */
  setup?: {
    group: 'services' | 'areas' | 'kickoff'
    field: 'service' | 'notOffered' | 'area' | 'neighbourhood' | 'success12mo' | 'usp' | 'idealClient' | 'brandWord'
    value: string
    category?: 'Home' | 'S1' | 'S2' | 'S3'
    categoryName?: string
    state?: string
    quote: string
  }
}

export interface AutofillRow {
  id: string
  step: number
  kind: AutofillKind
  source: 'rules' | 'claude'
  status: AutofillStatus
  summary: string
  items: AutofillItem[]
  /** Keywords left as they are; `note` says why (e.g. "Near me — not a page target"). */
  unmatched: { keywordId: string; keyword: string; note?: string }[]
  appliedCount: number | null
  createdAt: string
  decidedAt: string | null
  /** Open list only: how many of its keywords no longer exist (left out of items / counts). */
  gone?: number
}

export interface AutofillDecision {
  keywordId: string
  action: 'approve' | 'reject'
  /** For "needs a look": the option picked. */
  value?: string
  /** Page suggestions: the URL path as edited on Approve ('' = no URL). */
  path?: string
}

// ---- Sam's Guide sheet import (migration 0011) ------------------------------------------------------------

/** Something the sheet and SEO Hub disagree on. `replaceable` = Angel can tick "replace" (key goes back on Apply). */
export interface SamsGuideConflict {
  key: string
  kind: 'matrix' | 'page' | 'competitor' | 'volume' | 'later'
  text: string
  replaceable: boolean
}

/** The dry run: what Apply would do. Nothing is saved until Angel clicks Apply. */
export interface SamsGuidePlan {
  sheetClient: string | null
  sameClient: boolean
  /** When this client's Sam's Guide was already imported (one import per client). */
  alreadyImported: string | null
  counts: Record<string, number>
  conflicts: SamsGuideConflict[]
  newKeywords: { keyword: string; from: string[] }[]
  heldBack: { keyword: string; why: string }[]
  /** Empty fields only, values as written. */
  fills: { keyword: string; isNew: boolean; semrush?: number; kp?: string; kd?: number; cpc?: number }[]
  matrix: { id: string; cell: string; state: 'target' | 'pending' | 'n_a'; primary: string | null; backups: string[]; note: string; action: string }[]
  track: { keyword: string; already: boolean }[]
  pages: { name: string; url: string | null; category: string; status: 'live' | 'planned'; existing: boolean; from: string; keywords: { keyword: string; role: 'primary' | 'secondary'; action: string }[] }[]
  later: { keyword: string; type: string; status: 'later' | 'rejected'; action: string }[]
  /** "More areas" rows: one note added to the client (not keywords). null = none, or already there. */
  areaNote: string | null
  competitors: { code: string; name: string | null; written: string; action: string }[]
  skipped: { line: number; section: string; why: string }[]
  notUnderstood: { line: number; section: string; text: string }[]
}

// ---- Notes & links (redesign step 7, migration 0014) ------------------------------------------------------

export type NoteKind = 'rule' | 'decision' | 'note'

export interface ClientNote {
  id: string
  kind: NoteKind
  body: string
  author: string | null
  /** Guide step index (0 = Day 1 … 8 = Days 8–9, 9 = monthly). null = no day. */
  day: number | null
  /** No client: an agency rule, shown on every client. */
  agency: boolean
  createdAt: string
}

/** A link that isn't an account (the Google Sheet, ClickUp lists…). Links only, never logins. */
export interface ClientLink {
  id: string
  label: string
  url: string
  note: string | null
  sort: number
}

export interface NotesState {
  notes: ClientNote[]
  links: ClientLink[]
  /** The old one-box notes (Edit client → Notes), shown as "Earlier notes" until moved. */
  earlier: string | null
}

// ---- Whole client Sheet (.xlsx) import (migration 0015, docs/client-sheet-import-plan.md) ----------------------

export type SheetTabKind = 'master_db' | 'sams_guide' | 'clusters' | 'competitors' | 'unused'

/** One name from a Competitors tab. key = what Angel ticks to approve a new one. */
export interface SheetCompetitor {
  key: string
  written: string
  name: string | null
  code: string | null
  action: string
  /** New name with a free code: saved only if ticked. */
  approvable: boolean
}

export interface SheetClusterPage {
  category: string
  name: string
  url: string | null
  priority: 'high' | 'medium' | 'low' | null
  status: PageStatus
  primary: string | null
  keywords: number
}

export interface SheetTabPlan {
  name: string
  kind: SheetTabKind
  /** How it was recognised, or why it isn't used. */
  why: string
  rows: number
  /** Set when this tab won't be applied (the reason). */
  blocked: string | null
  masterDb?: ImportPreview
  samsGuide?: SamsGuidePlan
  clusters?: { pages: SheetClusterPage[]; unmatched: { page: string; role: string; keyword: string }[]; onTwoPages: { keyword: string; kept: string; skipped: string }[] }
  competitors?: SheetCompetitor[]
}

/** The whole-Sheet dry run. Nothing is saved until Apply. Tabs apply in this order: Master DB, Sam's Guide, Clusters, Competitors. */
/** Whose Sheet is it? matches = false → a red warning, and Apply needs “Yes, it’s for this client”. */
export interface SheetOwner {
  matches: boolean
  /** The business the Sheet seems to be about (when it isn’t this client). */
  otherName: string | null
  reasons: string[]
}

export interface SheetPlan {
  fileName: string
  owner: SheetOwner
  tabs: SheetTabPlan[]
  /** Keywords Sam's Guide Top 10 and the Clusters tab put on different pages (Clusters wins). */
  crossCheck: { keyword: string; samsGuide: string; clusters: string }[]
}

export interface SheetApplyResult {
  importId: string | null
  tabs: { name: string; kind: SheetTabKind; status: 'applied' | 'skipped' | 'failed' | 'not_run'; message: string }[]
}

// ---- Settings › Claude usage (from seo_ai_log, migration 0006; estimates at call time) ---------------------------

export interface AiUsageSum {
  calls: number
  failed: number
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export interface AiUsage {
  /** "2026-11" (UTC) */
  thisMonth: string
  total: AiUsageSum
  /** Newest first, up to 12. */
  months: (AiUsageSum & { month: string })[]
  tasks: (AiUsageSum & { task: string })[]
  /** siteId null = the client was deleted (its calls still count). */
  clients: { siteId: string | null; name: string; month: AiUsageSum; all: AiUsageSum; lastAt: string }[]
}

/** What deleting a client would remove (Client setup › Delete client; nothing deleted). */
export interface ClientDeleteCheck {
  name: string
  archived: boolean
  keywords: number
  imports: number
  pages: number
  notes: number
}

// ---- Phase 2a · Google (Search Console + GA4) per client, migration 0016 ------------------------------------

export interface GoogleLink {
  /** "sc-domain:example.com" or "https://example.com/" */
  gscProperty: string | null
  /** "properties/123456" */
  ga4Property: string | null
  queryWords: string[]
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
}

/** What the Connect panel needs: the email to add, the client's saved link, and what the service account can see. */
export interface GoogleSetup {
  /** null = GOOGLE_SERVICE_ACCOUNT_JSON isn't set on the server */
  serviceEmail: string | null
  /** false = migration 0016 hasn't been run yet */
  tableReady: boolean
  link: GoogleLink | null
  gscSites: { property: string; permission: string }[]
  ga4Properties: { property: string; name: string; account: string }[]
  /** Why a list is empty (no access yet, API not enabled…) */
  listErrors: string[]
}

/** A 7-day pull that saves nothing (the Test button). null = not asked. */
export interface GoogleTestResult {
  from: string
  to: string
  gsc: { ok: true; clicks: number; impressions: number; ctr: number; position: number } | { ok: false; error: string } | null
  ga4: { ok: true; sessions: number; engagedSessions: number; users: number } | { ok: false; error: string } | null
}

// ---- Phase 2b · Google numbers on the Overview (seo_metric_daily + seo_metric_top) ----------------------------

export type MetricRange = '28d' | '3m' | '12m'

/** Totals for one period. null = no data for that period (never 0). */
export interface GscTotals {
  clicks: number | null
  impressions: number | null
  /** clicks / impressions */
  ctr: number | null
  /** impression-weighted average position */
  position: number | null
  days: number
}

export interface Ga4Totals {
  sessions: number | null
  engagedSessions: number | null
  users: number | null
  keyEvents: number | null
  /** average session duration, seconds */
  avgSeconds: number | null
  days: number
}

export interface MetricsOverview {
  range: MetricRange
  linked: { gsc: boolean; ga4: boolean }
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
  gsc: null | {
    from: string
    to: string
    prevFrom: string
    prevTo: string
    /** false = the history doesn't cover the whole previous period: no change shown */
    comparable: boolean
    /** current baseline date (dashed marker); null = no baseline yet */
    baselineDay: string | null
    now: GscTotals
    prev: GscTotals
    /** one point per day (28d, 3m) or week (12m); null = no data that day */
    series: { day: string; clicks: number | null; impressions: number | null; ctr: number | null; position: number | null }[]
    queries: { label: string; clicks: number; impressions: number; ctr: number; position: number; prevPosition: number | null }[]
    pages: { label: string; clicks: number; impressions: number }[]
  }
  ga4: null | {
    from: string
    to: string
    comparable: boolean
    now: Ga4Totals
    prev: Ga4Totals
    /** sessions per day (28d), week (3m) or month (12m) */
    bars: { label: string; from: string; to: string; sessions: number | null }[]
  }
}

export interface MetricsSyncResult {
  gscDays: number
  ga4Days: number
  topRows: number
  errors: string[]
}

// ---- Phase 2c · Semrush Position Tracking (seo_rank_snapshots) ------------------------------------------------

/** Dry run of a Position Tracking CSV (nothing saved). */
export interface RankPlan {
  /** The tracked domain as Semrush writes it, e.g. "*.anassabeauty.com/*" */
  domain: string
  /** Dates with positions in the file (YYYY-MM-DD), oldest first */
  dates: string[]
  /** Semrush period line, e.g. "20261117 - 20261118" */
  period: string | null
  keywords: number
  /** Keywords that are already in this client's Database (the rest are listed, not created) */
  matched: number
  unmatched: string[]
  /** For the newest date in the file */
  latest: { date: string; ranked: number; top3: number; top10: number; avgPosition: number | null }
  /** Rows already saved for these dates (an import of the same dates replaces them) */
  replaces: number
  /** Other domains in the file (competitors): not imported */
  otherDomains: string[]
}

export interface RankRow {
  keyword: string
  position: number | null
  prevPosition: number | null
  landingUrl: string | null
  /** The page that owns this keyword (Clusters), when it differs from the ranking URL */
  swappedWith: { name: string; url: string } | null
}

export interface RankingsOverview {
  /** null = no Position Tracking CSV yet */
  latest: string | null
  previous: string | null
  lastImport: { fileName: string; at: string } | null
  buckets: { label: string; now: number; prev: number | null }[]
  moves: { keyword: string; from: number | null; to: number | null }[]
  rows: RankRow[]
  swapped: number
  avgPosition: number | null
}
