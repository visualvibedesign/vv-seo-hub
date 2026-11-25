import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Spinner } from '../../components/ui/Loading'
import StatCard from '../../components/ui/StatCard'
import { useSaveAccount } from '../../hooks/useClients'
import { LinkEditor, OpenButton } from '../../components/client/AccountParts'
import { ApiError } from '../../lib/api'
import { ACCOUNTS, ACCOUNT_STATUS_LABEL, accountOpenUrl, clientPath, strategyPath } from '../../lib/clientSetup'
import { useIndustryLabel } from '../../hooks/useIndustries'
import { GUIDE, stepLabel } from '../../lib/guide'
import { BTN_LIME, CARD, CARD_TITLE, FIELD, BTN_LINK, PILL, siteLabel, splitAccent } from '../../lib/ui'
import type { AccountStatus, ClientAccount, ClientDetail } from '../../types/seo'

// Client Overview (/clients/{site id}): the default page when you open a client: results + quick access (design
// docs/design/Client.png, split Nov 26). Analytics (phase 2: never faked, "—" until real dated numbers), Baseline
// (Day 3) and Results (Day 10 + monthly), accounts, notes. The work lives in the Strategy Builder (big button).

export default function OverviewPage() {
  const industryLabel = useIndustryLabel()
  const c = useClientContext()
  const [lead, accent] = splitAccent(c.name)
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            {lead}
            <em className="font-medium text-vv-purple">{accent}.</em>
          </h1>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <li>
              <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className={`${CHIP} no-underline hover:border-vv-lavender`}>
                {siteLabel(c.siteUrl)} ↗
              </a>
            </li>
            {c.city && <li className={CHIP}>{[c.city, c.state].filter(Boolean).join(', ')}</li>}
            <li className={`${CHIP} !border-vv-lavender-100 !bg-vv-lavender-100 !text-vv-purple-ink`}>Template: {industryLabel(c.industry) ?? 'none yet'}</li>
            <li className={CHIP} title={c.siteId}>
              Site id {c.siteId.slice(0, 8)}…
            </li>
            {c.status !== 'active' && <li className={`${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`}>{c.status === 'paused' ? 'Paused' : 'Archived'}</li>}
          </ul>
        </div>
        <HeaderTools>
          <Link to={strategyPath(c.siteId)} className={BTN_LIME}>
            Strategy Builder →
          </Link>
        </HeaderTools>
      </header>

      <section aria-label="Key numbers" className="grid grid-cols-4 gap-4 [@media(max-width:1199px)]:grid-cols-2 phone:gap-2.5">
        <StatCard label="Search Console" value={null} caption="Impressions + clicks · Baseline + reports (phase 2)" />
        <StatCard label="GA4 sessions" value={null} caption="Organic sessions · Baseline + reports (phase 2)" bar="lime" />
        <StatCard label="GBP views" value={null} caption="Views, calls, website clicks · phase 2" />
        <StatCard label="Map grid" value={null} caption="Whitespark points found · phase 2" bar="red" />
      </section>

      <div className="grid grid-cols-[minmax(0,13fr)_minmax(0,8fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
        <AreaCard client={c} />
        <AccountsCard client={c} />
      </div>
    </>
  )
}

const CHIP = 'inline-flex min-h-8 items-center rounded-full border border-solid border-vv-field-line bg-vv-surface px-3.5 text-[14px] font-medium text-vv-ink'

/** Baseline (Day 3) and Results (Day 10 + monthly) live here; plus where the Strategy Builder is. */
function AreaCard({ client: c }: { client: ClientDetail }) {
  const done = new Set(c.guide.doneSteps)
  const rows = [
    { n: 2, path: 'baseline', label: 'Baseline', blurb: 'Day 3 · the starting point: rankings, Search Console, GA4, GBP and the map grid' },
    { n: 8, path: 'results', label: 'Results', blurb: 'Day 10 + monthly · what changed vs the baseline' },
    { n: -1, path: 'notes', label: 'Notes & links', blurb: 'Quick links to the client’s tools, rules and decisions' },
  ]
  return (
    <section className={CARD} aria-labelledby="ov-area">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ov-area" className={CARD_TITLE}>
          Results <em className="font-medium text-vv-purple">+ notes</em>
        </h2>
        <Link to={strategyPath(c.siteId)} className="text-[15px] font-semibold text-vv-purple-deep underline">
          Strategy: {stepLabel(c.guide.current)} ›
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.path} className="border-0 border-t border-solid border-vv-line first:border-t-0">
            <Link to={clientPath(c.siteId, r.path)} className="flex min-h-[60px] items-center gap-3 py-2.5 text-vv-ink no-underline hover:bg-vv-lavender-50">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-semibold">{r.label}</span>
                <span className="text-[14px] text-vv-body">{r.blurb}</span>
              </span>
              {r.n >= 0 && <span className={done.has(r.n) ? `${PILL} bg-vv-lavender-100 text-vv-purple-ink` : `${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>{done.has(r.n) ? 'Done' : GUIDE[r.n].day.replace(' + monthly', '')}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The 6 core accounts (count toward "pending" + the guide tick), then "More accounts", both always shown. Each row opens the tool. */
function AccountsCard({ client: c }: { client: ClientDetail }) {
  const rows = (core: boolean) =>
    ACCOUNTS.filter((d) => d.core === core).flatMap((def) => {
      const a = c.accounts.find((x) => x.kind === def.kind)
      return a ? [<AccountRow key={def.kind} siteId={c.siteId} siteUrl={c.siteUrl} account={a} label={def.label} />] : []
    })
  const core = c.accounts.filter((a) => ACCOUNTS.find((d) => d.kind === a.kind)?.core)
  const ready = core.filter((a) => a.status === 'ready').length
  const counted = core.filter((a) => a.status !== 'n_a').length
  const more = rows(false)
  return (
    <section className={CARD} aria-labelledby="ov-accounts">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ov-accounts" className={CARD_TITLE}>
          Accounts
        </h2>
        <span className="text-sm font-semibold text-vv-muted">
          {ready} of {counted} ready
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">{rows(true)}</ul>
      {more.length > 0 && (
        <div className="flex flex-col border-0 border-t border-solid border-vv-line pt-3">
          <h3 className="m-0 text-[14px] font-bold text-vv-ink">More accounts ({more.length})</h3>
          <p className="m-0 pb-1 text-[12px] text-vv-muted">Optional. They don’t count toward “accounts pending”.</p>
          <ul className="m-0 flex list-none flex-col p-0">{more}</ul>
        </div>
      )}
      <p className="m-0 text-[13px] text-vv-muted">Links and status only. Never usernames or passwords.</p>
    </section>
  )
}

const STATUS_STYLE: Record<AccountStatus, string> = {
  ready: 'border-vv-green-100 bg-vv-green-100 text-vv-green-ink',
  pending: 'border-vv-st-waiting bg-vv-st-waiting text-vv-st-waiting-ink',
  n_a: 'border-vv-st-todo bg-vv-st-todo text-vv-st-todo-ink',
}

/** Name + Open (client link, else the tool's main page) + status pill, a client-link field, and a "next step" line for anything not ready. */
function AccountRow({ siteId, siteUrl, account, label }: { siteId: string; siteUrl: string; account: ClientAccount; label: string }) {
  const save = useSaveAccount(siteId)
  const [next, setNext] = useState(account.nextAction ?? '')
  const [open, setOpen] = useState(false)
  const send = (status: AccountStatus, nextAction: string, link?: string) => save.mutate({ kind: account.kind, status, nextAction, note: account.note ?? '', ...(link !== undefined ? { link } : {}) })
  const showNext = account.status !== 'ready' && (open || !!next)
  const saveError = save.error instanceof ApiError && save.error.detail ? save.error.detail : ''

  return (
    <li className="flex flex-col gap-1.5 border-0 border-t border-solid border-vv-line py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{label}</span>
        <span className="flex flex-none items-center gap-2">
          <OpenButton url={accountOpenUrl(account.kind, account.link, siteUrl)} label={label} />
          <span className="w-4 text-vv-muted" aria-live="polite">
            {save.isPending ? <Spinner /> : save.isError ? <span title="Couldn’t save" className="font-bold text-vv-red">!</span> : null}
          </span>
          <select
            aria-label={`${label} status`}
            value={account.status}
            onChange={(e) => send(e.target.value as AccountStatus, next)}
            className={`min-h-9 cursor-pointer rounded-full border border-solid px-3 font-body text-[13px] font-bold ${STATUS_STYLE[account.status]}`}
          >
            {(Object.keys(ACCOUNT_STATUS_LABEL) as AccountStatus[]).map((s) => (
              <option key={s} value={s}>
                {ACCOUNT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <LinkEditor value={account.link ?? ''} label={label} busy={save.isPending} onSave={(link) => send(account.status, next, link)} />
        {account.status !== 'ready' && !showNext && (
          <button type="button" onClick={() => setOpen(true)} aria-label={`Add a next step for ${label}`} className={`${BTN_LINK} min-h-6 flex-none text-[12px]`}>
            + Next step
          </button>
        )}
      </div>
      {showNext ? (
        <input
          aria-label={`${label} next step`}
          autoFocus={open && !next}
          className={`${FIELD} min-h-9 py-1.5 text-[13px]`}
          value={next}
          placeholder="Next step…"
          onChange={(e) => setNext(e.target.value)}
          onBlur={() => {
            if (next !== (account.nextAction ?? '')) send(account.status, next)
            if (!next) setOpen(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : null}
      {saveError && <span className="text-[12px] font-semibold text-vv-red">{saveError}</span>}
    </li>
  )
}

