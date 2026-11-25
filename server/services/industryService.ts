// Industries (migration 0009): a list Angel adds to (Add client wizard "+ New industry", Templates "Add industry").
// An industry is only a label. It never needs its own template versions: without them, the generic templates are
// used, and the rules always run on the client's own services, areas, scope words and brand words.
import { z } from 'zod'
import type { Industry } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'

export class IndustryInputError extends Error {}

type Row = { key: string; label: string; hint: string | null; sort: number; built_in: boolean }
const toIndustry = (r: Row): Industry => ({ key: r.key, label: r.label, hint: r.hint, sort: r.sort, builtIn: r.built_in })

export async function listIndustries(): Promise<Industry[]> {
  const rows = must(await db().from('seo_industries').select('key, label, hint, sort, built_in'), 'Loading industries') as Row[]
  return rows.map(toIndustry).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
}

/** Is this a known industry key? (null = no industry, always fine.) */
export async function checkIndustry(key: string | null): Promise<void> {
  if (key === null) return
  const row = must(await db().from('seo_industries').select('key').eq('key', key).maybeSingle(), 'Checking the industry')
  if (!row) throw new IndustryInputError('That industry isn’t in the list. Add it first.')
}

/** "Web design / agency" → "web_design_agency" (2–40 letters, digits, _). */
export function industryKey(label: string): string {
  const k = label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
    .replace(/_+$/, '')
  return k.length >= 2 ? k : `industry_${k}`.slice(0, 40)
}

const AddSchema = z.object({
  label: z.string().trim().min(1, 'Name the industry.').max(60, 'Keep the industry name under 60 characters.'),
  hint: z.string().trim().max(200).optional().default(''),
})

/** Adds an industry. Same name (any case) as an existing one → returns that one instead of a copy. */
export async function addIndustry(raw: unknown): Promise<Industry> {
  const p = AddSchema.safeParse(raw)
  if (!p.success) throw new IndustryInputError(p.error.issues[0]?.message ?? 'That industry isn’t right.')
  const all = await listIndustries()
  const same = all.find((i) => i.label.trim().toLowerCase() === p.data.label.toLowerCase())
  if (same) return same
  const base = industryKey(p.data.label)
  let key = base
  for (let n = 2; all.some((i) => i.key === key); n++) key = `${base}_${n}`
  // New ones go after the others but before anything parked at the end (sort 999+, e.g. Blank).
  const sort = Math.max(0, ...all.filter((i) => i.sort < 999).map((i) => i.sort)) + 10
  const row = must(
    await db().from('seo_industries').insert({ key, label: p.data.label, hint: p.data.hint || null, sort, built_in: false }).select('key, label, hint, sort, built_in').single(),
    'Adding the industry',
  ) as Row
  return toIndustry(row)
}

const RenameSchema = z.object({ key: z.string().regex(/^[a-z0-9_]{2,40}$/), label: AddSchema.shape.label, hint: AddSchema.shape.hint })

/** Renames an industry (the key stays, so clients and templates keep pointing at it). */
export async function renameIndustry(raw: unknown): Promise<Industry> {
  const p = RenameSchema.safeParse(raw)
  if (!p.success) throw new IndustryInputError(p.error.issues[0]?.message ?? 'That industry isn’t right.')
  const clash = (await listIndustries()).find((i) => i.key !== p.data.key && i.label.trim().toLowerCase() === p.data.label.toLowerCase())
  if (clash) throw new IndustryInputError(`“${clash.label}” already exists.`)
  const rows = must(
    await db().from('seo_industries').update({ label: p.data.label, hint: p.data.hint || null }).eq('key', p.data.key).select('key, label, hint, sort, built_in'),
    'Renaming the industry',
  ) as Row[]
  if (!rows.length) throw new IndustryInputError('That industry doesn’t exist.')
  return toIndustry(rows[0])
}
