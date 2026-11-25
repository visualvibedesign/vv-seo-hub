import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Dash, LilacTable, PageHead, Panel, Soon, Tile } from '../components/overview/OverviewParts'
import { Bone, Spinner } from '../components/ui/Loading'
import { useClients } from '../hooks/useClients'
import { useAddIndustry, useIndustries, useRenameIndustry } from '../hooks/useIndustries'
import { AI_TASKS, formatUsd } from '../lib/aiModels'
import { ApiError, getAiUsage } from '../lib/api'
import { clientPath, TAB_COMING } from '../lib/clientSetup'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, PILL } from '../lib/ui'
import type { Industry } from '../types/seo'

// Settings (/settings): for the whole hub. Industries (the list the Add client wizard and Templates use), Claude usage
// (calls and estimated cost per client, month and task, from seo_ai_log; read only) and Automation (phase 5).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e ? fallback : '')

export default function SettingsPage() {
  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          SEO Hub
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">Settings</strong>
      </span>
      <PageHead lead="Settings," accent="for the whole hub." sub="Industries, what the Claude calls cost, and automation." />
      <Usage />
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        <Industries />
        <Panel title="Automation" right={<Soon>Phase 5</Soon>} dashed>
          <p className="m-0 text-[13px] leading-relaxed text-vv-body">{TAB_COMING.automation}</p>
        </Panel>
      </div>
    </>
  )
}

// ---- Claude usage ----------------------------------------------------------------------------------------------

/** "day2.matrix" → "3×3 matrix", "day1.notes" → "Day 1 from notes" (any part that is a task name). */
const taskLabel = (task: string) => {
  const k = task.split('.').reverse().find((p) => p in AI_TASKS) as keyof typeof AI_TASKS | undefined
  return k ? AI_TASKS[k].label : task
}
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const num = (n: number) => n.toLocaleString('en-US')

function Usage() {
  const q = useQuery({ queryKey: ['ai-usage'], queryFn: getAiUsage, select: (d) => d.usage })
  if (q.isPending) return <Bone className="h-[260px] w-full rounded-[20px]" />
  if (q.isError) return <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the Claude usage.')}</p>
  const u = q.data
  const now = u.months.find((m) => m.month === u.thisMonth)
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Tile label="This month" value={now ? formatUsd(now.costUsd) : '$0.00'} note={`${monthLabel(u.thisMonth)} · estimated`} tone="purple" />
        <Tile label="Calls this month" value={num(now?.calls ?? 0)} note={now?.failed ? `${now.failed} failed (still logged)` : 'None failed'} tone="pink" />
        <Tile label="All time" value={formatUsd(u.total.costUsd)} note={`${num(u.total.calls)} calls`} tone="green" />
        <Tile label="Tokens all time" value={num(u.total.inputTokens + u.total.outputTokens)} note={`${num(u.total.inputTokens)} in · ${num(u.total.outputTokens)} out`} tone="orange" />
      </div>
      <Panel flush title="Claude usage per client" sub="Estimated at call time from the token counts. Anthropic’s bill is the source of truth.">
        {u.clients.length === 0 ? (
          <p className="m-0 px-5 pb-5 text-[13px] text-vv-body">No Claude calls yet.</p>
        ) : (
          <LilacTable
            head={['Client', 'Calls this month', 'This month', 'All time', 'Last call']}
            right={[1, 2, 3]}
            minWidth={620}
            rows={u.clients.map((c) => [
              c.siteId ? (
                <Link key="n" to={clientPath(c.siteId)} className="font-semibold text-vv-ink">
                  {c.name}
                </Link>
              ) : (
                <span key="n" className="text-vv-muted">
                  {c.name}
                </span>
              ),
              c.month.calls ? num(c.month.calls) : <Dash key="c" />,
              c.month.calls ? formatUsd(c.month.costUsd) : <Dash key="m" />,
              <strong key="a">{formatUsd(c.all.costUsd)}</strong>,
              new Date(c.lastAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            ])}
          />
        )}
      </Panel>
      <div className="grid grid-cols-2 items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Panel flush title="Per month">
          <LilacTable
            head={['Month', 'Calls', 'Failed', 'Cost']}
            right={[1, 2, 3]}
            minWidth={360}
            rows={u.months.length ? u.months.map((m) => [monthLabel(m.month), num(m.calls), m.failed ? num(m.failed) : <Dash key="f" />, <strong key="c">{formatUsd(m.costUsd)}</strong>]) : [[<span key="n" className="text-vv-muted">No calls yet</span>, '', '', '']]}
          />
        </Panel>
        <Panel flush title="Per task">
          <LilacTable
            head={['Task', 'Calls', 'Cost']}
            right={[1, 2]}
            minWidth={320}
            rows={u.tasks.length ? u.tasks.map((t) => [taskLabel(t.task), num(t.calls), <strong key="c">{formatUsd(t.costUsd)}</strong>]) : [[<span key="n" className="text-vv-muted">No calls yet</span>, '', '']]}
          />
        </Panel>
      </div>
    </>
  )
}

// ---- Industries ------------------------------------------------------------------------------------------------

function Industries() {
  const q = useIndustries()
  const clients = useClients().data ?? []
  const add = useAddIndustry()
  const [label, setLabel] = useState('')
  const [hint, setHint] = useState('')
  const used = (key: string) => clients.filter((c) => c.industry === key).length
  return (
    <Panel title="Industries" sub="Used by Add client and Templates. A label only: rules always run on each client’s own services, areas and words.">
      <form
        className="flex flex-wrap items-end gap-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return
          add.mutate({ label: label.trim(), hint: hint.trim() }, { onSuccess: () => (setLabel(''), setHint('')) })
        }}
      >
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[13px] font-semibold text-vv-body">
          New industry
          <input className={`${FIELD} min-h-10 py-1.5 text-[14px]`} value={label} maxLength={60} placeholder="e.g. Dental clinic" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex min-w-[180px] flex-[2] flex-col gap-1 text-[13px] font-semibold text-vv-body">
          Hint (optional)
          <input className={`${FIELD} min-h-10 py-1.5 text-[14px]`} value={hint} maxLength={200} placeholder="e.g. dentists, orthodontists" onChange={(e) => setHint(e.target.value)} />
        </label>
        <button type="submit" className={`${BTN_LIME} min-h-10 px-5 text-[14px]`} disabled={add.isPending || !label.trim()}>
          {add.isPending && <Spinner />}
          Add
        </button>
        {add.error && <span className="w-full text-[13px] font-semibold text-vv-red">{errText(add.error, 'Couldn’t add it.')}</span>}
      </form>
      {q.isPending && <Spinner />}
      <ul className="m-0 flex list-none flex-col p-0">
        {(q.data ?? []).map((i) => (
          <IndustryRow key={i.key} industry={i} used={used(i.key)} />
        ))}
      </ul>
      <p className="m-0 text-[12px] text-vv-muted">Renaming keeps every client and template on it. Industries aren’t deleted here (clients may use them).</p>
    </Panel>
  )
}

function IndustryRow({ industry: i, used }: { industry: Industry; used: number }) {
  const rename = useRenameIndustry()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(i.label)
  const [hint, setHint] = useState(i.hint ?? '')
  if (editing)
    return (
      <li className="flex flex-col gap-2 border-0 border-t border-solid border-vv-line py-3 first:border-t-0">
        <div className="flex flex-wrap gap-2">
          <input aria-label="Industry name" className={`${FIELD} min-h-10 flex-1 py-1.5 text-[14px]`} value={label} maxLength={60} autoFocus onChange={(e) => setLabel(e.target.value)} />
          <input aria-label="Hint" className={`${FIELD} min-h-10 flex-[2] py-1.5 text-[14px]`} value={hint} maxLength={200} placeholder="Hint (optional)" onChange={(e) => setHint(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`}
            disabled={rename.isPending || !label.trim()}
            onClick={() => rename.mutate({ key: i.key, label: label.trim(), hint: hint.trim() }, { onSuccess: () => setEditing(false) })}
          >
            {rename.isPending && <Spinner />}
            Save
          </button>
          <button type="button" className={`${BTN_LINK} text-[13px]`} onClick={() => (setEditing(false), setLabel(i.label), setHint(i.hint ?? ''))}>
            Cancel
          </button>
          {rename.error && <span className="text-[13px] font-semibold text-vv-red">{errText(rename.error, 'Couldn’t save.')}</span>}
        </div>
      </li>
    )
  return (
    <li className="flex items-center gap-3 border-0 border-t border-solid border-vv-line py-2.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">
          {i.label}
          {i.builtIn && <span className={`${PILL} ml-2 !px-2 !py-0 align-middle !text-[11px] bg-vv-st-todo text-vv-st-todo-ink`}>Built in</span>}
        </span>
        {i.hint && <span className="truncate text-[12px] text-vv-body">{i.hint}</span>}
      </span>
      <span className="flex-none text-[12px] text-vv-body">{used === 1 ? '1 client' : `${used} clients`}</span>
      <button type="button" className={`${BTN_LINK} min-h-8 text-[13px]`} onClick={() => setEditing(true)}>
        Rename
      </button>
    </li>
  )
}
