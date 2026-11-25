// Bulk "Add clients from CSV" (name, URL, city, state, optional industry). Preview first, nothing saved; on Add,
// every row is checked again here (never trusting the browser) and only the New ones are saved:
//   * site id worked out the same way the Vibe SEO plugin does it
//   * already a client (same site id) or twice in the file (first one kept) → skipped
//   * an industry that isn't in the list yet is added to it (by name, same as "+ New industry")
//   * no address is ever accepted: a city / name that looks like a street address is a problem row
// New clients get no services (filled in later per client) and every account starts Ready.
import { z } from 'zod'
import { stripStateSuffix } from '../../src/lib/templates.js'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import type { BulkClientCheck, BulkClientRow } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { normalizeSiteUrl, siteIdFor, SiteUrlError } from '../utils/siteId.js'
import { addClientBasic, ClientInputError } from './clientService.js'
import { addIndustry, listIndustries } from './industryService.js'

export const BULK_MAX = 500

const RowSchema = z.object({
  line: z.number().int().min(1),
  name: z.string().max(500),
  url: z.string().max(500),
  city: z.string().max(500),
  state: z.string().max(500),
  industry: z.string().max(500),
})
const RowsSchema = z.array(RowSchema).min(1, 'The file has no client rows.').max(BULK_MAX, `Up to ${BULK_MAX} clients per file. Split it.`)

function parseRows(raw: unknown): BulkClientRow[] {
  const p = RowsSchema.safeParse((raw as { rows?: unknown } | null)?.rows)
  if (!p.success) throw new ClientInputError(p.error.issues[0]?.message ?? 'Those rows aren’t right.')
  return p.data
}

/** Checks every row (nothing saved). */
export async function checkBulk(rows: BulkClientRow[]): Promise<BulkClientCheck[]> {
  const [industries, existing] = await Promise.all([
    listIndustries(),
    db().from('seo_clients').select('site_id, name'),
  ])
  const taken = new Map((must(existing, 'Loading clients') as { site_id: string; name: string }[]).map((c) => [c.site_id, c.name]))
  const seen = new Map<string, number>()
  return rows.map((raw): BulkClientCheck => {
    const r = { ...raw, city: stripStateSuffix(raw.city, raw.state) } // "Staten Island, NY" + NY → "Staten Island"
    const base = { ...r, siteUrl: null, siteId: null, industryKey: null, industryLabel: null, industryNew: false }
    const problem = (note: string): BulkClientCheck => ({ ...base, status: 'problem', note })
    if (!r.name) return problem('No business name.')
    if (r.name.length > 120) return problem('Business name is too long (120 max).')
    if (!r.url) return problem('No website URL.')
    if (!r.city) return problem('No city (it becomes the main area, A1).')
    if (r.city.length > 80 || r.state.length > 40) return problem('City or state is too long.')
    if (looksLikeAddress(r.city) || looksLikeAddress(r.name)) return problem('Looks like a street address. Addresses are never stored: use the city only.')
    let siteUrl: string
    try {
      siteUrl = normalizeSiteUrl(r.url)
    } catch (err) {
      if (err instanceof SiteUrlError) return problem(err.message)
      throw err
    }
    const siteId = siteIdFor(siteUrl)
    // Industry: a key or a name from the list (any case); anything else is a new one, added on save.
    let industryKey: string | null = null
    let industryLabel: string | null = null
    let industryNew = false
    if (r.industry) {
      const hit = industries.find((i) => i.key === r.industry.toLowerCase() || i.label.toLowerCase() === r.industry.toLowerCase())
      if (hit) {
        industryKey = hit.key
        industryLabel = hit.label
      } else if (r.industry.length > 60) return problem('Industry name is too long (60 max).')
      else {
        industryLabel = r.industry
        industryNew = true
      }
    }
    const withSite = { ...base, siteUrl, siteId, industryKey, industryLabel, industryNew }
    if (taken.has(siteId)) return { ...withSite, status: 'exists', note: `Already a client: ${taken.get(siteId)}.` }
    if (seen.has(siteId)) return { ...withSite, status: 'repeat', note: `Same site as line ${seen.get(siteId)}: only the first is added.` }
    seen.set(siteId, r.line)
    return { ...withSite, status: 'new', note: '' }
  })
}

export async function previewBulk(raw: unknown): Promise<BulkClientCheck[]> {
  return checkBulk(parseRows(raw))
}

/** Adds the New rows (after checking again). New industries are added to the list first. */
export async function addBulk(raw: unknown): Promise<{ added: number; skipped: number; industriesAdded: string[]; rows: BulkClientCheck[]; failed: { line: number; note: string }[] }> {
  const rows = await checkBulk(parseRows(raw))
  const toAdd = rows.filter((r) => r.status === 'new')
  // One new industry per distinct name (case-insensitive); addIndustry returns the existing one for a same name.
  const newNames = [...new Map(toAdd.filter((r) => r.industryNew).map((r) => [r.industryLabel!.toLowerCase(), r.industryLabel!])).values()]
  const keyFor = new Map<string, string>()
  for (const label of newNames) keyFor.set(label.toLowerCase(), (await addIndustry({ label })).key)
  const failed: { line: number; note: string }[] = []
  let added = 0
  for (const r of toAdd) {
    const industry = r.industryNew ? (keyFor.get(r.industryLabel!.toLowerCase()) ?? null) : r.industryKey
    try {
      await addClientBasic({ name: r.name, siteUrl: r.siteUrl!, siteId: r.siteId!, city: r.city, state: r.state, industry })
      added++
    } catch (err) {
      failed.push({ line: r.line, note: err instanceof Error ? err.message : 'Couldn’t add this one.' })
    }
  }
  return { added, skipped: rows.length - toAdd.length, industriesAdded: newNames, rows, failed }
}
