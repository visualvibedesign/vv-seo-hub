// Phase 4c · Links (Sam Days 8–9) helpers shared by the server and the Links screen. Plain code only.
import type { FoundVia, OpportunityHow, PremierKind } from '../types/seo.js'

/** Sam's citation waves by list row: 1, 4, 7… → wave 1 · 2, 5, 8… → wave 2 · 3, 6, 9… → wave 3. */
export const waveOf = (rowNo: number): 1 | 2 | 3 => ((((rowNo - 1) % 3) + 3) % 3 + 1) as 1 | 2 | 3

/** "https://www.Example.com/path?x" → "example.com". null if it isn't a domain. */
export function rootDomain(input: string | null | undefined): string | null {
  const t = (input ?? '').trim().toLowerCase()
  if (!t) return null
  const host = t.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0].replace(/:\d+$/, '').replace(/\.$/, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

/** One pasted line → cells (tab first, then comma when there are no tabs; quotes trimmed). */
export function cells(line: string): string[] {
  const parts = line.includes('\t') ? line.split('\t') : line.split(',')
  return parts.map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim())
}

/** Sam: "AS 3+ is OK to pursue"; the Backlink Gap hides below this by default. */
export const GAP_MIN_AS = 3

export const FOUND_VIA: { key: FoundVia; label: string }[] = [
  { key: 'R', label: 'Relationship' },
  { key: 'S', label: 'Search' },
  { key: 'C', label: 'Competitor' },
  { key: 'Cit', label: 'Citation' },
  { key: 'Sp', label: 'Sponsorship' },
]
export const HOW_LABEL: Record<OpportunityHow, string> = { claim: 'Claim', apply: 'Apply', contact: 'Contact', join: 'Join', other: 'Other' }
export const PREMIER_KINDS: { key: PremierKind; label: string }[] = [
  { key: 'chamber', label: 'Chamber of commerce' },
  { key: 'trade_group', label: 'Trade groups / associations' },
  { key: 'certification', label: 'Certifications' },
  { key: 'referral_partner', label: 'Referral partners' },
  { key: 'vendor', label: 'Manufacturers / vendors' },
  { key: 'organization', label: 'Organizations worked with' },
  { key: 'editorial', label: 'Editorial idea' },
]
