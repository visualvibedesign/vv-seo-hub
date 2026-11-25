import { useState } from 'react'
import { Spinner } from '../ui/Loading'
import { useAutofill, useDecide, useEstimateAi, useRetireStale, useRunAi, useRunRules } from '../../hooks/useAutofill'
import { formatUsd, type AiTask } from '../../lib/aiModels'
import type { AiEstimate } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { ROLE_LABEL, ROLE_PILL, STATUS_LABEL } from '../../lib/keywordUi'
import { BTN_GHOST, BTN_LIME, CARD, PILL } from '../../lib/ui'
import type { AutofillDecision, AutofillItem, AutofillKind, AutofillRow, ClientDetail, KeywordRole, KeywordStatus } from '../../types/seo'

// "2 · What Claude filled" for Day 2 (design docs/design/Autofill.png). Plain-code rules (6b) for roles,
// services and the scope list; Claude (6c-2) for leftover services, intent and the no-rule keywords. Each
// suggestion names its rule; "needs a look" = two rules disagree (pick one or reject). Approving never
// overwrites what's already set. Approve all never touches the scope list, the triage list, or a keyword on them.

/** Kinds Approve all may touch (never scope / triage). */
const BULK: AutofillKind[] = ['roles', 'services', 'services_ai', 'intent']

export default function Day2Autofill({ client: c }: { client: ClientDetail }) {
  const q = useAutofill(c.siteId)
  const run = useRunRules(c.siteId)
  const decide = useDecide(c.siteId)
  const [open, setOpen] = useState<AutofillKind | null>(null)
  const rows = q.data ?? []
  const row = (k: AutofillKind) => rows.find((r) => r.kind === k)
  const svcName = new Map(c.categories.flatMap((k) => k.services.map((s) => [s.id, s.name] as const)))
  const roleLabel = (v: string) => ROLE_LABEL[v as KeywordRole]
  const svcLabel = (v: string) => svcName.get(v) ?? 'Removed service'
  const statusLabel = (v: string) => STATUS_LABEL[v as KeywordStatus] ?? v

  // Keywords on the scope or triage list (open or approved there): no role / service / intent approvals for them.
  const flagged = new Map<string, string>()
  for (const k of ['triage', 'scope'] as const)
    for (const i of row(k)?.items ?? []) if (i.decision !== 'rejected' && i.category) flagged.set(i.keywordId, i.category)

  // Approve all = every single-option row still open in roles / services / intent, minus flagged keywords.
  const openSingles = (r?: AutofillRow) => (r?.status === 'ready' ? r.items.filter((i) => !i.decision && i.options.length === 1 && !flagged.has(i.keywordId)) : [])
  const bulkRows = BULK.map(row)
  const allCount = bulkRows.reduce((n, r) => n + openSingles(r).length, 0)
  const approveAll = async () => {
    for (const r of bulkRows) {
      const list = openSingles(r)
      if (r && list.length) await decide.mutateAsync({ autofillId: r.id, decisions: list.map((i) => ({ keywordId: i.keywordId, action: 'approve' })) })
    }
  }
  const err = (e: unknown) => (e ? (e instanceof ApiError && e.detail ? e.detail : 'Couldn’t save. Try again.') : '')
  const retire = useRetireStale(c.siteId)
  const error = err(run.error) || err(decide.error) || err(retire.error)
  // Open lists that point to keywords removed since (a deleted import): counted first, retired on click.
  const stale = rows.filter((r) => r.status === 'ready' && (r.gone ?? 0) > 0)
  const staleGone = stale.reduce((n, r) => n + (r.gone ?? 0), 0)

  /** One kind: its row, its Review panel when open, and (for Claude kinds) the estimate → run box. */
  const kind = (k: AutofillKind, title: string, what: string, label: (v: string) => string, extra?: { pill?: (v: string) => string; ai?: { task: AiTask; sends: string; empty: string } }) => {
    const r = row(k)
    return (
      <>
        <KindRow title={title} what={what} row={r} open={open === k} onToggle={() => setOpen(open === k ? null : k)} loading={q.isPending} />
        {extra?.ai && <AiRun siteId={c.siteId} task={extra.ai.task} hasRow={!!r} sends={extra.ai.sends} emptyText={extra.ai.empty} />}
        {open === k && r && (
          <Review
            row={r}
            label={label}
            pill={extra?.pill}
            flagged={BULK.includes(k) ? flagged : undefined}
            onDecide={(d) => decide.mutate({ autofillId: r.id, decisions: d })}
            busy={decide.isPending}
          />
        )}
      </>
    )
  }

  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="filled-h">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h2 id="filled-h" className="m-0 font-display text-[26px] font-semibold phone:text-[21px]">
          2 · What Claude filled
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN_GHOST} min-h-10`} onClick={() => run.mutate()} disabled={run.isPending || decide.isPending}>
            {run.isPending && <Spinner />}
            {row('roles') || row('services') ? 'Run rules again' : 'Run rules'}
          </button>
          <button type="button" className={`${BTN_LIME} min-h-10`} onClick={() => void approveAll()} disabled={!allCount || decide.isPending || run.isPending}>
            {decide.isPending && <Spinner />}
            Approve all{allCount ? ` (${allCount})` : ''}
          </button>
        </div>
      </div>
      {stale.length > 0 && (
        <div role="status" className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-vv-orange-100 px-3 py-2 text-[14px] text-vv-orange-ink">
          <span>
            {stale.length} open list{stale.length === 1 ? '' : 's'} ({stale.map((r) => r.kind.replace('_', ' ')).join(', ')}) point to <strong>{staleGone.toLocaleString('en-US')}</strong> keywords that were removed since. They’re left out of the counts and Approve skips them. Retire these lists (kept, marked replaced), then run again for fresh ones.
          </span>
          <button type="button" className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`} disabled={retire.isPending} onClick={() => retire.mutate()}>
            {retire.isPending && <Spinner />}
            Retire {stale.length} list{stale.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 mb-2 rounded-xl bg-vv-red-100 px-3 py-2 text-[14px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {kind('scope', 'Out of scope & neighbourhoods', 'Keywords with a scope word from Edit client: out of scope → Rejected, neighbourhood → Later', statusLabel)}
        {kind('roles', 'Roles', 'Secondary · FAQ · Near me, by plain rules (never Primary)', roleLabel, { pill: (v) => ROLE_PILL[v as KeywordRole] })}
        {kind('services', 'Services', 'Each keyword matched to one of the client’s services', svcLabel)}
        {kind('triage', 'No-rule keywords · Claude', 'Competitor brand or off-topic → Rejected, neighbourhood → Later. Keywords that fit are left as they are', statusLabel, {
          ai: { task: 'triage', sends: 'Sends only the keyword text, volumes, service names and area names.', empty: 'Nothing to send: every keyword has a role or a rule.' },
        })}
        {kind('services_ai', 'Leftover services · Claude', 'Keywords the rules couldn’t match to a service (run No-rule keywords first)', svcLabel, {
          ai: { task: 'services', sends: 'Sends only the keyword text, volumes and the client’s service names.', empty: 'Nothing to send: no keyword is left without a service.' },
        })}
        {kind('intent', 'Intent · Claude', 'Informational · Navigational · Commercial · Transactional, only where Semrush left it empty', (v) => v, {
          ai: { task: 'intent', sends: 'Sends only the keyword text.', empty: 'Nothing to send: every keyword already has an intent.' },
        })}
        {kind('matrix', '3×3 matrix · Claude', 'A primary + backups for each open cell (never a cell you already set). Approve cell by cell', (v) => row('matrix')?.items.find((i) => i.options[0]?.value === v)?.cell ?? v, {
          ai: { task: 'matrix', sends: 'Sends only the service names, area names and each open cell’s candidate keywords with their volumes.', empty: 'Nothing to send: every cell already has a primary, is N/A, or has no keyword with that service and city.' },
        })}
        {kind('clusters', 'Pages · Claude', 'A new page for each matrix cell with no page, and a page for keywords on none. Approve page by page', (v) => {
          const it = row('clusters')?.items.find((i) => i.options[0]?.value === v)
          return it?.assign?.pageName ?? it?.page?.name ?? v
        }, {
          ai: { task: 'clusters', sends: 'Sends only service and area names, page names, matrix cells and the keywords on no page (text, role, service, volumes).', empty: 'Nothing to send: every matrix cell has a page and every keyword is on one.' },
        })}
      </ul>
      <p className="m-0 border-0 border-t border-solid border-vv-line pt-3.5 text-[14px] text-vv-body">
        Rules and Claude only suggest. Nothing changes until you approve, and approving never overwrites a role, service, intent or status you already set. Approve all skips the scope and no-rule lists.
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

type ReviewProps = {
  row: AutofillRow
  label: (v: string) => string
  pill?: (v: string) => string
  /** Keywords on the scope / triage list → no Approve here, just a tag. */
  flagged?: Map<string, string>
  onDecide: (d: AutofillDecision[]) => void
  busy: boolean
}

function Review({ row, label, pill, flagged, onDecide, busy }: ReviewProps) {
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
        {items.map((i) =>
          i.page ? (
            <PageItemRow key={i.keywordId} item={i} busy={busy || closed} onDecide={onDecide} />
          ) : (
            <ItemRow key={i.keywordId} item={i} label={label} pill={pill} flag={flagged?.get(i.keywordId)} busy={busy || closed} onDecide={onDecide} />
          ),
        )}
      </ul>
    </li>
  )
}

function ItemRow({
  item: i,
  label,
  pill,
  flag,
  busy,
  onDecide,
}: {
  item: AutofillItem
  label: (v: string) => string
  pill?: (v: string) => string
  flag?: string
  busy: boolean
  onDecide: (d: AutofillDecision[]) => void
}) {
  const look = i.options.length > 1
  const tag = (v: string) => <span className={pill ? pill(v) : `${PILL} bg-vv-surface text-vv-ink`}>{label(v)}</span>
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[15px] font-semibold text-vv-ink">
          {i.keyword}
          {i.category && <span className={`${PILL} bg-vv-orange-100 text-vv-orange-ink`}>{i.category}</span>}
        </span>
        {!i.decision && flag ? (
          <span className={`${PILL} bg-vv-orange-100 text-vv-orange-ink`}>On the {flag} list · approve there</span>
        ) : i.decision ? (
          <span className={`${PILL} ${i.decision === 'approved' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>
            {i.decision === 'approved' ? `Approved · ${label(i.applied ?? '')}` : i.decision === 'skipped' ? 'Skipped · already set' : 'Rejected'}
          </span>
        ) : look ? (
          <span className={`${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`}>Needs a look</span>
        ) : null}
      </div>
      {flag && !i.decision ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-vv-body">
            {tag(i.options[0].value)} {i.options[0].rule}
          </span>
          <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'reject' }])} className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`}>
            Reject
          </button>
        </div>
      ) : null}
      {!i.decision &&
        !flag &&
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
function AiRun({ siteId, task, hasRow, sends, emptyText }: { siteId: string; task: AiTask; hasRow: boolean; sends: string; emptyText: string }) {
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
        <span className="flex flex-wrap items-center gap-2 text-[14px] text-vv-body">
          {emptyText}
          <button type="button" className="border-0 bg-transparent p-0 text-[14px] font-semibold text-vv-purple-deep underline" onClick={() => setShown(null)}>
            OK
          </button>
        </span>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-solid border-vv-line bg-vv-lavender-50 p-3 text-[14px] text-vv-ink">
          <span>
            <strong>{shown.items}</strong> {shown.noun}{shown.items === 1 ? '' : 's'}{shown.total > shown.items ? ` (first ${shown.items} of ${shown.total.toLocaleString('en-US')}: run again for the next)` : ''} · {shown.model} · ~{(shown.inputTokens + shown.outputTokens).toLocaleString('en-US')} tokens · about <strong>{formatUsd(shown.costUsd)}</strong>
          </span>
          <span className="text-[13px] text-vv-body">{sends} Results wait here as Ready to review; nothing changes until you approve.</span>
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

/** A suggested NEW page: name, category, URL (suggested from the template, editable), primary, secondaries, FAQs. */
function PageItemRow({ item: i, busy, onDecide }: { item: AutofillItem; busy: boolean; onDecide: (d: AutofillDecision[]) => void }) {
  const pg = i.page!
  const [path, setPath] = useState(pg.path ?? '')
  const edited = path.trim() !== (pg.path ?? '')
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-solid border-vv-line bg-vv-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[15px] font-semibold text-vv-ink">
          {pg.name}
          <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>{pg.cell} · new page</span>
        </span>
        {i.decision && (
          <span className={`${PILL} ${i.decision === 'approved' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>
            {i.decision === 'approved' ? 'Page created (planned)' : i.decision === 'skipped' ? 'Skipped · primary already on a page' : 'Rejected'}
          </span>
        )}
      </div>
      <span className="text-[13px] text-vv-body">
        <strong>Primary:</strong> {i.keyword}
        {pg.secondaries.length > 0 && <> · <strong>Secondary:</strong> {pg.secondaries.map((s) => s.keyword).join(', ')}</>}
        {pg.faqs.length > 0 && <> · <strong>FAQ:</strong> {pg.faqs.map((f) => f.keyword).join(', ')}</>}
      </span>
      {!i.decision && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-vv-body">
            URL
            <input
              className="box-border min-h-9 min-w-0 flex-1 rounded-xl border-[1.5px] border-solid border-vv-field-line bg-vv-field px-3 font-body text-[13px] text-vv-ink"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="No URL yet"
              aria-label={`URL for ${pg.name}`}
            />
            <span className={`${PILL} ${edited ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-waiting text-vv-st-waiting-ink'}`}>{edited ? 'yours' : 'suggested'}</span>
          </label>
          <span className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'approve', ...(edited ? { path } : {}) }])} className={`${BTN_LIME} min-h-9 px-4 text-[13px]`}>
              Create page
            </button>
            <button type="button" disabled={busy} onClick={() => onDecide([{ keywordId: i.keywordId, action: 'reject' }])} className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`}>
              Reject
            </button>
          </span>
        </div>
      )}
    </li>
  )
}
