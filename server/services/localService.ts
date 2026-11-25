// Phase 2d · Local numbers typed in by the team (docs/phase-2-plan.md, decisions 2 + 3):
// - GBP: one row per period (normally a calendar month) in seo_gbp_snapshots; the same period is updated, not doubled.
// - Whitespark map grid: a scan typed in (keyword, date, size, spacing, area name, rank per point) in seo_map_grids +
//   seo_map_grid_points. CSV import comes when Angel sends a sample. Rank empty = not found / 20+ (never 0).
// Privacy: the grid centre is a town / area name only. Anything with a digit (house number, ZIP) is refused.
import type { GbpInput, GbpSnapshot, LocalState, MapGrid, MapGridInput } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class LocalInputError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toISOString().slice(0, 10)

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new LocalInputError('That client doesn’t exist.')
  return c
}

function day(v: unknown, what: string, optional = false): string | null {
  if (optional && (v === null || v === undefined || v === '')) return null
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new LocalInputError(`${what}: pick a date.`)
  if (v > today()) throw new LocalInputError(`${what} can’t be in the future.`)
  return v
}

function count(v: unknown, what: string): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 100_000_000) throw new LocalInputError(`${what}: a whole number (0 or more), or leave it empty.`)
  return n
}

function shortText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, max) : null
}

type GbpRow = { id: string; period_from: string; period_to: string; views: number | null; views_search_desktop?: number | null; views_search_mobile?: number | null; views_maps_desktop?: number | null; views_maps_mobile?: number | null; calls: number | null; directions: number | null; website_clicks: number | null; reviews: number | null; rating: number | null; newest_review_on: string | null; typed_by: string | null; note: string | null; updated_at: string }
const gbpOut = (r: GbpRow): GbpSnapshot => ({
  id: r.id,
  periodFrom: r.period_from,
  periodTo: r.period_to,
  views: r.views,
  viewsSearchDesktop: r.views_search_desktop ?? null, // undefined until migration 0017 has run
  viewsSearchMobile: r.views_search_mobile ?? null,
  viewsMapsDesktop: r.views_maps_desktop ?? null,
  viewsMapsMobile: r.views_maps_mobile ?? null,
  calls: r.calls,
  directions: r.directions,
  websiteClicks: r.website_clicks,
  reviews: r.reviews,
  rating: r.rating === null ? null : Number(r.rating),
  newestReviewOn: r.newest_review_on,
  typedBy: r.typed_by,
  note: r.note,
  updatedAt: r.updated_at,
})

type GridRow = { id: string; keyword: string; scanned_on: string; grid_size: number; spacing: string | null; center_label: string | null; source: MapGrid['source']; created_at: string }

/** GBP periods + map grid scans for one client (newest first; enough for Overview, Baseline and Results). */
export async function localState(siteId: string): Promise<LocalState> {
  const c = await client(siteId)
  const gbp = must(await db().from('seo_gbp_snapshots').select('*').eq('client_id', c.id).order('period_to', { ascending: false }).limit(36), 'Loading GBP numbers') as GbpRow[]
  const grids = must(await db().from('seo_map_grids').select('id, keyword, scanned_on, grid_size, spacing, center_label, source, created_at').eq('client_id', c.id).order('scanned_on', { ascending: false }).order('created_at', { ascending: false }).limit(12), 'Loading map grids') as GridRow[]
  const points = grids.length ? (must(await db().from('seo_map_grid_points').select('grid_id, row_no, col_no, rank').in('grid_id', grids.map((g) => g.id)), 'Loading map grid points') as { grid_id: string; row_no: number; col_no: number; rank: number | null }[]) : []
  return {
    gbp: gbp.map(gbpOut),
    grids: grids.map((g) => {
      const ranks: (number | null)[][] = Array.from({ length: g.grid_size }, () => Array<number | null>(g.grid_size).fill(null))
      for (const p of points) if (p.grid_id === g.id && p.row_no < g.grid_size && p.col_no < g.grid_size) ranks[p.row_no][p.col_no] = p.rank
      return { id: g.id, keyword: g.keyword, scannedOn: g.scanned_on, gridSize: g.grid_size, spacing: g.spacing, centerLabel: g.center_label, source: g.source, ranks, createdAt: g.created_at }
    }),
  }
}

/** Saves one GBP period (the same from/to is updated, so typing a month twice never doubles it). */
export async function saveGbp(siteId: string, raw: unknown): Promise<GbpSnapshot> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Partial<Record<keyof GbpInput, unknown>>
  const from = day(b.periodFrom, 'From')!
  const to = day(b.periodTo, 'To')!
  if (to < from) throw new LocalInputError('“To” is before “From”.')
  let rating: number | null = null
  if (b.rating !== null && b.rating !== undefined && b.rating !== '') {
    rating = Number(b.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new LocalInputError('Rating: a number from 1 to 5 (like 4.8), or leave it empty.')
    rating = Math.round(rating * 10) / 10
  }
  const row = {
    client_id: c.id,
    period_from: from,
    period_to: to,
    views: count(b.views, 'Profile views'),
    calls: count(b.calls, 'Calls'),
    directions: count(b.directions, 'Direction requests'),
    website_clicks: count(b.websiteClicks, 'Website clicks'),
    reviews: count(b.reviews, 'Reviews'),
    rating,
    newest_review_on: day(b.newestReviewOn, 'Newest review', true),
    typed_by: shortText(b.typedBy, 60),
    note: shortText(b.note, 300),
    updated_at: new Date().toISOString(),
  }
  const split = {
    views_search_desktop: count(b.viewsSearchDesktop, 'Search · desktop'),
    views_search_mobile: count(b.viewsSearchMobile, 'Search · mobile'),
    views_maps_desktop: count(b.viewsMapsDesktop, 'Maps · desktop'),
    views_maps_mobile: count(b.viewsMapsMobile, 'Maps · mobile'),
  }
  const hasSplit = Object.values(split).some((v) => v !== null)
  if (!hasSplit && [row.views, row.calls, row.directions, row.website_clicks, row.reviews, row.rating].every((v) => v === null)) throw new LocalInputError('Type at least one number.')
  // The breakdown columns come with migration 0017. Always sent (so clearing them on an edit clears them); if the
  // columns don't exist yet and no breakdown was typed, the rest still saves.
  const upsert = (r: object) => db().from('seo_gbp_snapshots').upsert(r, { onConflict: 'client_id,period_from,period_to' }).select('*').single()
  let res = await upsert({ ...row, ...split })
  const missingCols = !!res.error && /views_(search|maps)_/.test(res.error.message)
  if (missingCols && hasSplit) throw new LocalInputError('The views breakdown needs database migration 0017 first. Clear those 4 boxes to save the rest now.')
  if (missingCols) res = await upsert(row)
  return gbpOut(must(res, 'Saving GBP numbers') as GbpRow)
}

export async function deleteGbp(siteId: string, id: unknown): Promise<void> {
  const c = await client(siteId)
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new LocalInputError('Pick a period to remove.')
  must(await db().from('seo_gbp_snapshots').delete().eq('client_id', c.id).eq('id', id), 'Removing GBP numbers')
}

/** Saves a typed map grid scan (always a new scan; same keyword + date twice = two scans, the newest shows). */
export async function saveMapGrid(siteId: string, raw: unknown): Promise<MapGrid> {
  const c = await client(siteId)
  const b = (raw ?? {}) as Partial<Record<keyof MapGridInput, unknown>>
  const keyword = shortText(b.keyword, 200)
  if (!keyword) throw new LocalInputError('Type the keyword the scan was for.')
  const scannedOn = day(b.scannedOn, 'Scan date')!
  const size = Number(b.gridSize)
  if (![3, 5, 7, 9, 11, 13, 15].includes(size)) throw new LocalInputError('Grid size: 3×3 up to 15×15 (odd sizes).')
  const centerLabel = shortText(b.centerLabel, 80)
  if (centerLabel && /\d/.test(centerLabel)) throw new LocalInputError('Area: a town or area name only, never a street address or ZIP (no numbers).')
  const spacing = shortText(b.spacing, 40)
  const ranks = b.ranks
  if (!Array.isArray(ranks) || ranks.length !== size || ranks.some((r) => !Array.isArray(r) || r.length !== size)) throw new LocalInputError(`Fill the ${size}×${size} grid.`)
  const clean: (number | null)[][] = (ranks as unknown[][]).map((r) =>
    r.map((v) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 100) throw new LocalInputError('Each point: a rank from 1 to 100, or empty for not found / 20+.')
      return n
    }),
  )
  if (clean.flat().every((v) => v === null)) throw new LocalInputError('Type at least one rank (empty points = not found).')
  const g = must(
    await db().from('seo_map_grids').insert({ client_id: c.id, keyword, scanned_on: scannedOn, grid_size: size, spacing, center_label: centerLabel, source: 'typed' }).select('id, keyword, scanned_on, grid_size, spacing, center_label, source, created_at').single(),
    'Saving the map grid',
  ) as GridRow
  const pts = clean.flatMap((r, row_no) => r.map((rank, col_no) => ({ grid_id: g.id, row_no, col_no, rank })))
  const ins = await db().from('seo_map_grid_points').insert(pts)
  if (ins.error) {
    await db().from('seo_map_grids').delete().eq('id', g.id) // nothing half-saved
    throw new LocalInputError(`Couldn’t save the points: ${ins.error.message}`)
  }
  return { id: g.id, keyword: g.keyword, scannedOn: g.scanned_on, gridSize: g.grid_size, spacing: g.spacing, centerLabel: g.center_label, source: g.source, ranks: clean, createdAt: g.created_at }
}

export async function deleteMapGrid(siteId: string, id: unknown): Promise<void> {
  const c = await client(siteId)
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new LocalInputError('Pick a scan to remove.')
  must(await db().from('seo_map_grids').delete().eq('client_id', c.id).eq('id', id), 'Removing the map grid') // points go with it
}
