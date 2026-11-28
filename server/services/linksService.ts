// Phase 4c · Links (Sam Days 8–9, docs/phase-4-plan.md, migration 0024). Works for ANY client.
// - Citations (Day 8): a BrightLocal list pasted (or typed) in list order → row # → wave by row (1,4,7… / 2,5,8… /
//   3,6,9…, plain code), YP network (aggregator) row per wave, who does it, DA as exported, Planned / Submitted / Live.
// - Backlink Gap (Day 9): Semrush rows pasted with their header (domain, Authority Score, matches, competitor
//   columns → C1–C4 in order); numbers exactly as exported. Flags domains already on the waves or the list.
// - Opportunities: exact page, found via, why / how / cost, next action + date, This week / Sent / Approved / Live as
//   separate ticks (Live needs the date the link was clicked and checked). A domain on the citation waves is refused.
// - Premier links, sponsorships, SERP searches, authority checks: typed in.
// Never an address: anything that looks like a street address is refused (no address field anywhere).
import type { AuthorityCheck, Citation, CitationOwner, CitationStatus, FoundVia, GapRow, LinkOpportunity, LinkSettings, LinksState, OpportunityHow, PastePlan, PremierKind, SerpSearch, Sponsorship } from '../../src/types/seo.js'
import { looksLikeAddress } from '../../src/lib/importRules.js'
import { cells, rootDomain, waveOf } from '../../src/lib/links.js'
import { db, must } from '../clients/supabase.js'
import { latestToday } from '../utils/dates.js'
import { clientRow } from './clientService.js'

export class LinksInputError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i
type Client = NonNullable<Awaited<ReturnType<typeof clientRow>>>

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new LinksInputError('That client doesn’t exist.')
  return c
}

function text(v: unknown, what: string, max: number): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new LinksInputError(`${what}: text only.`)
  const t = v.trim().replace(/\s+/g, ' ')
  if (!t) return null
  if (t.length > max) throw new LinksInputError(`${what}: ${max} characters at most (now ${t.length}).`)
  if (t.split(/[,;|·]/).some((p) => looksLikeAddress(p))) throw new LinksInputError(`${what}: that looks like a street address. The client’s address is never stored here.`)
  return t
}
function day(v: unknown, what: string, future = false): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new LinksInputError(`${what}: pick a date.`)
  if (!future && v > latestToday()) throw new LinksInputError(`${what} can’t be in the future.`)
  return v
}
function whole(v: unknown, what: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new LinksInputError(`${what}: a whole number from ${min} to ${max}, or leave it empty.`)
  return n
}
function pick<T extends string>(v: unknown, list: readonly T[], what: string, fallback?: T): T {
  if ((v === undefined || v === null || v === '') && fallback) return fallback
  if (!list.includes(v as T)) throw new LinksInputError(`${what}: pick from the list.`)
  return v as T
}
const bool = (v: unknown) => v === true
const triState = (v: unknown) => (v === true ? true : v === false ? false : null)
function url(v: unknown, what: string): string | null {
  const t = text(v, what, 500)
  if (t && !rootDomain(t)) throw new LinksInputError(`${what}: a web address (like example.com/page).`)
  return t
}

// ---- Read -------------------------------------------------------------------------------------------------------

type R = Record<string, unknown>
const toCitation = (r: R): Citation => ({ id: r.id as string, rowNo: r.row_no as number | null, wave: r.wave as 1 | 2 | 3, name: r.name as string, domain: r.domain as string | null, domainAuthority: r.domain_authority as number | null, verification: r.verification as string | null, owner: r.owner as CitationOwner, status: r.status as CitationStatus, liveUrl: r.live_url as string | null, note: r.note as string | null })
const toOpp = (r: R): LinkOpportunity => ({
  id: r.id as string, rowNo: r.row_no as number, pageUrl: r.page_url as string | null, domain: r.domain as string, foundVia: (r.found_via as FoundVia[]) ?? [], authorityScore: r.authority_score as number | null,
  competitorMatches: r.competitor_matches as number | null, why: r.why as string | null, how: r.how as OpportunityHow | null, cost: r.cost as string | null, nextAction: r.next_action as string | null,
  nextActionOn: r.next_action_on as string | null, thisWeek: !!r.this_week, sent: !!r.sent, approved: !!r.approved, live: !!r.live, liveCheckedOn: r.live_checked_on as string | null, note: r.note as string | null,
})

export async function linksState(siteId: string): Promise<LinksState> {
  const c = await client(siteId)
  const q = (t: string) => db().from(t).select('*').eq('client_id', c.id)
  const [setR, citR, gapR, oppR, preR, spoR, serR, autR, compR] = await Promise.all([
    db().from('seo_link_settings').select('*').eq('client_id', c.id).maybeSingle(),
    q('seo_citations'), q('seo_backlink_gap'), q('seo_link_opportunities').order('row_no'), q('seo_premier_links').order('sort'), q('seo_sponsorships').order('created_at'),
    q('seo_serp_searches').order('created_at'), q('seo_authority_checks').order('checked_on'),
    db().from('seo_competitors').select('code, name').eq('client_id', c.id).order('code'),
  ])
  const st = must(setR, 'Loading link settings') as R | null
  const settings: LinkSettings = { weeklyPace: (st?.weekly_pace as number) ?? null, citationStartWeek: (st?.citation_start_week as number) ?? 6, waveStarted: [(st?.wave1_started_on as string) ?? null, (st?.wave2_started_on as string) ?? null, (st?.wave3_started_on as string) ?? null], sponsorBudget: (st?.sponsor_budget as string) ?? null }
  const citations = (must(citR, 'Loading citations') as R[]).map(toCitation).sort((a, b) => a.wave - b.wave || (a.rowNo ?? 0) - (b.rowNo ?? 0))
  const opportunities = (must(oppR, 'Loading opportunities') as R[]).map(toOpp)
  const waveOfDomain = new Map(citations.filter((x) => x.domain && x.rowNo !== null).map((x) => [x.domain!, x.wave]))
  const listOfDomain = new Map(opportunities.map((o) => [o.domain, o.rowNo]))
  const gap: GapRow[] = (must(gapR, 'Loading Backlink Gap') as R[])
    .map((r) => ({ id: r.id as string, domain: r.domain as string, authorityScore: r.authority_score as number | null, matches: r.matches as number | null, matchesOf: r.matches_of as number | null, competitors: (r.competitors as string[]) ?? [], skipped: !!r.skipped, onWave: waveOfDomain.get(r.domain as string) ?? null, onList: listOfDomain.get(r.domain as string) ?? null }))
    .sort((a, b) => (b.matches ?? -1) - (a.matches ?? -1) || (b.authorityScore ?? -1) - (a.authorityScore ?? -1) || a.domain.localeCompare(b.domain))
  const weekAgo = new Date(Date.parse(`${latestToday()}T12:00:00Z`) - 8 * 86_400_000).toISOString().slice(0, 10)
  return {
    clientName: c.name,
    city: c.city,
    settings,
    citations,
    competitors: must(compR, 'Loading competitors') as { code: string; name: string }[],
    gap,
    opportunities,
    premier: (must(preR, 'Loading premier links') as R[]).map((r) => ({ id: r.id as string, kind: r.kind as PremierKind, name: r.name as string, pageOrRoute: r.page_or_route as string | null, nextAction: r.next_action as string | null, nextActionOn: r.next_action_on as string | null })),
    sponsorships: (must(spoR, 'Loading sponsorships') as R[]).map((r) => ({ id: r.id as string, cause: r.cause as string, tierCost: r.tier_cost as string | null, why: r.why as string | null, pagePublic: r.page_public as boolean | null, onMainSite: r.on_main_site as boolean | null, staysUp: r.stays_up as string | null, shows: (r.shows as Sponsorship['shows']) ?? [], status: r.status as Sponsorship['status'] })),
    serp: (must(serR, 'Loading SERP searches') as R[]).map((r) => ({ id: r.id as string, search: r.search as string, style: r.style as SerpSearch['style'], runOn: r.run_on as string | null, found: r.found as string | null })),
    authority: (must(autR, 'Loading authority checks') as R[]).map((r) => ({ id: r.id as string, checkedOn: r.checked_on as string, monthMark: r.month_mark as AuthorityCheck['monthMark'], authorityScore: r.authority_score as number | null, referringDomains: r.referring_domains as number | null, backlinks: r.backlinks as number | null, note: r.note as string | null })),
    liveThisWeek: opportunities.filter((o) => o.live && o.liveCheckedOn && o.liveCheckedOn > weekAgo).length,
  }
}

// ---- Citations --------------------------------------------------------------------------------------------------

type CitationRowIn = { rowNo: number; wave: 1 | 2 | 3; name: string; domain: string | null; domainAuthority: number | null; verification: string | null }
const VERIFY = /\b(phone|call|sms|text|email|e-mail|postcard|mail|video|none|no verification)\b/i

/** Pasted BrightLocal list → rows numbered after the last one (dry run shows the plan; apply saves it). */
export async function pasteCitations(siteId: string, raw: unknown): Promise<PastePlan<CitationRowIn> & { state?: LinksState }> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { text?: unknown; apply?: unknown }
  if (typeof b.text !== 'string' || !b.text.trim()) throw new LinksInputError('Paste the citation list (one directory per line).')
  const lines = b.text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 300) throw new LinksInputError('300 lines at most in one paste.')
  const existing = must(await db().from('seo_citations').select('row_no, domain, name').eq('client_id', c.id), 'Loading citations') as { row_no: number | null; domain: string | null; name: string }[]
  const seen = new Map(existing.filter((e) => e.domain && e.row_no !== null).map((e) => [e.domain!, e.row_no!]))
  let next = Math.max(0, ...existing.map((e) => e.row_no ?? 0)) + 1
  const rows: CitationRowIn[] = []
  const skipped: PastePlan<CitationRowIn>['skipped'] = []
  for (const [i, line] of lines.entries()) {
    const cs = cells(line).filter(Boolean)
    if (i === 0 && cs.some((x) => /^(name|directory|site|domain|da|domain authority|verification)$/i.test(x))) continue // header
    let domain: string | null = null
    let verification: string | null = null
    const nums: number[] = []
    const rest: string[] = []
    for (const x of cs) {
      if (!domain && !/\s/.test(x) && rootDomain(x)) domain = rootDomain(x)
      else if (/^\d{1,3}\.?$/.test(x) && Number(x.replace('.', '')) <= 500) nums.push(Number(x.replace('.', '')))
      else if (!verification && VERIFY.test(x) && x.length <= 120) verification = x
      else rest.push(x)
    }
    // One number = the DA; two = the export's own row # first, then the DA. DA kept exactly as shown (0–100).
    const daRaw = nums.length >= 2 ? nums[1] : nums[0]
    const da = daRaw !== undefined && daRaw <= 100 ? daRaw : null
    const realName = (rest[0] ?? domain ?? '').slice(0, 120)
    if (!realName) skipped.push({ line, why: 'No name or domain' })
    else if (cs.some((x) => looksLikeAddress(x))) skipped.push({ line, why: 'Looks like an address' })
    else if (domain && seen.has(domain)) skipped.push({ line, why: `Already on the list (row ${seen.get(domain)})` })
    else {
      const rowNo = next++
      if (domain) seen.set(domain, rowNo)
      rows.push({ rowNo, wave: waveOf(rowNo), name: realName, domain, domainAuthority: da, verification })
    }
  }
  if (b.apply !== true) return { rows, skipped }
  if (!rows.length) throw new LinksInputError('Nothing to add: every line was skipped.')
  if (next - 1 > 500) throw new LinksInputError('500 rows at most on the citation list.')
  must(await db().from('seo_citations').insert(rows.map((r) => ({ client_id: c.id, row_no: r.rowNo, wave: r.wave, name: r.name, domain: r.domain, domain_authority: r.domainAuthority, verification: r.verification }))), 'Saving citations')
  return { rows, skipped, state: await linksState(siteId) }
}

/** The YP network (aggregator, ~$30, always) once in each wave, if missing. */
export async function addAggregators(siteId: string): Promise<LinksState> {
  const c = await client(siteId)
  const have = must(await db().from('seo_citations').select('wave, name').eq('client_id', c.id).is('row_no', null), 'Loading citations') as { wave: number; name: string }[]
  const add = ([1, 2, 3] as const).filter((w) => !have.some((h) => h.wave === w && /yp/i.test(h.name))).map((w) => ({ client_id: c.id, row_no: null, wave: w, name: 'YP network', domain: 'yp.com', owner: 'brightlocal' }))
  if (add.length) must(await db().from('seo_citations').insert(add), 'Adding the YP network')
  return linksState(siteId)
}

export async function saveCitation(siteId: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as R
  const id = b.id ? String(b.id) : null
  if (id && !UUID.test(id)) throw new LinksInputError('Pick a citation to edit.')
  const rowNo = whole(b.rowNo, 'Row #', 1, 500)
  const wave = rowNo !== null ? waveOf(rowNo) : (whole(b.wave, 'Wave', 1, 3) as 1 | 2 | 3 | null)
  if (!wave) throw new LinksInputError('An aggregator row needs a wave (1, 2 or 3).')
  const name = text(b.name, 'Directory', 120)
  if (!name) throw new LinksInputError('Type the directory name.')
  const domain = b.domain ? rootDomain(String(b.domain)) : null
  if (b.domain && !domain) throw new LinksInputError('Domain: like example.com.')
  const status = pick(b.status, ['planned', 'submitted', 'live'] as const, 'Status', 'planned')
  const row = { row_no: rowNo, wave, name, domain, domain_authority: whole(b.domainAuthority, 'Domain Authority', 0, 100), verification: text(b.verification, 'Verification', 120), owner: pick(b.owner, ['brightlocal', 'me'] as const, 'Who', 'brightlocal'), status, live_url: url(b.liveUrl, 'Live link'), note: text(b.note, 'Note', 300) }
  const others = (must(await db().from('seo_citations').select('id, row_no, domain').eq('client_id', c.id), 'Loading citations') as { id: string; row_no: number | null; domain: string | null }[]).filter((o) => o.id !== id)
  if (rowNo !== null && others.some((o) => o.row_no === rowNo)) throw new LinksInputError(`Row ${rowNo} is already used.`)
  if (rowNo !== null && domain && others.some((o) => o.row_no !== null && o.domain === domain)) throw new LinksInputError(`${domain} is already on the list.`)
  if (id) {
    const r = must(await db().from('seo_citations').update(row).eq('client_id', c.id).eq('id', id).select('id'), 'Saving the citation') as unknown[]
    if (!r.length) throw new LinksInputError('That citation is gone. Reload the page.')
  } else must(await db().from('seo_citations').insert({ ...row, client_id: c.id }), 'Adding the citation')
  return linksState(siteId)
}

// ---- Backlink Gap -----------------------------------------------------------------------------------------------

type GapIn = { domain: string; authorityScore: number | null; matches: number | null; matchesOf: number | null; competitors: string[] }

/**
 * Pasted Semrush Backlink Gap rows WITH the header line. Columns found by name: Domain, Authority Score, Matches;
 * columns whose header is a domain = the domains compared (the client's own is left out; the others are C1–C4 in
 * order, a competitor "has" the source when its cell is a number above 0). Existing domains are updated.
 */
export async function pasteGap(siteId: string, raw: unknown): Promise<PastePlan<GapIn> & { state?: LinksState }> {
  const c = await client(siteId)
  const b = (raw ?? {}) as { text?: unknown; apply?: unknown }
  if (typeof b.text !== 'string' || !b.text.trim()) throw new LinksInputError('Paste the Backlink Gap rows with their header line.')
  const lines = b.text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length > 2001) throw new LinksInputError('2000 rows at most in one paste.')
  const head = cells(lines[0]).map((h) => h.toLowerCase())
  const col = (re: RegExp) => head.findIndex((h) => re.test(h))
  const iDomain = col(/domain|referring/)
  const iAs = col(/authority|^as$/)
  const iMatch = col(/match/)
  if (iDomain < 0) throw new LinksInputError('The first line must be the header (with a “Domain” column). Copy the header row too.')
  const own = rootDomain(c.site_url)
  const domCols = head.map((h, i) => ({ i, d: rootDomain(h) })).filter((x) => x.d && x.i !== iDomain)
  const compCols = domCols.filter((x) => x.d !== own).slice(0, 4).map((x, k) => ({ i: x.i, code: `C${k + 1}` }))
  const matchesOf = domCols.length ? Math.min(5, domCols.length) : null
  const num = (v: string | undefined) => {
    const m = (v ?? '').replace(/,/g, '').match(/^\s*(\d+)/)
    return m ? Number(m[1]) : null
  }
  const rows: GapIn[] = []
  const skipped: PastePlan<GapIn>['skipped'] = []
  const seen = new Set<string>()
  for (const line of lines.slice(1)) {
    const cs = cells(line)
    const domain = rootDomain(cs[iDomain])
    if (!domain) { skipped.push({ line: line.slice(0, 120), why: 'No domain' }); continue }
    if (seen.has(domain)) { skipped.push({ line: line.slice(0, 120), why: 'Same domain twice' }); continue }
    seen.add(domain)
    const as = iAs >= 0 ? num(cs[iAs]) : null
    const matches = iMatch >= 0 ? num(cs[iMatch]) : null
    rows.push({ domain, authorityScore: as !== null && as <= 100 ? as : null, matches: matches !== null && matches <= 5 ? matches : null, matchesOf, competitors: compCols.filter((x) => (num(cs[x.i]) ?? 0) > 0).map((x) => x.code) })
  }
  if (b.apply !== true) return { rows, skipped }
  if (!rows.length) throw new LinksInputError('Nothing to add: every line was skipped.')
  const existing = must(await db().from('seo_backlink_gap').select('id, domain').eq('client_id', c.id), 'Loading Backlink Gap') as { id: string; domain: string }[]
  const byDomain = new Map(existing.map((e) => [e.domain, e.id]))
  const fresh = rows.filter((r) => !byDomain.has(r.domain))
  const toRow = (r: GapIn) => ({ domain: r.domain, authority_score: r.authorityScore, matches: r.matches, matches_of: r.matchesOf, competitors: r.competitors })
  for (let i = 0; i < fresh.length; i += 500) must(await db().from('seo_backlink_gap').insert(fresh.slice(i, i + 500).map((r) => ({ ...toRow(r), client_id: c.id }))), 'Saving Backlink Gap')
  for (const r of rows.filter((x) => byDomain.has(x.domain))) must(await db().from('seo_backlink_gap').update(toRow(r)).eq('id', byDomain.get(r.domain)!), 'Saving Backlink Gap')
  return { rows, skipped, state: await linksState(siteId) }
}

// ---- Opportunities ----------------------------------------------------------------------------------------------

const VIA: FoundVia[] = ['R', 'S', 'C', 'Cit', 'Sp']

async function citationWave(clientId: string, domain: string): Promise<number | null> {
  const r = must(await db().from('seo_citations').select('wave').eq('client_id', clientId).eq('domain', domain).not('row_no', 'is', null).limit(1), 'Checking the citation waves') as { wave: number }[]
  return r[0]?.wave ?? null
}

export async function saveOpportunity(siteId: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as R
  const id = b.id ? String(b.id) : null
  if (id && !UUID.test(id)) throw new LinksInputError('Pick a row to edit.')
  const pageUrl = url(b.pageUrl, 'Exact page')
  const domain = rootDomain(String(b.domain ?? '')) ?? rootDomain(pageUrl)
  if (!domain) throw new LinksInputError('Type the exact page (or at least the domain).')
  const via = Array.isArray(b.foundVia) ? [...new Set(b.foundVia)] : []
  if (via.some((v) => !VIA.includes(v as FoundVia))) throw new LinksInputError('Found via: R, S, C, Cit or Sp.')
  const live = bool(b.live)
  const liveCheckedOn = day(b.liveCheckedOn, 'Live checked on')
  if (live && !liveCheckedOn) throw new LinksInputError('Tick Live only after clicking the link and checking where it goes: add the date you checked it.')
  const others = must(await db().from('seo_link_opportunities').select('id, row_no, domain, page_url').eq('client_id', c.id), 'Loading opportunities') as { id: string; row_no: number; domain: string; page_url: string | null }[]
  const rest = others.filter((o) => o.id !== id)
  if (id && rest.length === others.length) throw new LinksInputError('That row is gone. Reload the page.')
  const prev = id ? others.find((o) => o.id === id) : null
  if (!prev || prev.domain !== domain) {
    const w = await citationWave(c.id, domain)
    if (w) throw new LinksInputError(`${domain} is already on citation wave ${w}. It isn’t added twice (Sam, Day 9).`)
  }
  if (pageUrl && rest.some((o) => o.page_url && o.page_url.toLowerCase() === pageUrl.toLowerCase())) throw new LinksInputError('That exact page is already on the list.')
  const rowNo = whole(b.rowNo, 'Row #', 1, 999) ?? (id ? others.find((o) => o.id === id)!.row_no : Math.max(0, ...others.map((o) => o.row_no)) + 1)
  if (rest.some((o) => o.row_no === rowNo)) throw new LinksInputError(`Row ${rowNo} is already used.`)
  const row = {
    row_no: rowNo, page_url: pageUrl, domain, found_via: via, authority_score: whole(b.authorityScore, 'Authority Score', 0, 100), competitor_matches: whole(b.competitorMatches, 'Competitor matches', 0, 5),
    why: text(b.why, 'Why it fits', 300), how: b.how ? pick(b.how, ['claim', 'apply', 'contact', 'join', 'other'] as const, 'How') : null, cost: text(b.cost, 'Cost', 60),
    next_action: text(b.nextAction, 'Next action', 200), next_action_on: day(b.nextActionOn, 'Next action date', true), this_week: bool(b.thisWeek), sent: bool(b.sent), approved: bool(b.approved), live, live_checked_on: liveCheckedOn, note: text(b.note, 'Note', 300),
  }
  if (id) must(await db().from('seo_link_opportunities').update(row).eq('client_id', c.id).eq('id', id), 'Saving the opportunity')
  else must(await db().from('seo_link_opportunities').insert({ ...row, client_id: c.id }), 'Adding the opportunity')
  return linksState(siteId)
}

/** Backlink Gap row → a new opportunity (found via C, AS + matches as exported). Refused if on the waves / list. */
export async function gapToOpportunity(siteId: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const id = String(((raw ?? {}) as R).id ?? '')
  if (!UUID.test(id)) throw new LinksInputError('Pick a Backlink Gap row.')
  const g = must(await db().from('seo_backlink_gap').select('*').eq('client_id', c.id).eq('id', id).maybeSingle(), 'Loading Backlink Gap') as R | null
  if (!g) throw new LinksInputError('That row is gone. Reload the page.')
  const on = must(await db().from('seo_link_opportunities').select('row_no').eq('client_id', c.id).eq('domain', g.domain as string).limit(1), 'Checking the list') as { row_no: number }[]
  if (on.length) throw new LinksInputError(`${g.domain} is already on the opportunity list (row ${on[0].row_no}).`)
  const m = g.matches as number | null
  return saveOpportunity(siteId, { domain: g.domain, foundVia: ['C'], authorityScore: g.authority_score, competitorMatches: m === null ? null : Math.min(5, m), why: m !== null && g.matches_of ? `Backlink Gap: ${m} of ${g.matches_of} match` : 'Backlink Gap' })
}

// ---- Settings + the small typed lists ------------------------------------------------------------------------

export async function saveSettings(siteId: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as R
  const ws = Array.isArray(b.waveStarted) ? b.waveStarted : []
  must(
    await db().from('seo_link_settings').upsert({ client_id: c.id, weekly_pace: whole(b.weeklyPace, 'Weekly pace', 1, 20), citation_start_week: whole(b.citationStartWeek, 'Citation start week', 1, 52) ?? 6, wave1_started_on: day(ws[0], 'Wave 1 started'), wave2_started_on: day(ws[1], 'Wave 2 started'), wave3_started_on: day(ws[2], 'Wave 3 started'), sponsor_budget: text(b.sponsorBudget, 'Sponsorship budget', 40) }, { onConflict: 'client_id' }),
    'Saving link settings',
  )
  return linksState(siteId)
}

const KINDS: PremierKind[] = ['chamber', 'trade_group', 'certification', 'referral_partner', 'vendor', 'organization', 'editorial']
const SHOWS = ['name', 'logo', 'profile', 'link'] as const

/** Row builders for the typed lists (each validated; no address anywhere). */
const BUILD: Record<string, { table: string; label: string; row: (b: R, c: Client) => R }> = {
  premier: {
    table: 'seo_premier_links', label: 'premier link',
    row: (b) => {
      const name = text(b.name, 'Name', 120)
      if (!name) throw new LinksInputError('Type the relationship (e.g. the chamber’s name).')
      return { kind: pick(b.kind, KINDS, 'Kind'), name, page_or_route: text(b.pageOrRoute, 'Page or route in', 300), next_action: text(b.nextAction, 'Next action', 200), next_action_on: day(b.nextActionOn, 'Next action date', true) }
    },
  },
  sponsorship: {
    table: 'seo_sponsorships', label: 'sponsorship',
    row: (b) => {
      const cause = text(b.cause, 'Event or cause', 120)
      if (!cause) throw new LinksInputError('Type the event or cause.')
      const shows = Array.isArray(b.shows) ? [...new Set(b.shows)] : []
      if (shows.some((s) => !SHOWS.includes(s as (typeof SHOWS)[number]))) throw new LinksInputError('Shows: name, logo, profile or link.')
      return { cause, tier_cost: text(b.tierCost, 'Tier + cost', 80), why: text(b.why, 'Why', 300), page_public: triState(b.pagePublic), on_main_site: triState(b.onMainSite), stays_up: text(b.staysUp, 'Stays up', 60), shows, status: pick(b.status, ['considering', 'committed', 'done'] as const, 'Status', 'considering') }
    },
  },
  serp: {
    table: 'seo_serp_searches', label: 'search',
    row: (b) => {
      const search = text(b.search, 'Search', 200)
      if (!search) throw new LinksInputError('Type the search you ran.')
      return { search, style: pick(b.style, ['customer', 'lister'] as const, 'Style'), run_on: day(b.runOn, 'Date'), found: text(b.found, 'Found', 300) }
    },
  },
  authority: {
    table: 'seo_authority_checks', label: 'authority check',
    row: (b) => {
      const checked = day(b.checkedOn, 'Checked on')
      if (!checked) throw new LinksInputError('Pick the date you checked it.')
      const mark = b.monthMark === null || b.monthMark === undefined || b.monthMark === '' ? null : Number(b.monthMark)
      if (mark !== null && ![3, 6, 9, 12].includes(mark)) throw new LinksInputError('Month: 3, 6, 9 or 12.')
      const r = { checked_on: checked, month_mark: mark, authority_score: whole(b.authorityScore, 'Authority Score', 0, 100), referring_domains: whole(b.referringDomains, 'Referring domains', 0, 100_000_000), backlinks: whole(b.backlinks, 'Backlinks', 0, 1_000_000_000), note: text(b.note, 'Note', 300) }
      if (r.authority_score === null && r.referring_domains === null && r.backlinks === null) throw new LinksInputError('Type at least one number.')
      return r
    },
  },
  citation: { table: 'seo_citations', label: 'citation', row: () => ({}) },
  opportunity: { table: 'seo_link_opportunities', label: 'opportunity', row: () => ({}) },
  gap: { table: 'seo_backlink_gap', label: 'Backlink Gap row', row: () => ({}) },
}

async function saveSimple(siteId: string, kind: 'premier' | 'sponsorship' | 'serp' | 'authority', raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as R
  const id = b.id ? String(b.id) : null
  if (id && !UUID.test(id)) throw new LinksInputError(`Pick a ${BUILD[kind].label} to edit.`)
  const row = BUILD[kind].row(b, c)
  const res = id ? await db().from(BUILD[kind].table).update(row).eq('client_id', c.id).eq('id', id).select('id') : await db().from(BUILD[kind].table).insert({ ...row, client_id: c.id }).select('id')
  if (res.error && /duplicate key/.test(res.error.message)) throw new LinksInputError(kind === 'authority' ? 'There’s already a check on that date. Edit that one.' : 'That one is already on the list.')
  const out = must(res, `Saving the ${BUILD[kind].label}`) as unknown[]
  if (id && !out.length) throw new LinksInputError(`That ${BUILD[kind].label} is gone. Reload the page.`)
  return linksState(siteId)
}

async function removeRow(siteId: string, kind: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const id = String(((raw ?? {}) as R).id ?? '')
  if (!BUILD[kind]) throw new LinksInputError('Pick what to remove.')
  if (!UUID.test(id)) throw new LinksInputError(`Pick a ${BUILD[kind].label} to remove.`)
  must(await db().from(BUILD[kind].table).delete().eq('client_id', c.id).eq('id', id), `Removing the ${BUILD[kind].label}`)
  return linksState(siteId)
}

async function skipGap(siteId: string, raw: unknown): Promise<LinksState> {
  const c = await client(siteId)
  const b = (raw ?? {}) as R
  if (!UUID.test(String(b.id ?? ''))) throw new LinksInputError('Pick a Backlink Gap row.')
  must(await db().from('seo_backlink_gap').update({ skipped: b.skipped === true }).eq('client_id', c.id).eq('id', String(b.id)), 'Saving Backlink Gap')
  return linksState(siteId)
}

/** One write entry point for the Links screen: { op, ...fields }. */
export async function linksWrite(siteId: string, raw: unknown): Promise<unknown> {
  const op = String(((raw ?? {}) as R).op ?? '')
  switch (op) {
    case 'settings': return saveSettings(siteId, raw)
    case 'citations-paste': return pasteCitations(siteId, raw)
    case 'citations-aggregators': return addAggregators(siteId)
    case 'citation-save': return saveCitation(siteId, raw)
    case 'gap-paste': return pasteGap(siteId, raw)
    case 'gap-skip': return skipGap(siteId, raw)
    case 'gap-to-opportunity': return gapToOpportunity(siteId, raw)
    case 'opportunity-save': return saveOpportunity(siteId, raw)
    case 'premier-save': return saveSimple(siteId, 'premier', raw)
    case 'sponsorship-save': return saveSimple(siteId, 'sponsorship', raw)
    case 'serp-save': return saveSimple(siteId, 'serp', raw)
    case 'authority-save': return saveSimple(siteId, 'authority', raw)
    case 'remove': return removeRow(siteId, String(((raw ?? {}) as R).kind ?? ''), raw)
    default: throw new LinksInputError('Unknown action.')
  }
}
