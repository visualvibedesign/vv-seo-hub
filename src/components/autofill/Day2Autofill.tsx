import { useState } from 'react'
import { Spinner } from '../ui/Loading'
import { useAutofill, useDecide, useEstimateAi, useRunAi, useRunRules } from '../../hooks/useAutofill'
import { formatUsd, type AiTask } from '../../lib/aiModels'
import type { AiEstimate } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { ROLE_LABEL, ROLE_PILL } from '../../lib/keywordUi'
import { BTN_GHOST, BTN_LIME, CARD, PILL } from '../../lib/ui'
import type { AutofillDecision, AutofillItem, AutofillRow, ClientDetail, KeywordRole } from '../../types/seo'

// "2 · What Claude filled" for Day 2 (design docs/design/Autofill.png). Step 6b: plain-code rules for roles and
// services. Each suggestion names its rule; "needs a look" = two rules disagree (pick one or reject). Approving
// applies only to keywords that still have no role / service. Intent, 3×3 matrix and clusters come with Claude (6c).

const CLAUDE_LATER = [
  { title: '3×3 matrix', what: 'Suggested primary + backups per cell, from volume and fit' },
  { title: 'Clusters', what: 'Pages drafted, no keyword on two pages' },
]

export default function Day2Autofill({ client: c }: { client: ClientDetail }) {
  const q = useAutofill(c.siteId)
  const run = useRunRules(c.siteId)
  const decide = useDecide(c.siteId)
  const [open, setOpen] = useState<'roles' | 'services' | 'intent' | null>(null)
  const rows = q.data ?? []
  const roles = rows.find((r) => r.kind === 'roles')
  const services = rows.find((r) => r.kind === 'services')
  const intent = rows.find((r) => r.kind === 'intent')
  const svcName = new Map(c.categories.flatMap((k) => k.services.map((s) => [s.id, s.name] as const)))
  const label = (kind: 'roles' | 'services', v: string) => (kind === 'roles' ? ROLE_LABEL[v as KeywordRole] : (svcName.get(v) ?? 'Removed service'))

  // Approve all = every single-option row still open, in both suggestions ("needs a look" rows stay open).
  const openSingles = (r?: AutofillRow) => (r?.status === 'ready' ? r.items.filter((i) => !i.decision && i.options.length === 1) : [])
  const allCount = openSingles(roles).length + openSingles(services).length + openSingles(intent).length
  const approveAll = async () => {
    for (const r of [roles, services, intent]) {
      const list = openSingles(r)
      if (r && list.length) await decide.mutateAsync({ autofillId: r.id, decisions: list.map((i) => ({ keywordId: i.keywordId, action: 'approve' })) })
    }
  }
  const err = (e: unknown) => (e ? (e instanceof ApiError && e.detail ? e.detail : 'Couldn’t save. Try again.') : '')
  const error = err(run.error) || err(decide.error)

  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="filled-h">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h2 id="filled-h" className="m-0 font-display text-[26px] font-semibold phone:text-[21px]">
          2 · What Claude filled
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN_GHOST} min-h-10`} onClick={() => run.mutate()} disabled={run.isPending || decide.isPending}>
            {run.isPending && <Spinner />}
            {roles || services ? 'Run rules again' : 'Run rules'}
          </button>
          <button type="button" className={`${BTN_LIME} min-h-10`} onClick={() => void approveAll()} disabled={!allCount || decide.isPending || run.isPending}>
            {decide.isPending && <Spinner />}
            Approve all{allCount ? ` (${allCount})` : ''}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="m-0 mb-2 rounded-xl bg-vv-red-100 px-3 py-2 text-[14px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        <KindRow title="Roles" what="Secondary · FAQ · Near me, by plain rules (never Primary)" row={roles} open={open === 'roles'} onToggle={() => setOpen(open === 'roles' ? null : 'roles')} loading={q.isPending} />
        {open === 'roles' && roles && <Review row={roles} label={(v) => label('roles', v)} pill={(v) => ROLE_PILL[v as KeywordRole]} onDecide={(d) => decide.mutate({ autofillId: roles.id, decisions: d })} busy={decide.isPending} />}
        <KindRow title="Services" what="Each keyword matched to one of the client’s services" row={services} open={open === 'services'} onToggle={() => setOpen(open === 'services' ? null : 'services')} loading={q.isPending} />
        {open === 'services' && services && <Review row={services} label={(v) => label('services', v)} onDecide={(d) => decide.mutate({ autofillId: services.id, decisions: d })} busy={decide.isPending} />}
        <KindRow title="Intent" what="Informational · Navigational · Commercial · Transactional, only where Semrush left it empty" row={intent} open={open === 'intent'} onToggle={() => setOpen(open === 'intent' ? null : 'intent')} loading={q.isPending} />
        <AiRun siteId={c.siteId} task="intent" hasRow={!!intent} />
        {open === 'intent' && intent && <Review row={intent} label={(v) => v} onDecide={(d) => decide.mutate({ autofillId: intent.id, decisions: d })} busy={decide.isPending} />}
        {CLAUDE_LATER.map((f) => (
          <li key={f.title} className="flex items-center justify-between gap-3 border-0 border-t border-solid border-vv-line py-3.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-semibold text-vv-ink">{f.title}</span>
              <span className="text-[14px] text-vv-body">{f.what}</span>
            </span>
            <span className={`${PILL} flex-none bg-vv-st-todo text-vv-st-todo-ink`}>Claude · step 6c</span>
          </li>
        ))}
      </ul>
      <p className="m-0 border-0 border-t border-solid border-vv-line pt-3.5 text-[14px] text-vv-body">
        Rules only suggest. Nothing changes until you approve, and approving never overwrites a role or service you already set.
      </p>
    </section>
  )
}

function KindRow({ title, what, row, open, onToggle, loading }: { title: string; what: string; row?: AutofillRow; open: boolean; onToggle: () => void; loading: boolean }) {
  const openCount = row?.items.filter((i) => !i.decision).length ?? 0
  const status = !row
    ? { cls: 'bg-vv-st-todo text-vv-st-todo-ink', text: loading ? '…' : 'Not run yet' }
    : row.status === 'ready' && openCount
      ? { cls: 'bg-vv-lavender-100 text-vv-purple-ink', text: 'Ready to review' }
      : { cls: 'bg-vv-green-100 text-vv-green-ink', text: `Done · ${row.appliedCount ?? 0} applied` }
  return (
    <li className="flex items-center justify-between gap-3 border-0 border-t border-solid border-vv-line py-3.5">
      <span className="flex min-w-0 flex-col">
        <span className="text-[16px] font-semibold text-vv-ink">{title}</span>
        <span className="text-[14px] text-vv-body">{row ? row.summary : what}</span>
      </span>
      <span className="flex flex-none items-center gap-2">
        <span className={`${PILL} ${status.cls}`}>{status.text}</span>
        {row && row.items.length > 0 && (
          <button type="button" aria-expanded={open} onClick={onToggle} className={`${BTN_GHOST} min-h-10 px-4`}>
            {open ? 'Close' : 'Review'}
          </button>
        )}
      </span>
    </li>
  )
}

function Review({ row, label, pill, onDecide, busy }: { row: AutofillRow; label: (v: string) => string; pill?: (v: string) => string; onDecide: (d: AutofillDecision[]) => void; busy: boolean }) {
  const [only, setOnly] = useState<'open' | 'all'>('open')
  const items = row.items.filter((i) => only === 'all' || !i.decision)
  const looks = row.items.filter((i) => !i.decision && i.options.length > 1).length
  const closed = row.status !== 'ready'
  return (
    <li className="mb-2 flex flex-col gap-2 rounded-2xl border border-solid border-vv-line bg-vv-lavender-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-vv-body">
        <span>
          {row.items.filter((i) => !i.decision).length} open{looks ? ` · ${looks} need a look` : ''} · {row.items.filter((i) => i.decision === 'approved').length} approved ·{' '}
          {row.items.filter((i) => i.decision === 'rejected').length} rejected{row.items.some((i) => i.decision === 'skipped') ? ` · ${row.items.filter((i) => i.decision === 'skipped').length} skipped (already set)` : ''}
        </span>
        <button type="button" className="border-0 bg-transparent p-0 text-[13px] font-semibold text-vv-purple-deep underline" onClick={() => setOnly(only === 'open' ? 'all' : 'open')}>
          {only === 'open' ? 'Show decided too' : 'Show open only'}
        </button>
      </div>
      {items.length === 0 && <p className="m-0 px-1 py-2 text-[14px] text-vv-body">Nothing open here.</p>}
      <ul className="m-0 flex max-h-[420px] list-none flex-col gap-1.5 overflow-y-auto p-0">
        {items.map((i) => (
          <ItemRow key={i.keywordId} item={i} label={label} pill={pill} busy={busy || closed} onDecide={onDecide} />
        ))}
      </ul>
    </li>
  )
}

function ItemRow({ item: i, label, pill, busy, onDecide }: { item: AutofillItem; label: (v: string) => string; pill?: (v: string) => string; busy: boolean; onDecide: (d: AutofillDecision[]) => void }) {
  const look = i.options.length > 1
  const tag = (v: string) => <span className={pill ? pill(v) : `${PILL} bg-vv-surface text-vv-ink`}>{label(v)}</span>
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-[15px] font-semibold text-vv-ink">{i.keyword}</span>
        {i.decision ? (
          <span className={`${PILL} ${i.decision === 'approved' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>
            {i.decision === 'approved' ? `Approved · ${label(i.applied ?? '')}` : i.decision === 'skipped' ? 'Skipped · already set' : 'Rejected'}
          </span>
        ) : look ? (
          <span className={`${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`}>Needs a look</span>
        ) : null}
      </div>
      {!i.decision &&
        (look ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {i.options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={busy}
                onClick={() => onDecide([{ keywordId: i.keywordId, action: 'approve', value: o.value }])}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-solid border-vv-field-line bg-vv-surface px-3 font-body text-[13px] font-semibold text-vv-ink hover:bg-vv-lavender-50"
              >
                Use {label(o.value)} <span className="font-normal text-vv-body">({o.rule})</span>
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'reject' }])} className={`${BTN_GHOST} min-h-9 px-3 text-[13px]`}>
              Reject
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-vv-body">
              {tag(i.options[0].value)} {i.options[0].rule}
            </span>
            <span className="flex gap-1.5">
              <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'approve' }])} className={`${BTN_LIME} min-h-9 px-4 text-[13px]`}>
                Approve
              </button>
              <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'reject' }])} className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`}>
                Reject
              </button>
            </span>
          </div>
        ))}
    </li>
  )
}

/** Claude run: Estimate (free) → shows keywords, model, tokens, cost → Run with Claude (only on click). */
function AiRun({ siteId, task, hasRow }: { siteId: string; task: AiTask; hasRow: boolean }) {
  const est = useEstimateAi(siteId)
  const run = useRunAi(siteId)
  const [shown, setShown] = useState<AiEstimate | null>(null)
  const err = (e: unknown) => (e ? (e instanceof ApiError && e.detail ? e.detail : 'Something went wrong. Nothing was saved.') : '')
  const error = err(est.error) || err(run.error)
  return (
    <li className="-mt-1 flex flex-col gap-2 pb-3.5">
      {!shown ? (
        <button
          type="button"
          className="self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-vv-purple-deep underline"
          disabled={est.isPending}
          onClick={() => est.mutate(task, { onSuccess: setShown })}
        >
          {est.isPending ? 'Counting…' : hasRow ? 'Run with Claude again: see the cost first' : 'Run with Claude: see the cost first'}
        </button>
      ) : shown.empty ? (
        <span className="text-[14px] text-vv-body">Nothing to send: every keyword already has one.</span>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-solid border-vv-line bg-vv-lavender-50 p-3 text-[14px] text-vv-ink">
          <span>
            <strong>{shown.items}</strong> keyword{shown.items === 1 ? '' : 's'} · {shown.model} · ~{(shown.inputTokens + shown.outputTokens).toLocaleString('en-US')} tokens · about <strong>{formatUsd(shown.costUsd)}</strong>
          </span>
          <span className="text-[13px] text-vv-body">Sends only the keyword text. Results wait here as Ready to review; nothing changes until you approve.</span>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={`${BTN_LIME} min-h-10`} disabled={run.isPending} onClick={() => run.mutate(task, { onSuccess: () => setShown(null) })}>
              {run.isPending && <Spinner />}
              Run with Claude
            </button>
            <button type="button" className={`${BTN_GHOST} min-h-10`} disabled={run.isPending} onClick={() => setShown(null)}>
              Cancel
            </button>
          </span>
        </div>
      )}
      {error && <span className="text-[13px] font-semibold text-vv-red">{error}</span>}
    </li>
  )
}
