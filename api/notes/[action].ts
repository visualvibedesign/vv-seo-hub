// API route: /api/notes/:action (redesign step 7, migration 0014). Signed-in only.
//   GET  /api/notes/list?site=<site id>                            -> NotesState (client notes + agency rules, links, old notes)
//   POST /api/notes/add          { siteId, kind, body, author?, day?, agency? } -> { note }
//   POST /api/notes/edit         { siteId, id, kind, body }         -> { note }
//   POST /api/notes/delete       { siteId, id }                     -> { ok }
//   POST /api/notes/move-earlier { siteId, author? }                -> { note }  (old one-box notes → one Note)
//   POST /api/notes/link         { siteId, id?, label, url, note? } -> { link }
//   POST /api/notes/link-delete  { siteId, id }                     -> { ok }
import { DatabaseError } from '../../server/clients/supabase.js'
import { addNote, deleteLink, deleteNote, editNote, listNotes, moveEarlier, NotesInputError, saveLink } from '../../server/services/notesService.js'
import { requireSession } from '../../server/utils/auth.js'

function actionOf(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''
}

export async function GET(request: Request) {
  return handle(request, 'GET')
}

export async function POST(request: Request) {
  return handle(request, 'POST')
}

async function handle(request: Request, method: 'GET' | 'POST') {
  const denied = await requireSession(request)
  if (denied) return denied
  const action = actionOf(request)
  try {
    if (method === 'GET' && action === 'list') return Response.json(await listNotes(new URL(request.url).searchParams.get('site') ?? ''))
    if (method === 'POST') {
      const body = await request.json().catch(() => null)
      if (action === 'add') return Response.json({ note: await addNote(body) })
      if (action === 'edit') return Response.json({ note: await editNote(body) })
      if (action === 'move-earlier') return Response.json({ note: await moveEarlier(body) })
      if (action === 'link') return Response.json({ link: await saveLink(body) })
      if (action === 'delete') {
        await deleteNote(body)
        return Response.json({ ok: true })
      }
      if (action === 'link-delete') {
        await deleteLink(body)
        return Response.json({ ok: true })
      }
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof NotesInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
