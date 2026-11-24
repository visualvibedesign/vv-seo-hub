// "Needs you": what each client needs from the team next, from real counts only (never guessed).
// Used by All clients (first item) and the hub Overview (all items, every active client).
import type { ClientSummary } from '../types/seo'

export type NeedsYouItem = {
  /** Sort order: lower = more urgent. */
  rank: number
  tone: 'orange' | 'red' | 'purple'
  title: string
  /** Where it is ("Keywords › Database"). */
  where: string
  /** Client path to open (relative to /clients/{site id}). */
  path: string
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

export function needsYouItems(c: ClientSummary): NeedsYouItem[] {
  if (c.status === 'archived') return []
  const n = c.counts
  const out: NeedsYouItem[] = []
  if (n.keywords === 0) out.push({ rank: 1, tone: 'orange', title: 'Import keywords', where: 'Keywords › Import', path: 'keywords/import' })
  if (n.needsRole > 0)
    out.push({ rank: 2, tone: 'orange', title: `${plural(n.needsRole, 'keyword needs', 'keywords need')} a role`, where: 'Keywords › Database', path: 'keywords/database' })
  if (n.keywords > 0 && n.tracked === 0) out.push({ rank: 3, tone: 'purple', title: 'Pick keywords to track', where: 'Keywords › Database', path: 'keywords/database' })
  if (n.accountsPending > 0) out.push({ rank: 4, tone: 'purple', title: `${plural(n.accountsPending, 'account', 'accounts')} pending`, where: 'Overview › Accounts', path: '' })
  return out
}
