// Keyword database look: role tags, intent tags, KP range quick picks. Used by every client.
// Colors reuse HQ tokens (light blue = hold, orange = pill-orange, gray = to-do). Teal has no HQ token,
// so it's defined here for this tag only (light + dark), without touching the global tokens.
import { PILL } from './ui'
import type { KeywordRole, KeywordStatus } from '../types/seo'

export const ROLE_LABEL: Record<KeywordRole, string> = { primary: 'Primary', secondary: 'Secondary', faq: 'FAQ', near_me: 'Near me' }
export const ROLES: KeywordRole[] = ['primary', 'secondary', 'faq', 'near_me']

export const ROLE_PILL: Record<KeywordRole, string> = {
  primary: `${PILL} bg-[#d9f2ee] text-[#0b5e53] dark:bg-[#7fd6c6] dark:text-[#121010]`,
  secondary: `${PILL} bg-vv-st-hold text-vv-st-hold-ink`,
  faq: `${PILL} bg-vv-pill-orange text-vv-pill-orange-ink`,
  near_me: `${PILL} bg-vv-st-todo text-vv-st-todo-ink`,
}

export const STATUS_LABEL: Record<KeywordStatus, string> = { keep: 'Keep', later: 'Later', rejected: 'Rejected' }

/** Semrush-like intent colors. Intent may hold several ("Commercial, Transactional"). */
const INTENT_PILL: Record<string, string> = {
  commercial: 'bg-vv-st-waiting text-vv-st-waiting-ink',
  informational: 'bg-vv-st-hold text-vv-st-hold-ink',
  navigational: 'bg-vv-st-review text-vv-st-review-ink',
  transactional: 'bg-vv-st-done text-vv-st-done-ink',
}
const INTENT_SHORT: Record<string, string> = { commercial: 'C', informational: 'I', navigational: 'N', transactional: 'T' }

export function intentParts(intent: string | null): { label: string; short: string; className: string }[] {
  return (intent ?? '')
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => {
      const k = label.toLowerCase()
      return { label, short: INTENT_SHORT[k] ?? label.slice(0, 1).toUpperCase(), className: `${PILL} px-2 ${INTENT_PILL[k] ?? 'bg-vv-st-todo text-vv-st-todo-ink'}` }
    })
}

/** Keyword Planner's ranges, as KP shows them (en dash). Saved as text exactly as picked. */
export const KP_PICKS = ['0–10', '10–100', '100–1K', '1K–10K', '10K–100K', '100K–1M', 'No data', 'Not checked']

/** "74000" → "74,000"; null → "". */
export const num = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'))
