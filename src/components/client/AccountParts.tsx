import { useState } from 'react'
import { accountLinkProblem } from '../../lib/clientSetup'
import { BTN_GHOST, BTN_LINK, FIELD } from '../../lib/ui'

// Account list as a quick-access place (Overview + Add client wizard): "Open" goes to the client's own saved link,
// else the tool's main page. Links only, never usernames or passwords.

/** Opens in a new tab. No URL → a quiet "No link yet". */
export function OpenButton({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="inline-flex min-h-9 items-center px-1 text-[12px] text-vv-muted">No link yet</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} in a new tab`} className={`${BTN_GHOST} min-h-9 px-3.5 text-[13px]`}>
      Open
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    </a>
  )
}

/** "+ Client link" / "Edit link" toggle → paste field. Saves on Enter or Save; '' removes it (back to the main page). */
export function LinkEditor({ value, label, onSave, busy }: { value: string; label: string; onSave: (link: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const problem = accountLinkProblem(draft)
  const save = () => {
    if (problem) return
    if (draft.trim() !== value) onSave(draft.trim())
    setOpen(false)
  }
  if (!open)
    return (
      <button
        type="button"
        className={`${BTN_LINK} min-h-6 self-start text-left text-[12px]`}
        onClick={() => {
          setDraft(value)
          setOpen(true)
        }}
        aria-label={`${value ? 'Edit' : 'Add'} this client’s ${label} link`}
      >
        {value ? 'Edit client link' : '+ Client link'}
      </button>
    )
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`This client’s ${label} link`}
          autoFocus
          className={`${FIELD} min-h-9 min-w-0 flex-1 py-1.5 text-[13px]`}
          value={draft}
          placeholder={`https://… this client’s page in ${label}`}
          inputMode="url"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        <button type="button" className={`${BTN_GHOST} min-h-9 px-3.5 text-[13px]`} disabled={!!problem || busy} onClick={save}>
          Save
        </button>
        <button type="button" className={`${BTN_LINK} text-[12px]`} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {problem ? (
        <span className="text-[12px] font-semibold text-vv-red">{problem}</span>
      ) : (
        <span className="text-[12px] text-vv-muted">Leave empty to use the tool’s main page. Links only, never usernames or passwords.</span>
      )}
    </div>
  )
}
