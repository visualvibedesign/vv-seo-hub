// Templates (redesign step 5). Tables: seo_templates, seo_template_items, seo_client_templates (0004 + 0005).
// Applying a template stores a COPY (snapshot) on the client: editing the template later never changes it.
// Applying never creates keywords or changes exported numbers.
import { z } from 'zod'
import { INDUSTRY_KEYS } from '../../src/lib/clientSetup.js'
import type { ClientIndustry, Template, TemplateInput, TemplateItem, TemplateKind } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { clientRow } from './clientService.js'

export class TemplateInputError extends Error {}

const KINDS: TemplateKind[] = ['keyword_research', 'matrix', 'clusters', 'hotspots', 'gbp_posts', 'review_email', 'citation_waves']

type Row = {
  id: string
  kind: TemplateKind
  name: string
  sam_step: number
  industry: ClientIndustry | null
  description: string
  built_in: boolean
  updated_at: string
  seo_template_items: { sort: number; kind: TemplateItem['kind']; word_group: TemplateItem['wordGroup']; body: string }[]
  seo_client_templates: { applied_at: string; seo_clients: { site_id: string; name: string } | null }[]
}

const SELECT =
  'id, kind, name, sam_step, industry, description, built_in, updated_at, seo_template_items(sort, kind, word_group, body), seo_client_templates(applied_at, seo_clients(site_id, name))'

function toTemplate(r: Row): Template {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    samStep: r.sam_step,
    industry: r.industry,
    description: r.description,
    builtIn: r.built_in,
    updatedAt: r.updated_at,
    items: [...r.seo_template_items].sort((a, b) => a.sort - b.sort).map((i) => ({ kind: i.kind, wordGroup: i.word_group, body: i.body })),
    applied: r.seo_client_templates
      .filter((a) => a.seo_clients)
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at))
      .map((a) => ({ siteId: a.seo_clients!.site_id, name: a.seo_clients!.name, appliedAt: a.applied_at })),
  }
}

export async function listTemplates(): Promise<Template[]> {
  const rows = must(await db().from('seo_templates').select(SELECT), 'Loading templates') as unknown as Row[]
  return rows
    .map(toTemplate)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name))
}

async function getTemplate(id: string): Promise<Template> {
  const row = must(await db().from('seo_templates').select(SELECT).eq('id', id).maybeSingle(), 'Loading the template') as unknown as Row | null
  if (!row) throw new TemplateInputError('That template doesn’t exist.')
  return toTemplate(row)
}

const ItemSchema = z
  .object({
    kind: z.enum(['pattern', 'word', 'rule', 'export', 'text']),
    wordGroup: z.enum(['money', 'faq', 'service']).nullable(),
    body: z.string().trim().min(1).max(500),
  })
  .refine((i) => (i.kind === 'word') === (i.wordGroup !== null), 'Word lines need a group (money / FAQ / service); other lines don’t.')

const InputSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(KINDS as [TemplateKind, ...TemplateKind[]]),
  name: z.string().trim().min(1, 'Name the template.').max(80),
  samStep: z.number().int().min(0).max(8),
  industry: z.enum(INDUSTRY_KEYS as [ClientIndustry, ...ClientIndustry[]]).nullable(),
  description: z.string().trim().max(300),
  items: z.array(ItemSchema).max(200),
})

/** Creates or edits a template (its lines are replaced as a whole). Clients it was applied to keep their copy. */
export async function saveTemplate(raw: unknown): Promise<Template> {
  const p = InputSchema.safeParse(raw)
  if (!p.success) throw new TemplateInputError(p.error.issues[0]?.message ?? 'That template isn’t right.')
  const t: TemplateInput = p.data
  if (!t.items.length) throw new TemplateInputError('Add at least one line (a pattern, word, rule or step).')
  const fields = { kind: t.kind, name: t.name, sam_step: t.samStep, industry: t.industry, description: t.description }

  let id = t.id
  if (id) {
    const updated = must(await db().from('seo_templates').update(fields).eq('id', id).select('id'), 'Saving the template') as { id: string }[]
    if (!updated.length) throw new TemplateInputError('That template doesn’t exist.')
    // Replace its lines (the template's own lines only; applied copies live in seo_client_templates).
    must(await db().from('seo_template_items').delete().eq('template_id', id), 'Saving the template lines')
  } else {
    id = (must(await db().from('seo_templates').insert({ ...fields, built_in: false }).select('id').single(), 'Adding the template') as { id: string }).id
  }
  must(
    await db()
      .from('seo_template_items')
      .insert(t.items.map((i, n) => ({ template_id: id, sort: n + 1, kind: i.kind, word_group: i.wordGroup, body: i.body }))),
    'Saving the template lines',
  )
  return getTemplate(id!)
}

const ApplySchema = z.object({ templateId: z.string().uuid(), siteId: z.string() })

/** Stores a copy of the template on the client. Fills the client's industry if it has none yet. */
export async function applyTemplate(raw: unknown): Promise<Template> {
  const p = ApplySchema.safeParse(raw)
  if (!p.success) throw new TemplateInputError('Pick a template and a client.')
  const c = await clientRow(p.data.siteId)
  if (!c) throw new TemplateInputError('That client doesn’t exist.')
  const t = await getTemplate(p.data.templateId)
  const snapshot = { name: t.name, kind: t.kind, samStep: t.samStep, industry: t.industry, description: t.description, items: t.items, copiedAt: new Date().toISOString() }
  must(
    await db().from('seo_client_templates').insert({ client_id: c.id, template_id: t.id, kind: t.kind, name: t.name, snapshot }),
    'Applying the template',
  )
  if (t.industry && !c.industry) must(await db().from('seo_clients').update({ industry: t.industry }).eq('id', c.id), 'Saving the client’s industry')
  return getTemplate(t.id)
}
