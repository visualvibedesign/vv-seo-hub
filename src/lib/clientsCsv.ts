// Bulk "Add clients from CSV": columns name, URL, city, state, industry (optional). Pure helpers shared by the
// browser (read + column match) and the server (it re-checks everything before saving). No address column, ever.
import Papa from 'papaparse'
import type { BulkClientRow } from '../types/seo.js'

export type BulkField = 'name' | 'url' | 'city' | 'state' | 'industry'
export const BULK_FIELDS: { field: BulkField; label: string; required: boolean }[] = [
  { field: 'name', label: 'Business name', required: true },
  { field: 'url', label: 'Website URL', required: true },
  { field: 'city', label: 'City (becomes A1)', required: true },
  { field: 'state', label: 'State', required: false },
  { field: 'industry', label: 'Industry', required: false },
]

/** Header names each field is matched from (lower case, spaces / _ / - ignored). */
const ALIASES: Record<BulkField, string[]> = {
  name: ['name', 'businessname', 'business', 'client', 'clientname', 'company'],
  url: ['url', 'website', 'websiteurl', 'site', 'siteurl', 'homeurl', 'domain'],
  city: ['city', 'maincity', 'town', 'area', 'a1'],
  state: ['state', 'st', 'statecode', 'region'],
  industry: ['industry', 'template', 'type', 'category', 'niche'],
}
const squash = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, '')

export interface BulkFile {
  fileName: string
  headers: string[]
  rows: string[][]
}

/** CSV or tab-separated text, first line = headers. */
export function parseClientsCsv(text: string, fileName: string): BulkFile {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const first = clean.split(/\r?\n/, 1)[0] ?? ''
  const parsed = Papa.parse<string[]>(clean, { delimiter: first.includes('\t') ? '\t' : ',', skipEmptyLines: 'greedy' })
  const [headers = [], ...rows] = parsed.data
  return { fileName, headers: headers.map((h) => h.trim()), rows }
}

/** Header → field, by name. Unmatched fields stay empty (pick them by hand). */
export function autoMapClients(headers: string[]): Partial<Record<BulkField, number>> {
  const map: Partial<Record<BulkField, number>> = {}
  for (const { field } of BULK_FIELDS) {
    const i = headers.findIndex((h) => ALIASES[field].includes(squash(h)))
    if (i >= 0 && !Object.values(map).includes(i)) map[field] = i
  }
  return map
}

/** The mapped rows (trimmed text, nothing else changed). Blank lines are dropped. */
export function mapClientRows(file: BulkFile, map: Partial<Record<BulkField, number>>): BulkClientRow[] {
  const get = (r: string[], f: BulkField) => (map[f] === undefined ? '' : (r[map[f]!] ?? '').trim())
  return file.rows
    .map((r, i) => ({ line: i + 2, name: get(r, 'name'), url: get(r, 'url'), city: get(r, 'city'), state: get(r, 'state'), industry: get(r, 'industry') }))
    .filter((r) => r.name || r.url || r.city)
}
