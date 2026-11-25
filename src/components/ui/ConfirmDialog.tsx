// Copied from Visual Vibe HQ (src/components/ui/ConfirmDialog.tsx), unchanged.
import { useEffect, useRef } from 'react'
import { Spinner } from './Loading'

/**
 * "Are you sure?" popup (Angel, 2026-11-14: ask in a popup, not inline). Same look as the other popups
 * (Weekly queue, calendar): centred card, soft purple backdrop. Esc or a click outside cancels;
 * the safe choice ("Keep") has focus first, so Enter never deletes by accident.
 */
export default function ConfirmDialog(props: {
  open: boolean
  title: string
  body?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { open, title, body, confirmLabel, cancelLabel = 'Keep', busy = false, onConfirm, onCancel } = props
  const ref = useRef<HTMLDialogElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      keepRef.current?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === ref.current && onCancel()}
      aria-labelledby="confirm-h"
      className="m-auto w-[calc(100%-32px)] max-w-[420px] rounded-[26px] border-0 bg-vv-surface p-0 text-vv-ink shadow-[0_30px_60px_-30px_rgba(42,28,110,0.5)] backdrop:bg-[rgba(42,28,110,0.18)]"
    >
      {open && (
        <div className="flex flex-col gap-3 p-[26px] phone:p-5">
          <h2 id="confirm-h" className="m-0 font-display text-[24px] font-semibold leading-[1.2]">
            {title}
          </h2>
          {body && <div className="text-[15px] leading-normal text-vv-body">{body}</div>}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button ref={keepRef} type="button" onClick={onCancel} className="min-h-[44px] rounded-full border border-solid border-vv-field-line bg-vv-surface px-5 text-sm font-bold text-vv-ink">
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-0 bg-vv-red px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy && <Spinner />}
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
