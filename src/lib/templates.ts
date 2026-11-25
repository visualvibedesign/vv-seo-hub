// Templates (redesign step 5): labels, variables and the fill-in used by the library preview, the editor's
// live preview and Apply. Variables: {service} {city} {st} {state} {brand}. Filled from the client's own
// services, A1 city and state; nothing else is made up. Unknown variables are left as typed.
import type { ClientDetail, TemplateItem, TemplateKind, WordGroup } from '../types/seo'

export const TEMPLATE_KINDS: { kind: TemplateKind; label: string; step: number }[] = [
  { kind: 'keyword_research', label: 'Keyword research', step: 1 },
  { kind: 'matrix', label: '3×3 matrix', step: 1 },
  { kind: 'clusters', label: 'Clusters', step: 1 },
  { kind: 'hotspots', label: 'SEO hotspots', step: 4 },
  { kind: 'gbp_posts', label: 'GBP 13-week posts', step: 6 },
  { kind: 'review_email', label: 'Review request email', step: 6 },
  { kind: 'citation_waves', label: 'Citation waves', step: 7 },
]
export const kindLabel = (k: TemplateKind) => TEMPLATE_KINDS.find((x) => x.kind === k)?.label ?? k

export const VARIABLES: { name: string; hint: string }[] = [
  { name: 'service', hint: 'each service' },
  { name: 'city', hint: 'A1–A3' },
  { name: 'st', hint: 'state code' },
  { name: 'state', hint: 'full state name' },
  { name: 'brand', hint: 'business name' },
]

export const WORD_GROUP_LABEL: Record<WordGroup, string> = { money: 'Money words', faq: 'FAQ words', service: 'Service words' }

export type Vars = { service: string; city: string; st: string; state: string; brand: string }

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
/** "NY" → "New York"; unknown → the code as typed. */
export const stateName = (st: string) => STATES[st.trim().toUpperCase()] ?? st.trim()

/** "Main City" → "main-city" (URL patterns). */
const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Fill {service} {city} {st} {state} {brand}; empty values leave the variable in place so gaps show.
 * A pattern that starts with "/" is a URL: each value becomes a slug ("/main-service-main-city-st/").
 */
export function fill(body: string, v: Partial<Vars>): string {
  const url = body.trim().startsWith('/')
  return body.replace(/\{(service|city|st|state|brand)\}/g, (m, key: keyof Vars) => {
    const val = v[key]?.trim()
    if (!val) return m
    return url ? slug(val) : val
  })
}

/** Keyword patterns read lower case, like searches ("main service main city st"). */
export function fillSearch(body: string, v: Partial<Vars>): string {
  const lower: Partial<Vars> = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (x ?? '').toLowerCase()]))
  return fill(body, lower)
}

/** Sample values from a client: the Home service first (the main page), else the first S1–S3 service, the A1 area (or main city) and its state. */
export function varsFromClient(c: ClientDetail): Vars {
  const order = ['Home', 'S1', 'S2', 'S3']
  const services = [...c.categories].filter((k) => k.code !== 'FAQ').sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code)).flatMap((k) => k.services)
  const a1 = c.areas.find((a) => a.code === 'A1' && a.status === 'active')
  const st = (a1?.state || c.state || '').trim()
  return { service: services[0]?.name ?? '', city: (a1?.name || c.city || '').trim(), st, state: st ? stateName(st) : '', brand: c.name }
}

/** Every pattern × every service and active area of a client (the "seed" list), deduped. */
export function seedsFor(items: TemplateItem[], c: ClientDetail, max = 500): string[] {
  const patterns = items.filter((i) => i.kind === 'pattern').map((i) => i.body)
  const services = c.categories.filter((k) => k.code !== 'FAQ').flatMap((k) => k.services.map((s) => s.name))
  const areas = c.areas.filter((a) => a.status === 'active' && a.name)
  const out = new Set<string>()
  for (const p of patterns)
    for (const s of services.length ? services : [''])
      for (const a of areas.length ? areas : [{ name: c.city ?? '', state: c.state ?? '' }]) {
        const st = (a.state || c.state || '').trim()
        out.add(fillSearch(p, { service: s, city: a.name ?? '', st, state: st ? stateName(st) : '', brand: c.name }).replace(/\s+/g, ' ').trim())
        if (out.size >= max) return [...out]
      }
  return [...out]
}
