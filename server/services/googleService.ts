// Phase 2a · Connect Search Console + GA4 per client (docs/phase-2-plan.md). Stores only the property ids
// (seo_google_links, migration 0016); the agency's Google access is the service account in env vars.
// Test = a 7-day pull that saves nothing. The daily pull into seo_metric_daily comes in step 2b.
import { z } from 'zod'
import type { GoogleLink, GoogleSetup, GoogleTestResult } from '../../src/types/seo.js'
import { google, GoogleApiError, GoogleConfigError, serviceAccountEmail } from '../clients/google.js'
import { db, DatabaseError, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class GoogleInputError extends Error {}

type LinkRow = { gsc_property: string | null; ga4_property: string | null; gsc_query_words: string[]; last_sync_at: string | null; last_sync_ok: boolean | null; last_error: string | null }
const toLink = (r: LinkRow): GoogleLink => ({ gscProperty: r.gsc_property, ga4Property: r.ga4_property, queryWords: r.gsc_query_words ?? [], lastSyncAt: r.last_sync_at, lastSyncOk: r.last_sync_ok, lastError: r.last_error })

const GSC = /^(sc-domain:[a-z0-9.-]+|https:\/\/[^\s]+)$/
const GA4 = /^properties\/[0-9]+$/

async function clientId(siteId: string): Promise<string> {
  const c = await clientRow(siteId)
  if (!c) throw new GoogleInputError('That client doesn’t exist.')
  return c.id
}

const missingTable = (e: { code?: string; message: string }) => /does not exist|schema cache|PGRST205|42P01/i.test(`${e.code ?? ''} ${e.message}`)
const errText = (e: unknown) => (e instanceof GoogleApiError || e instanceof GoogleConfigError ? e.message : 'Google didn’t answer. Try again in a moment.')

/** The email to add, the client's saved link, and the properties the service account can already see. */
export async function googleSetup(siteId: string): Promise<GoogleSetup> {
  const id = await clientId(siteId)
  const r = await db().from('seo_google_links').select('gsc_property, ga4_property, gsc_query_words, last_sync_at, last_sync_ok, last_error').eq('client_id', id).maybeSingle()
  if (r.error && !missingTable(r.error)) throw new DatabaseError(`Loading the Google link: ${r.error.message}`)
  const serviceEmail = serviceAccountEmail()
  const out: GoogleSetup = { serviceEmail, tableReady: !r.error, link: r.data ? toLink(r.data as LinkRow) : null, gscSites: [], ga4Properties: [], listErrors: [] }
  if (!serviceEmail) return out
  const [sites, props] = await Promise.allSettled([
    google<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('https://www.googleapis.com/webmasters/v3/sites'),
    google<{ accountSummaries?: { displayName?: string; propertySummaries?: { property: string; displayName?: string }[] }[] }>('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200'),
  ])
  if (sites.status === 'fulfilled')
    out.gscSites = (sites.value.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => ({ property: s.siteUrl, permission: s.permissionLevel })).sort((a, b) => a.property.localeCompare(b.property))
  else out.listErrors.push(`Search Console list: ${errText(sites.reason)}`)
  if (props.status === 'fulfilled')
    out.ga4Properties = (props.value.accountSummaries ?? [])
      .flatMap((a) => (a.propertySummaries ?? []).map((p) => ({ property: p.property, name: p.displayName ?? p.property, account: a.displayName ?? '' })))
      .sort((a, b) => a.name.localeCompare(b.name))
  else out.listErrors.push(`GA4 list (needs the Google Analytics Admin API enabled): ${errText(props.reason)}`)
  return out
}

const LinkInput = z.object({
  gscProperty: z.string().trim().max(300).optional().default(''),
  ga4Property: z.string().trim().max(40).optional().default(''),
  queryWords: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
})

function parseLink(raw: unknown) {
  const p = LinkInput.safeParse(raw)
  if (!p.success) throw new GoogleInputError(p.error.issues[0]?.message ?? 'That isn’t right.')
  const v = p.data
  const ga4 = /^[0-9]+$/.test(v.ga4Property) ? `properties/${v.ga4Property}` : v.ga4Property // "123456" → "properties/123456"
  if (v.gscProperty && !GSC.test(v.gscProperty)) throw new GoogleInputError('Search Console property: use “sc-domain:example.com” or “https://example.com/”.')
  if (ga4 && !GA4.test(ga4)) throw new GoogleInputError('GA4 property: use the number (Admin › Property settings), e.g. 123456789.')
  return { gsc: v.gscProperty || null, ga4: ga4 || null, words: [...new Set(v.queryWords.map((w) => w.toLowerCase()))] }
}

/** Day "YYYY-MM-DD", n days before today (UTC). */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

/** 7 days of totals from each property, without saving anything (the Test button). */
export async function testGoogle(raw: unknown): Promise<GoogleTestResult> {
  const { gsc, ga4 } = parseLink(raw)
  if (!gsc && !ga4) throw new GoogleInputError('Pick a Search Console property or a GA4 property to test.')
  // Search Console data lags ~2–3 days: the 7 days ending 3 days ago are complete. GA4: the 7 days ending yesterday.
  const from = daysAgo(9)
  const to = daysAgo(3)
  const out: GoogleTestResult = { from, to, gsc: null, ga4: null }
  if (gsc) {
    try {
      const r = await google<{ rows?: { clicks: number; impressions: number; ctr: number; position: number }[] }>(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gsc)}/searchAnalytics/query`,
        { startDate: from, endDate: to, dimensions: [] },
      )
      const t = r.rows?.[0]
      out.gsc = { ok: true, clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0 }
    } catch (e) {
      out.gsc = { ok: false, error: errText(e) }
    }
  }
  if (ga4) {
    try {
      const r = await google<{ rows?: { metricValues: { value: string }[] }[] }>(`https://analyticsdata.googleapis.com/v1beta/${ga4}:runReport`, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'totalUsers' }],
        dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
      })
      const v = r.rows?.[0]?.metricValues.map((m) => Number(m.value)) ?? [0, 0, 0]
      out.ga4 = { ok: true, sessions: v[0] ?? 0, engagedSessions: v[1] ?? 0, users: v[2] ?? 0 }
    } catch (e) {
      out.ga4 = { ok: false, error: errText(e) }
    }
  }
  return out
}

/** Saves which properties this client uses (empty = not linked). */
export async function saveGoogleLink(siteId: string, raw: unknown): Promise<GoogleLink> {
  const id = await clientId(siteId)
  const { gsc, ga4, words } = parseLink(raw)
  const r = await db()
    .from('seo_google_links')
    .upsert({ client_id: id, gsc_property: gsc, ga4_property: ga4, gsc_query_words: words }, { onConflict: 'client_id' })
    .select('gsc_property, ga4_property, gsc_query_words, last_sync_at, last_sync_ok, last_error')
    .single()
  if (r.error && missingTable(r.error)) throw new GoogleInputError('The Google tables aren’t there yet: run migration 0016 first.')
  return toLink(must(r, 'Saving the Google link') as LinkRow)
}
