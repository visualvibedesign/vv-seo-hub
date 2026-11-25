// Clients: list, one client, save (add / edit), site id check, account checklist.
// Tables: seo_clients, seo_client_categories, seo_client_services, seo_client_areas, seo_client_accounts.
// No address is ever stored (there is no column for it).
import { z } from 'zod'
import { ACCOUNTS, ACCOUNT_KINDS, accountLinkProblem, AREA_CODES, CATEGORY_CODES, CORE_ACCOUNT_KINDS, DEFAULT_FAQ_NAME } from '../../src/lib/clientSetup.js'
import { checkIndustry, IndustryInputError } from './industryService.js'
import { GUIDE_STEPS } from '../../src/lib/guide.js'
import { stripStateSuffix } from '../../src/lib/templates.js'
import type {
  AccountKind,
  AccountStatus,
  AreaCode,
  AreaStatus,
  CategoryCode,
  ClientAccount,
  ClientArea,
  ClientCategory,
  ClientCounts,
  ClientDetail,
  ClientIndustry,
  ClientInput,
  ClientStatus,
  ClientSummary,
  GuideSummary,
  SiteIdCheck,
} from '../../src/types/seo.js'
import type { ClientDeleteCheck } from '../../src/types/seo.js'
import { DatabaseError, db, must } from '../clients/supabase.js'
import { normalizeSiteUrl, siteIdFor, SiteUrlError } from '../utils/siteId.js'

/** A problem the person can fix (shown on the form). */
export class ClientInputError extends Error {}

// ---- Rows as Supabase returns them ---------------------------------------------
export type ClientRow = {
  id: string
  site_id: string
  site_url: string
  name: string
  city: string | null
  state: string | null
  ideal_client: string | null
  usp: string | null
  success_12mo: string | null
  status: ClientStatus
  /** null until migration 0002 runs, or when no template was picked. */
  industry?: ClientIndustry | null
  /** Both undefined until migration 0008 runs. */
  out_of_scope_words?: string[]
  neighbourhood_words?: string[]
  /** Undefined until migration 0009 runs. */
  brand_words?: string[]
  notes: string | null
  created_at: string
  updated_at: string
}
type CategoryRow = { id: string; client_id: string; code: CategoryCode; name: string; in_matrix: boolean; sort: number }
type ServiceRow = { id: string; client_id: string; category_id: string; name: string; sort: number }
type AreaRow = { id: string; code: AreaCode; name: string | null; state: string | null; status: AreaStatus }
type AccountRow = { id: string; kind: AccountKind; status: AccountStatus; next_action: string | null; note: string | null; link?: string | null; updated_at: string }
const toAccount = (a: AccountRow): ClientAccount => ({ id: a.id, kind: a.kind, status: a.status, nextAction: a.next_action, note: a.note, link: a.link ?? null, updatedAt: a.updated_at })

const byCode = <T extends { code: string }>(order: readonly string[]) => (a: T, b: T) => order.indexOf(a.code) - order.indexOf(b.code)

// ---- Read ------------------------------------------------------------------------

/** Counts per client (head-only counts, run in parallel). `lastWorkedAt` = latest edit, import or keyword change. */
async function countsFor(clients: Pick<ClientRow, 'id' | 'updated_at'>[]): Promise<Map<string, ClientCounts>> {
  const out = new Map<string, ClientCounts>()
  const head = { count: 'exact', head: true } as const
  await Promise.all(
    clients.map(async ({ id, updated_at }) => {
      const kws = () => db().from('seo_keywords').select('id', head).eq('client_id', id)
      const [svc, kw, tracked, noRole, pg, imp, pending, lastKw] = await Promise.all([
        db().from('seo_client_services').select('id', head).eq('client_id', id),
        kws(),
        kws().eq('track', true),
        kws().is('role', null),
        db().from('seo_pages').select('id', head).eq('client_id', id),
        db().from('seo_imports').select('created_at', { count: 'exact' }).eq('client_id', id).order('created_at', { ascending: false }).limit(1),
        // Only the 6 core accounts count as "pending" (clientSetup CORE_ACCOUNT_KINDS).
        db().from('seo_client_accounts').select('id', head).eq('client_id', id).eq('status', 'pending').in('kind', CORE_ACCOUNT_KINDS),
        db().from('seo_keywords').select('updated_at').eq('client_id', id).order('updated_at', { ascending: false }).limit(1),
      ])
      for (const r of [svc, kw, tracked, noRole, pg, imp, pending, lastKw]) if (r.error) throw new DatabaseError(`Counting this client’s data: ${r.error.message}`)
      const lastImportAt = (imp.data as { created_at: string }[] | null)?.[0]?.created_at ?? null
      const lastKwAt = (lastKw.data as { updated_at: string }[] | null)?.[0]?.updated_at ?? null
      out.set(id, {
        services: svc.count ?? 0,
        keywords: kw.count ?? 0,
        imports: imp.count ?? 0,
        pages: pg.count ?? 0,
        lastImportAt,
        tracked: tracked.count ?? 0,
        needsRole: noRole.count ?? 0,
        accountsPending: pending.count ?? 0,
        lastWorkedAt: [updated_at, lastImportAt, lastKwAt].filter((d): d is string => !!d).sort().pop()!,
      })
    }),
  )
  return out
}

/** Guide summary per client from seo_guide_progress: current = first step not done (9 = all done). */
export async function guideSummaries(clientIds: string[]): Promise<Map<string, GuideSummary>> {
  const rows = clientIds.length
    ? (must(
        await db().from('seo_guide_progress').select('client_id, step').eq('status', 'done').in('client_id', clientIds),
        'Loading guide progress',
      ) as { client_id: string; step: number }[])
    : []
  return new Map(clientIds.map((id) => [id, guideSummaryOf(rows.filter((r) => r.client_id === id).map((r) => r.step))]))
}

/** From the done step numbers (0–8). */
export function guideSummaryOf(doneSteps: number[]): GuideSummary {
  const done = new Set(doneSteps)
  let current = 0
  while (current < GUIDE_STEPS && done.has(current)) current++
  return { current, doneCount: done.size, doneSteps: [...done].sort((a, b) => a - b) }
}

export async function listClients(): Promise<ClientSummary[]> {
  const clients = must(await db().from('seo_clients').select('*').order('name'), 'Loading clients') as ClientRow[]
  const cats = must(
    await db().from('seo_client_categories').select('client_id, code, name').in('client_id', clients.map((c) => c.id)),
    'Loading service categories',
  ) as Pick<CategoryRow, 'client_id' | 'code' | 'name'>[]
  const [counts, guides] = await Promise.all([countsFor(clients), guideSummaries(clients.map((c) => c.id))])
  return clients.map((c) => ({
    ...summaryOf(c),
    categories: cats
      .filter((k) => k.client_id === c.id)
      .sort(byCode(CATEGORY_CODES))
      .map((k) => ({ code: k.code, name: k.name })),
    counts: counts.get(c.id)!,
    guide: guides.get(c.id)!,
  }))
}

function summaryOf(c: ClientRow) {
  return { siteId: c.site_id, siteUrl: c.site_url, name: c.name, city: c.city, state: c.state, status: c.status, industry: c.industry ?? null }
}

export async function clientRow(siteId: string): Promise<ClientRow | null> {
  if (!/^[0-9a-f]{32}$/.test(siteId)) return null
  return must(await db().from('seo_clients').select('*').eq('site_id', siteId).maybeSingle(), 'Loading the client') as ClientRow | null
}

export async function getClient(siteId: string): Promise<ClientDetail | null> {
  const c = await clientRow(siteId)
  return c ? clientDetail(c) : null
}

/** Everything about one client, from its row (one round of parallel queries). */
export async function clientDetail(c: ClientRow): Promise<ClientDetail> {
  const [cats, services, areas, accounts, counts, guides] = await Promise.all([
    db().from('seo_client_categories').select('*').eq('client_id', c.id),
    db().from('seo_client_services').select('*').eq('client_id', c.id).order('sort'),
    db().from('seo_client_areas').select('*').eq('client_id', c.id),
    db().from('seo_client_accounts').select('*').eq('client_id', c.id),
    countsFor([c]),
    guideSummaries([c.id]),
  ])
  const svc = must(services, 'Loading services') as ServiceRow[]
  const categories: ClientCategory[] = (must(cats, 'Loading service categories') as CategoryRow[]).sort(byCode(CATEGORY_CODES)).map((k) => ({
    id: k.id,
    code: k.code,
    name: k.name,
    inMatrix: k.in_matrix,
    services: svc.filter((s) => s.category_id === k.id).map((s) => ({ id: s.id, name: s.name, sort: s.sort })),
  }))
  const areaList: ClientArea[] = (must(areas, 'Loading areas') as AreaRow[])
    .sort(byCode(AREA_CODES))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, state: a.state, status: a.status }))
  const accountList: ClientAccount[] = (must(accounts, 'Loading the account checklist') as AccountRow[])
    .filter((a) => ACCOUNT_KINDS.includes(a.kind))
    .sort((a, b) => ACCOUNT_KINDS.indexOf(a.kind) - ACCOUNT_KINDS.indexOf(b.kind))
    .map(toAccount)
  return {
    ...summaryOf(c),
    idealClient: c.ideal_client,
    usp: c.usp,
    success12mo: c.success_12mo,
    notes: c.notes,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    categories,
    areas: areaList,
    accounts: accountList,
    outOfScopeWords: c.out_of_scope_words ?? [],
    neighbourhoodWords: c.neighbourhood_words ?? [],
    brandWords: c.brand_words ?? [],
    counts: counts.get(c.id)!,
    guide: guides.get(c.id)!,
  }
}

/** Live check for the form: cleaned URL, its plugin site id, and whether another client already has it. */
export async function checkSiteId(url: string, currentSiteId?: string): Promise<SiteIdCheck> {
  const siteUrl = normalizeSiteUrl(url)
  const siteId = siteIdFor(siteUrl)
  const other = siteId === currentSiteId ? null : await clientRow(siteId)
  return { siteUrl, siteId, takenBy: other?.name ?? null }
}

// ---- Save (add / edit) --------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max)
const InputSchema = z.object({
  siteUrl: z.string(),
  name: text(120).min(1, 'Add the client’s name.'),
  city: text(80),
  state: text(40),
  idealClient: text(2000),
  usp: text(2000),
  success12mo: text(2000),
  notes: text(4000),
  status: z.enum(['active', 'paused', 'archived']),
  // Any key from seo_industries (checked against the list on save).
  industry: z.string().regex(/^[a-z0-9_]{2,40}$/).nullable().default(null),
  categories: z
    .array(
      z.object({
        code: z.enum(['Home', 'S1', 'S2', 'S3', 'FAQ']),
        name: text(80),
        services: z.array(z.object({ id: z.string().uuid().optional(), name: text(80).refine((n) => !n.startsWith('~'), 'A service name was lost (it shows as “~…”). Type its real name again.') })).max(60),
      }),
    )
    .length(5),
  areas: z.array(z.object({ code: z.enum(['A1', 'A2', 'A3']), name: text(80), state: text(40), status: z.enum(['active', 'n_a']) })).length(3),
  accounts: z
    .array(z.object({ kind: z.enum(ACCOUNT_KINDS as [AccountKind, ...AccountKind[]]), status: z.enum(['ready', 'pending', 'n_a']), link: z.string().max(500).optional() }))
    .max(ACCOUNT_KINDS.length)
    .optional(),
  outOfScopeWords: z.array(text(60)).max(100).optional(),
  neighbourhoodWords: z.array(text(60)).max(200).optional(),
  brandWords: z.array(text(60)).max(50).optional(),
})

const FIELD_LABEL: Record<string, string> = {
  name: 'Client name',
  city: 'Main city',
  state: 'State',
  idealClient: 'Ideal client',
  usp: 'USP',
  success12mo: '12-month success',
  notes: 'Notes',
}

/** Turns a validation problem into a sentence that names the field ("The S2 category name is too long…"). */
function friendly(issue: z.core.$ZodIssue | undefined, raw: unknown): string {
  if (!issue) return 'Some fields aren’t right.'
  const path = issue.path
  const max = issue.code === 'too_big' ? ` (${String((issue as { maximum?: unknown }).maximum)} characters max)` : ''
  const input = raw as { categories?: { code?: string }[]; areas?: { code?: string }[] } | null
  if (path[0] === 'categories' && typeof path[1] === 'number') {
    const code = input?.categories?.[path[1]]?.code ?? 'A'
    if (path[2] === 'name')
      return issue.code === 'too_big'
        ? `The ${code} category name is too long${max}. Use a short name and put the services in the ${code} services box.`
        : `Check the ${code} category name.`
    if (path[2] === 'services') return issue.code === 'too_big' ? `A ${code} service name is too long${max}.` : `Check the ${code} services.`
  }
  if (path[0] === 'areas' && typeof path[1] === 'number') {
    const code = input?.areas?.[path[1]]?.code ?? 'An area'
    return `Check area ${code}${max ? `: too long${max}` : ''}.`
  }
  const label = FIELD_LABEL[String(path[0])]
  if (label) return issue.code === 'too_big' ? `${label} is too long${max}.` : issue.message.startsWith('Add') ? issue.message : `Check ${label}.`
  return 'Some fields aren’t right.'
}

function validate(raw: unknown): ClientInput {
  const parsed = InputSchema.safeParse(raw)
  if (!parsed.success) throw new ClientInputError(friendly(parsed.error.issues[0], raw))
  const input = parsed.data
  for (const code of CATEGORY_CODES) {
    const cat = input.categories.find((c) => c.code === code)
    if (!cat) throw new ClientInputError(`${code} is missing.`)
    if (code !== 'FAQ' && !cat.name) throw new ClientInputError(`Name the ${code === 'Home' ? 'Home' : code} category.`)
  }
  const seen = new Set<string>()
  for (const cat of input.categories) {
    cat.services = cat.services.filter((s) => s.name)
    for (const s of cat.services) {
      const key = s.name.toLowerCase()
      if (seen.has(key)) throw new ClientInputError(`“${s.name}” is listed twice. Each service can only be in one category.`)
      seen.add(key)
    }
  }
  // "Staten Island, NY" with state NY is stored as "Staten Island" (the state is its own field: never "…, NY, NY").
  input.city = stripStateSuffix(input.city, input.state)
  for (const a of input.areas) a.name = stripStateSuffix(a.name, a.state || input.state)
  for (const a of input.areas) {
    if (a.status === 'active' && !a.name) throw new ClientInputError(`Name area ${a.code}, or mark it N/A.`)
  }
  if (input.areas.find((a) => a.code === 'A1')?.status !== 'active') throw new ClientInputError('A1 is the main area: give it a name.')
  for (const a of input.accounts ?? []) {
    const problem = a.link ? accountLinkProblem(a.link) : ''
    if (problem) throw new ClientInputError(`${ACCOUNT_LABEL(a.kind)} link: ${problem}`)
  }
  return input
}

const orNull = (s: string) => (s ? s : null)
const ACCOUNT_LABEL = (k: AccountKind) => ACCOUNTS.find((a) => a.kind === k)?.label ?? k

/** Creates or updates a client. Returns its (possibly new) site id. */
export async function saveClient(raw: unknown, existingSiteId?: string): Promise<{ siteId: string }> {
  const input = validate(raw)
  try {
    await checkIndustry(input.industry)
  } catch (err) {
    if (err instanceof IndustryInputError) throw new ClientInputError(err.message)
    throw err
  }
  let site: SiteIdCheck
  try {
    site = await checkSiteId(input.siteUrl, existingSiteId)
  } catch (err) {
    if (err instanceof SiteUrlError) throw new ClientInputError(err.message)
    throw err
  }
  if (site.takenBy) throw new ClientInputError(`${site.takenBy} already uses this site (same site id).`)

  const fields = {
    site_id: site.siteId,
    site_url: site.siteUrl,
    name: input.name,
    city: orNull(input.city),
    state: orNull(input.state),
    ideal_client: orNull(input.idealClient),
    usp: orNull(input.usp),
    success_12mo: orNull(input.success12mo),
    notes: orNull(input.notes),
    status: input.status,
    industry: input.industry,
    // Migration 0008 columns: only sent when the form sends them (Edit client), as clean lowercase lists.
    ...(input.outOfScopeWords ? { out_of_scope_words: cleanWords(input.outOfScopeWords) } : {}),
    ...(input.neighbourhoodWords ? { neighbourhood_words: cleanWords(input.neighbourhoodWords) } : {}),
    ...(input.brandWords ? { brand_words: cleanWords(input.brandWords) } : {}),
  }

  try {
    return await writeClient(input, fields, existingSiteId, site.siteId)
  } catch (err) {
    // Migration 0002 adds seo_clients.industry. Until it runs, say so instead of a raw database error.
    if (err instanceof DatabaseError && /industry/i.test(err.message) && /column/i.test(err.message)) {
      throw new ClientInputError('The industry column is missing: run supabase/migrations/0002_seo_client_industry.sql in Supabase first.')
    }
    if (err instanceof DatabaseError && /(out_of_scope|neighbourhood)_words/i.test(err.message)) {
      throw new ClientInputError('The scope word columns are missing: run supabase/migrations/0008_seo_scope_words.sql in Supabase first.')
    }
    if (err instanceof DatabaseError && /brand_words/i.test(err.message)) {
      throw new ClientInputError('The brand words column is missing: run supabase/migrations/0009_seo_industries.sql in Supabase first.')
    }
    throw err
  }
}

/** " Men's, MALE ,men's" → ["men's", "male"]: trimmed, lowercase, no repeats, no blanks. */
function cleanWords(words: string[]): string[] {
  return [...new Set(words.map((w) => w.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))]
}

async function writeClient(input: ClientInput, fields: Record<string, unknown>, existingSiteId: string | undefined, siteId: string) {
  if (!existingSiteId) return createClient(input, fields)

  const current = await clientRow(existingSiteId)
  if (!current) throw new ClientInputError('That client no longer exists.')
  must(await db().from('seo_clients').update(fields).eq('id', current.id), 'Saving the client')
  await saveStructure(current.id, input)
  return { siteId }
}

/**
 * Bulk "Add clients from CSV": a client with only name, site, city (A1), state and industry. Categories get their
 * code as a placeholder name, no services (filled in later on Edit client), A2/A3 N/A, every account Ready.
 * The caller has already checked the row (site id free, industry in the list, no address).
 */
export async function addClientBasic(row: { name: string; siteUrl: string; siteId: string; city: string; state: string; industry: string | null }): Promise<{ siteId: string }> {
  row = { ...row, city: stripStateSuffix(row.city, row.state) }
  const input: ClientInput = {
    siteUrl: row.siteUrl,
    name: row.name,
    city: row.city,
    state: row.state,
    idealClient: '',
    usp: '',
    success12mo: '',
    notes: '',
    status: 'active',
    industry: row.industry,
    categories: CATEGORY_CODES.map((code) => ({ code, name: '', services: [] })),
    areas: AREA_CODES.map((code) => ({ code, name: code === 'A1' ? row.city : '', state: code === 'A1' ? row.state : '', status: code === 'A1' ? 'active' : 'n_a' })),
  }
  const fields = { site_id: row.siteId, site_url: row.siteUrl, name: row.name, city: orNull(row.city), state: orNull(row.state), status: 'active', industry: row.industry }
  return createClient(input, fields)
}

async function createClient(input: ClientInput, fields: Record<string, unknown>): Promise<{ siteId: string }> {
  const created = must(await db().from('seo_clients').insert(fields).select('id, site_id').single(), 'Adding the client') as {
    id: string
    site_id: string
  }
  try {
    // Categories (all 5 always exist), areas (A1–A3), then the default account checklist.
    must(
      await db()
        .from('seo_client_categories')
        .insert(
          CATEGORY_CODES.map((code, i) => ({
            client_id: created.id,
            code,
            name: input.categories.find((c) => c.code === code)!.name || (code === 'FAQ' ? DEFAULT_FAQ_NAME : code),
            in_matrix: code !== 'FAQ',
            sort: i,
          })),
        ),
      'Adding the service categories',
    )
    must(
      await db()
        .from('seo_client_areas')
        .insert(input.areas.map((a) => ({ client_id: created.id, code: a.code, name: orNull(a.name), state: orNull(a.state), status: a.status }))),
      'Adding the areas',
    )
    must(
      await db()
        .from('seo_client_accounts')
        .insert(
          ACCOUNT_KINDS.map((kind, i) => ({
            client_id: created.id,
            kind,
            // Ready by default: one agency account covers most tools; Angel sets Pending when something's missing.
            status: input.accounts?.find((a) => a.kind === kind)?.status ?? 'ready',
            ...(input.accounts?.find((a) => a.kind === kind)?.link?.trim() ? { link: input.accounts.find((a) => a.kind === kind)!.link!.trim() } : {}),
            sort: i,
          })),
        ),
      'Adding the account checklist',
    )
    await saveServices(created.id, input)
  } catch (err) {
    // Undo a half-made client (cascades to everything above) so the form can simply be saved again.
    await db().from('seo_clients').delete().eq('id', created.id)
    throw err
  }
  return { siteId: created.site_id }
}

async function saveStructure(clientId: string, input: ClientInput) {
  // Category names (the 5 rows always exist)
  for (const cat of input.categories) {
    const name = cat.name || (cat.code === 'FAQ' ? DEFAULT_FAQ_NAME : cat.code)
    must(await db().from('seo_client_categories').update({ name }).eq('client_id', clientId).eq('code', cat.code), `Saving ${cat.code}`)
  }
  for (const a of input.areas) {
    must(
      await db()
        .from('seo_client_areas')
        .update({ name: orNull(a.name), state: orNull(a.state), status: a.status })
        .eq('client_id', clientId)
        .eq('code', a.code),
      `Saving area ${a.code}`,
    )
  }
  await saveServices(clientId, input)
}

/**
 * Services keep their id when renamed or moved to another category (so keywords stay linked).
 * Removed services are deleted; keywords that pointed at them become "no service" (flagged), never deleted.
 */
async function saveServices(clientId: string, input: ClientInput) {
  const cats = must(await db().from('seo_client_categories').select('id, code').eq('client_id', clientId), 'Loading categories') as Pick<
    CategoryRow,
    'id' | 'code'
  >[]
  const catId = new Map(cats.map((c) => [c.code, c.id]))
  const existing = must(await db().from('seo_client_services').select('id, name, category_id, sort').eq('client_id', clientId), 'Loading services') as Pick<
    ServiceRow,
    'id' | 'name' | 'category_id' | 'sort'
  >[]
  const keep = new Set<string>()
  const wanted = input.categories.flatMap((cat) =>
    cat.services.map((s, i) => ({ id: s.id && existing.some((e) => e.id === s.id) ? s.id : undefined, name: s.name, category_id: catId.get(cat.code)!, sort: i })),
  )
  for (const w of wanted) if (w.id) keep.add(w.id)

  // 1. Delete removed ones first. Only RENAMED services are parked on a temporary name (so swapping two names
  //    never trips the "one name per client" rule); unchanged rows aren't touched. Writes are batched (Found #4/#5:
  //    a slow save left 8 services on "~…" names).
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id)
  if (removed.length) must(await db().from('seo_client_services').delete().in('id', removed), 'Removing services')
  const before = new Map(existing.map((e) => [e.id, e]))
  const changed = wanted.filter((w) => {
    const e = w.id ? before.get(w.id) : undefined
    return !!e && (e.name !== w.name || e.category_id !== w.category_id || e.sort !== w.sort)
  })
  const renamed = changed.filter((w) => before.get(w.id!)!.name !== w.name)
  if (renamed.length)
    must(await db().from('seo_client_services').upsert(renamed.map((w) => ({ id: w.id!, client_id: clientId, name: `~${w.id}`, category_id: before.get(w.id!)!.category_id, sort: before.get(w.id!)!.sort })), { onConflict: 'id' }), 'Saving services')
  // 2. Final names, categories and order, in one request. If it fails, the parked names go back.
  if (changed.length) {
    const final = await db().from('seo_client_services').upsert(changed.map((w) => ({ id: w.id!, client_id: clientId, name: w.name, category_id: w.category_id, sort: w.sort })), { onConflict: 'id' })
    if (final.error) {
      if (renamed.length) await db().from('seo_client_services').upsert(renamed.map((w) => ({ id: w.id!, client_id: clientId, name: before.get(w.id!)!.name, category_id: before.get(w.id!)!.category_id, sort: before.get(w.id!)!.sort })), { onConflict: 'id' })
      must(final, 'Saving services')
    }
  }
  const added = wanted.filter((w) => !w.id).map((w) => ({ client_id: clientId, name: w.name, category_id: w.category_id, sort: w.sort }))
  if (added.length) must(await db().from('seo_client_services').insert(added), 'Adding services')
}

// ---- Account checklist ---------------------------------------------------------------

const AccountSchema = z.object({
  kind: z.enum(ACCOUNT_KINDS as [AccountKind, ...AccountKind[]]),
  status: z.enum(['ready', 'pending', 'n_a']),
  nextAction: text(300),
  note: text(500),
  /** Left out = unchanged; '' = remove (Open goes back to the tool's main page). */
  link: z.string().max(500).optional(),
})

export async function saveAccount(siteId: string, raw: unknown): Promise<ClientAccount> {
  const parsed = AccountSchema.safeParse(raw)
  if (!parsed.success) throw new ClientInputError('That account row isn’t right.')
  const c = await clientRow(siteId)
  if (!c) throw new ClientInputError('That client no longer exists.')
  const a = parsed.data
  if (a.link !== undefined) {
    const problem = accountLinkProblem(a.link)
    if (problem) throw new ClientInputError(problem)
  }
  const values = { status: a.status, next_action: orNull(a.nextAction), note: orNull(a.note), ...(a.link !== undefined ? { link: orNull(a.link.trim()) } : {}) }
  // Rows are made with the client; insert only if one is somehow missing. (The unique index is partial,
  // so PostgREST can't upsert on it.)
  const updated = must(
    await db().from('seo_client_accounts').update(values).eq('client_id', c.id).eq('kind', a.kind).select('*'),
    'Saving the account checklist',
  ) as AccountRow[]
  const row =
    updated[0] ??
    (must(
      await db()
        .from('seo_client_accounts')
        .insert({ client_id: c.id, kind: a.kind, sort: ACCOUNT_KINDS.indexOf(a.kind), ...values })
        .select('*')
        .single(),
      'Saving the account checklist',
    ) as AccountRow)
  return toAccount(row)
}

// ---- Delete a client (Angel, Nov 26) -------------------------------------------------------------------------
// Only an Archived client, and only after typing its exact name. Every seo_ table row for the client goes with it
// (all are "on delete cascade"; the Claude call log keeps its rows with no client, so costs still add up). Agency
// rules (notes with no client) stay. Then the raw import files in Storage (<site id>/…) are removed.

const IMPORT_BUCKET = 'seo-imports'


async function countFor(table: string, clientId: string): Promise<number> {
  const r = await db().from(table).select('id', { count: 'exact', head: true }).eq('client_id', clientId)
  if (r.error) throw new DatabaseError(`Counting ${table}: ${r.error.message}`)
  return r.count ?? 0
}

/** What deleting would remove (nothing deleted). */
export async function checkDeleteClient(siteId: string): Promise<ClientDeleteCheck> {
  const c = await clientRow(siteId)
  if (!c) throw new ClientInputError('That client doesn’t exist.')
  const [keywords, imports, pages, notes] = await Promise.all(['seo_keywords', 'seo_imports', 'seo_pages', 'seo_notes'].map((t) => countFor(t, c.id)))
  return { name: c.name, archived: c.status === 'archived', keywords, imports, pages, notes }
}

/** Deletes an Archived client after its exact name was typed. Returns whether every raw file was removed too. */
export async function deleteClient(siteId: string, typedName: unknown): Promise<{ filesRemoved: number; filesLeft: number }> {
  const c = await clientRow(siteId)
  if (!c) throw new ClientInputError('That client doesn’t exist (already deleted?).')
  if (c.status !== 'archived') throw new ClientInputError('Archive the client first (Client setup › Status: Archived), then delete it.')
  if (typeof typedName !== 'string' || typedName.trim() !== c.name.trim()) throw new ClientInputError(`Type the client’s name exactly (“${c.name}”) to delete it.`)
  must(await db().from('seo_clients').delete().eq('id', c.id), 'Deleting the client')
  // Raw files: <site id>/<import id>/<file>. Last, so a Storage hiccup never leaves half a client in the database.
  let filesRemoved = 0
  let filesLeft = 0
  const folders = await db().storage.from(IMPORT_BUCKET).list(c.site_id, { limit: 1000 })
  for (const f of folders.data ?? []) {
    const files = await db().storage.from(IMPORT_BUCKET).list(`${c.site_id}/${f.name}`, { limit: 1000 })
    const paths = (files.data ?? []).map((x) => `${c.site_id}/${f.name}/${x.name}`)
    if (!paths.length) continue
    const rm = await db().storage.from(IMPORT_BUCKET).remove(paths)
    if (rm.error) filesLeft += paths.length
    else filesRemoved += paths.length
  }
  return { filesRemoved, filesLeft }
}
