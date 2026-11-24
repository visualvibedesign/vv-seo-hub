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
  updatedAt: string
}

export interface ClientCounts {
  keywords: number
  imports: number
  pages: number
  lastImportAt: string | null
}

export interface ClientSummary {
  siteId: string
  siteUrl: string
  name: string
  city: string | null
  state: string | null
  status: ClientStatus
  categories: { code: CategoryCode; name: string }[]
  counts: ClientCounts
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
  categories: { code: CategoryCode; name: string; services: { id?: string; name: string }[] }[]
  areas: { code: AreaCode; name: string; state: string; status: AreaStatus }[]
}

export interface SiteIdCheck {
  siteUrl: string
  siteId: string
  /** Name of another client that already has this site id. */
  takenBy: string | null
}

// ---- CSV imports (phase 1, step 4) ---------------------------------------------------

export type ImportSource = 'kp' | 'semrush' | 'sheet'
export type ImportReport = 'kp_ideas' | 'kp_volumes' | 'keyword_magic' | 'keyword_overview' | 'keyword_gap' | 'master_db'

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
  /** KP file totals (rows with no keyword, e.g. "All" / "Richmond County"): kept on the import, not shown in the table. */
  totals: { segment: string; volume: string }[]
  rows: ImportRow[]
  /** keyword keys whose different Semrush numbers should replace the filled ones ("Use the new numbers"). */
  useNew?: string[]
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
}
