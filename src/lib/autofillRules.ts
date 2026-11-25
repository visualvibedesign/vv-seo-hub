// Day 2 auto-fill, plain-code rules (redesign step 6b). Pure functions: same input → same suggestions, for any
// client. Rules only SUGGEST; nothing changes until Angel approves. Guardrails (Angel, Nov 25):
//   * Roles only for keywords with no role ("Needs role"); services only for keywords with no service.
//   * Never suggests Primary (a judgment call for the matrix / Claude step).
//   * Two rules that disagree → "needs a look" with both options, never a pick.
//   * Every suggestion names the rule that made it.
//   * Service match: the exact service name, or a service word from the client's industry template that points
//     to exactly one of the client's services. No match → no suggestion (listed under Needs you).
import type { KeywordRole } from '../types/seo.js'

export type RuleRole = Exclude<KeywordRole, 'primary'>
export type Option<T> = { value: T; rule: string }
export type ItemDecision = 'approved' | 'rejected' | 'skipped' | null

/** One keyword in a suggestion. `options.length === 1` = a suggestion; more = needs a look. */
export interface SuggestItem<T> {
  keywordId: string
  keyword: string
  options: Option<T>[]
  decision: ItemDecision
  /** What was applied (a picked option for "needs a look", or the single suggestion). */
  applied?: T
}

export interface RulesPayload<T> {
  items: SuggestItem<T>[]
  /** Keywords no rule matched (shown under Needs you). */
  unmatched: { keywordId: string; keyword: string }[]
}

export type Words = { money: string[]; faq: string[]; service: string[] }

const QUESTION_STARTS = ['how', 'what', 'why', 'does', 'do', 'can', 'is', 'are', 'should', 'when', 'where', 'which', 'will']

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
/** "full legs" → "full leg" (simple plural; words over 3 letters). */
const singular = (s: string) =>
  norm(s)
    .trim()
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
const has = (keyword: string, phrase: string) => phrase.trim() !== '' && norm(keyword).includes(norm(phrase))

/** Role options for one keyword (empty = no rule matched). Same role from two rules → one option. */
export function roleOptions(keyword: string, w: Words): Option<RuleRole>[] {
  const out: Option<RuleRole>[] = []
  const add = (value: RuleRole, rule: string) => {
    if (!out.some((o) => o.value === value)) out.push({ value, rule })
  }
  if (has(keyword, 'near me')) add('near_me', 'near me rule')
  const faq = w.faq.find((f) => has(keyword, f))
  const first = norm(keyword).trim().split(' ')[0]
  if (faq) add('faq', `FAQ word “${faq}”`)
  else if (QUESTION_STARTS.includes(first)) add('faq', `question word “${first}”`)
  const money = w.money.find((m) => has(keyword, m))
  if (money) add('secondary', `money word “${money}”`)
  return out
}

/** `home` = a Home-row service (the general term, e.g. "Waxing"): only used when no S1–S3 service matches. */
export type ServiceRef = { id: string; name: string; home?: boolean }

/**
 * Service options, in order: an S1–S3 service name in the keyword, then a template service word that points to
 * S1–S3 services, then (only if nothing else matched) a Home service name (the general term).
 */
export function serviceOptions(keyword: string, all: ServiceRef[], w: Words): Option<string>[] {
  const specific = serviceMatches(keyword, all.filter((s) => !s.home), w)
  return specific.length ? specific : serviceMatches(keyword, all.filter((s) => s.home), { ...w, service: [] })
}

function serviceMatches(keyword: string, services: ServiceRef[], w: Words): Option<string>[] {
  const out: Option<string>[] = []
  const add = (value: string, rule: string) => {
    if (!out.some((o) => o.value === value)) out.push({ value, rule })
  }
  const kw = ` ${singular(keyword)} `
  // 1. exact service name in the keyword (plurals ignored): longest names first, so "bikini line" beats "bikini"
  const byLength = [...services].sort((a, b) => b.name.length - a.name.length)
  const exact = byLength.filter((s) => kw.includes(` ${singular(s.name)} `))
  // drop a shorter exact match that sits inside a longer one ("bikini" inside "full bikini")
  const kept = exact.filter((s) => !exact.some((o) => o !== s && singular(o.name).includes(singular(s.name)) && kw.includes(` ${singular(o.name)} `)))
  for (const s of kept) add(s.id, `service name “${s.name}”`)
  if (out.length) return out
  // 2. a template service word that points to exactly one service
  for (const word of [...w.service].sort((a, b) => b.length - a.length)) {
    if (!kw.includes(` ${singular(word)} `)) continue
    const targets = services.filter((s) => singular(s.name).includes(singular(word)) || singular(word).includes(singular(s.name)))
    if (targets.length === 1) add(targets[0].id, `service word “${word}”`)
    else if (targets.length > 1) for (const t of targets) add(t.id, `service word “${word}” (fits ${targets.length} services)`)
    if (targets.length) break // the longest matching word decides
  }
  return out
}

export type KeywordLite = { id: string; keyword: string; role: KeywordRole | null; serviceId: string | null; status: string }

export function suggestRoles(keywords: KeywordLite[], w: Words): RulesPayload<RuleRole> {
  const items: SuggestItem<RuleRole>[] = []
  const unmatched: RulesPayload<RuleRole>['unmatched'] = []
  for (const k of keywords) {
    if (k.role || k.status === 'rejected') continue
    const options = roleOptions(k.keyword, w)
    if (options.length) items.push({ keywordId: k.id, keyword: k.keyword, options, decision: null })
    else unmatched.push({ keywordId: k.id, keyword: k.keyword })
  }
  return { items, unmatched }
}

export function suggestServices(keywords: KeywordLite[], services: ServiceRef[], w: Words): RulesPayload<string> {
  const items: SuggestItem<string>[] = []
  const unmatched: RulesPayload<string>['unmatched'] = []
  for (const k of keywords) {
    if (k.serviceId || k.status === 'rejected') continue
    const options = serviceOptions(k.keyword, services, w)
    if (options.length) items.push({ keywordId: k.id, keyword: k.keyword, options, decision: null })
    else unmatched.push({ keywordId: k.id, keyword: k.keyword })
  }
  return { items, unmatched }
}
