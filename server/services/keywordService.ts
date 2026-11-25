// Keyword database (phase 1, step 5): list a client's keywords and edit them (one row or many).
// Tables: seo_keywords (+ seo_keyword_sources for where each keyword came from and the KP stand-in).
// Rules: KP range is text, saved exactly as picked/typed, with kp_volume_by = 'typed' + time.
// Bulk KP range never replaces an existing different range unless the person confirmed (overwriteKp).
// Imports never change what is set here (see importService).
import { z } from 'zod'
import type { ImportSource, KeywordItem, KeywordUpdateResult } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'

export class KeywordInputError extends Error {}

const PAGE = 1000 // Supabase returns at most 1000 rows per request
const CHUNK = 200

interface Row {
  id: string
  keyword: string
  role: KeywordItem['role']
  service_id: string | null
  intent: string | null
  kp_volume: string | null
  kp_volume_by: KeywordItem['kpVolumeBy']
  semrush_volume: number | null
  kd: number | null
  cpc: number | string | null
  track: boolean
  status: KeywordItem['status']
  notes: string | null
  created_at: string
  seo_keyword_sources: { source: ImportSource; segment: string | null; volume_raw: string | null }[]
  seo_matrix_keywords: { kind: string }[]
  seo_page_keywords: { role: string } | { role: string }[] | null
}

async function clientIdFor(siteId: string): Promise<string> {
  const c = must(await db().from('seo_clients').select('id').eq('site_id', siteId).maybeSingle(), 'Loading the client') as { id: string } | null
  if (!c) throw new KeywordInputError('That client no longer exists.')
  return c.id
}

/** KP stand-in from the KP rows: the location row first (e.g. a county row), never the hidden "All" row. */
function standIn(sources: Row['seo_keyword_sources']): string | null {
  const kp = sources.filter((s) => s.source === 'kp' && s.volume_raw)
  const pick = kp.find((s) => s.segment && s.segment.toLowerCase() !== 'all') ?? kp.find((s) => !s.segment) ?? null
  return pick?.volume_raw?.replace(/\.0+$/, '') ?? null
}

const SOURCE_ORDER: ImportSource[] = ['kp', 'semrush', 'sheet']

export async function listKeywords(siteId: string): Promise<KeywordItem[]> {
  const clientId = await clientIdFor(siteId)
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const part = must(
      await db()
        .from('seo_keywords')
        .select('id, keyword, role, service_id, intent, kp_volume, kp_volume_by, semrush_volume, kd, cpc, track, status, notes, created_at, seo_keyword_sources(source, segment, volume_raw), seo_matrix_keywords(kind), seo_page_keywords(role)')
        .eq('client_id', clientId)
        .order('keyword')
        .order('id')
        .range(from, from + PAGE - 1),
      'Loading keywords',
    ) as Row[]
    rows.push(...part)
    if (part.length < PAGE) break
  }
  return rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    role: r.role,
    isPrimarySomewhere:
      r.seo_matrix_keywords.some((m) => m.kind === 'primary') || [r.seo_page_keywords ?? []].flat().some((p) => p.role === 'primary'),
    serviceId: r.service_id,
    intent: r.intent,
    kpVolume: r.kp_volume,
    kpVolumeBy: r.kp_volume_by,
    kpStandIn: standIn(r.seo_keyword_sources),
    semrushVolume: r.semrush_volume,
    kd: r.kd,
    cpc: r.cpc === null ? null : Number(r.cpc),
    track: r.track,
    status: r.status,
    notes: r.notes,
    sources: SOURCE_ORDER.filter((s) => r.seo_keyword_sources.some((x) => x.source === s)),
    createdAt: r.created_at,
  }))
}

const UpdateSchema = z.object({
  siteId: z.string().min(1),
  ids: z.array(z.string().uuid()).min(1).max(20_000),
  changes: z
    .object({
      kpVolume: z.string().trim().max(40).nullable().optional(),
      role: z.enum(['primary', 'secondary', 'faq', 'near_me']).nullable().optional(),
      serviceId: z.string().uuid().nullable().optional(),
      track: z.boolean().optional(),
      status: z.enum(['keep', 'later', 'rejected']).optional(),
      notes: z.string().max(2000).nullable().optional(),
    })
    .strict(),
  overwriteKp: z.boolean().optional(),
})

export async function updateKeywords(raw: unknown): Promise<KeywordUpdateResult> {
  const parsed = UpdateSchema.safeParse(raw)
  if (!parsed.success) throw new KeywordInputError('Those changes don’t look right. Reload the page and try again.')
  const { siteId, changes, overwriteKp } = parsed.data
  const ids = [...new Set(parsed.data.ids)]
  if (!Object.keys(changes).length) return { updated: 0 }
  const clientId = await clientIdFor(siteId)

  if (changes.serviceId) {
    const s = must(await db().from('seo_client_services').select('id').eq('id', changes.serviceId).eq('client_id', clientId).maybeSingle(), 'Checking the service')
    if (!s) throw new KeywordInputError('That service isn’t one of this client’s services.')
  }

  // Only this client's keywords, and (for KP) which ones already hold a different range.
  const current: { id: string; kp_volume: string | null }[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = must(await db().from('seo_keywords').select('id, kp_volume').eq('client_id', clientId).in('id', ids.slice(i, i + CHUNK)), 'Loading keywords') as typeof current
    current.push(...part)
  }
  if (current.length !== ids.length) throw new KeywordInputError('Some of these keywords no longer exist. Reload the page.')

  const kp = changes.kpVolume === undefined ? undefined : changes.kpVolume ? changes.kpVolume : null
  if (kp !== undefined && ids.length > 1 && !overwriteKp) {
    const clash = current.filter((r) => r.kp_volume && r.kp_volume !== kp).length
    if (clash > 0) return { needsConfirm: clash }
  }

  const patch: Record<string, unknown> = {}
  if (kp !== undefined) {
    patch.kp_volume = kp
    patch.kp_volume_by = kp === null ? null : 'typed'
    patch.kp_volume_at = kp === null ? null : new Date().toISOString()
  }
  if (changes.role !== undefined) patch.role = changes.role
  if (changes.serviceId !== undefined) patch.service_id = changes.serviceId
  if (changes.track !== undefined) patch.track = changes.track
  if (changes.status !== undefined) patch.status = changes.status
  if (changes.notes !== undefined) patch.notes = changes.notes?.trim() || null

  for (let i = 0; i < ids.length; i += CHUNK) {
    must(await db().from('seo_keywords').update(patch).eq('client_id', clientId).in('id', ids.slice(i, i + CHUNK)), 'Saving keywords')
  }
  return { updated: ids.length }
}
