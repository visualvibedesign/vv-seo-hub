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

/** `home` = a Home-row service (the general term the home page targets): only used when no S1–S3 service matches. */
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
  // 1. exact service name in the keyword (plurals ignored): longest names first, so "full service" beats "service"
  const byLength = [...services].sort((a, b) => b.name.length - a.name.length)
  const exact = byLength.filter((s) => kw.includes(` ${singular(s.name)} `))
  // drop a shorter exact match that sits inside a longer one ("service" inside "full service")
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

/** The keyword contains one of the client's service names exactly (plurals ignored), e.g. "<service> <city>". */
export function hasServiceName(keyword: string, services: { name: string }[]): boolean {
  const kw = ` ${singular(keyword)} `
  return services.some((s) => singular(s.name).trim() !== '' && kw.includes(` ${singular(s.name)} `))
}

/**
 * A category hub URL: ONE short path segment that names no place, e.g. /seo, /web-design/, /branding
 * (full links too). Place words = the client's city, state, areas and neighbourhoods. /web-design-rogers-ar → no.
 */
export function isHubPath(url: string | null | undefined, placeWords: string[]): boolean {
  if (!url?.trim()) return false
  let path: string
  try {
    path = new URL(url.trim(), 'https://example.invalid').pathname
  } catch {
    return false
  }
  const segs = path.split('/').filter(Boolean)
  if (segs.length !== 1) return false
  let seg = segs[0]
  try {
    seg = decodeURIComponent(seg)
  } catch {
    /* keep it as is */
  }
  const words = seg.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (!words.length || words.length > 4 || seg.length > 40) return false
  const text = ` ${words.join(' ')} `
  return !placeWords.some((w) => {
    const t = w.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ')
    return t !== '' && text.includes(` ${t} `)
  })
}

export type KeywordLite = { id: string; keyword: string; role: KeywordRole | null; serviceId: string | null; status: string }

// ---- Brand (the client's own name) ----------------------------------------------------------------------
// Brand words from Edit client. None typed → the full business name and the site's domain name are used
// ("Acme Plumbing & Heat" → "acme plumbing heat"; "https://www.acmeplumbing.com/" → "acmeplumbing").
// Keywords naming the client are never sent to the triage (they'd look like a competitor brand).

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Domain name without www / the ending: "https://www.acme-plumbing.co.uk/x" → "acme-plumbing". */
export function domainName(siteUrl: string): string {
  const host = siteUrl.toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '')
  const parts = host.split('.')
  if (parts.length <= 1) return host
  // keep the label before the ending (handles two-part endings like co.uk / com.au)
  const twoPart = parts.length >= 3 && parts[parts.length - 2].length <= 3
  return parts[parts.length - (twoPart ? 3 : 2)]
}

/** Does the keyword name the client? Typed words: whole words. Fallback: name / domain, spaces ignored. */
export function isOwnBrand(keyword: string, b: { brandWords: string[]; name: string; siteUrl: string }): boolean {
  if (b.brandWords.length) return b.brandWords.some((w) => has(keyword, w))
  const kw = compact(keyword)
  return [compact(b.name), compact(domainName(b.siteUrl))].some((x) => x.length >= 4 && kw.includes(x))
}

// ---- Scope (step 6c-2, Angel Nov 25) ------------------------------------------------------------------
// Per client (Edit client): out-of-scope words (services they don't offer, e.g. "male", "chest") and
// neighbourhood words (places inside their area, e.g. "great kills"). A keyword with one of them gets NO
// role / service / intent suggestion. Instead: out of scope → suggest Rejected; neighbourhood → suggest Later
// (unless that neighbourhood is one of the client's active areas). Angel confirms each one.

export type ScopeWords = { outOfScope: string[]; neighbourhoods: string[]; activeAreas: string[] }
export type ScopeStatus = 'rejected' | 'later'
export type ScopeHit = { category: 'out of scope' | 'neighbourhood'; word: string; status: ScopeStatus }

/** Out of scope wins over neighbourhood. Whole words only ("pro" matches "pro's pick", not "product"). */
export function scopeHit(keyword: string, s: ScopeWords): ScopeHit | null {
  const out = [...s.outOfScope].sort((a, b) => b.length - a.length).find((w) => has(keyword, w))
  if (out) return { category: 'out of scope', word: out, status: 'rejected' }
  const hood = [...s.neighbourhoods]
    .sort((a, b) => b.length - a.length)
    .find((w) => has(keyword, w) && !s.activeAreas.some((a) => has(a, w) || has(w, a)))
  if (hood) return { category: 'neighbourhood', word: hood, status: 'later' }
  return null
}

/** Keywords still "keep" that hit a scope word: one suggestion each (Rejected or Later), with the word. */
export function suggestScope(keywords: KeywordLite[], s: ScopeWords): { items: (SuggestItem<ScopeStatus> & { category: string })[]; unmatched: RulesPayload<ScopeStatus>['unmatched'] } {
  const items: (SuggestItem<ScopeStatus> & { category: string })[] = []
  for (const k of keywords) {
    if (k.status !== 'keep') continue
    const hit = scopeHit(k.keyword, s)
    if (hit) items.push({ keywordId: k.id, keyword: k.keyword, category: hit.category, options: [{ value: hit.status, rule: `${hit.category} word “${hit.word}”` }], decision: null })
  }
  return { items, unmatched: [] }
}

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
