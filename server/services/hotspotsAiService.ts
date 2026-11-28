// Phase 3 step 4 · Claude drafts SEO hotspots (Sam Day 5): title, meta description, H1, URL, plus an opening and a
// closing line, for the pages Angel picks. Saved as "Ready to review" (seo_autofill kind 'hotspots', one open row per
// client holding one draft per page). Nothing changes on a page until Angel saves its hotspots (that approves the
// draft) or skips it. Every call is logged (task "hotspots").
//
// What Claude gets: the business name, site, city + state, structure, service / area names, the client's Hotspots
// template (patterns + rules; the built-in one when none is applied), and per page: code, name, type, keep / improve /
// new, current URL, primary / secondary / FAQ keywords with volumes exactly as exported. Never the private address or
// account details. Rules: no invented facts (unknown trust signals stay [in brackets]), keep sensible existing URLs.
import { z } from 'zod'
import { AI_MODELS, AI_TASKS, costUsd } from '../../src/lib/aiModels.js'
import type { HotspotDraft, HotspotsEstimate, SitePage, TemplateItem } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { callStructured, countInputTokens } from './aiService.js'
import { clientDetail, clientRow } from './clientService.js'
import { openHotspotsRow, pagesState, pathOf } from './pagesService.js'

/** A problem the person can fix (400). */
export class HotspotsInputError extends Error {}

const TASK = 'hotspots' as const
const KIND = 'hotspots' as const
const STEP = 4 // Day 5 (guide steps start at 0 = Day 1)
const MAX_PAGES = 12

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

const SYSTEM = `You draft SEO "hotspots" for pages of a small local business website, for an agency team that edits them before anything is published.

For each page you get, write: SEO title, meta description, H1, URL, one opening line and one closing line for the page copy, and short notes about anything missing.

Rules:
- SEO title: 50 to 60 characters. The page's primary keyword phrase near the start (natural wording is fine). Use the FULL state name in titles (e.g. "Arkansas", never "AR"). Lead with a trust signal instead of the brand name when you have one; you don't know the business's trust signals (years, reviews, awards), so write "[Trust signal]" in brackets where it would go.
- Meta description: 150 to 160 characters, plain and specific, ending with a call to action (for example "Book a call today!").
- H1: human-readable, includes the primary phrase, not identical to the title.
- URL: for a page that is live and marked keep, return its current URL unchanged. For improve, keep the current URL unless it clearly doesn't match the page's keyword; say so in notes if you change it. For new pages: a short lowercase hyphenated slug ending with "/", using the STATE ABBREVIATION (e.g. "-ar"), following the site structure (service first: /service/ hubs and /service/city-st/ children; location first: /city-st/ hubs; flat: /service-city-st/).
- Opening line: one sentence that says what the page offers and where. Closing line: one sentence with a next step.
- Use only the facts given. Never invent services, prices, guarantees, reviews, years, awards, results or locations. Anything unknown goes in [brackets]. Volumes are given only so you know which phrases matter: never quote them.
- Return one item for every page id you were given, using exactly those ids.`

const Out = z.object({
  pages: z.array(
    z.object({
      pageId: z.string(),
      seoTitle: z.string(),
      metaDescription: z.string(),
      h1: z.string(),
      url: z.string(),
      opening: z.string(),
      closing: z.string(),
      notes: z.string().describe('Gaps or unknown facts for this page; empty if none'),
    }),
  ),
})

async function client(siteId: string) {
  const c = await clientRow(siteId)
  if (!c) throw new HotspotsInputError('That client doesn’t exist.')
  return c
}

/** The client's applied Hotspots template (its copy), or the built-in general one. */
async function template(clientId: string): Promise<{ name: string; items: TemplateItem[] }> {
  const applied = must(await db().from('seo_client_templates').select('name, snapshot').eq('client_id', clientId).eq('kind', 'hotspots').order('applied_at', { ascending: false }).limit(1), 'Loading the template') as { name: string; snapshot: { items?: TemplateItem[] } }[]
  if (applied[0]?.snapshot?.items?.length) return { name: applied[0].name, items: applied[0].snapshot.items }
  const built = must(await db().from('seo_templates').select('name, industry, seo_template_items(sort, kind, word_group, body)').eq('kind', 'hotspots').eq('built_in', true).is('industry', null).limit(1), 'Loading the template') as { name: string; seo_template_items: { sort: number; kind: TemplateItem['kind']; word_group: TemplateItem['wordGroup']; body: string }[] }[]
  const t = built[0]
  return t ? { name: t.name, items: [...t.seo_template_items].sort((a, b) => a.sort - b.sort).map((i) => ({ kind: i.kind, wordGroup: i.word_group, body: i.body })) } : { name: 'none', items: [] }
}

const vol = (k: SitePage['keywords'][number]) => [k.kpVolume ? `KP ${k.kpVolume}` : null, k.semrushVolume !== null ? `Semrush ${k.semrushVolume}` : null].filter(Boolean).join(', ') || 'no volume'

async function prompt(siteId: string, pageIds: string[]) {
  const c = await client(siteId)
  const [d, st, tpl] = await Promise.all([clientDetail(c), pagesState(siteId), template(c.id)])
  if (new Set(pageIds).size > MAX_PAGES) throw new HotspotsInputError(`Up to ${MAX_PAGES} pages at a time.`)
  const pages = st.pages.filter((p) => pageIds.includes(p.id))
  if (!pages.length) throw new HotspotsInputError('Pick at least one page.')
  if (pages.length > MAX_PAGES) throw new HotspotsInputError(`Up to ${MAX_PAGES} pages at a time.`)
  const abbr = (c.state ?? '').trim().toUpperCase()
  const lines: string[] = []
  lines.push(`Business: ${d.name}`, `Website: ${st.siteUrl}`, `Main city: ${d.city || '[unknown]'}${abbr ? `, state ${STATES[abbr] ?? abbr} (abbreviation ${abbr})` : ''}`)
  lines.push(`Site structure: ${st.structure.replace('_', ' ')}`)
  const services = d.categories.filter((k) => k.name.trim()).map((k) => `${k.code} ${k.name}${k.services.length ? ` (${k.services.map((s) => s.name).join(', ')})` : ''}`)
  if (services.length) lines.push(`Services: ${services.join('; ')}`)
  const areas = d.areas.filter((a) => a.status === 'active' && a.name).map((a) => a.name)
  if (areas.length) lines.push(`Areas served: ${areas.join(', ')}`)
  if (tpl.items.length) lines.push('', `Hotspots template "${tpl.name}":`, ...tpl.items.map((i) => `- ${i.kind}: ${i.body}`))
  lines.push('', 'Pages:')
  for (const p of pages) {
    const parent = p.parentId ? st.pages.find((x) => x.id === p.parentId) : null
    const prim = p.keywords.filter((k) => k.role === 'primary')
    const sec = p.keywords.filter((k) => k.role === 'secondary').slice(0, 15)
    const faq = [...p.keywords.filter((k) => k.role === 'faq').map((k) => k.keyword), ...p.ideas].slice(0, 8)
    lines.push(
      '',
      `Page id: ${p.id}`,
      `- ${p.code ?? ''} ${p.name} · ${p.type ?? 'type not set'} page · ${p.action ?? 'keep / improve / new not set'} · ${p.status}${parent ? ` · under ${parent.code ?? ''} ${parent.name}` : ''}`,
      `- Current URL: ${p.url ? pathOf(p.url) : 'none (not live yet)'}`,
      `- Primary keyword: ${prim.length ? prim.map((k) => `${k.keyword} (${vol(k)})`).join('; ') : 'none yet'}`,
      `- Secondary keywords: ${sec.length ? sec.map((k) => `${k.keyword} (${vol(k)})`).join('; ') : 'none'}`,
      `- FAQ ideas: ${faq.length ? faq.join('; ') : 'none'}`,
    )
    if (p.seoTitle || p.metaDescription || p.h1) lines.push(`- Current hotspots: title "${p.seoTitle ?? ''}", meta "${p.metaDescription ?? ''}", H1 "${p.h1 ?? ''}"`)
  }
  return { c, pages, user: lines.join('\n') }
}

const ids = (raw: unknown) => (Array.isArray((raw as { pageIds?: unknown })?.pageIds) ? ((raw as { pageIds: unknown[] }).pageIds.filter((x) => typeof x === 'string') as string[]) : [])

/** Before the call: tokens in (free count) + a generous output guess for the picked pages. */
export async function estimateHotspots(siteId: string, raw: unknown): Promise<HotspotsEstimate> {
  const { pages, user } = await prompt(siteId, ids(raw))
  const t = AI_TASKS[TASK]
  const inputTokens = (await countInputTokens(t.model, SYSTEM, user)) + 300
  const outputTokens = t.outBase + t.outPerItem * pages.length
  return { model: AI_MODELS[t.model].label, pages: pages.length, inputTokens, outputTokens, costUsd: costUsd(t.model, inputTokens, outputTokens) }
}

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/** One Claude call → drafts saved as "Ready to review" (drafts for other pages that are still open are kept). */
export async function draftHotspots(siteId: string, raw: unknown): Promise<{ drafts: HotspotDraft[] }> {
  const { c, pages, user } = await prompt(siteId, ids(raw))
  const t = AI_TASKS[TASK]
  const { data, logId } = await callStructured({ task: TASK, clientId: c.id, model: t.model, system: SYSTEM, user, schema: Out, maxTokens: 4000 + 700 * pages.length, effort: 'medium' })
  const sent = new Set(pages.map((p) => p.id))
  const fresh: HotspotDraft[] = []
  for (const x of data.pages) {
    if (!sent.has(x.pageId) || fresh.some((f) => f.pageId === x.pageId)) continue // only the pages we sent, once each
    fresh.push({ pageId: x.pageId, seoTitle: clip(x.seoTitle, 120), metaDescription: clip(x.metaDescription, 320), h1: clip(x.h1, 160), url: clip(x.url, 300), opening: clip(x.opening, 400), closing: clip(x.closing, 400), notes: clip(x.notes, 400) })
  }
  if (!fresh.length) throw new HotspotsInputError('Claude returned no usable drafts. Nothing was saved; try again.')
  const open = await openHotspotsRow(c.id)
  const kept = (open?.payload.drafts ?? []).filter((d) => !fresh.some((f) => f.pageId === d.pageId))
  const drafts = [...kept, ...fresh]
  if (open) must(await db().from('seo_autofill').update({ status: 'superseded' }).eq('id', open.id).eq('status', 'ready'), 'Saving drafts')
  must(
    await db().from('seo_autofill').insert({ client_id: c.id, step: STEP, kind: KIND, source: 'claude', status: 'ready', summary: `Hotspots for ${drafts.length} page${drafts.length === 1 ? '' : 's'} · Ready to review`, payload: { drafts }, item_count: drafts.length, ai_log_id: logId }),
    'Saving drafts',
  )
  return { drafts }
}
