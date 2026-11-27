import { useState } from 'react'
import { useReport, useRefreshReport, useReportActions, useReportStatus } from '../../hooks/useReports'
import { agencyDate } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { CHANGE_TONE, changeOf, fmtMetric, REPORT_ROWS, shortDates, SOURCE_NAME } from '../../lib/baseline'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, PILL } from '../../lib/ui'
import type { Report, ReportAction, ReportActionKind } from '../../types/seo'
import { LilacTable } from '../overview/OverviewParts'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Bone, Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'
import ReportNotes from './ReportNotes'

// Results › one monthly report: the month's frozen numbers vs the baseline copy it was made with, Draft / Sent, refresh
// (draft only), up to 3 next actions, and the notes (Claude drafts, Angel approves: ReportNotes).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
/** Saved-at dates in the agency's time zone (Asia/Manila). */
const savedOn = agencyDate
const todayIso = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const KIND_LABEL: Record<ReportActionKind, string> = { page: 'Page', gbp: 'GBP', links: 'Links', tracking: 'Tracking', other: 'Other' }

export default function ReportView({ siteId, id, onClose }: { siteId: string; id: string; onClose: () => void }) {
  const q = useReport(siteId, id)
  if (q.isPending) return <Bone className="h-[420px] w-full rounded-[24px]" />
  if (q.isError || !q.data)
    return (
      <section className={`${CARD} !rounded-[24px]`}>
        <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the report.')}</p>
        <button type="button" className={`${BTN_LINK} self-start`} onClick={onClose}>
          Close
        </button>
      </section>
    )
  return <Loaded siteId={siteId} r={q.data} onClose={onClose} />
}

function Loaded({ siteId, r, onClose }: { siteId: string; r: Report; onClose: () => void }) {
  const refresh = useRefreshReport(siteId)
  const status = useReportStatus(siteId)
  const [sending, setSending] = useState(false)
  const [reopen, setReopen] = useState(false)
  const n = r.numbers
  const sent = r.status === 'sent'
  const rows = REPORT_ROWS.filter((x) => n.sources.includes(x.source))
  const since = n.baseline.label ?? 'the baseline'
  const cell = (v: number | null | undefined, kind: (typeof rows)[number]['kind'], dates: string, strong = false) => (
    <span className="flex flex-col items-end leading-tight">
      <span className={strong ? 'font-semibold' : ''}>{fmtMetric(kind, v)}</span>
      {dates && <span className="whitespace-nowrap text-[11px] text-vv-muted">{dates}</span>}
    </span>
  )
  return (
    <section className={`${CARD} !gap-4 !rounded-[24px]`} aria-labelledby="report-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="report-title" className="m-0 font-display text-[26px] font-semibold leading-tight">
              {r.title}
            </h2>
            <span className={`${PILL} ${sent ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>{sent && r.sentOn ? `Sent · ${savedOn(r.sentOn)}` : 'Draft'}</span>
          </div>
          <span className="text-[13px] text-vv-body">{r.dates ? `Search Console ${r.dates}` : 'No Search Console window'}</span>
          <span className="text-[12px] text-vv-muted">
            vs {since} (saved {savedOn(n.baseline.savedAt)}) · numbers frozen {savedOn(n.frozenAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!sent && (
            <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[13px]`} onClick={() => refresh.mutate(r.id)} disabled={refresh.isPending}>
              {refresh.isPending && <Spinner />}
              Refresh numbers
            </button>
          )}
          {sent ? (
            <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[13px]`} onClick={() => {
                status.reset()
                setReopen(true)
              }}>
              Reopen as draft
            </button>
          ) : (
            <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => {
                status.reset()
                setSending(true)
              }}>
              Mark as sent
            </button>
          )}
          <button type="button" className={`${BTN_LINK} px-2`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {refresh.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(refresh.error, 'Couldn’t refresh the numbers.')}</p>}

      <div className="overflow-hidden rounded-2xl border border-solid border-vv-line">
        <LilacTable
          head={['Metric', 'Source', 'Baseline', 'This month', 'Change']}
          right={[2, 3, 4]}
          rows={rows.map((x) => {
            const b = n.baseline.snapshots.find((s) => s.source === x.source)
            const m = n.snapshots.find((s) => s.source === x.source)
            const ch = changeOf(x, b?.values[x.metric], m?.values[x.metric])
            return [
              <strong key="m" title={x.lowerIsBetter ? 'Lower is better' : undefined}>
                {x.label}
              </strong>,
              <span key="s" className="text-vv-body">
                {SOURCE_NAME[x.source]}
              </span>,
              cell(b?.values[x.metric], x.kind, b ? shortDates(b) : 'not in baseline'),
              cell(m?.values[x.metric], x.kind, m ? shortDates(m) : 'nothing this month', true),
              ch.tone === 'none' ? (
                <span key="c" className={CHANGE_TONE.none}>
                  —
                </span>
              ) : (
                <span key="c" className={`${PILL} !px-2.5 !py-0.5 ${CHANGE_TONE[ch.tone]}`}>
                  {ch.text}
                </span>
              ),
            ]
          })}
        />
      </div>
      {n.missing.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">
          {n.missing.map((m) => (
            <li key={m.source}>
              <strong>{SOURCE_NAME[m.source]}:</strong> {m.reason}
            </li>
          ))}
        </ul>
      )}

      {sent ? <ActionsReadOnly r={r} /> : <Actions siteId={siteId} r={r} />}

      <ReportNotes siteId={siteId} r={r} />

      <Modal open={sending} title={`Mark the ${r.title} as sent`} onClose={() => !status.isPending && setSending(false)}>
        {sending && <SendForm r={r} busy={status.isPending} error={status.error} onCancel={() => setSending(false)} onSend={(d) => status.mutate({ id: r.id, status: 'sent', sentOn: d }, { onSuccess: () => setSending(false) })} />}
      </Modal>
      <ConfirmDialog
        open={reopen}
        title="Reopen as draft?"
        body={
          <>
            The sent date is cleared and you can change the numbers, next actions and notes again. Mark it as sent when you send the update.
            {status.error && <span className="mt-2 block font-semibold text-vv-red">{errText(status.error, 'Couldn’t reopen it.')}</span>}
          </>
        }
        confirmLabel="Reopen"
        busy={status.isPending}
        onCancel={() => setReopen(false)}
        onConfirm={() => status.mutate({ id: r.id, status: 'draft' }, { onSuccess: () => setReopen(false) })}
      />
    </section>
  )
}

function SendForm({ r, busy, error, onCancel, onSend }: { r: Report; busy: boolean; error: unknown; onCancel: () => void; onSend: (date: string) => void }) {
  const [d, setD] = useState(todayIso())
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSend(d)
      }}
    >
      <p className="m-0 text-[13px] text-vv-body">A sent report is read-only: its numbers, next actions and notes stay as they are until you reopen it as a draft.</p>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-vv-body">
        Sent on
        <input className={FIELD} type="date" value={d} min={r.month} max={todayIso()} onChange={(e) => setD(e.target.value)} required />
      </label>
      {error !== null && error !== undefined && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-vv-red">
          {errText(error, 'Couldn’t mark it as sent.')}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={BTN_LIME} disabled={busy || !d}>
          {busy && <Spinner />}
          Mark as sent
        </button>
      </div>
    </form>
  )
}

type Draft = Omit<ReportAction, 'id'>
const blank = (): Draft => ({ kind: 'page', body: '', owner: null, due: null, done: false })

const KIND_TONE = 'bg-vv-lavender-100 text-vv-purple-ink'

/** A sent report's next actions: read-only until the report is reopened as a draft. */
function ActionsReadOnly({ r }: { r: Report }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-vv-body">Next actions</h3>
      {r.actions.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">No next actions were set for this report.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {r.actions.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-vv-lavender-50 px-3 py-2 text-[13px]">
              <span className={`${PILL} !px-2 !py-0.5 !text-[11px] ${a.done ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>{a.done ? 'Done' : 'To do'}</span>
              <span className={`${PILL} !px-2 !py-0.5 !text-[11px] ${KIND_TONE}`}>{KIND_LABEL[a.kind]}</span>
              <span className={`min-w-0 flex-1 ${a.done ? 'line-through opacity-70' : ''}`}>{a.body}</span>
              <span className="text-[12px] text-vv-body">{[a.owner, a.due ? `due ${savedOn(a.due)}` : null].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Up to 3 next actions. Edit freely, then Save; "done" ticks save straight away. */
function Actions({ siteId, r }: { siteId: string; r: Report }) {
  const save = useReportActions(siteId)
  const start = r.actions.map(({ kind, body, owner, due, done }) => ({ kind, body, owner, due, done }))
  const [list, setList] = useState<Draft[]>(start)
  const [baseKey, setBaseKey] = useState(JSON.stringify(start))
  // Keep in step with the server copy after a save / refresh (only when nothing is being edited).
  const serverKey = JSON.stringify(start)
  if (serverKey !== baseKey && JSON.stringify(list) === baseKey) {
    setBaseKey(serverKey)
    setList(start)
  }
  const dirty = JSON.stringify(list) !== baseKey
  const set = (i: number, patch: Partial<Draft>) => setList(list.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const valid = list.every((a) => a.body.trim())
  const persist = (next: Draft[]) => save.mutate({ id: r.id, actions: next }, { onSuccess: (rep) => setBaseKey(JSON.stringify(rep.actions.map(({ kind, body, owner, due, done }) => ({ kind, body, owner, due, done })))) })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-vv-body">Next actions ({list.length} of 3)</h3>
        {list.length < 3 && (
          <button type="button" className={`${BTN_LINK} min-h-8 text-[13px]`} onClick={() => setList([...list, blank()])}>
            + Add an action
          </button>
        )}
      </div>
      {list.length === 0 && <p className="m-0 text-[13px] text-vv-body">No next actions yet. Up to 3: what the team does in the next 30 days.</p>}
      {list.map((a, i) => (
        <div key={i} className="grid grid-cols-[auto_110px_minmax(0,1fr)_120px_150px_auto] items-center gap-2 rounded-xl bg-vv-lavender-50 p-2 [@media(max-width:900px)]:grid-cols-[auto_minmax(0,1fr)]">
          <input
            type="checkbox"
            aria-label={`Action ${i + 1} done`}
            checked={a.done}
            className="h-5 w-5 accent-vv-purple"
            onChange={(e) => {
              const next = list.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x))
              setList(next)
              if (!dirty && a.body.trim()) persist(next)
            }}
          />
          <select aria-label={`Action ${i + 1} type`} className={`${FIELD} !py-2 !text-[13px]`} value={a.kind} onChange={(e) => set(i, { kind: e.target.value as ReportActionKind })}>
            {(Object.keys(KIND_LABEL) as ReportActionKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input aria-label={`Action ${i + 1}`} className={`${FIELD} !py-2 !text-[13px] ${a.done ? 'line-through opacity-70' : ''}`} value={a.body} maxLength={300} placeholder="What needs doing" onChange={(e) => set(i, { body: e.target.value })} />
          <input aria-label={`Action ${i + 1} owner`} className={`${FIELD} !py-2 !text-[13px]`} value={a.owner ?? ''} maxLength={60} placeholder="Owner" onChange={(e) => set(i, { owner: e.target.value || null })} />
          <input aria-label={`Action ${i + 1} due`} type="date" className={`${FIELD} !py-2 !text-[13px]`} value={a.due ?? ''} onChange={(e) => set(i, { due: e.target.value || null })} />
          <button type="button" className={`${BTN_LINK} min-h-8 px-1 text-[12px] !text-vv-red`} onClick={() => setList(list.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      {dirty && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!valid && <span className="text-[12px] font-semibold text-vv-orange-ink">Each action needs a line of text.</span>}
          <button type="button" className={`${BTN_LINK} px-3`} onClick={() => setList(JSON.parse(baseKey) as Draft[])} disabled={save.isPending}>
            Undo changes
          </button>
          <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => persist(list)} disabled={save.isPending || !valid}>
            {save.isPending && <Spinner />}
            Save actions
          </button>
        </div>
      )}
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the actions.')}</p>}
    </div>
  )
}
