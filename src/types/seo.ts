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
  /** Date the export's change columns compare with (period start); null = no change column */
  compareFrom: string | null
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
  /** Position at the comparison date (Semrush's own "difference" column, or the previous saved CSV date) */
  prevPosition: number | null
  landingUrl: string | null
  /** The page that owns this keyword (Clusters), when it differs from the ranking URL */
  swappedWith: { name: string; url: string } | null
  /** Exactly as exported (text: "n/a" stays "n/a"); null = column not in the CSV */
  volume: string | null
  kd: string | null
  visibility: number | null
  traffic: number | null
  /** Semrush's result type: "local" = local pack (map pin); anything else but "organic" = another SERP feature */
  serpType: string | null
  /** Positions over saved dates (oldest first), for the sparkline (3+ dates) */
  history: (number | null)[]
}

export interface RankingsOverview {
  /** null = no Position Tracking CSV yet */
  latest: string | null
  /** The date "Change" compares with (the export's period start, or the previous saved CSV date) */
  previous: string | null
  lastImport: { fileName: string; at: string } | null
  buckets: { label: string; now: number; prev: number | null }[]
  moves: { keyword: string; from: number | null; to: number | null }[]
  rows: RankRow[]
  swapped: number
  /** Average over ranking keywords only */
  avgPosition: number | null
  ranking: number
  total: number
  /** Which optional columns the CSV had */
  columns: { volume: boolean; kd: boolean; visibility: boolean; traffic: boolean; serpType: boolean }
  /** Sum of the keywords' visibility (Semrush's visibility %), its value at the comparison date, and per saved date */
  visibility: { now: number; prev: number | null; series: { date: string; value: number }[] } | null
  traffic: { now: number; prev: number | null } | null
  /** Keywords whose result type is "local" (map pin); null = no type column */
  localPack: number | null
  /** Keywords whose result type is "ai overview" (cited in Google's AI Overview); null = no type column */
  aiOverview: number | null
  /** Tracked keywords not ranking yet, biggest volume first */
  opportunities: { keyword: string; volume: string | null; kd: string | null }[]
}

// ---- Phase 2d · GBP numbers (typed monthly) + Whitespark map grid (typed now, CSV later) ----------------------

export interface GbpSnapshot {
  id: string
  periodFrom: string
  periodTo: string
  views: number | null
  /** Profile views breakdown (GBP › Performance), optional: null = unknown */
  viewsSearchDesktop: number | null
  viewsSearchMobile: number | null
  viewsMapsDesktop: number | null
  viewsMapsMobile: number | null
  calls: number | null
  directions: number | null
  websiteClicks: number | null
  reviews: number | null
  rating: number | null
  newestReviewOn: string | null
  typedBy: string | null
  note: string | null
  updatedAt: string
}

export type GbpInput = Omit<GbpSnapshot, 'id' | 'updatedAt'>

export interface MapGrid {
  id: string
  keyword: string
  scannedOn: string
  gridSize: number
  spacing: string | null
  /** A town / area name only, never an address */
  centerLabel: string | null
  source: 'csv' | 'typed' | 'screenshot'
  /** ranks[row][col]: 1–20, null = not found / 20+ */
  ranks: (number | null)[][]
  createdAt: string
}

export type MapGridInput = Pick<MapGrid, 'keyword' | 'scannedOn' | 'gridSize' | 'spacing' | 'centerLabel' | 'ranks'>

export interface LocalState {
  /** Newest period first */
  gbp: GbpSnapshot[]
  /** Newest scan first */
  grids: MapGrid[]
  /** 2g · the open ("Ready to review") GBP screenshot read, or null. Counts nowhere until approved. */
  gbpRead: GbpScreenshotRead | null
}

/** 2g · numbers Claude read from a GBP Performance screenshot. null = not readable (never 0, never a guess). */
export interface GbpScreenshotRead {
  id: string
  createdAt: string
  summary: string
  /** The period text exactly as shown on the screenshot (never used as a date by itself) */
  periodShown: string | null
  /** Fields Claude couldn't read clearly (keys) and their labels */
  unread: string[]
  unreadLabels: string[]
  values: {
    /** Both null unless the whole period (with its year) was clearly shown: Angel picks it in the form */
    periodFrom: string | null
    periodTo: string | null
    views: number | null
    viewsSearchDesktop: number | null
    viewsSearchMobile: number | null
    viewsMapsDesktop: number | null
    viewsMapsMobile: number | null
    calls: number | null
    websiteClicks: number | null
    directions: number | null
  }
}

/** Before reading a screenshot with Claude: likely cost (count_tokens with the image + an output guess). */
export interface ScreenshotEstimate {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ---- Phase 2e · Baseline (seo_baselines + seo_baseline_values, saved through seo_save_baseline(), migration 0018) ----

/** Site check comes later; it is never saved until it exists. */
export type BaselineSource = 'gsc' | 'ga4' | 'semrush' | 'gbp' | 'whitespark'

/**
 * One source's numbers with their own dates. Metric keys per source:
 * gsc: impressions, clicks, ctr, position · ga4: sessions, users, key_events, avg_engagement_sec ·
 * semrush: avg_position, top3, top10, top100, tracked · gbp: views, calls, directions, website_clicks, reviews, rating ·
 * whitespark: avg_rank, top3, found, points (+ texts: keyword, grid, spacing).
 * A value of null = missing (never 0).
 */
export interface BaselineSnapshot {
  source: BaselineSource
  from: string | null
  to: string | null
  values: Record<string, number | null>
  texts: Record<string, string>
}

export interface BaselineSummary {
  id: string
  label: string | null
  note: string | null
  savedAt: string
  /** Sources saved in it */
  sources: BaselineSource[]
}

export interface BaselineState {
  /** Sources that must be saved: GSC, GA4, Semrush, GBP always; Whitespark only once the client has a map grid scan */
  required: BaselineSource[]
  /** The current baseline, or null before the first save */
  current: (BaselineSummary & { snapshots: BaselineSnapshot[] }) | null
  /** Required sources saved in the current baseline */
  savedRequired: number
  /** The numbers a save would freeze right now (also "now" for Baseline vs now). A source with no data is left out. */
  live: BaselineSnapshot[]
  /** Every baseline for the client, newest first (the current one included) */
  history: BaselineSummary[]
}

// ---- Phase 2f · Monthly reports (seo_reports + seo_report_actions, migrations 0016 + 0019) ----------------------

/**
 * Frozen when the report is made (and on "Refresh numbers" while it's a draft). Month values per source:
 * Search Console + GA4 = the 28 days ending on the month's last pulled day (same length as the baseline);
 * Semrush = the latest CSV dated inside the month; GBP = the period typed for the month; map grid = the latest scan
 * inside the month. A source with nothing for the month is in `missing` with the reason, never 0 or an older number.
 */
export interface ReportNumbers {
  month: string
  baseline: { id: string; label: string | null; savedAt: string; snapshots: BaselineSnapshot[] }
  snapshots: BaselineSnapshot[]
  missing: { source: BaselineSource; reason: string }[]
  /** Sources the client uses (the map grid only once it has a scan) */
  sources: BaselineSource[]
  frozenAt: string
}

export type ReportActionKind = 'page' | 'gbp' | 'links' | 'tracking' | 'other'

export interface ReportAction {
  id: string
  kind: ReportActionKind
  body: string
  owner: string | null
  due: string | null
  done: boolean
}

export interface ReportSummary {
  id: string
  /** First day of the month, YYYY-MM-01 */
  month: string
  /** "November 2026 report" */
  title: string
  status: 'draft' | 'sent'
  sentOn: string | null
  /** The Search Console window under the title, e.g. "Nov 1 – Nov 28, 2026 · 28 days" (null = no Search Console) */
  dates: string | null
  hasNotes: boolean
  hasDraft: boolean
  updatedAt: string
}

export interface Report extends ReportSummary {
  baselineId: string | null
  numbers: ReportNumbers
  /** Approved text only */
  notes: string | null
  /** Claude's draft, waiting for review */
  notesDraft: string | null
  notesDraftAt: string | null
  notesApprovedAt: string | null
  actions: ReportAction[]
}

export interface ReportsState {
  reports: ReportSummary[]
  /** The last 6 months (newest first) and whether each has a report: what "Create report" can offer */
  months: { month: string; title: string; exists: boolean; current: boolean; beforeBaseline: boolean }[]
  /** Reports start from the month the current baseline ends in (decided Nov 28); null = no baseline */
  firstMonth: string | null
  /** Search Console clicks per calendar month, last 6 (oldest first); partial = the month isn't fully pulled */
  clicksByMonth: { month: string; clicks: number | null; partial: boolean }[]
  hasBaseline: boolean
}

/** Before "Draft with Claude": what the call will likely cost (count_tokens for the input, a generous output guess). */
export interface ReportNotesEstimate {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ---- Phase 3 · Pages: sitemap + hotspots, site plan (migration 0021) --------------------------------------------

export type PageType = 'home' | 'service' | 'location' | 'supporting'
export type PageAction = 'keep' | 'improve' | 'new'
export type SiteStructure = 'service_first' | 'location_first' | 'flat'

/** A page of the ideal sitemap: the Clusters page + its code, type, parent, keep / improve / new and hotspots. */
export interface SitePage extends ClusterPage {
  /** "P1", "P2"… (null until set) */
  code: string | null
  type: PageType | null
  parentId: string | null
  action: PageAction | null
  seoTitle: string | null
  metaDescription: string | null
  h1: string | null
  /** The target permalink (where the page should live); `url` stays the current live URL */
  urlTarget: string | null
  hotspotsAt: string | null
  /** Google ranks another URL for this page's keyword (latest Position Tracking CSV), or null */
  swappedUrl: string | null
}

export interface PagesState {
  structure: SiteStructure
  siteUrl: string
  /** The client's state abbreviation (for the "full state name in the title / abbreviation in the URL" checks) */
  state: string | null
  pages: SitePage[]
  /** Pages missing a code, type or keep / improve / new (the backfill can fill them) */
  needsBackfill: number
  /** The redirects queue, newest first */
  redirects: SiteRedirect[]
  /** Claude's open hotspot drafts (Ready to review), one per page; empty when none */
  drafts: HotspotDraft[]
  /** When those drafts were made */
  draftsAt: string | null
}

export interface PagesBackfillPlan {
  changes: { pageId: string; name: string; code: string | null; type: PageType | null; action: PageAction | null }[]
  applied: boolean
}

export interface HotspotsInput {
  pageId: string
  code: string | null
  type: PageType | null
  action: PageAction | null
  seoTitle: string | null
  metaDescription: string | null
  h1: string | null
  urlTarget: string | null
}

export type RedirectStatus = 'queued' | 'sent' | 'live'

/** A redirect old → new, queued when a live page's URL changes (sent to the site later, phase 5). */
export interface SiteRedirect {
  id: string
  pageId: string | null
  pageCode: string | null
  pageName: string | null
  oldUrl: string
  newUrl: string
  why: string | null
  status: RedirectStatus
  updatedAt: string
}

/** Phase 3 step 4 · Claude's hotspots for one page ("Ready to review" until saved or skipped). */
export interface HotspotDraft {
  pageId: string
  seoTitle: string | null
  metaDescription: string | null
  h1: string | null
  url: string | null
  /** Suggested opening / closing lines for the page copy (used later in the page brief) */
  opening: string | null
  closing: string | null
  /** What Claude flagged (gaps, unknown facts) */
  notes: string | null
}

export interface HotspotsEstimate {
  model: string
  pages: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ---- Phase 3 step 5 · BrandScript (StoryBrand A–P, once per client; seo_brandscripts, migration 0021) ------------

export type BrandKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P'

export interface BrandScript {
  /** Answers as written (missing key = empty) */
  answers: Partial<Record<BrandKey, string>>
  /** "Read aloud and confirmed"; cleared when an answer changes */
  confirmedAt: string | null
  updatedAt: string | null
  /** Claude's open draft (Ready to review) or null */
  draft: { answers: Partial<Record<BrandKey, string>>; notes: string | null; createdAt: string } | null
}

// ---- Phase 3 step 6 · Page brief (Day 5 worksheet + StoryBrand copy V1 / V2; seo_page_briefs, migration 0021) ----

export type BriefVersion = 'v1' | 'v2'
export type SectionStatus = 'to_write' | 'drafted' | 'done'
/** "1".."11" */
export type SectionKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11'
export type WorksheetKey = 'opportunity' | 'whyFirst' | 'customerNeed' | 'buyingQuestions' | 'proof' | 'desiredAction' | 'linksFrom' | 'linksTo' | 'missingInputs'

export interface PageBriefDraft {
  sections: Partial<Record<SectionKey, string>>
  worksheet: Partial<Record<WorksheetKey, string>>
  notes: string | null
  version: BriefVersion
  createdAt: string
}

export interface PageBrief {
  page: { id: string; code: string | null; name: string; type: PageType | null; seoTitle: string | null; metaDescription: string | null; h1: string | null; url: string | null; primary: string | null }
  version: BriefVersion
  worksheet: Partial<Record<WorksheetKey, string>>
  sections: Partial<Record<SectionKey, { text: string; status: SectionStatus }>>
  updatedAt: string | null
  /** Claude's open draft for this page (Ready to review) */
  draft: PageBriefDraft | null
  /** BrandScript answers filled (of 16) and whether confirmed: Claude writes from it */
  brandFilled: number
  brandConfirmed: boolean
}

// ---- Phase 4a · GBP check (Sam Day 4): map pack per service, Whitespark factors, business details (migration 0022) ----

export type MapServiceCode = 'S1' | 'S2' | 'S3'

/** The Maps search used for one service (Chrome guest profile, ads skipped) */
export interface MapSearch {
  category: MapServiceCode
  search: string | null
  checkedOn: string | null
  /** Unpaid results counted (0–20) */
  resultsCounted: number | null
}

/** One map-pack row. isClient = the client's own row (pinned at the bottom). Missing = null, never 0. */
export interface MapCompetitor {
  id: string
  category: MapServiceCode
  isClient: boolean
  rank: number | null
  name: string
  primaryCategory: string | null
  additionalCategories: string[]
  reviews: number | null
  rating: number | null
  newestReviewOn: string | null
  note: string | null
}

export type MapCompetitorInput = Omit<MapCompetitor, 'id'> & { id?: string | null }

export type GbpFactorKey = 'primary_category' | 'name_keywords' | 'open_hours' | 'address_shown' | 'additional_categories' | 'reviews_text' | 'review_recency' | 'website_match'
export type GbpFactorStatus = 'to_check' | 'ok' | 'needs_work' | 'na'

export interface GbpFactor {
  key: GbpFactorKey
  status: GbpFactorStatus
  note: string | null
}

export type ProfileCheckKey = 'name_hours' | 'categories' | 'description' | 'attributes' | 'main_services' | 'contact_tested' | 'photos'

/** GBP business details: PUBLIC fields only (must match the website). There is no address field, by design. */
export interface GbpProfile {
  businessName: string | null
  website: string | null
  phone: string | null
  email: string | null
  primaryCategory: string | null
  additionalCategories: string[]
  serviceAreas: string | null
  hours: string | null
  holidayHours: string | null
  socials: string[]
  bookingUrl: string | null
  reviewUrl: string | null
  /** Up to 750 characters, no em dashes, ends with a call to action */
  description: string | null
  /** Address shown on GBP? yes / no only (null = not checked) */
  addressShown: boolean | null
  profileChecks: Partial<Record<ProfileCheckKey, { done: boolean; note: string | null }>>
  checkedOn: string | null
  waitingOnGoogle: string | null
  checkAgainOn: string | null
}

export interface GbpCheckState {
  clientName: string
  /** Service names for the S1–S3 tabs (null = not named yet) */
  services: Record<MapServiceCode, string | null>
  searches: MapSearch[]
  competitors: MapCompetitor[]
  /** All 8 factors (missing rows come back as "to_check") */
  factors: GbpFactor[]
  profile: GbpProfile
  /** 4a · the open ("Ready to review") Maps / Pleper screenshot read, or null. Nothing is in the list until approved. */
  mapRead: MapShotRead | null
  /** The client's own reviews from the newest typed GBP period with reviews (for the pinned row when not typed here) */
  fromGbp: { reviews: number | null; rating: number | null; newestReviewOn: string | null; periodTo: string } | null
}

/** 4a · one row Claude read from a Maps / Pleper screenshot. Unclear = null (never 0, never a guess). */
export interface MapShotRow {
  rank: number | null
  name: string
  primaryCategory: string | null
  additionalCategories: string[]
  reviews: number | null
  rating: number | null
  newestReviewOn: string | null
  /** The name looks like the client's own business (saved as the client row if kept) */
  looksLikeClient: boolean
}

export interface MapShotRead {
  id: string
  createdAt: string
  summary: string
  category: MapServiceCode
  /** The search text shown in the Maps search box, if readable */
  searchShown: string | null
  rows: MapShotRow[]
  /** What Claude couldn't read clearly / skipped (ads, cut-off rows) */
  notes: string[]
}

/** Approving: the rows Angel kept (edited), saved through the normal competitor rules. */
export type MapShotApproveRow = Omit<MapShotRow, 'looksLikeClient'> & { isClient: boolean }

// ---- Phase 4b · GBP care (Sam Day 7): products, reviews, 13-week posts (migration 0023) ----

export type ProductStatus = 'not_added' | 'added'
export type ReviewChannel = 'email' | 'text' | 'in_person' | 'other'
export type ReviewResult = 'waiting' | 'reviewed' | 'no_reply' | 'declined'
export type PostStatus = 'not_drafted' | 'drafted' | 'approved' | 'scheduled' | 'live'

/** A sitemap page a product or post can link to (never Home for products) */
export interface CarePage {
  id: string
  code: string | null
  name: string
  type: PageType | null
  status: PageStatus
  /** Live URL, or the target permalink, or null */
  url: string | null
}

export interface GbpProduct {
  id: string
  pageId: string | null
  name: string
  description: string | null
  imageReady: boolean
  status: ProductStatus
}

export interface ReviewRequest {
  id: string
  /** Short ref only: never a name, email or phone */
  customerRef: string
  askedOn: string
  channel: ReviewChannel
  result: ReviewResult
  followUpOn: string | null
}

export interface GbpPost {
  week: number
  /** null = this week has no saved row yet */
  id: string | null
  postOn: string | null
  topic: string | null
  takeaway: string | null
  body: string | null
  cta: string
  pageId: string | null
  /** The page URL + UTM (worked out by the server) */
  linkUrl: string | null
  imageNeed: string | null
  status: PostStatus
}

export interface GbpCareSettings {
  reviewTarget: number
  roundStartedOn: string | null
  postsStartOn: string | null
  nextPostBatchOn: string | null
  careChecks: Record<string, boolean>
}

export interface GbpCareState {
  clientName: string
  city: string | null
  care: GbpCareSettings
  /** Service pages (products are one per service page) */
  servicePages: CarePage[]
  /** Every page a post can link to (live first) */
  pages: CarePage[]
  products: GbpProduct[]
  requests: ReviewRequest[]
  /** Reviews this round: results "reviewed" asked on / after the round start (all if no start) */
  reviewed: number
  reviewEmail: { templateName: string; subject: string; body: string; missing: string[] }
  /** 13 slots for the quarter that starts on care.postsStartOn (empty when no start date) */
  posts: GbpPost[]
  /** Claude's open product descriptions draft (Ready to review), or null */
  productDraft: ProductDraft | null
  /** Claude's open 13-week posts draft (Ready to review), or null */
  postsDraft: PostsDraft | null
}

/** 4b step 4 · Claude's product descriptions draft (one per service page) */
export interface ProductDraft {
  id: string
  createdAt: string
  items: { pageId: string; code: string | null; name: string; description: string }[]
  notes: string | null
}

/** 4b step 4 · Claude's 13-week post plan (text for the first weeks, or all) */
export interface PostsDraft {
  id: string
  createdAt: string
  quarterStart: string
  weeks: { week: number; topic: string; takeaway: string | null; body: string | null; pageId: string | null; imageNeed: string | null }[]
  notes: string | null
}

export interface CareEstimate {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ---- Phase 4c · Links (Sam Days 8–9, migration 0024) ----

export type CitationOwner = 'brightlocal' | 'me'
export type CitationStatus = 'planned' | 'submitted' | 'live'
export type FoundVia = 'R' | 'S' | 'C' | 'Cit' | 'Sp'
export type OpportunityHow = 'claim' | 'apply' | 'contact' | 'join' | 'other'
export type PremierKind = 'chamber' | 'trade_group' | 'certification' | 'referral_partner' | 'vendor' | 'organization' | 'editorial'

export interface LinkSettings {
  weeklyPace: number | null
  citationStartWeek: number
  waveStarted: [string | null, string | null, string | null]
  sponsorBudget: string | null
}

export interface Citation {
  id: string
  /** List order (null = aggregator row like the YP network, one per wave) */
  rowNo: number | null
  wave: 1 | 2 | 3
  name: string
  domain: string | null
  /** As exported (BrightLocal) */
  domainAuthority: number | null
  verification: string | null
  owner: CitationOwner
  status: CitationStatus
  liveUrl: string | null
  note: string | null
}

export interface GapRow {
  id: string
  domain: string
  authorityScore: number | null
  matches: number | null
  matchesOf: number | null
  competitors: string[]
  skipped: boolean
  /** Already on the citation waves (wave number), or null */
  onWave: number | null
  /** Already on the opportunity list (row #), or null */
  onList: number | null
}

export interface LinkOpportunity {
  id: string
  rowNo: number
  pageUrl: string | null
  domain: string
  foundVia: FoundVia[]
  authorityScore: number | null
  competitorMatches: number | null
  why: string | null
  how: OpportunityHow | null
  cost: string | null
  nextAction: string | null
  nextActionOn: string | null
  thisWeek: boolean
  sent: boolean
  approved: boolean
  live: boolean
  liveCheckedOn: string | null
  note: string | null
}

export interface PremierLink { id: string; kind: PremierKind; name: string; pageOrRoute: string | null; nextAction: string | null; nextActionOn: string | null }
export interface Sponsorship { id: string; cause: string; tierCost: string | null; why: string | null; pagePublic: boolean | null; onMainSite: boolean | null; staysUp: string | null; shows: ('name' | 'logo' | 'profile' | 'link')[]; status: 'considering' | 'committed' | 'done' }
export interface SerpSearch { id: string; search: string; style: 'customer' | 'lister'; runOn: string | null; found: string | null }
export interface AuthorityCheck { id: string; checkedOn: string; monthMark: 3 | 6 | 9 | 12 | null; authorityScore: number | null; referringDomains: number | null; backlinks: number | null; note: string | null }

export interface LinksState {
  clientName: string
  city: string | null
  settings: LinkSettings
  citations: Citation[]
  /** Backlink Gap competitors C1–C4 (Sam's Guide) */
  competitors: { code: string; name: string }[]
  gap: GapRow[]
  opportunities: LinkOpportunity[]
  premier: PremierLink[]
  sponsorships: Sponsorship[]
  serp: SerpSearch[]
  authority: AuthorityCheck[]
  /** Links ticked Live (opportunities with a checked date in the last 7 days, + citations Live) */
  liveThisWeek: number
}

/** A pasted list, before it's saved: what each line became, and lines that were skipped (with why). */
export interface PastePlan<T> {
  rows: T[]
  skipped: { line: string; why: string }[]
}
