import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, checkDeleteClient, deleteClient } from '../../lib/api'
import { CARD, CARD_TITLE, FIELD } from '../../lib/ui'
import type { ClientDetail } from '../../types/seo'
import { Spinner } from '../ui/Loading'

// Client setup › Delete client (Angel, Nov 26). Two steps on purpose: set Status to Archived and save, then delete
// here by typing the client's exact name. Everything SEO Hub holds for the client goes (keywords, imports + raw
// files, matrix, pages, notes, links, guide progress); Claude call costs stay in Settings. Can't be undone.

export default function DeleteClient({ client: c }: { client: ClientDetail }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const archived = c.status === 'archived'
  const check = useQuery({ queryKey: ['client-delete-check', c.siteId], queryFn: () => checkDeleteClient(c.siteId), enabled: open && archived })
  const del = useMutation({
    mutationFn: () => deleteClient(c.siteId, typed),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['client', c.siteId] })
      await qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['ai-usage'] })
      navigate('/clients', { replace: true })
    },
  })
  const matches = typed.trim() === c.name.trim()
  const n = check.data
  return (
    <section className={`${CARD} !border-vv-error-line`} aria-labelledby="del-h">
      <h2 id="del-h" className={CARD_TITLE}>
        Delete client
      </h2>
      {!archived ? (
        <p className="m-0 text-[14px] text-vv-body">
          To delete {c.name}, first set <strong>Status</strong> to <strong>Archived</strong> above and save. Archived clients are hidden from the sidebar switcher but keep all their data.
        </p>
      ) : !open ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 flex-1 text-[14px] text-vv-body">{c.name} is archived. Deleting removes everything SEO Hub holds for it. This can’t be undone.</p>
          <button type="button" className="inline-flex min-h-[46px] items-center rounded-full border-2 border-solid border-vv-red bg-transparent px-5 text-[15px] font-bold text-vv-red" onClick={() => setOpen(true)}>
            Delete client…
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {check.isPending && <Spinner />}
          {n && (
            <p className="m-0 text-[14px] text-vv-body">
              This deletes <strong>{n.keywords.toLocaleString('en-US')} keywords</strong>, <strong>{n.imports} imports</strong> (and their raw files), <strong>{n.pages} pages</strong>,{' '}
              <strong>{n.notes} notes</strong>, the matrix, links, accounts and guide progress. Agency rules and Claude call costs stay.
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-vv-body">
            Type “{c.name}” to delete it
            <input
              className={FIELD}
              value={typed}
              autoComplete="off"
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (matches && !del.isPending) del.mutate()
                }
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!matches || del.isPending}
              onClick={() => del.mutate()}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-full border-0 bg-vv-red px-5 text-[15px] font-bold text-white disabled:opacity-40"
            >
              {del.isPending && <Spinner />}
              Delete {c.name} forever
            </button>
            <button type="button" className="min-h-9 border-0 bg-transparent text-[14px] font-bold text-vv-purple-deep" onClick={() => (setOpen(false), setTyped(''))}>
              Keep it
            </button>
          </div>
          {del.error && <p className="m-0 text-[14px] font-semibold text-vv-red">{del.error instanceof ApiError && del.error.detail ? del.error.detail : 'Couldn’t delete it. Try again.'}</p>}
        </div>
      )}
    </section>
  )
}
