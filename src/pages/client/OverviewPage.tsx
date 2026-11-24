import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Spinner } from '../../components/ui/Loading'
import { useSaveAccount } from '../../hooks/useClients'
import { ACCOUNTS, ACCOUNT_STATUS_LABEL, SAM_STEPS } from '../../lib/clientSetup'
import { BTN_LINK, CARD, CARD_TITLE, FIELD, PILL_DONE, PILL_PROGRESS, PILL_REVIEW, PILL_TODO } from '../../lib/ui'
import type { AccountStatus, ClientAccount, ClientDetail } from '../../types/seo'

// Overview tab (/clients/{site id}): Sam's 9 steps, services + areas, kickoff answers, account checklist.

/** What's still missing from Day 1 setup (empty = done). */
function setupGaps(c: ClientDetail): string[] {
  const gaps: string[] = []
  for (const k of c.categories.filter((k) => k.code !== 'FAQ' && k.code !== 'Home')) {
    if (!k.services.length) gaps.push(`${k.code} has no services`)
  }
  if (!c.areas.find((a) => a.code === 'A1')?.name) gaps.push('A1 has no name')
  if (!c.success12mo) gaps.push('12-month success answer')
  if (!c.usp) gaps.push('USP')
  if (!c.idealClient) gaps.push('ideal client')
  const pending = c.accounts.filter((a) => a.status === 'pending').length
  if (pending) gaps.push(`${pending} account${pending === 1 ? '' : 's'} pending`)
  return gaps
}

export default function OverviewPage() {
  const c = useClientContext()
  const gaps = setupGaps(c)

  return (
    // Desktop: two columns. Phones: one column in reading order (steps, services, kickoff, then the long checklist).
    <div className="flex flex-wrap items-start gap-5 phone:flex-col phone:flex-nowrap phone:items-stretch">
      <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5 phone:contents">
        <StepsCard client={c} gaps={gaps} />
        <AccountsCard client={c} className="phone:order-4" />
      </div>
      <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-5 phone:contents">
        <TargetsCard client={c} className="phone:order-2" />
        <KickoffCard client={c} className="phone:order-3" />
      </div>
    </div>
  )
}

function StepsCard({ client: c, gaps }: { client: ClientDetail; gaps: string[] }) {
  return (
    <section className={`${CARD} phone:order-1`} aria-labelledby="ov-steps">
      <div className="flex flex-col gap-1">
        <h2 id="ov-steps" className={CARD_TITLE}>
          Sam’s <em className="font-medium text-vv-purple">9 steps</em>
        </h2>
        <p className="m-0 text-sm text-vv-muted">The 10-Day Rank Yourself process, one flow per client.</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {SAM_STEPS.map((s) => {
          let pill: { cls: string; text: string }
          let detail = ''
          if (s.n === 0) {
            pill = gaps.length ? { cls: PILL_PROGRESS, text: 'In progress' } : { cls: PILL_DONE, text: 'Done' }
            detail = gaps.length ? `Missing: ${gaps.join(', ')}` : 'Services, areas, kickoff answers and accounts are in.'
          } else if (s.n === 1) {
            pill = c.counts.keywords ? { cls: PILL_PROGRESS, text: 'In progress' } : { cls: PILL_REVIEW, text: 'Next' }
            detail = c.counts.keywords ? `${c.counts.keywords} keywords so far` : 'Import the Keyword Planner + Semrush CSVs'
          } else {
            pill = { cls: PILL_TODO, text: `Phase ${s.phase}` }
          }
          return (
            <li key={s.n} className="flex items-center gap-3 rounded-2xl bg-vv-lavender-50 px-4 py-3">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-vv-surface font-display text-base font-semibold text-vv-purple-deep"
              >
                {s.n}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">
                  {s.tab ? (
                    <Link to={`/clients/${c.siteId}/${s.tab}`} className="text-vv-ink no-underline hover:text-vv-purple-deep">
                      {s.title}
                    </Link>
                  ) : (
                    s.title
                  )}{' '}
                  <span className="text-[13px] font-medium text-vv-muted">· {s.day}</span>
                </span>
                {detail && <span className="text-[13px] text-vv-muted">{detail}</span>}
              </div>
              <span className={pill.cls}>{pill.text}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TargetsCard({ client: c, className = '' }: { client: ClientDetail; className?: string }) {
  return (
    <section className={`${CARD} ${className}`} aria-labelledby="ov-targets">
      <h2 id="ov-targets" className={CARD_TITLE}>
        Services &amp; <em className="font-medium text-vv-purple">areas</em>
      </h2>
      <dl className="m-0 flex flex-col gap-3">
        {c.categories.map((k) => (
          <div key={k.code} className="flex flex-col gap-1.5">
            <dt className="text-[15px] font-semibold">
              <span className="mr-1.5 text-vv-purple-deep">{k.code}</span>
              {k.name}
            </dt>
            <dd className="m-0 flex flex-wrap gap-1.5">
              {k.services.length ? (
                k.services.map((s) => (
                  <span key={s.id} className="rounded-full bg-vv-lavender-100 px-2.5 py-0.5 text-[13px] text-vv-purple-ink">
                    {s.name}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-vv-muted">{k.code === 'FAQ' ? 'Help pages are added as clusters.' : 'No services yet'}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1.5 border-t border-solid border-vv-line pt-3">
        {c.areas.map((a) => (
          <div key={a.code} className="flex items-baseline gap-2 text-[15px]">
            <span className="font-semibold text-vv-purple-deep">{a.code}</span>
            {a.status === 'n_a' ? (
              <span className="text-vv-muted">N/A</span>
            ) : (
              <span>
                {a.name}
                {a.state ? `, ${a.state}` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function KickoffCard({ client: c, className = '' }: { client: ClientDetail; className?: string }) {
  const rows: [string, string | null][] = [
    ['12-month success', c.success12mo],
    ['Why them (USP)', c.usp],
    ['Ideal client', c.idealClient],
    ['Notes', c.notes],
  ]
  return (
    <section className={`${CARD} ${className}`} aria-labelledby="ov-kickoff">
      <h2 id="ov-kickoff" className={CARD_TITLE}>
        Kickoff <em className="font-medium text-vv-purple">answers</em>
      </h2>
      <dl className="m-0 flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[13px] font-semibold text-vv-muted">{label}</dt>
            <dd className="m-0 whitespace-pre-line text-[15px] leading-normal text-vv-body">
              {value || (
                <Link to={`/clients/${c.siteId}/edit`} className="text-vv-purple-deep">
                  Add it
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AccountsCard({ client: c, className = '' }: { client: ClientDetail; className?: string }) {
  const ready = c.accounts.filter((a) => a.status === 'ready').length
  const counted = c.accounts.filter((a) => a.status !== 'n_a').length
  return (
    <section className={`${CARD} ${className}`} aria-labelledby="ov-accounts">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ov-accounts" className={CARD_TITLE}>
          Account <em className="font-medium text-vv-purple">checklist</em>
        </h2>
        <span className="text-sm font-semibold text-vv-muted">
          {ready} of {counted} ready
        </span>
      </div>
      <p className="m-0 -mt-2 text-[13px] text-vv-muted">Status and next step only. Never passwords or keys here.</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {ACCOUNTS.map((def) => {
          const a = c.accounts.find((x) => x.kind === def.kind)
          return a ? <AccountRow key={def.kind} siteId={c.siteId} account={a} label={def.label} hint={def.hint} /> : null
        })}
      </ul>
    </section>
  )
}

const STATUS_STYLE: Record<AccountStatus, string> = {
  ready: 'border-vv-st-done bg-vv-st-done text-vv-st-done-ink',
  pending: 'border-vv-st-waiting bg-vv-st-waiting text-vv-st-waiting-ink',
  n_a: 'border-vv-st-todo bg-vv-st-todo text-vv-st-todo-ink',
}

function AccountRow({ siteId, account, label, hint }: { siteId: string; account: ClientAccount; label: string; hint: string }) {
  const save = useSaveAccount(siteId)
  const [next, setNext] = useState(account.nextAction ?? '')
  const send = (status: AccountStatus, nextAction: string) => save.mutate({ kind: account.kind, status, nextAction, note: account.note ?? '' })
  // Phones: an empty next step stays folded behind "+ Next step" so 12 rows don't each carry a field.
  const [open, setOpen] = useState(false)
  const folded = !next && !open

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_130px_minmax(0,1.3fr)] items-center gap-3 border-b border-solid border-vv-line py-2.5 last:border-0 phone:grid-cols-[minmax(0,1fr)_112px] phone:gap-x-2.5 phone:gap-y-1.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold phone:text-sm">{label}</span>
        {hint && <span className="truncate text-xs text-vv-muted">{hint}</span>}
        {folded && (
          <button type="button" onClick={() => setOpen(true)} className={`${BTN_LINK} hidden min-h-7 self-start text-xs phone:inline`}>
            + Next step
          </button>
        )}
      </div>
      <select
        aria-label={`${label} status`}
        value={account.status}
        onChange={(e) => send(e.target.value as AccountStatus, next)}
        className={`min-h-10 rounded-full border border-solid px-3 font-body text-sm font-bold ${STATUS_STYLE[account.status]}`}
      >
        {(Object.keys(ACCOUNT_STATUS_LABEL) as AccountStatus[]).map((s) => (
          <option key={s} value={s}>
            {ACCOUNT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <div className={`flex items-center gap-2 phone:col-span-2 ${folded ? 'phone:hidden' : ''}`}>
        <input
          aria-label={`${label} next action`}
          autoFocus={open && !next}
          className={`${FIELD} min-h-10 py-2 text-sm`}
          value={next}
          placeholder={account.status === 'ready' ? '' : 'Next step…'}
          onChange={(e) => setNext(e.target.value)}
          onBlur={() => {
            if (next !== (account.nextAction ?? '')) send(account.status, next)
            if (!next) setOpen(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="w-4 flex-none text-vv-muted" aria-live="polite">
          {save.isPending ? <Spinner /> : save.isError ? <span title="Couldn’t save" className="font-bold text-vv-red">!</span> : null}
        </span>
      </div>
    </li>
  )
}
