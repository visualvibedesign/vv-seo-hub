// CSV imports (phase 1, step 4): preview (dry run) and commit, plus the import history.
// Tables: seo_imports, seo_keywords, seo_keyword_sources; raw file in Storage bucket seo-imports.
//
// Merge rules (Angel, 2026-11-20):
//   - Every row is kept in history (seo_keyword_sources, raw row included), exactly as exported.
//   - Exact duplicates (same keyword ignoring case/extra spaces, same segment) inside one file: skipped.
//   - Existing keyword: an EMPTY Semrush volume / KD / CPC / intent is filled. A FILLED one is never
//     overwritten, unless the person ticked "Use the new numbers" for that keyword in the preview.
//   - KP ranges: KP and Semrush imports never touch them. Only the Sheet (master_db) import fills an
//     EMPTY one (kp_volume_by = 'sheet'). Typed ranges are never overwritten.
//   - KP CSV numbers are stand-ins (50, 500): stored in history only, never as a volume.
import { z } from 'zod'
import { keywordKey, looksLikeAddress, parseCpc, parseKd, parseRole, parseVolume, sourceOf } from '../../src/lib/importRules.js'
import type { DeleteImportCheck, ImportDifference, ImportPayload, ImportPreview, ImportRecord, ImportRow, NumberField } from '../../src/types/seo.js'
import { db, DatabaseError, must, pagedRows } from '../clients/supabase.js'
import { retireStale } from './autofillService.js'
import type { SamsGuideAdded } from './samsGuideService.js'

export class ImportInputError extends Error {}

const MAX_ROWS = 20_000
const CHUNK = 500
const BUCKET = 'seo-imports'

const RowSchema = z.object({
  keyword: z.string().min(1).max(300),
  volume: z.string().max(60).optional(),
  kd: z.string().max(20).optional(),
  cpc: z.string().max(20).optional(),
  intent: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  role: z.string().max(40).optional(),
  service: z.string().max(80).optional(),
  kp: z.string().max(40).optional(),
  raw: z.record(z.string(), z.string().max(5000)),
})

const PayloadSchema = z.object({
  siteId: z.string().regex(/^[0-9a-f]{32}$/),
  source: z.enum(['kp', 'semrush', 'sheet']),
  report: z.enum(['kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap', 'master_db']),
  fileName: z.string().min(1).max(200),
  location: z.string().trim().max(120),
  filter: z.string().trim().max(200),
  columnMap: z.record(z.string(), z.string().max(200)),
  totals: z.array(z.object({ segment: z.string().max(120), volume: z.string().max(60) })).max(50),
  rows: z.array(RowSchema).max(MAX_ROWS),
  useNew: z.array(z.string().max(300)).max(MAX_ROWS).optional(),
  allowAddresses: z.array(z.string().max(300)).max(200).optional(),
})

function validate(raw: unknown): ImportPayload {
  const p = PayloadSchema.safeParse(raw)
  if (!p.success) throw new ImportInputError(`The import data isn’t right (${p.error.issues[0]?.path.join('.') || 'file'}). Try reading the file again.`)
  if (sourceOf(p.data.report) !== p.data.source) throw new ImportInputError('The report doesn’t match the source.')
  if (!p.data.rows.length) throw new ImportInputError('No keyword rows to import.')
  return p.data as ImportPayload
}

// ---- Plan (shared by preview and commit) ---------------------------------------------------

type KeywordRow = {
  id: string
  keyword: string
  keyword_key: string
  role: string | null
  service_id: string | null
  intent: string | null
  kp_volume: string | null
  kp_volume_by: string | null
  semrush_volume: number | null
  kd: number | null
  cpc: number | null
}

type Incoming = { semrush_volume: number | null; kd: number | null; cpc: number | null; intent: string | null }

interface Plan {
  clientId: string
  unique: { row: ImportRow; key: string }[]
  skipped: string[]
  creates: Record<string, unknown>[]
  updates: Map<string, Record<string, unknown>> // keyword id → fields
  existing: Map<string, KeywordRow> // key → row
  preview: ImportPreview
}

async function clientIdFor(siteId: string): Promise<string> {
  const c = must(await db().from('seo_clients').select('id').eq('site_id', siteId).maybeSingle(), 'Loading the client') as { id: string } | null
  if (!c) throw new ImportInputError('That client no longer exists.')
  return c.id
}

async function existingKeywords(clientId: string, keys: string[]): Promise<Map<string, KeywordRow>> {
  const out = new Map<string, KeywordRow>()
  for (let i = 0; i < keys.length; i += 200) {
    const part = keys.slice(i, i + 200)
    const rows = must(
      await db()
        .from('seo_keywords')
        .select('id, keyword, keyword_key, role, service_id, intent, kp_volume, kp_volume_by, semrush_volume, kd, cpc')
        .eq('client_id', clientId)
        .in('keyword_key', part),
      'Loading existing keywords',
    ) as KeywordRow[]
    for (const r of rows) out.set(r.keyword_key, r)
  }
  return out
}

async function servicesByName(clientId: string): Promise<Map<string, string>> {
  const rows = must(await db().from('seo_client_services').select('id, name').eq('client_id', clientId), 'Loading services') as { id: string; name: string }[]
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]))
}

/** Numbers this row brings to the keyword. KP rows bring none (stand-ins stay in history only). */
function incomingOf(p: ImportPayload, row: ImportRow): Incoming {
  if (p.source === 'kp') return { semrush_volume: null, kd: null, cpc: null, intent: null }
  return { semrush_volume: parseVolume(row.volume), kd: parseKd(row.kd), cpc: parseCpc(row.cpc), intent: row.intent?.trim() || null }
}

async function plan(p: ImportPayload): Promise<Plan> {
  const clientId = await clientIdFor(p.siteId)

  // 1. Exact duplicates inside this file (same keyword key + same segment): first one wins.
  const seen = new Set<string>()
  const unique: Plan['unique'] = []
  const skipped: string[] = []
  // 0. Street addresses ("123 main st springfield") are held back: never stored (not even in the
  //    import history) unless Angel ticks them. A client's private address must never be stored.
  const allowed = new Set(p.allowAddresses ?? [])
  const addresses = new Map<string, string>()
  for (const row of p.rows) {
    const key = keywordKey(row.keyword)
    if (looksLikeAddress(row.keyword) && !allowed.has(key)) {
      addresses.set(key, row.keyword)
      continue
    }
    const dupKey = `${key}\u0000${(row.segment ?? '').toLowerCase()}`
    if (seen.has(dupKey)) {
      skipped.push(row.keyword)
      continue
    }
    seen.add(dupKey)
    unique.push({ row, key })
  }

  const keys = [...new Set(unique.map((u) => u.key))]
  const existing = await existingKeywords(clientId, keys)
  const services = p.source === 'sheet' ? await servicesByName(clientId) : new Map<string, string>()
  const useNew = new Set(p.useNew ?? [])

  const creates: Record<string, unknown>[] = []
  const created = new Set<string>()
  const updates = new Map<string, Record<string, unknown>>()
  const differences: ImportDifference[] = []
  const unmatchedServices = new Set<string>()
  const unknownRoles = new Set<string>()
  let filled = 0
  let kpFilled = 0
  let kpKept = 0
  let newWithoutVolume = 0
  const now = new Date().toISOString()

  for (const { row, key } of unique) {
    const inc = incomingOf(p, row)
    let role: string | undefined
    let serviceId: string | undefined
    if (p.source === 'sheet') {
      role = parseRole(row.role)
      if (row.role?.trim() && !role) unknownRoles.add(row.role.trim())
      if (row.service?.trim()) {
        serviceId = services.get(row.service.trim().toLowerCase())
        if (!serviceId) unmatchedServices.add(row.service.trim())
      }
    }
    const kpText = p.source === 'sheet' ? row.kp?.trim() || undefined : undefined
    const current = existing.get(key)

    if (!current) {
      if (created.has(key)) continue // same keyword again on another segment row: one keyword, two history rows
      created.add(key)
      if (inc.semrush_volume === null) newWithoutVolume++
      creates.push({
        client_id: clientId,
        keyword: row.keyword,
        keyword_key: key,
        role: role ?? null,
        service_id: serviceId ?? null,
        intent: inc.intent,
        semrush_volume: inc.semrush_volume,
        kd: inc.kd,
        cpc: inc.cpc,
        ...(kpText ? { kp_volume: kpText, kp_volume_by: 'sheet', kp_volume_at: now } : {}),
      })
      continue
    }

    // Existing keyword: fill empties; list differences; replace only if ticked.
    const upd = updates.get(current.id) ?? {}
    const changes: ImportDifference['changes'] = []
    let didFill = false
    for (const field of ['semrush_volume', 'kd', 'cpc'] as NumberField[]) {
      const value = inc[field]
      if (value === null || current[field] === value) continue
      if (current[field] === null) {
        upd[field] = value
        didFill = true
      } else {
        changes.push({ field, current: Number(current[field]), incoming: value })
        if (useNew.has(key)) upd[field] = value
      }
    }
    if (inc.intent && !current.intent) {
      upd.intent = inc.intent
      didFill = true
    }
    if (p.source === 'sheet') {
      if (role && !current.role) upd.role = role
      if (serviceId && !current.service_id) upd.service_id = serviceId
      if (kpText) {
        if (!current.kp_volume) {
          upd.kp_volume = kpText
          upd.kp_volume_by = 'sheet'
          upd.kp_volume_at = now
          kpFilled++
        } else if (current.kp_volume !== kpText) {
          kpKept++ // typed (or already set) ranges are never overwritten
        }
      }
    }
    if (didFill) filled++
    if (changes.length && !differences.some((d) => d.key === key)) differences.push({ key, keyword: current.keyword, changes })
    if (Object.keys(upd).length) updates.set(current.id, upd)
  }

  if (p.source === 'sheet') kpFilled += creates.filter((c) => c.kp_volume).length

  return {
    clientId,
    unique,
    skipped,
    creates,
    updates,
    existing,
    preview: {
      rows: p.rows.length,
      unique: unique.length,
      newKeywords: creates.length,
      existing: new Set(unique.filter((u) => existing.has(u.key)).map((u) => u.key)).size,
      skippedDuplicates: skipped.length,
      duplicateExamples: skipped.slice(0, 8),
      filled,
      kpFilled,
      kpKept,
      differences,
      unmatchedServices: [...unmatchedServices].sort(),
      unknownRoles: [...unknownRoles].sort(),
      newWithoutVolume: p.source === 'kp' ? 0 : newWithoutVolume,
      sampleNew: creates.slice(0, 10).map((c) => String(c.keyword)),
      addresses: [...addresses.values()],
    },
  }
}

export async function previewImport(raw: unknown): Promise<ImportPreview> {
  return (await plan(validate(raw))).preview
}

// ---- Commit ------------------------------------------------------------------------------

const safeFileName = (n: string) => n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 150) || 'import.csv'

/** The dry run plus the keyword keys it would create (whole-Sheet import: later tabs count them as found). */
export async function previewImportKeys(raw: unknown): Promise<{ preview: ImportPreview; newKeys: string[] }> {
  const pl = await plan(validate(raw))
  return { preview: pl.preview, newKeys: pl.creates.map((c) => String(c.keyword_key)) }
}

/** opts.parentImportId: the .xlsx this tab came from (whole-Sheet import, migration 0015). */
export async function commitImport(raw: unknown, file: { base64: string; type: string } | null, opts: { parentImportId?: string } = {}): Promise<{ importId: string; preview: ImportPreview }> {
  const p = validate(raw)
  const pl = await plan(p)

  // 1. The import record
  const imp = must(
    await db()
      .from('seo_imports')
      .insert({
        client_id: pl.clientId,
        source: p.source,
        report: p.report,
        file_name: p.fileName,
        location: p.location || null,
        filter: p.filter || null,
        column_map: { fields: p.columnMap, totals: p.totals },
        rows_total: pl.preview.rows,
        rows_added: pl.preview.newKeywords,
        rows_merged: pl.preview.existing,
        rows_skipped: pl.preview.skippedDuplicates,
        ...(opts.parentImportId ? { parent_import_id: opts.parentImportId } : {}),
      })
      .select('id')
      .single(),
    'Saving the import',
  ) as { id: string }

  const createdIds: string[] = []
  let storagePath: string | null = null
  try {
    // 2. The raw file, untouched
    if (file?.base64) {
      const bytes = Buffer.from(file.base64, 'base64')
      storagePath = `${p.siteId}/${imp.id}/${safeFileName(p.fileName)}`
      const up = await db().storage.from(BUCKET).upload(storagePath, bytes, { contentType: file.type || 'text/csv', upsert: false })
      if (up.error) throw new DatabaseError(`Saving the raw file: ${up.error.message}`)
      must(await db().from('seo_imports').update({ storage_path: storagePath, file_size: bytes.length }).eq('id', imp.id), 'Saving the raw file')
    }

    // 3. New keywords
    const ids = new Map<string, string>([...pl.existing.values()].map((k) => [k.keyword_key, k.id]))
    for (let i = 0; i < pl.creates.length; i += CHUNK) {
      const rows = must(
        await db().from('seo_keywords').insert(pl.creates.slice(i, i + CHUNK)).select('id, keyword_key'),
        'Adding keywords',
      ) as { id: string; keyword_key: string }[]
      for (const r of rows) {
        ids.set(r.keyword_key, r.id)
        createdIds.push(r.id)
      }
    }

    // 4. History: one row per unique CSV row, exactly as exported
    const sources = pl.unique.map(({ row, key }) => ({
      keyword_id: ids.get(key)!,
      import_id: imp.id,
      source: p.source,
      segment: row.segment || null,
      volume_raw: row.volume || null, // KP: the stand-in as exported ("50.0"); Semrush/Sheet: as exported ("74,000")
      kd: parseKd(row.kd),
      cpc: parseCpc(row.cpc),
      intent: row.intent?.trim() || null,
      raw: row.raw,
    }))
    for (let i = 0; i < sources.length; i += CHUNK) {
      must(await db().from('seo_keyword_sources').insert(sources.slice(i, i + CHUNK)), 'Saving the import history')
    }
  } catch (err) {
    // Undo: new keywords, the import (its history rows go with it) and the raw file.
    for (let i = 0; i < createdIds.length; i += CHUNK) await db().from('seo_keywords').delete().in('id', createdIds.slice(i, i + CHUNK))
    await db().from('seo_imports').delete().eq('id', imp.id)
    if (storagePath) await db().storage.from(BUCKET).remove([storagePath])
    throw err
  }

  // 5. Fill empties / ticked "use the new numbers" on existing keywords (last, once everything else is saved)
  const entries = [...pl.updates.entries()]
  for (let i = 0; i < entries.length; i += 20) {
    await Promise.all(
      entries.slice(i, i + 20).map(async ([id, fields]) => must(await db().from('seo_keywords').update(fields).eq('id', id), 'Updating keywords')),
    )
  }
  return { importId: imp.id, preview: pl.preview }
}

// ---- History ---------------------------------------------------------------------------------

type ImportDbRow = {
  id: string
  source: ImportRecord['source']
  report: ImportRecord['report']
  file_name: string
  location: string | null
  filter: string | null
  rows_total: number
  rows_added: number
  rows_merged: number
  rows_skipped: number
  column_map: { totals?: { segment: string; volume: string }[] } | null
  storage_path: string | null
  note: string | null
  /** Undefined until migration 0015 runs. */
  parent_import_id?: string | null
  created_at: string
}

export async function listImports(siteId: string): Promise<ImportRecord[]> {
  const clientId = await clientIdFor(siteId)
  const rows = must(
    await db().from('seo_imports').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100),
    'Loading imports',
  ) as ImportDbRow[]
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    report: r.report,
    fileName: r.file_name,
    location: r.location,
    filter: r.filter,
    rowsTotal: r.rows_total,
    rowsAdded: r.rows_added,
    rowsMerged: r.rows_merged,
    rowsSkipped: r.rows_skipped,
    totals: r.column_map?.totals ?? [],
    hasFile: !!r.storage_path,
    note: r.note,
    parentImportId: r.parent_import_id ?? null,
    createdAt: r.created_at,
  }))
}

/** A short-lived link to download the raw file of one import. */
export async function rawFileUrl(siteId: string, importId: string): Promise<string> {
  const clientId = await clientIdFor(siteId)
  const r = must(
    await db().from('seo_imports').select('storage_path, file_name').eq('id', importId).eq('client_id', clientId).maybeSingle(),
    'Loading the import',
  ) as { storage_path: string | null; file_name: string } | null
  if (!r?.storage_path) throw new ImportInputError('This import has no saved file.')
  const signed = await db().storage.from(BUCKET).createSignedUrl(r.storage_path, 60, { download: r.file_name })
  if (signed.error || !signed.data) throw new DatabaseError(`Making the download link: ${signed.error?.message ?? 'no link'}`)
  return signed.data.signedUrl
}

// ---- Delete an import (Angel, 2026-11-20) ------------------------------------------------------
// Removes the import's history rows, its raw file in Storage, and the keywords that ONLY came from this
// import. Keywords that also appear in another import stay (only this import's history rows go).
// Numbers this import filled into keywords that stay are left as they are.

async function importFor(siteId: string, importId: string) {
  if (!/^[0-9a-f-]{36}$/.test(importId)) throw new ImportInputError('That import doesn’t exist.')
  const clientId = await clientIdFor(siteId)
  const imp = must(
    await db().from('seo_imports').select('id, file_name, storage_path, report, note, column_map').eq('id', importId).eq('client_id', clientId).maybeSingle(),
    'Loading the import',
  ) as { id: string; file_name: string; storage_path: string | null; report: string; note: string | null; column_map: { added?: { code: string; name: string }[]; samsGuide?: SamsGuideAdded } | null } | null
  if (!imp) throw new ImportInputError('That import doesn’t exist (already deleted?).')
  return { clientId, imp }
}

/** Which keywords only came from these imports (one import, or an .xlsx with its tab imports), and which also came from others. */
async function splitKeywords(importIds: string[]) {
  const own: { keyword_id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const page = must(
      await db().from('seo_keyword_sources').select('keyword_id').in('import_id', importIds).order('id').range(from, from + 999),
      'Loading the import history',
    ) as { keyword_id: string }[]
    own.push(...page)
    if (page.length < 1000) break
  }
  const ids = [...new Set(own.map((r) => r.keyword_id))]
  const shared = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200)
    // Paged: 200 keywords can have well over 1,000 history rows (PostgREST returns at most 1,000 per request).
    // Missing one would mark a shared keyword as "only from this import" and delete it.
    for await (const r of pagedRows<{ keyword_id: string }>((from, to) => db().from('seo_keyword_sources').select('keyword_id').in('keyword_id', part).not('import_id', 'in', `(${importIds.join(',')})`).order('id').range(from, to), 'Checking other imports'))
      shared.add(r.keyword_id)
  }
  return { historyRows: own.length, remove: ids.filter((id) => !shared.has(id)), keep: ids.filter((id) => shared.has(id)) }
}

/** What a Sam's Guide import recorded as added (null = an older import that didn't record it). */
async function samsGuideAdded(importId: string): Promise<SamsGuideAdded | null> {
  const r = await db().from('seo_imports').select('column_map').eq('id', importId).maybeSingle()
  return ((r.data as { column_map: { samsGuide?: SamsGuideAdded } | null } | null)?.column_map?.samsGuide) ?? null
}

/** Removes the matrix entries, then the cells it created if they're now empty, then the competitor names (same name only). */
async function undoSamsGuide(clientId: string, a: SamsGuideAdded): Promise<void> {
  for (const m of a.matrix) must(await db().from('seo_matrix_keywords').delete().eq('cell_id', m.cell_id).eq('keyword_id', m.keyword_id).eq('kind', m.kind), 'Removing matrix entries')
  for (const cellId of a.cells) {
    const left = await db().from('seo_matrix_keywords').select('keyword_id', { count: 'exact', head: true }).eq('cell_id', cellId)
    if (left.error) throw new DatabaseError(`Checking the matrix: ${left.error.message}`)
    if (!left.count) must(await db().from('seo_matrix_cells').delete().eq('id', cellId).eq('client_id', clientId), 'Removing matrix cells')
  }
  for (const x of a.competitors) must(await db().from('seo_competitors').delete().eq('client_id', clientId).eq('code', x.code).eq('name', x.name), 'Removing competitor names')
}

/** Tab imports that came from this .xlsx (whole-Sheet import). Empty for every other import. */
async function childImports(importId: string): Promise<{ id: string; report: string; note: string | null }[]> {
  const r = await db().from('seo_imports').select('id, report, note').eq('parent_import_id', importId)
  if (r.error) return [] // before migration 0015: no tab imports
  return r.data as { id: string; report: string; note: string | null }[]
}

export async function checkDeleteImport(siteId: string, importId: string): Promise<DeleteImportCheck> {
  const { imp } = await importFor(siteId, importId)
  const children = await childImports(importId)
  const { historyRows, remove, keep } = await splitKeywords([importId, ...children.map((x) => x.id)])
  let removedWithEdits = 0
  let removedInUse = 0
  for (let i = 0; i < remove.length; i += 200) {
    const part = remove.slice(i, i + 200)
    const edited = await db().from('seo_keywords').select('id', { count: 'exact', head: true }).in('id', part).or('kp_volume_by.eq.typed,role.not.is.null,service_id.not.is.null')
    if (edited.error) throw new DatabaseError(`Checking edited keywords: ${edited.error.message}`)
    removedWithEdits += edited.count ?? 0
    const inUse = new Set<string>()
    for await (const r of pagedRows<{ keyword_id: string }>((from, to) => db().from('seo_matrix_keywords').select('keyword_id').in('keyword_id', part).order('cell_id').order('keyword_id').range(from, to), 'Checking the matrix'))
      inUse.add(r.keyword_id)
    for await (const r of pagedRows<{ keyword_id: string }>((from, to) => db().from('seo_page_keywords').select('keyword_id').in('keyword_id', part).order('keyword_id').range(from, to), 'Checking pages'))
      inUse.add(r.keyword_id)
    removedInUse += inUse.size
  }
  const all = [imp, ...children]
  const sg = all.find((x) => x.report === 'sams_guide')
  const sgNote = !sg
    ? ''
    : (sg === imp ? imp.column_map?.samsGuide : await samsGuideAdded(sg.id))
      ? 'Sam’s Guide: the matrix primaries and backups, new matrix cells and competitor names it added are removed. Track, Later / Rejected statuses, pages and its note stay.'
      : 'Sam’s Guide (older import): what it added to the matrix wasn’t recorded, so the matrix stays as it is.'
  const notes = [...all.map((x) => (x.report === 'clusters' ? 'Pages added from the Clusters tab stay (only the import record goes).' : x.report === 'competitors' ? 'Competitor names this import added are removed.' : '')), sgNote].filter(Boolean)
  return { fileName: imp.file_name, historyRows, keywordsRemoved: remove.length, keywordsKept: keep.length, removedWithEdits, removedInUse, hasFile: !!imp.storage_path, tabImports: children.length, notes: [...new Set(notes)] }
}

export async function deleteImport(siteId: string, importId: string): Promise<{ keywordsRemoved: number; fileRemoved: boolean }> {
  const { imp, clientId } = await importFor(siteId, importId)
  // An .xlsx goes with its tab imports: each one first, by its own rules (keywords shared between tabs go with the last one).
  let childRemoved = 0
  for (const child of await childImports(importId)) childRemoved += (await deleteImport(siteId, child.id)).keywordsRemoved
  const { remove } = await splitKeywords([importId])
  // 0. Sam's Guide: undo what it added to the matrix + competitors (only entries still exactly as it saved them)
  if (imp.report === 'sams_guide' && imp.column_map?.samsGuide) await undoSamsGuide(clientId, imp.column_map.samsGuide)
  // 1. Keywords that only came from this import (their history rows, matrix and cluster links go with them)
  for (let i = 0; i < remove.length; i += 200) {
    must(await db().from('seo_keywords').delete().in('id', remove.slice(i, i + 200)), 'Removing keywords')
  }
  // 1b. A Competitors tab import: the names it added go too (only while they still have the name it saved)
  if (imp.report === 'competitors')
    for (const a of imp.column_map?.added ?? []) must(await db().from('seo_competitors').delete().eq('client_id', clientId).eq('code', a.code).eq('name', a.name), 'Removing competitor names')
  // 2. The import itself: its remaining history rows (on keywords that stay) go with it
  must(await db().from('seo_imports').delete().eq('id', imp.id), 'Removing the import')
  // 2b. Open auto-fill lists that pointed to the removed keywords are now stale: retire them (kept, marked replaced)
  if (remove.length) await retireStale(siteId, true)
  // 3. The raw file (last: if this fails, the data is already consistent and the file is just left over)
  let fileRemoved = false
  if (imp.storage_path) {
    const rm = await db().storage.from(BUCKET).remove([imp.storage_path])
    fileRemoved = !rm.error
  }
  return { keywordsRemoved: remove.length + childRemoved, fileRemoved }
}
