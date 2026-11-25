// Notes & links for one client (redesign step 7). Agency rules come with every client's list.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addNote, deleteLink, deleteNote, editNote, getNotes, moveEarlierNotes, saveLink } from '../lib/api'
import type { NoteKind } from '../types/seo'

export function useNotes(siteId: string) {
  return useQuery({ queryKey: ['notes', siteId], queryFn: () => getNotes(siteId), enabled: !!siteId })
}

/** Every change reloads the list. Agency rules show on every client, so all notes lists refresh. */
function useRefresh(siteId: string) {
  const qc = useQueryClient()
  return async (agencyToo = false) => {
    if (agencyToo) await qc.invalidateQueries({ queryKey: ['notes'] })
    else await qc.invalidateQueries({ queryKey: ['notes', siteId] })
  }
}

export function useAddNote(siteId: string) {
  const refresh = useRefresh(siteId)
  return useMutation({
    mutationFn: (n: { kind: NoteKind; body: string; author: string; day: number | null; agency: boolean }) => addNote({ siteId, ...n }),
    onSuccess: ({ note }) => refresh(note.agency),
  })
}

export function useEditNote(siteId: string) {
  const refresh = useRefresh(siteId)
  return useMutation({
    mutationFn: (n: { id: string; kind: NoteKind; body: string }) => editNote({ siteId, ...n }),
    onSuccess: ({ note }) => refresh(note.agency),
  })
}

export function useDeleteNote(siteId: string) {
  const refresh = useRefresh(siteId)
  return useMutation({ mutationFn: (n: { id: string; agency: boolean }) => deleteNote(siteId, n.id), onSuccess: (_r, n) => refresh(n.agency) })
}

/** The old notes box is emptied too, so the client (Edit client form) reloads. */
export function useMoveEarlier(siteId: string) {
  const qc = useQueryClient()
  const refresh = useRefresh(siteId)
  return useMutation({
    mutationFn: (author: string) => moveEarlierNotes(siteId, author),
    onSuccess: async () => {
      await refresh()
      await qc.invalidateQueries({ queryKey: ['client', siteId] })
    },
  })
}

export function useSaveLink(siteId: string) {
  const refresh = useRefresh(siteId)
  return useMutation({ mutationFn: (l: { id?: string; label: string; url: string; note: string }) => saveLink({ siteId, ...l }), onSuccess: () => refresh() })
}

export function useDeleteLink(siteId: string) {
  const refresh = useRefresh(siteId)
  return useMutation({ mutationFn: (id: string) => deleteLink(siteId, id), onSuccess: () => refresh() })
}
