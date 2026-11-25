// 3×3 matrix (redesign step 4b): Home + S1–S3 rows × A1–A3 columns, one primary keyword per cell + backups.
// Tables (from 0001): seo_matrix_cells (one row per category × area) + seo_matrix_keywords (primary / backup links).
// Keywords themselves are never changed here; only which keyword sits in which cell.
import { z } from 'zod'
import { AREA_CODES, areaState } from '../../src/lib/clientSetup.js'
import type { AreaCode, CategoryCode, MatrixCell, MatrixCellInput, MatrixKeyword, MatrixState, PageStatus } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class MatrixInputError extends Error {}

const ROWS: CategoryCode[] = ['Home', 'S1', 'S2', 'S3']

type KwRow = { id: string; keyword: string; role: MatrixKeyword['role']; semrush_volume: number | null; kp_volume: string | null }
type CellRow = {
  id: string
  category_id: string
  area_id: string
  state: MatrixCell['state']
  seo_matrix_keywords: { kind: 'primary' | 'backup'; sort: number; seo_keywords: KwRow | null }[]
}

async function client(siteId: string) {
  const row = await clientRow(siteId)
  if (!row) throw new MatrixInputError('That client doesn’t exist.')
  return row
}

export async function getMatrix(siteId: string): Promise<MatrixState> {
  const c = await client(siteId)
  const [cats, areas, cells] = await Promise.all([
    db().from('seo_client_categories').select('id, code, name').eq('client_id', c.id).in('code', ROWS),
    db().from('seo_client_areas').select('id, code, name, state, status').eq('client_id', c.id),
    db()
      .from('seo_matrix_cells')
      .select('id, category_id, area_id, state, seo_matrix_keywords(kind, sort, seo_keywords(id, keyword, role, semrush_volume, kp_volume))')
      .eq('client_id', c.id),
  ])
  const catRows = must(cats, 'Loading the categories') as { id: string; code: CategoryCode; name: string }[]
  const areaRows = (must(areas, 'Loading the areas') as { id: string; code: AreaCode; name: string | null; state: string | null; status: 'active' | 'n_a' }[]).sort(
    (a, b) => AREA_CODES.indexOf(a.code) - AREA_CODES.indexOf(b.code),
  )
  const cellRows = must(cells, 'Loading the matrix') as unknown as CellRow[]

  // Which page owns each keyword in the matrix (Clusters), for "Page live" / "Page not live yet".
  const kwIds = [...new Set(cellRows.flatMap((r) => r.seo_matrix_keywords.map((m) => m.seo_keywords?.id).filter((x): x is string => !!x)))]
  const pages = new Map<string, { name: string; status: PageStatus }>()
  if (kwIds.length) {
    const rows = must(
      await db().from('seo_page_keywords').select('keyword_id, seo_pages(name, status)').in('keyword_id', kwIds),
      'Loading pages',
    ) as unknown as { keyword_id: string; seo_pages: { name: string; status: PageStatus } | null }[]
    for (const r of rows) if (r.seo_pages) pages.set(r.keyword_id, r.seo_pages)
  }
  const kw = (k: KwRow): MatrixKeyword => ({ id: k.id, keyword: k.keyword, role: k.role, semrushVolume: k.semrush_volume, kpVolume: k.kp_volume, page: pages.get(k.id) ?? null })

  return {
    // An area with no state shows the client's main state.
    areas: areaRows.map((a) => ({ code: a.code, name: a.name, state: a.name ? areaState(a, c.state) || null : a.state, status: a.status })),
    rows: ROWS.flatMap((code) => {
      const cat = catRows.find((k) => k.code === code)
      if (!cat) return []
      return [
        {
          code,
          name: cat.name,
          cells: areaRows.map((a): MatrixCell => {
            const r = cellRows.find((x) => x.category_id === cat.id && x.area_id === a.id)
            const links = (r?.seo_matrix_keywords ?? []).filter((m) => m.seo_keywords).sort((x, y) => x.sort - y.sort)
            const primary = links.find((m) => m.kind === 'primary')?.seo_keywords
            return {
              category: code,
              area: a.code,
              state: a.status === 'n_a' ? 'n_a' : primary ? 'target' : 'pending',
              primary: primary ? kw(primary) : null,
              backups: links.filter((m) => m.kind === 'backup').map((m) => kw(m.seo_keywords!)),
            }
          }),
        },
      ]
    }),
  }
}

const CellSchema = z.object({
  siteId: z.string(),
  category: z.enum(['Home', 'S1', 'S2', 'S3']),
  area: z.enum(['A1', 'A2', 'A3']),
  primaryId: z.string().uuid().nullable(),
  backupIds: z.array(z.string().uuid()).max(20),
})

/** Replaces one cell's primary + backups. A keyword can be the primary of one cell only. */
export async function setCell(raw: unknown): Promise<{ matrix: MatrixState; replaced: string | null }> {
  const p = CellSchema.safeParse(raw)
  if (!p.success) throw new MatrixInputError('That matrix cell isn’t right.')
  const input: MatrixCellInput = p.data
  const c = await client(input.siteId)
  const [cat, area] = await Promise.all([
    db().from('seo_client_categories').select('id').eq('client_id', c.id).eq('code', input.category).maybeSingle(),
    db().from('seo_client_areas').select('id, status').eq('client_id', c.id).eq('code', input.area).maybeSingle(),
  ])
  const catId = (must(cat, 'Loading the category') as { id: string } | null)?.id
  const a = must(area, 'Loading the area') as { id: string; status: string } | null
  if (!catId || !a) throw new MatrixInputError('That cell doesn’t exist for this client.')
  if (a.status === 'n_a') throw new MatrixInputError(`${input.area} is N/A for this client: mark it active on Edit client first.`)

  const backups = [...new Set(input.backupIds)].filter((id) => id !== input.primaryId)
  const ids = [...(input.primaryId ? [input.primaryId] : []), ...backups]
  if (ids.length) {
    const found = must(await db().from('seo_keywords').select('id').eq('client_id', c.id).in('id', ids), 'Checking the keywords') as { id: string }[]
    if (found.length !== ids.length) throw new MatrixInputError('A keyword isn’t this client’s.')
  }

  // Same cell row (upsert on category × area).
  const cell = must(
    await db()
      .from('seo_matrix_cells')
      .upsert({ client_id: c.id, category_id: catId, area_id: a.id, state: input.primaryId ? 'target' : 'pending' }, { onConflict: 'category_id,area_id' })
      .select('id')
      .single(),
    'Saving the cell',
  ) as { id: string }

  if (input.primaryId) {
    const taken = must(
      await db()
        .from('seo_matrix_keywords')
        .select('cell_id, seo_matrix_cells!inner(client_id)')
        .eq('keyword_id', input.primaryId)
        .eq('kind', 'primary')
        .neq('cell_id', cell.id)
        .eq('seo_matrix_cells.client_id', c.id),
      'Checking the primary',
    ) as unknown[]
    if (taken.length) throw new MatrixInputError('That keyword is already the primary of another cell. Pick a different one, or clear the other cell first.')
  }

  // The primary this cell had before (to say so when it's replaced: it keeps its role, the Database flags it).
  const before = (must(
    await db().from('seo_matrix_keywords').select('keyword_id, seo_keywords(keyword)').eq('cell_id', cell.id).eq('kind', 'primary').maybeSingle(),
    'Loading the cell',
  ) as unknown as { keyword_id: string; seo_keywords: { keyword: string } | null } | null)

  // Replace this cell's links (only links; the one keyword change is the Primary role below).
  must(await db().from('seo_matrix_keywords').delete().eq('cell_id', cell.id), 'Saving the cell')
  const links = [
    ...(input.primaryId ? [{ cell_id: cell.id, keyword_id: input.primaryId, kind: 'primary', sort: 0 }] : []),
    ...backups.map((id, i) => ({ cell_id: cell.id, keyword_id: id, kind: 'backup', sort: i + 1 })),
  ]
  if (links.length) must(await db().from('seo_matrix_keywords').insert(links), 'Saving the cell')
  // A primary picked by hand is Angel's pick: Primary role, only if the keyword has no role yet.
  if (input.primaryId) must(await db().from('seo_keywords').update({ role: 'primary' }).eq('id', input.primaryId).eq('client_id', c.id).is('role', null), 'Setting the Primary role')
  // The old primary keeps its role; the Database flags it when it's no longer a primary anywhere.
  const replaced = before && before.keyword_id !== input.primaryId ? (before.seo_keywords?.keyword ?? null) : null
  return { matrix: await getMatrix(input.siteId), replaced }
}
