// Reads an exported CSV in the browser (Papa Parse) without changing any values.
// Keyword Planner: UTF-16, tab-separated, title lines before the header ("Keyword Stats …", date range).
// Semrush / Sheet: UTF-8 CSV. The raw file itself is uploaded untouched with the import.
import Papa from 'papaparse'
import { autoMatch, cleanKeyword, detectReport, sourceOf } from './importRules'
import type { ImportField, ImportReport, ImportRow } from '../types/seo'

export interface ParsedFile {
  fileName: string
  encoding: 'utf-16le' | 'utf-16be' | 'utf-8'
  titleLine: string
  headers: string[]
  rows: string[][]
  report: ImportReport
}

export const MAX_FILE_BYTES = 3 * 1024 * 1024 // Vercel request limit is ~4.5 MB, and the file goes up as base64

function decode(buf: ArrayBuffer): { text: string; encoding: ParsedFile['encoding'] } {
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(buf.slice(2)), encoding: 'utf-16le' }
  if (b[0] === 0xfe && b[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(buf.slice(2)), encoding: 'utf-16be' }
  // UTF-16 without a BOM: every other byte is 0 in plain text
  if (b.length > 3 && b[1] === 0 && b[3] === 0) return { text: new TextDecoder('utf-16le').decode(buf), encoding: 'utf-16le' }
  const text = new TextDecoder('utf-8').decode(buf)
  return { text: text.startsWith('﻿') ? text.slice(1) : text, encoding: 'utf-8' }
}

export async function readCsvFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Split it into files under 3 MB.`)
  const { text, encoding } = decode(await file.arrayBuffer())
  const lines = text.split(/\r?\n/)
  // The header is the first line whose first cell is "Keyword" (skips KP's title lines).
  const headerAt = lines.findIndex((l) => /^"?keyword"?(\t|,|$)/i.test(l.trim()))
  if (headerAt < 0) throw new Error('Couldn’t find a “Keyword” column header in this file.')
  const titleLine = lines.slice(0, headerAt).join(' ').trim()
  // Semrush Position Tracking exports have a "Keyword" column too, but they're rankings, not keyword research.
  if (/report type:\s*position_tracking/i.test(titleLine) || /position_tracking/i.test(file.name)) {
    throw new Error('This is a Semrush Position Tracking export (rankings). Upload it in the client Overview: Keyword rankings › Upload CSV (or Baseline › Semrush).')
  }
  const body = lines.slice(headerAt).join('\n')
  const delimiter = lines[headerAt].includes('\t') ? '\t' : ','
  const parsed = Papa.parse<string[]>(body, { delimiter, skipEmptyLines: 'greedy' })
  const [headers = [], ...rows] = parsed.data
  if (!rows.length) throw new Error('This file has a header but no rows.')
  return { fileName: file.name, encoding, titleLine, headers, rows, report: detectReport(file.name, headers, titleLine) }
}

export function initialMap(p: ParsedFile, report: ImportReport) {
  return autoMatch(sourceOf(report), p.headers)
}

/**
 * Applies the column match. Rows with no keyword: KP totals ("All", a county row) are kept apart;
 * anything else without a keyword is counted as blank and left out.
 */
export function applyMap(p: ParsedFile, map: Partial<Record<ImportField, string>>) {
  const idx = (f: ImportField) => (map[f] ? p.headers.indexOf(map[f]!) : -1)
  const at = Object.fromEntries((['keyword', 'volume', 'kd', 'cpc', 'intent', 'segment', 'role', 'service', 'kp'] as ImportField[]).map((f) => [f, idx(f)]))
  const rows: ImportRow[] = []
  const totals: { segment: string; volume: string }[] = []
  let blank = 0
  for (const r of p.rows) {
    const get = (f: ImportField) => (at[f] >= 0 ? (r[at[f]] ?? '').trim() : undefined)
    const keyword = cleanKeyword(get('keyword') ?? '')
    if (!keyword) {
      const segment = get('segment')
      if (segment) totals.push({ segment, volume: get('volume') ?? '' })
      else blank++
      continue
    }
    const raw: Record<string, string> = {}
    p.headers.forEach((h, i) => {
      raw[h || `Column ${i + 1}`] = r[i] ?? ''
    })
    rows.push({
      keyword,
      volume: get('volume'),
      kd: get('kd'),
      cpc: get('cpc'),
      intent: get('intent'),
      segment: get('segment') || undefined,
      role: get('role'),
      service: get('service'),
      kp: get('kp'),
      raw,
    })
  }
  return { rows, totals, blank }
}

/** Include / exclude words (comma-separated), like Semrush's filters. Case-insensitive. */
export function filterRows(rows: ImportRow[], include: string, exclude: string) {
  const words = (s: string) =>
    s
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
  const inc = words(include)
  const exc = words(exclude)
  return rows.filter((r) => {
    const k = r.keyword.toLowerCase()
    if (inc.length && !inc.some((w) => k.includes(w))) return false
    return !exc.some((w) => k.includes(w))
  })
}

/** The file as base64 (sent with the import so the raw file is kept untouched in Storage). */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
