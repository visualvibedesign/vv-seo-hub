// Values-only .xlsx reader for "Import a client Sheet" (docs/client-sheet-import-plan.md). Runs in the browser.
// An .xlsx is a zip of XML files. We unzip ONLY the parts we need (workbook, its relationships, the sheets and the
// shared strings) with fflate (pinned), and read each cell's value: no formulas (a formula cell gives the value it
// last showed), no styles, no macros, no images, no comments. Text stays text exactly as written ("1K–10K").
// Guards: 3 MB file cap, 30 MB unzipped cap (checked before unzipping), row / column caps per sheet.
import { unzipSync } from 'fflate'

export const XLSX_MAX_BYTES = 3 * 1024 * 1024
const UNZIPPED_MAX = 30 * 1024 * 1024
const MAX_SHEETS = 40
const MAX_ROWS = 20000
const MAX_COLS = 300

export class XlsxError extends Error {}

export interface XlsxTab {
  name: string
  hidden: boolean
  /** Rows as text, top to bottom; blank rows kept as [] so sections line up like the Sheet's CSV download. */
  rows: string[][]
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** XML entities → text: &amp; &lt; &gt; &quot; &apos; &#38; &#x26;. Unknown ones stay as written. */
export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    return ENTITY[e.toLowerCase()] ?? m
  })
}

/** Attributes of one tag: `name="x" r:id="rId1"` → { name: 'x', 'r:id': 'rId1' } (values decoded). */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[3] ?? m[4] ?? '')
  return out
}

/**
 * The text of a string item (<si> or <is>): plain (<t>) or rich text (several <r><t> runs) joined in order.
 * Phonetic hints (<rPh>, East Asian readings) are not part of the value and are skipped.
 */
function itemText(xml: string): string {
  const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let out = ''
  for (const m of body.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) out += decodeXml(m[1] ?? '')
  return out
}

/** "AB12" → column 27 (0-based), or -1. */
function colOf(ref: string | undefined): number {
  const letters = /^([A-Z]+)\d*$/i.exec(ref ?? '')?.[1]?.toUpperCase()
  if (!letters) return -1
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** A stored number as the Sheet shows it plainly: "390.0" → "390", "3.76" stays. Not a number → as written. */
function numberText(v: string): string {
  if (!/^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : v
}

function cellValue(a: Record<string, string>, inner: string, shared: string[]): string {
  const t = a.t ?? 'n'
  if (t === 'inlineStr') return itemText(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '')
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  if (raw === undefined) return ''
  const v = decodeXml(raw)
  if (t === 's') return shared[Number(v)] ?? ''
  if (t === 'b') return v === '1' ? 'TRUE' : 'FALSE'
  if (t === 'str' || t === 'e' || t === 'd') return v // formula text result, error (#N/A), ISO date: as written
  return numberText(v.trim())
}

function sheetRows(xml: string, shared: string[], name: string): string[][] {
  const data = /<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/.exec(xml)?.[1] ?? ''
  const rows: string[][] = []
  let nextRow = 0
  for (const rm of data.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1])
    const rowIndex = ra.r ? Number(ra.r) - 1 : nextRow
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= MAX_ROWS) throw new XlsxError(`The “${name}” tab is too big (over ${MAX_ROWS.toLocaleString('en-US')} rows).`)
    nextRow = rowIndex + 1
    const cells: string[] = []
    let nextCol = 0
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1])
      const col = ca.r ? colOf(ca.r) : nextCol
      if (col < 0 || col >= MAX_COLS) throw new XlsxError(`The “${name}” tab is too wide (over ${MAX_COLS} columns).`)
      nextCol = col + 1
      const value = cellValue(ca, cm[2] ?? '', shared)
      if (value === '') continue
      while (cells.length < col) cells.push('')
      cells[col] = value
    }
    while (rows.length < rowIndex) rows.push([])
    rows[rowIndex] = cells
  }
  return rows
}

const NEEDED = /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/

/** Reads every tab's values. Throws XlsxError with a plain-English reason when the file can't be used. */
export function readXlsx(bytes: Uint8Array): XlsxTab[] {
  if (bytes.length > XLSX_MAX_BYTES) throw new XlsxError(`That file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. The cap is 3 MB.`)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new XlsxError('That isn’t an .xlsx file. In Google Sheets: File › Download › Microsoft Excel (.xlsx).')
  let total = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (!NEEDED.test(f.name)) return false
        total += f.originalSize
        if (f.originalSize > UNZIPPED_MAX || total > UNZIPPED_MAX) throw new XlsxError('That file unpacks to more than 30 MB. A client Sheet is much smaller: check it’s the right file.')
        return true
      },
    })
  } catch (e) {
    if (e instanceof XlsxError) throw e
    throw new XlsxError('Couldn’t open that file. Download it again from Google Sheets as .xlsx.')
  }
  const real = Object.values(files).reduce((n, f) => n + f.length, 0)
  if (real > UNZIPPED_MAX) throw new XlsxError('That file unpacks to more than 30 MB. A client Sheet is much smaller: check it’s the right file.')

  const text = (path: string) => (files[path] ? new TextDecoder('utf-8').decode(files[path]) : null)
  const workbook = text('xl/workbook.xml')
  if (!workbook) throw new XlsxError('That .xlsx has no workbook inside. Download it again from Google Sheets.')
  const rels = new Map<string, string>()
  for (const m of (text('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1])
    if (a.Id && a.Target) rels.set(a.Id, a.Target.startsWith('/') ? a.Target.slice(1) : `xl/${a.Target}`)
  }
  const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => itemText(m[1] ?? ''))

  const sheets = [...workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)].map((m) => attrs(m[1]))
  if (!sheets.length) throw new XlsxError('That .xlsx has no tabs.')
  if (sheets.length > MAX_SHEETS) throw new XlsxError(`That file has ${sheets.length} tabs. The cap is ${MAX_SHEETS}.`)
  return sheets.map((s) => {
    const name = s.name || 'Untitled'
    const path = rels.get(s['r:id'] ?? '')
    const xml = path ? text(path) : null
    return { name, hidden: s.state === 'hidden' || s.state === 'veryHidden', rows: xml ? sheetRows(xml, shared, name) : [] }
  })
}
