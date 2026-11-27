import type { ReactNode } from 'react'
import { useGuide, useGuideChange } from '../../hooks/useGuide'
import { ApiError } from '../../lib/api'
import { GUIDE } from '../../lib/guide'
import { TONE, type Tone } from '../../lib/tones'
import { BTN_GHOST, BTN_LIME, CARD, PILL } from '../../lib/ui'
import HeaderTools from '../layout/HeaderTools'
import { Bone, Spinner } from '../ui/Loading'

// Shared pieces for the client Overview area (designs: docs/design/overview/*.dc.html): Fraunces page headline with
// a purple italic part, pastel tiles, white panels, lilac table headers, and the Day 3 / Day 10 checklist.
// Numbers are never faked: a value we don't have yet is "—" with the phase it comes in.

/** "Baseline, where we started." + a line under it + tools on the right. */
export function PageHead({ lead, accent, sub, children }: { lead: string; accent: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2">
        <h1 className="m-0 font-display text-[44px] font-semibold leading-[1.1] tracking-[-0.02em] phone:text-[34px] phone-sm:text-[30px]">
          {lead} <em className="font-medium text-vv-purple">{accent}</em>
        </h1>
        <div className="text-[15px] leading-normal text-vv-body">{sub}</div>
      </div>
      <HeaderTools>{children}</HeaderTools>
    </header>
  )
}

/** Pastel tile: label, big value ("—" until we have it), a note. */
export function Tile({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone: Tone }) {
  const t = TONE[tone]
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-[24px] px-[22px] py-5 ${t.bg}`}>
      <span className={`text-[12px] font-bold uppercase tracking-[0.06em] ${t.ink}`}>{label}</span>
      <span className="font-display text-[34px] font-semibold leading-tight text-vv-ink">{value}</span>
      <span className="text-[12px] text-vv-body">{note}</span>
    </div>
  )
}

/** White panel with a Fraunces title, a grey line under it and something on the right. */
export function Panel({ title, sub, right, children, className = '', dashed = false, flush = false }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; dashed?: boolean; flush?: boolean }) {
  return (
    <section className={`${CARD} !rounded-[20px] ${flush ? '!gap-0 !p-0 overflow-hidden' : '!gap-3.5 !p-5'} ${dashed ? '!border-dashed !border-vv-lavender' : ''} ${className}`}>
      <div className={`flex flex-wrap items-start justify-between gap-2 ${flush ? 'px-5 pb-3 pt-[18px]' : ''}`}>
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[20px] font-semibold leading-tight">{title}</h2>
          {sub && <div className="text-[12px] text-vv-body">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

/** A small "Comes in phase 2" / "Later" pill. */
export function Soon({ children }: { children: ReactNode }) {
  return <span className={`${PILL} !px-2.5 !py-0.5 !text-[11px] bg-vv-st-todo text-vv-st-todo-ink`}>{children}</span>
}

/** Table with the lilac header row. Cells are already formatted. */
export function LilacTable({ head, rows, minWidth = 560, right = [] }: { head: string[]; rows: ReactNode[][]; minWidth?: number; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-vv-lavender-50 text-left text-[11px] uppercase tracking-[0.05em] text-vv-purple-ink">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-2.5 font-bold first:pl-5 last:pr-5 ${right.includes(i) ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-0 border-t border-solid border-vv-line">
              {r.map((cell, i) => (
                <td key={i} className={`px-2 py-2.5 first:pl-5 last:pr-5 ${right.includes(i) ? 'text-right' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** "—" in a muted colour: a number we don't have yet (never 0, never a guess). */
export const Dash = () => <span className="text-vv-muted">—</span>

/**
 * The Day 3 (step 2) or Day 10 (step 8) checklist from the guide: same tasks, same saved ticks. Auto tasks tick
 * themselves from the data. "Mark Day 3 done" / "Reopen" like the guide.
 */
export function GuideChecklist({ siteId, step }: { siteId: string; step: number }) {
  const q = useGuide(siteId)
  const change = useGuideChange(siteId)
  const s = GUIDE[step]
  if (q.isPending) return <Bone className="h-[120px] w-full rounded-[20px]" />
  if (q.isError || !q.data) return <p className="m-0 text-[14px] font-semibold text-vv-red">Couldn’t load the checklist. Try again in a moment.</p>
  const st = q.data.steps[step]
  const isDone = (key: string, auto?: boolean) => (auto ? st.autoDone.includes(key) : st.tasksDone.includes(key))
  const ticked = s.tasks.filter((t) => isDone(t.key, t.auto)).length
  const done = st.status === 'done'
  const day = s.day.replace(' + monthly', '')
  const error = change.error ? (change.error instanceof ApiError && change.error.detail ? change.error.detail : 'Couldn’t save. Try again.') : ''
  return (
    <Panel
      title={`${day} checklist`}
      sub={`${ticked} of ${s.tasks.length} ticked · ${s.title}`}
      right={
        done ? (
          <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[13px]`} disabled={change.isPending} onClick={() => change.mutate({ kind: 'step', step, done: false })}>
            {change.isPending && <Spinner />}
            Reopen {day}
          </button>
        ) : (
          <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} disabled={change.isPending} onClick={() => change.mutate({ kind: 'step', step, done: true })}>
            {change.isPending && <Spinner />}
            Mark {day} done ({ticked}/{s.tasks.length})
          </button>
        )
      }
    >
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6 gap-y-1 p-0">
        {s.tasks.map((t) => {
          const on = isDone(t.key, t.auto)
          return (
            <li key={t.key}>
              <label className={`flex min-h-11 items-start gap-2.5 py-1.5 text-[14px] ${t.auto ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 flex-none accent-vv-purple"
                  checked={on}
                  disabled={t.auto || change.isPending}
                  onChange={(e) => change.mutate({ kind: 'task', step, task: t.key, done: e.target.checked })}
                />
                <span className={on ? 'text-vv-muted line-through' : 'text-vv-ink'}>
                  {t.label}
                  {t.auto && <span className={`${PILL} ml-1.5 !px-2 !py-0 align-middle !text-[10px] bg-vv-lavender-100 text-vv-purple-ink no-underline`}>Auto</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && <p className="m-0 text-[13px] font-semibold text-vv-red">{error}</p>}
    </Panel>
  )
}

/** A progress ring: part of a whole, label in the middle. */
export function Ring({ value, max, color, center }: { value: number; max: number; color: string; center: ReactNode }) {
  const r = 26
  const c = 2 * Math.PI * r
  const f = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <span className="relative flex h-[68px] w-[68px] flex-none items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-vv-line" />
        {f > 0 && <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke="currentColor" className={color} strokeDasharray={`${f * c} ${c}`} />}
      </svg>
      <span className="relative text-center text-[13px] font-bold leading-tight">{center}</span>
    </span>
  )
}
