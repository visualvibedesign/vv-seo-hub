// Notes & links (redesign step 7, migration 0014). Design: docs/design/Notes.png.
//   seo_notes        = Rule / Decision / Note feed per client; client_id null = an agency rule, shown on every client.
//   seo_client_links = links that aren't accounts (the Sheet, ClickUp…). Account links stay on seo_client_accounts.
// Never a street address in a note; links are https only, never logins. The old one-box seo_clients.notes is shown as
// "Earlier notes" and can be moved into the feed (then the old box is emptied: the text now lives in a note).
import { z } from 'zod'
import { AUTHOR_MAX, LINK_LABEL_MAX, LINK_NOTE_MAX, linkProblem, noteProblem } from '../../src/lib/notes.js'
import type { ClientLink, ClientNote, NoteKind, NotesState } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'

export class NotesInputError extends Error {}

type NoteRow = { id: string; client_id: string | null; kind: NoteKind; body: string; author: string | null; day: number | null; created_at: string }
type LinkRow = { id: string; label: string; url: string; note: string | null; sort: number }

const NOTE_COLS = 'id, client_id, kind, body, author, day, created_at'
const LINK_COLS = 'id, label, url, note, sort'
const toNote = (r: NoteRow): ClientNote => ({ id: r.id, kind: r.kind, body: r.body, author: r.author, day: r.day, agency: r.client_id === null, createdAt: r.created_at })
const toLink = (r: LinkRow): ClientLink => ({ id: r.id, label: r.label, url: r.url, note: r.note, sort: r.sort })

async function clientOf(siteId: string): Promise<{ id: string; notes: string | null }> {
  if (!siteId) throw new NotesInputError('Which client?')
  const c = must(await db().from('seo_clients').select('id, notes').eq('site_id', siteId).maybeSingle(), 'Loading the client') as { id: string; notes: string | null } | null
  if (!c) throw new NotesInputError('That client doesn’t exist.')
  return c
}

/** This client's notes + every agency rule (newest first), its extra links, and the old one-box notes. */
export async function listNotes(siteId: string): Promise<NotesState> {
  const c = await clientOf(siteId)
  const [notes, links] = await Promise.all([
    db().from('seo_notes').select(NOTE_COLS).or(`client_id.eq.${c.id},client_id.is.null`).order('created_at', { ascending: false }).order('id').limit(500),
    db().from('seo_client_links').select(LINK_COLS).eq('client_id', c.id).order('sort').order('created_at'),
  ])
  return {
    notes: (must(notes, 'Loading notes') as NoteRow[]).map(toNote),
    links: (must(links, 'Loading links') as LinkRow[]).map(toLink),
    earlier: c.notes?.trim() ? c.notes.trim() : null,
  }
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const p = schema.safeParse(raw)
  if (!p.success) throw new NotesInputError(p.error.issues[0]?.message ?? 'That isn’t right.')
  return p.data
}

const Kind = z.enum(['rule', 'decision', 'note'])
const Author = z.string().trim().max(AUTHOR_MAX, `Keep the name under ${AUTHOR_MAX} characters.`).optional().default('')

const NoteInput = z.object({
  siteId: z.string().min(1),
  kind: Kind,
  body: z.string(),
  author: Author,
  day: z.number().int().min(0).max(9).nullable().optional().default(null),
  agency: z.boolean().optional().default(false),
})

/** Adds a note. An agency rule (agency: true) has no client and shows on every client; it must be a Rule. */
export async function addNote(raw: unknown): Promise<ClientNote> {
  const n = parse(NoteInput, raw)
  const problem = noteProblem(n.body)
  if (problem) throw new NotesInputError(problem)
  if (n.agency && n.kind !== 'rule') throw new NotesInputError('Only a Rule can be an agency rule.')
  const c = await clientOf(n.siteId)
  const row = must(
    await db()
      .from('seo_notes')
      .insert({ client_id: n.agency ? null : c.id, kind: n.kind, body: n.body.trim(), author: n.author || null, day: n.agency ? null : n.day })
      .select(NOTE_COLS)
      .single(),
    'Saving the note',
  ) as NoteRow
  return toNote(row)
}

/** This client's note, or an agency rule (shown here too). Another client's note → refused. */
async function ownNote(siteId: string, id: string): Promise<NoteRow> {
  const c = await clientOf(siteId)
  const row = must(await db().from('seo_notes').select(NOTE_COLS).eq('id', id).maybeSingle(), 'Loading the note') as NoteRow | null
  if (!row || (row.client_id !== null && row.client_id !== c.id)) throw new NotesInputError('That note doesn’t exist.')
  return row
}

const EditInput = z.object({ siteId: z.string().min(1), id: z.string().uuid(), kind: Kind, body: z.string() })

/** Edits the text and tag. An agency rule stays a Rule. */
export async function editNote(raw: unknown): Promise<ClientNote> {
  const n = parse(EditInput, raw)
  const problem = noteProblem(n.body)
  if (problem) throw new NotesInputError(problem)
  const row = await ownNote(n.siteId, n.id)
  if (row.client_id === null && n.kind !== 'rule') throw new NotesInputError('An agency rule stays a Rule.')
  const saved = must(await db().from('seo_notes').update({ kind: n.kind, body: n.body.trim() }).eq('id', n.id).select(NOTE_COLS).single(), 'Saving the note') as NoteRow
  return toNote(saved)
}

const IdInput = z.object({ siteId: z.string().min(1), id: z.string().uuid() })

/** Deletes one note (asked in a popup first). An agency rule goes from every client. */
export async function deleteNote(raw: unknown): Promise<void> {
  const n = parse(IdInput, raw)
  await ownNote(n.siteId, n.id)
  must(await db().from('seo_notes').delete().eq('id', n.id), 'Deleting the note')
}

const MoveInput = z.object({ siteId: z.string().min(1), author: Author })

/** "Move to notes": the old one-box text becomes one Note (as written), then the old box is emptied. */
export async function moveEarlier(raw: unknown): Promise<ClientNote> {
  const n = parse(MoveInput, raw)
  const c = await clientOf(n.siteId)
  const text = c.notes?.trim() ?? ''
  if (!text) throw new NotesInputError('There are no earlier notes to move.')
  const problem = noteProblem(text)
  if (problem) throw new NotesInputError(`${problem} Fix it in Edit client → Notes first.`)
  const row = must(
    await db().from('seo_notes').insert({ client_id: c.id, kind: 'note', body: text, author: n.author || null, day: null }).select(NOTE_COLS).single(),
    'Moving the notes',
  ) as NoteRow
  const cleared = await db().from('seo_clients').update({ notes: null }).eq('id', c.id)
  if (cleared.error) {
    await db().from('seo_notes').delete().eq('id', row.id) // keep one copy only
    must(cleared, 'Emptying the old notes box')
  }
  return toNote(row)
}

const LinkInput = z.object({
  siteId: z.string().min(1),
  id: z.string().uuid().optional(),
  label: z.string(),
  url: z.string(),
  note: z.string().trim().max(LINK_NOTE_MAX, `Keep the line under the name to ${LINK_NOTE_MAX} characters.`).optional().default(''),
})

/** Adds (no id) or saves a link. https only, no username:password@, no keys. */
export async function saveLink(raw: unknown): Promise<ClientLink> {
  const l = parse(LinkInput, raw)
  const problem = linkProblem(l.label, l.url)
  if (problem) throw new NotesInputError(problem)
  const c = await clientOf(l.siteId)
  const fields = { label: l.label.trim().slice(0, LINK_LABEL_MAX), url: l.url.trim(), note: l.note || null }
  if (l.id) {
    const rows = must(await db().from('seo_client_links').update(fields).eq('id', l.id).eq('client_id', c.id).select(LINK_COLS), 'Saving the link') as LinkRow[]
    if (!rows.length) throw new NotesInputError('That link doesn’t exist.')
    return toLink(rows[0])
  }
  const last = must(await db().from('seo_client_links').select('sort').eq('client_id', c.id).order('sort', { ascending: false }).limit(1), 'Loading links') as { sort: number }[]
  const sort = Math.min(32000, (last[0]?.sort ?? 0) + 10)
  return toLink(must(await db().from('seo_client_links').insert({ client_id: c.id, ...fields, sort }).select(LINK_COLS).single(), 'Saving the link') as LinkRow)
}

/** Deletes one of this client's links (asked in a popup first). */
export async function deleteLink(raw: unknown): Promise<void> {
  const l = parse(IdInput, raw)
  const c = await clientOf(l.siteId)
  must(await db().from('seo_client_links').delete().eq('id', l.id).eq('client_id', c.id), 'Deleting the link')
}
