import { useEffect, useRef, type ReactNode } from 'react'

/** Centred popup with a Fraunces title (same look as ConfirmDialog). Esc or a click outside closes it. */
export default function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean | 'xl' }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto w-[calc(100%-32px)] ${wide === 'xl' ? 'max-w-[900px]' : wide ? 'max-w-[560px]' : 'max-w-[480px]'} rounded-[26px] border-0 bg-vv-surface p-0 text-vv-ink shadow-[0_30px_60px_-30px_rgba(42,28,110,0.5)] backdrop:bg-[rgba(42,28,110,0.18)]`}
    >
      {open && (
        <div className="flex flex-col gap-3.5 p-[26px] phone:p-5">
          <h2 className="m-0 font-display text-[24px] font-semibold leading-[1.2]">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
