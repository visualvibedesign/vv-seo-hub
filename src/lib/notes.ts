// Notes & links (redesign step 7): rules shared by the page and the server (the server re-checks everything).
import { accountLinkProblem } from './clientSetup.js'
import { looksLikeAddress } from './importRules.js'
import type { NoteKind } from '../types/seo.js'

export const NOTE_KINDS: { kind: NoteKind; label: string }[] = [
  { kind: 'note', label: 'Note' },
  { kind: 'decision', label: 'Decision' },
  { kind: 'rule', label: 'Rule' },
]
export const NOTE_KIND_LABEL: Record<NoteKind, string> = { note: 'Note', decision: 'Decision', rule: 'Rule' }

export const NOTE_MAX = 4000
export const AUTHOR_MAX = 60
export const LINK_LABEL_MAX = 80
export const LINK_NOTE_MAX = 120

/** '' = fine. A note never holds a street address (a private studio's address is never stored). */
export function noteProblem(raw: string): string {
  const s = raw.trim()
  if (!s) return 'Write the note first.'
  if (s.length > NOTE_MAX) return `Keep a note under ${NOTE_MAX} characters.`
  if (s.split(/[\n;,]+/).some((part) => looksLikeAddress(part))) return 'That looks like a street address. Addresses are never stored: leave it out.'
  return ''
}

/** '' = fine. https only, no username:password@, no keys in it (same rule as account links). */
export function linkProblem(label: string, url: string): string {
  if (!label.trim()) return 'Name the link.'
  if (label.trim().length > LINK_LABEL_MAX) return `Keep the name under ${LINK_LABEL_MAX} characters.`
  if (!url.trim()) return 'Paste the link (https://…).'
  return accountLinkProblem(url)
}

/** Two-letter icon from a name: "Google Search Console" → "GS", "ClickUp lists" → "CL", "GA4" → "GA". */
export function linkInitials(label: string): string {
  const words = label.replace(/\(.*?\)/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!words.length) return '··'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** "docs.google.com/spreadsheets/…" from a link (no https://, shortened). */
export function shortLink(url: string, max = 42): string {
  const s = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

const AUTHOR_KEY = 'vv-seo-note-author'

/** The name typed once per browser (no user list). Storage can be blocked: then it's just not remembered. */
export function savedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}
export function rememberAuthor(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name.trim().slice(0, AUTHOR_MAX))
  } catch {
    /* not remembered: fine */
  }
}
