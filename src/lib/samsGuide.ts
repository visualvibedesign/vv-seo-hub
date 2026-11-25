// Reads a client's "Sam's Guide" sheet tab (exported as CSV). Pure: same text → same result, for any client.
// The tab is several "pages" stacked in one sheet, so it's read by section titles ("Page 2 · …", "Direct
// competitors") and header names, never by fixed cell positions. Values are kept exactly as written.
// Sections read: Page 2 (3×3 register + hub rows), Direct competitors (names only), Page 3 (keep for later),
// Page 5 (Top 10 per page). Page 1 (seeds), Page 4 (Keyword Gap) and Page 6 (checklist) are skipped.
import Papa from 'papaparse'

/** One volume as written, split by source: "Semrush 40 · KP 10–100" → { semrush: '40', kp: '10–100' }. */
export interface SheetVolume {
  semrush: string | null
  kp: string | null
  kd: string | null
  cpc: string | null
  /** The whole text as written. */
  written: string
}

export interface RegisterRow {
  line: number
  /** "S1-A2" → category S1, area A2. A hub row ("S1 hub") has no area: it's a page target, not a matrix cell. */
  id: string
  category: string
  area: string | null
  hub: boolean
  /** null = "Pending" (no primary yet). */
  primary: string | null
  pending: boolean
  na: boolean
  volume: SheetVolume
  variants: { keyword: string; volume: SheetVolume }[]
  /** "Home (/)" → "/"; "example.com/brand-design" → "/brand-design" (+ host); "None yet" → null. */
  pageNow: { path: string | null; host: string | null; written: string }
  notes: string
  track: boolean
}

export interface LaterRow {
  line: number
  type: string
  keyword: string
  volume: SheetVolume
  why: string
  status: 'later' | 'rejected'
}

export interface PageTop {
  line: number
  name: string
  keywords: { line: number; rank: number; keyword: string; volume: SheetVolume }[]
}

export interface Competitor {
  line: number
  code: string
  /** Name only: anything in brackets removed. null = it still looked like an address (never stored). */
  name: string | null
  written: string
}

export interface SamsGuide {
  title: string
  /** "Sam's Guide · Keyword research: Visual Vibe Design" → "Visual Vibe Design". */
  clientName: string | null
  register: RegisterRow[]
  competitors: Competitor[]
  later: LaterRow[]
  pages: PageTop[]
  skipped: { line: number; section: string; why: string }[]
  notUnderstood: { line: number; section: string; text: string }[]
}

const DOT = /\s+·\s+/
const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** "Semrush 50 · KP 10–100" | "260 · 10–100" | "No data · KP no data" | "(390 · KD 13)" | "50 · CPC $28.73". */
export function parseVolume(text: string): SheetVolume {
  const written = clean(text).replace(/^\((.*)\)$/, '$1')
  const v: SheetVolume = { semrush: null, kp: null, kd: null, cpc: null, written }
  if (!written) return v
  written.split(DOT).forEach((seg, i) => {
    const m = seg.match(/^(semrush|kp|kd|cpc)\s*:?\s*(.+)$/i)
    if (m) {
      const key = m[1].toLowerCase() as 'semrush' | 'kp' | 'kd' | 'cpc'
      v[key] = m[2].trim()
    } else if (i === 0 && !v.semrush) v.semrush = seg.trim() // bare first value = Semrush ("50", "No data", "n/a")
    else if (!v.kp) v.kp = seg.trim() // bare later value = KP ("10–100")
  })
  return v
}

/** "web design rogers (40)" → keyword + volume; no brackets → volume empty. */
function keywordWithVolume(text: string): { keyword: string; volume: SheetVolume } {
  const m = clean(text).match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  return m ? { keyword: m[1].trim(), volume: parseVolume(m[2]) } : { keyword: clean(text), volume: parseVolume('') }
}

/** "a / b" or "a; b" → each keyword (with its own volume in brackets, if any). */
function splitKeywords(text: string): { keyword: string; volume: SheetVolume }[] {
  return clean(text)
    .split(/\s*;\s*|\s+\/\s+/)
    .filter(Boolean)
    .map(keywordWithVolume)
    .filter((k) => k.keyword)
}

/** "Home (/)" → "/"; "visualvibedesign.com/brand-design" → host + "/brand-design"; "None yet" → null. */
export function parsePageNow(text: string): RegisterRow['pageNow'] {
  const written = clean(text)
  const inBrackets = written.match(/\((\/[^)]*)\)/)
  if (inBrackets) return { path: inBrackets[1], host: null, written }
  const url = written.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(\/\S*)?$/i)
  if (url) return { path: url[2] || '/', host: url[1].toLowerCase(), written }
  if (/^\/\S*$/.test(written)) return { path: written, host: null, written }
  return { path: null, host: null, written }
}

/** Competitor name only: drop "(…)" / "[…]" (addresses, notes). */
export function competitorName(text: string): string {
  return clean(text.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '))
}

type Section = 'intro' | 'page1' | 'page2' | 'competitors' | 'page3' | 'page4' | 'page5' | 'page6' | 'other'

function sectionOf(first: string): Section | null {
  const m = first.match(/^page\s*(\d)\b/i)
  if (m) return ['1', '2', '3', '4', '5', '6'].includes(m[1]) ? (`page${m[1]}` as Section) : 'other'
  if (/^direct competitors\b/i.test(first) || /^competitors\b/i.test(first)) return 'competitors'
  return null
}

const SKIP_WHY: Partial<Record<Section, string>> = {
  page1: 'Page 1 · Semrush seeds: not imported (seeds only)',
  page4: 'Page 4 · Keyword Gap: skipped',
  page6: 'Page 6 · checklist: not data',
  other: 'Unknown page: skipped',
}

/** Header cell index by name (case-insensitive "starts with"). */
const col = (header: string[], ...names: string[]) => header.findIndex((h) => names.some((n) => clean(h).toLowerCase().startsWith(n)))
const isTrue = (s: string | undefined) => /^(true|yes|x|✓|✔|1)$/i.test(clean(s))

export function parseSamsGuide(text: string): SamsGuide {
  const rows = Papa.parse<string[]>(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, { skipEmptyLines: false }).data
  const out: SamsGuide = { title: clean(rows[0]?.[0]), clientName: null, register: [], competitors: [], later: [], pages: [], skipped: [], notUnderstood: [] }
  out.clientName = out.title.match(/:\s*(.+)$/)?.[1]?.trim() || null

  let section: Section = 'intro'
  let header: string[] | null = null
  let page: PageTop | null = null
  const filled = (r: string[]) => r.filter((c) => clean(c)).length

  rows.forEach((r, i) => {
    const line = i + 1
    const first = clean(r[0])
    const sec = first ? sectionOf(first) : null
    if (sec) {
      section = sec
      header = null
      page = null
      if (SKIP_WHY[sec]) out.skipped.push({ line, section: first, why: SKIP_WHY[sec]! })
      return
    }
    if (!filled(r) || SKIP_WHY[section] || section === 'intro') return
    // A one-cell line under a table is a note ("Track = …", "All four were seen …"): not data.
    if (header && filled(r) === 1 && first.length > 60) return
    if (!header) {
      if (filled(r) >= 2) header = r
      return
    }
    const h = header as string[]
    const get = (...names: string[]) => {
      const c = col(h, ...names)
      return c < 0 ? '' : clean(r[c])
    }

    if (section === 'page2') {
      const id = get('id')
      const m = id.match(/^(home|s[1-9])(?:\s*-\s*(a[1-9])|\s+hub)$/i)
      if (!m) return void out.notUnderstood.push({ line, section: 'Page 2', text: r.filter(Boolean).join(' | ') })
      const primaryText = get('primary')
      const pending = /^pending$/i.test(primaryText)
      const na = /^n\/?a$/i.test(primaryText)
      out.register.push({
        line,
        id,
        category: m[1].toLowerCase() === 'home' ? 'Home' : m[1].toUpperCase(),
        area: m[2] ? m[2].toUpperCase() : null,
        hub: !m[2],
        primary: pending || na || !primaryText ? null : primaryText,
        pending: pending || !primaryText,
        na,
        volume: parseVolume(get('volume')),
        variants: splitKeywords(get('close variants', 'variants')),
        pageNow: parsePageNow(get('page that serves', 'page')),
        notes: get('notes'),
        track: isTrue(get('track')),
      })
    } else if (section === 'competitors') {
      const code = clean(r[col(h, '#')] ?? r[0])
      const written = get('name')
      if (!/^c\d$/i.test(code) || !written) return void out.notUnderstood.push({ line, section: 'Competitors', text: r.filter(Boolean).join(' | ') })
      const name = competitorName(written)
      out.competitors.push({ line, code: code.toUpperCase(), name: name || null, written })
    } else if (section === 'page3') {
      const type = get('type')
      const why = get('use', 'why')
      const status = /^reject/i.test(type) ? 'rejected' : 'later'
      const kws = splitKeywords(get('keyword'))
      if (!type || !kws.length) return void out.notUnderstood.push({ line, section: 'Page 3', text: r.filter(Boolean).join(' | ') })
      for (const k of kws) out.later.push({ line, type, keyword: k.keyword, volume: k.volume, why, status })
    } else if (section === 'page5') {
      const name = get('page')
      const rank = Number(get('#'))
      const keyword = get('keyword')
      if (name) {
        page = { line, name, keywords: [] }
        out.pages.push(page)
      }
      if (!page || !keyword || !Number.isFinite(rank)) return void out.notUnderstood.push({ line, section: 'Page 5', text: r.filter(Boolean).join(' | ') })
      ;(page as PageTop).keywords.push({ line, rank, keyword, volume: parseVolume(get('volume')) })
    }
  })
  return out
}
