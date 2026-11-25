import { useEffect, useRef, useState } from 'react'
import { useGoogleSetup } from '../../hooks/useGoogle'
import { useRankings } from '../../hooks/useRankings'
import { BTN_GHOST, BTN_LINK } from '../../lib/ui'
import type { ClientDetail } from '../../types/seo'

// Overview: one compact "Sources · 2 of 5 connected" button with a dot per source. Opens a small popover with each
// source's real status and the Google properties (Change opens the Connect panel). Closes on outside click / Esc.

type State = 'on' | 'part' | 'off' | 'warn'
const DOT: Record<State, string> = { on: 'bg-vv-green', part: 'bg-vv-purple', off: 'bg-vv-muted opacity-50', warn: 'bg-vv-orange-ink' }
const short = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function SourcesButton({ client: c, onChangeGoogle }: { client: ClientDetail; onChangeGoogle: () => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const link = useGoogleSetup(c.siteId).data?.link ?? null
  const ranks = useRankings(c.siteId).data

  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const google = (prop: string | null | undefined): { note: string; state: State } => {
    if (!prop) return { note: 'Not connected', state: 'off' }
    if (!link?.lastSyncAt) return { note: 'Linked · not pulled yet', state: 'part' }
    if (link.lastSyncOk === false) return { note: `Last pull had errors · ${short(link.lastSyncAt)}`, state: 'warn' }
    return { note: `Connected · pulled ${short(link.lastSyncAt)}`, state: 'on' }
  }
  const list: { name: string; note: string; state: State }[] = [
    { name: 'Search Console', ...google(link?.gscProperty) },
    { name: 'GA4', ...google(link?.ga4Property) },
    ranks?.latest
      ? { name: 'Semrush', note: `CSV · positions from ${short(ranks.latest)}`, state: 'on' }
      : { name: 'Semrush', note: 'No rankings CSV yet', state: 'off' },
    { name: 'Whitespark', note: 'No map grid yet', state: 'off' },
    { name: 'GBP', note: 'Not typed in yet', state: 'off' },
  ]
  const on = list.filter((s) => s.state === 'on' || s.state === 'warn').length

  return (
    <div ref={box} className="relative self-start">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="ov-sources"
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-solid border-vv-field-line bg-vv-surface px-3.5 font-body text-[13px] text-vv-ink hover:bg-vv-lavender-50"
      >
        <strong>Sources</strong>
        <span className="text-vv-body">
          · {on} of {list.length} connected
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {list.map((s) => (
            <span key={s.name} className={`h-2 w-2 rounded-full ${DOT[s.state]}`} />
          ))}
        </span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 text-vv-body transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id="ov-sources"
          role="dialog"
          aria-label="Sources"
          className="absolute left-0 top-full z-30 mt-2 flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 rounded-[20px] border border-solid border-vv-line bg-vv-surface p-4 shadow-[0_24px_48px_-24px_rgba(42,28,110,0.45)]"
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {list.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5 border-0 border-t border-solid border-vv-line py-2 text-[13px] first:border-t-0 first:pt-0">
                <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-full ${DOT[s.state]}`} />
                <strong className="w-[112px] flex-none">{s.name}</strong>
                <span className="min-w-0 text-vv-body">{s.note}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-vv-lavender-50 p-3 text-[12px]">
            <span className="font-bold uppercase tracking-[0.05em] text-vv-body">Google properties</span>
            {link && (link.gscProperty || link.ga4Property) ? (
              <>
                <span className="break-all">
                  Search Console: <strong>{link.gscProperty ?? '—'}</strong>
                </span>
                <span className="break-all">
                  GA4: <strong>{link.ga4Property ?? '—'}</strong>
                </span>
              </>
            ) : (
              <span className="text-vv-body">Not connected yet.</span>
            )}
            <button
              type="button"
              className={`${link ? BTN_LINK : BTN_GHOST} min-h-8 self-start text-[13px]`}
              onClick={() => {
                setOpen(false)
                onChangeGoogle()
              }}
            >
              {link ? 'Change' : 'Connect Search Console + GA4'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
