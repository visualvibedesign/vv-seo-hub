import { useMemo, useState } from 'react'
import { useApproveNotes, useDiscardNotes, useDraftNotes, useReportNotesEstimate } from '../../hooks/useReports'
import { formatUsd } from '../../lib/aiModels'
import { ApiError } from '../../lib/api'
import { allowedNumbers, unmatchedNumbers } from '../../lib/notesCheck'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, PILL } from '../../lib/ui'
import type { Report } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Results › report › Notes for the report (2f step 3). Claude drafts from the frozen numbers (estimate first); the
// draft is "Ready to review" until Angel edits and approves it. Only approved text is the report's notes. The numbers
// check flags any number that isn't in the report (it never removes anything). A sent report's notes are locked.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function ReportNotes({ siteId, r }: { siteId: string; r: Report }) {
  const draft = useDraftNotes(siteId)
  const approve = useApproveNotes(siteId)
  const discard = useDiscardNotes(siteId)
  const [asking, setAsking] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // text being edited (own text or approved notes)
  const [dropDraft, setDropDraft] = useState(false)
  const allowed = useMemo(() => allowedNumbers(r.numbers, r.actions), [r.numbers, r.actions])
  const sent = r.status === 'sent'
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-vv-body">Notes for the report</h3>
      {r.notesDraft && !sent && <span className={`${PILL} bg-vv-orange-100 text-vv-orange-ink`}>Ready to review</span>}
      {!r.notesDraft && r.notes && r.notesApprovedAt && <span className="text-[12px] text-vv-muted">Approved {when(r.notesApprovedAt)}</span>}
    </div>
  )

  // Sent: locked, approved text only.
  if (sent)
    return (
      <div className="flex flex-col gap-1.5">
        {head}
        {r.notes ? <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed">{r.notes}</p> : <p className="m-0 text-[13px] text-vv-body">No notes were approved for this report. Reopen it as a draft to add them.</p>}
      </div>
    )

  // Claude's draft waiting for review (edit in place, then approve).
  if (r.notesDraft)
    return (
      <div className="flex flex-col gap-2">
        {head}
        <ReviewBox
          key={`draft-${r.notesDraftAt}`}
          start={r.notesDraft}
          allowed={allowed}
          note={`Drafted by Claude ${r.notesDraftAt ? when(r.notesDraftAt) : ''} from this report’s numbers. Edit anything, then approve: only the approved text goes in the report.${r.notes ? ' Approving replaces the notes approved before.' : ''}`}
          busy={approve.isPending}
          error={approve.error}
          primary="Approve notes"
          onSave={(text) => approve.mutate({ id: r.id, text })}
          extra={
            <>
              <button type="button" className={`${BTN_LINK} px-2 !text-vv-red`} onClick={() => setDropDraft(true)} disabled={approve.isPending || discard.isPending}>
                Discard draft
              </button>
              <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[13px]`} onClick={() => setAsking(true)} disabled={approve.isPending || draft.isPending}>
                Draft again
              </button>
            </>
          }
        />
        <DraftDialog siteId={siteId} id={r.id} open={asking} busy={draft.isPending} error={draft.error} onClose={() => !draft.isPending && setAsking(false)} onRun={() => draft.mutate(r.id, { onSuccess: () => setAsking(false) })} />
        <ConfirmDialog
          open={dropDraft}
          title="Discard Claude’s draft?"
          body={<>The draft is removed.{r.notes ? ' The notes approved before stay.' : ''}{discard.error ? <span className="mt-2 block font-semibold text-vv-red">{errText(discard.error, 'Couldn’t discard it.')}</span> : null}</>}
          confirmLabel="Discard"
          busy={discard.isPending}
          onCancel={() => setDropDraft(false)}
          onConfirm={() => discard.mutate(r.id, { onSuccess: () => setDropDraft(false) })}
        />
      </div>
    )

  // Editing own text (new, or the approved notes).
  if (editing !== null)
    return (
      <div className="flex flex-col gap-2">
        {head}
        <ReviewBox
          start={editing}
          allowed={allowed}
          note="Your own text. The numbers check still flags any number that isn’t in this report."
          busy={approve.isPending}
          error={approve.error}
          primary={r.notes ? 'Save notes' : 'Approve notes'}
          onSave={(text) => approve.mutate({ id: r.id, text }, { onSuccess: () => setEditing(null) })}
          extra={
            <button type="button" className={`${BTN_LINK} px-2`} onClick={() => setEditing(null)} disabled={approve.isPending}>
              Cancel
            </button>
          }
        />
      </div>
    )

  // Approved notes (or none yet).
  return (
    <div className="flex flex-col gap-2">
      {head}
      {r.notes ? <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed">{r.notes}</p> : <p className="m-0 text-[13px] text-vv-body">No notes yet. Claude can draft them from this report’s numbers and next actions; you edit and approve before they go in.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${r.notes ? BTN_GHOST : BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => setAsking(true)}>
          {r.notes ? 'Redraft with Claude' : 'Draft with Claude'}
        </button>
        <button type="button" className={`${BTN_LINK} px-2`} onClick={() => setEditing(r.notes ?? '')}>
          {r.notes ? 'Edit notes' : 'Write them myself'}
        </button>
      </div>
      <DraftDialog siteId={siteId} id={r.id} open={asking} busy={draft.isPending} error={draft.error} onClose={() => !draft.isPending && setAsking(false)} onRun={() => draft.mutate(r.id, { onSuccess: () => setAsking(false) })} />
    </div>
  )
}

/** Textarea + live numbers check + approve. */
function ReviewBox({ start, allowed, note, busy, error, primary, onSave, extra }: { start: string; allowed: number[]; note: string; busy: boolean; error: unknown; primary: string; onSave: (text: string) => void; extra?: React.ReactNode }) {
  const [text, setText] = useState(start)
  const flagged = unmatchedNumbers(text, allowed)
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[12px] text-vv-body">{note}</p>
      <textarea aria-label="Notes for the report" className={`${FIELD} min-h-[220px] resize-y leading-relaxed`} value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        {flagged.length ? (
          <span role="status" className="rounded-lg bg-vv-orange-100 px-2.5 py-1 font-semibold text-vv-orange-ink">
            Not in this report’s numbers: {flagged.join(', ')}. Check them before approving.
          </span>
        ) : (
          <span role="status" className="text-vv-green-ink">Every number is from this report.</span>
        )}
        <span className="text-vv-muted">{text.length.toLocaleString('en-US')} / 6,000</span>
      </div>
      {error !== null && error !== undefined && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(error, 'Couldn’t save the notes.')}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {extra}
        <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => onSave(text)} disabled={busy || !text.trim()}>
          {busy && <Spinner />}
          {primary}
        </button>
      </div>
    </div>
  )
}

/** Estimate first, then the call. The draft waits for review; nothing is approved automatically. */
function DraftDialog({ siteId, id, open, busy, error, onClose, onRun }: { siteId: string; id: string; open: boolean; busy: boolean; error: unknown; onClose: () => void; onRun: () => void }) {
  const est = useReportNotesEstimate(siteId, id, open)
  return (
    <Modal open={open} title="Draft the notes with Claude" onClose={onClose}>
      <p className="m-0 text-[13px] text-vv-body">Claude writes “What moved”, “Likely why” and “Next 30 days” from this report. It gets the frozen numbers with their dates, what’s missing, the next actions, last month’s approved notes and the business name, city, services and areas. Never the address or account details.</p>
      <div className="rounded-xl bg-vv-lavender-50 px-3 py-2.5 text-[13px]">
        {est.isPending ? (
          <span className="flex items-center gap-2 text-vv-body">
            <Spinner /> Working out the cost…
          </span>
        ) : est.isError || !est.data ? (
          <span className="font-semibold text-vv-red">{errText(est.error, 'Couldn’t work out the cost.')}</span>
        ) : (
          <span>
            <strong>{est.data.model}</strong> · about {est.data.inputTokens.toLocaleString('en-US')} tokens in, up to {est.data.outputTokens.toLocaleString('en-US')} out · about <strong>{formatUsd(est.data.costUsd)}</strong>
          </span>
        )}
      </div>
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review”: you edit and approve before it goes in the report. Logged in Settings › Claude usage. Takes up to a minute.</p>
      {error !== null && error !== undefined && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(error, 'Claude couldn’t draft the notes.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} onClick={onRun} disabled={busy || est.isPending || est.isError}>
          {busy && <Spinner />}
          {busy ? 'Drafting…' : 'Draft now'}
        </button>
      </div>
    </Modal>
  )
}
