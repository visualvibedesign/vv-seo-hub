// Phase 3 · SEO hotspot checks (Sam Day 5–6), plain code: warnings only, never blocking.
// Title 50–60 characters, meta 150–160 and ending with a call to action, primary keyword near the start of the
// title, full state name in the title, state abbreviation (not the full name) in the URL, no open [brackets].
import { stateName } from './templates'

export type HotspotCheck = { ok: boolean; text: string }

export const TITLE_RANGE = [50, 60] as const
export const META_RANGE = [150, 160] as const

const STOP = new Set(['in', 'near', 'me', 'the', 'a', 'an', 'and', 'of', 'for', 'to', 'best', 'top'])
// Last sentence of a meta description that asks the reader to do something (Sam: end with a call to action, "!").
const CTA = /\b(book|call|contact|schedule|get|request|start|visit|see|shop|order|learn|find|try|claim|reserve|message|text|email|talk|chat|apply|join|discover|explore|browse|download|sign up|reach out)\b/i

export const inRange = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi

/** The words of the primary keyword that should show in the title (no state abbreviation, no filler words). */
function keyWords(primary: string, st: string | null): string[] {
  const abbr = st?.trim().toLowerCase()
  return primary
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w) && w !== abbr)
}

export function hotspotChecks(v: { title: string; meta: string; h1: string; url: string; primary: string | null; state: string | null }): HotspotCheck[] {
  const out: HotspotCheck[] = []
  const title = v.title.trim()
  const meta = v.meta.trim()
  const st = v.state?.trim().toUpperCase() || null
  const full = st ? stateName(st) : null

  out.push({ ok: inRange(title.length, TITLE_RANGE), text: `SEO title ${title.length} characters (aim for ${TITLE_RANGE[0]}–${TITLE_RANGE[1]})` })
  out.push({ ok: inRange(meta.length, META_RANGE), text: `Meta description ${meta.length} characters (aim for ${META_RANGE[0]}–${META_RANGE[1]})` })
  const lastSentence = meta.split(/(?<=[.!?])\s+/).filter(Boolean).pop() ?? ''
  out.push({ ok: !!meta && (/!\s*$/.test(meta) || CTA.test(lastSentence)), text: 'Meta description ends with a call to action (book, call, get a quote… or “!”)' })

  if (v.primary) {
    const words = keyWords(v.primary, st)
    const t = title.toLowerCase()
    const all = words.length > 0 && words.every((w) => t.includes(w))
    const first = words.length ? Math.min(...words.map((w) => (t.includes(w) ? t.indexOf(w) : Infinity))) : Infinity
    out.push({ ok: all && first <= 25, text: `Primary keyword “${v.primary}” near the start of the title` })
  } else out.push({ ok: false, text: 'No primary keyword on this page yet (set it in Clusters)' })

  if (st && full && full !== st) {
    const hasFull = title.toLowerCase().includes(full.toLowerCase())
    const hasAbbr = new RegExp(`\\b${st}\\b`).test(title)
    out.push({ ok: hasFull || !hasAbbr, text: hasAbbr && !hasFull ? `Use the full state name “${full}” in the title, not “${st}”` : `Full state name “${full}” in the title when a place is named` })
    const url = v.url.toLowerCase()
    const slugFull = full.toLowerCase().replace(/\s+/g, '-')
    out.push({ ok: !url.includes(slugFull), text: url.includes(slugFull) ? `Use the state abbreviation “${st.toLowerCase()}” in the URL, not “${slugFull}”` : 'State abbreviation (not the full name) in the URL' })
  }
  out.push({ ok: !!v.h1.trim(), text: 'H1 filled in' })
  const open = `${title} ${meta} ${v.h1}`.match(/\[[^\]]*\]/g)
  out.push({ ok: !open, text: open ? `Still in [brackets]: ${[...new Set(open)].join(', ')} (fill in, or keep on purpose)` : 'No [bracketed] placeholders left' })
  return out
}

/** "Brazilian Wax NY" → "/brazilian-wax-ny/" (what the server saves; shown as you type). */
export function slugPath(v: string): string {
  const path = v.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '')
  const slug = path
    .toLowerCase()
    .split('/')
    .map((s) => s.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/')
  return slug ? `/${slug}/` : '/'
}
