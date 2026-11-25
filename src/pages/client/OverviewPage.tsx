import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Spinner } from '../../components/ui/Loading'
import { Dash, LilacTable, PageHead, Panel, Soon } from '../../components/overview/OverviewParts'
import { useSaveAccount } from '../../hooks/useClients'
import { useKeywords } from '../../hooks/useKeywords'
import { useNotes } from '../../hooks/useNotes'
import { useGoogleSetup } from '../../hooks/useGoogle'
import ConnectGoogle from '../../components/overview/ConnectGoogle'
import GoogleNumbers from '../../components/overview/GoogleNumbers'
import { LinkEditor, OpenButton } from '../../components/client/AccountParts'
import { ApiError } from '../../lib/api'
import { ACCOUNT_ICON, ACCOUNTS, ACCOUNT_STATUS_LABEL, accountOpenUrl, clientPath, strategyPath } from '../../lib/clientSetup'
import { stepLabel, stepDay } from '../../lib/guide'
import { NOTE_KIND_LABEL } from '../../lib/notes'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, PILL, siteLabel } from '../../lib/ui'
import type { AccountStatus, ClientAccount, ClientDetail, NoteKind } from '../../types/seo'

// Client Overview (/clients/{site id}): the default page when you open a client: results + quick access. Design:
// docs/design/overview/Main.dc.html. Real data now: the client, tracked keywords, accounts, notes. Search Console,
// GA4, Semrush positions, GBP and the map grid come in phase 2: honest empty states, never sample numbers.

/** Every source's metrics we'll compare (Baseline vs now). Values come in phase 2. */
const COMPARE: { metric: string; source: string }[] = [
  { metric: 'Search impressions', source: 'Search Console' },
  { metric: 'Search clicks', source: 'Search Console' },
  { metric: 'Organic sessions', source: 'GA4' },
  { metric: 'Keywords in top 10', source: 'Semrush CSV' },
  { metric: 'Map grid avg rank', source: 'Whitespark' },
  { metric: 'GBP calls', source: 'GBP (typed in)' },
  { metric: 'Reviews', source: 'GBP (typed in)' },
]

export default function OverviewPage() {
  const c = useClientContext()
  return (
    <>
      <PageHead
        lead={`${c.name},`}
        accent="at a glance."
        sub={
          <div className="flex flex-col gap-2">
            <span>How the client’s SEO is doing, all in one place.</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-vv-purple-deep no-underline hover:underline">
                {siteLabel(c.siteUrl)} ↗
              </a>
              {c.city && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <Link to={strategyPath(c.siteId)} className={`${PILL} !py-0.5 bg-vv-lavender-100 text-vv-purple-ink no-underline`}>
                {stepLabel(c.guide.current)}
              </Link>
              {c.status !== 'active' && <span className={`${PILL} !py-0.5 bg-vv-st-waiting text-vv-st-waiting-ink`}>{c.status === 'paused' ? 'Paused' : 'Archived'}</span>}
            </span>
          </div>
        }
      >
        <Link to={strategyPath(c.siteId)} className={BTN_LIME}>
          Strategy Builder →
        </Link>
      </PageHead>

      <Sources client={c} />

      <ConnectGoogle client={c} />
      <LinkedNumbers siteId={c.siteId} />

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1200px)]:grid-cols-2 [@media(max-width:760px)]:grid-cols-1">
        <Rankings client={c} />
        <Panel title="Map grid" sub="Whitespark · CSV or screenshot" right={<Soon>Phase 2</Soon>}>
          <div className="grid max-w-[240px] grid-cols-5 gap-2" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} className="aspect-square rounded-full border border-dashed border-vv-lavender bg-vv-lavender-50" />
            ))}
          </div>
          <p className="m-0 text-[13px] text-vv-body">No scan yet. The 5×5 grid for the main service and city shows here, with the average rank and points in the top 3.</p>
        </Panel>
        <Panel title="Google Business Profile" sub="Typed in once a month" right={<Soon>Phase 2</Soon>}>
          <div className="grid grid-cols-2 gap-3">
            {['Profile views', 'Calls', 'Direction requests', 'Website clicks'].map((l) => (
              <div key={l} className="rounded-[14px] bg-vv-pink-100 p-3">
                <div className="text-[22px] font-bold">
                  <Dash />
                </div>
                <div className="text-[12px] text-vv-body">{l}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Baseline vs now"
        sub="Day 3 baseline compared with the latest numbers"
        right={
          <span className="flex gap-4 text-[13px] font-semibold">
            <Link to={clientPath(c.siteId, 'baseline')} className="text-vv-purple-deep">
              Baseline ›
            </Link>
            <Link to={clientPath(c.siteId, 'results')} className="text-vv-purple-deep">
              Results ›
            </Link>
          </span>
        }
      >
        <LilacTable
          head={['Metric', 'Source', 'Baseline', 'Now', 'Change']}
          right={[2, 3, 4]}
          rows={COMPARE.map((r) => [<strong key="m">{r.metric}</strong>, <span key="s" className="text-vv-body">{r.source}</span>, <Dash key="b" />, <Dash key="n" />, <Soon key="c">Not saved yet</Soon>])}
        />
      </Panel>

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Accounts client={c} />
        <NotesPreview client={c} />
      </div>
    </>
  )
}

/** Search Console + GA4 numbers, once Google is linked for this client. */
function LinkedNumbers({ siteId }: { siteId: string }) {
  const link = useGoogleSetup(siteId).data?.link
  return link && (link.gscProperty || link.ga4Property) ? <GoogleNumbers siteId={siteId} /> : null
}

const DOT: Record<'live' | 'soon' | 'part', string> = { live: 'bg-vv-green', soon: 'bg-vv-muted', part: 'bg-vv-purple' }

/** Where each number comes from, and whether we have it yet (real state only). */
function Sources({ client: c }: { client: ClientDetail }) {
  const tracked = c.counts.tracked
  const link = useGoogleSetup(c.siteId).data?.link ?? null
  const pulled = link?.lastSyncAt ? `Connected · pulled ${new Date(link.lastSyncAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${link.lastSyncOk === false ? ' (with errors)' : ''}` : 'Linked · not pulled yet'
  const list: { name: string; note: string; dot: keyof typeof DOT }[] = [
    { name: 'Search Console', note: link?.gscProperty ? pulled : 'Not connected', dot: link?.gscProperty ? (link.lastSyncOk === false ? 'soon' : 'live') : 'soon' },
    { name: 'GA4', note: link?.ga4Property ? pulled : 'Not connected', dot: link?.ga4Property ? (link.lastSyncOk === false ? 'soon' : 'live') : 'soon' },
    { name: 'Semrush', note: tracked ? `${tracked} keywords tracked · positions CSV in phase 2` : 'No keywords tracked yet', dot: tracked ? 'part' : 'soon' },
    { name: 'Whitespark', note: 'No map grid yet', dot: 'soon' },
    { name: 'GBP', note: 'Not typed in yet', dot: 'soon' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-vv-body">Sources</span>
      {list.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-solid border-vv-field-line bg-vv-surface px-3 py-1 text-[12px]">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[s.dot]}`} />
          <strong>{s.name}</strong>
          <span className="text-vv-body">{s.note}</span>
        </span>
      ))}
    </div>
  )
}

/** The keywords marked Track (real); their positions come from the Semrush Position Tracking CSV in phase 2. */
function Rankings({ client: c }: { client: ClientDetail }) {
  const q = useKeywords(c.siteId)
  const tracked = (q.data ?? []).filter((k) => k.track && k.status === 'keep')
  return (
    <Panel title="Keyword rankings" sub={`Semrush Position Tracking · ${c.counts.tracked} tracked keywords`} right={<Soon>Positions in phase 2</Soon>}>
      {q.isPending ? (
        <Spinner />
      ) : tracked.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">
          No keywords tracked yet. Pick them in{' '}
          <Link to={strategyPath(c.siteId, 'keywords/database')} className="font-semibold text-vv-purple-deep">
            Database
          </Link>{' '}
          (Track).
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {tracked.slice(0, 10).map((k) => (
            <li key={k.id} className="flex justify-between gap-3 border-0 border-t border-solid border-vv-line py-2 text-[13px] first:border-t-0">
              <span className="min-w-0 truncate">{k.keyword}</span>
              <span className="flex-none text-vv-muted">position —</span>
            </li>
          ))}
          {tracked.length > 10 && <li className="pt-1 text-[12px] text-vv-muted">+ {tracked.length - 10} more</li>}
        </ul>
      )}
    </Panel>
  )
}

const KIND_PILL: Record<NoteKind, string> = {
  rule: 'bg-vv-pill-red text-vv-pill-red-ink',
  decision: 'bg-vv-lavender-100 text-vv-purple-ink',
  note: 'bg-vv-st-todo text-vv-st-todo-ink',
}

/** The newest notes (this client's + agency rules), real. */
function NotesPreview({ client: c }: { client: ClientDetail }) {
  const q = useNotes(c.siteId)
  const notes = q.data?.notes.slice(0, 3) ?? []
  return (
    <Panel
      title="Notes"
      right={
        <Link to={clientPath(c.siteId, 'notes')} className="text-[13px] font-semibold text-vv-purple-deep">
          All notes &amp; links ›
        </Link>
      }
    >
      {q.isPending && <Spinner />}
      {q.isSuccess && notes.length === 0 && <p className="m-0 text-[13px] text-vv-body">No notes yet. Rules and decisions the team needs to remember go in Notes &amp; links.</p>}
      {notes.map((n) => (
        <div key={n.id} className="flex gap-2.5 text-[13px]">
          <span className={`${PILL} !px-2 !py-0.5 !text-[11px] h-fit flex-none ${KIND_PILL[n.kind]}`}>{NOTE_KIND_LABEL[n.kind]}</span>
          <div className="min-w-0">
            <p className="m-0 line-clamp-3 whitespace-pre-wrap break-words">{n.body}</p>
            <span className="text-[12px] text-vv-body">{[n.agency ? 'Agency rule' : '', n.author ?? '', n.day !== null ? stepDay(n.day) : ''].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      ))}
    </Panel>
  )
}

/** Quick access: one tile per account that opens the tool; "Edit" shows the full status + link editor. */
function Accounts({ client: c }: { client: ClientDetail }) {
  const [editing, setEditing] = useState(false)
  const core = c.accounts.filter((a) => ACCOUNTS.find((d) => d.kind === a.kind)?.core)
  const ready = core.filter((a) => a.status === 'ready').length
  const counted = core.filter((a) => a.status !== 'n_a').length
  if (editing) return <AccountsCard client={c} onDone={() => setEditing(false)} />
  const tiles = ACCOUNTS.flatMap((def) => {
    const a = c.accounts.find((x) => x.kind === def.kind)
    if (!a || a.status === 'n_a') return []
    return [{ def, a, url: accountOpenUrl(a.kind, a.link, c.siteUrl) }]
  })
  return (
    <Panel
      title="Accounts"
      right={
        <span className="flex items-center gap-3">
          <span className={`text-[12px] font-semibold ${ready === counted ? 'text-vv-green-ink' : 'text-vv-orange-ink'}`}>
            {ready} of {counted} ready
          </span>
          <button type="button" className={`${BTN_LINK} min-h-8 text-[13px]`} onClick={() => setEditing(true)}>
            Edit
          </button>
        </span>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
        {tiles.map(({ def, a, url }) => {
          const inner = (
            <>
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-vv-lavender-100 text-[12px] font-bold text-vv-purple-deep">{ACCOUNT_ICON[def.kind]}</span>
              <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">{def.label}</span>
              {a.status === 'pending' && <span title="Pending" className="h-2 w-2 flex-none rounded-full bg-vv-orange-ink" />}
            </>
          )
          const cls = 'box-border flex min-h-11 items-center gap-2.5 rounded-[12px] border border-solid border-vv-field-line px-3 py-2.5 text-vv-ink no-underline'
          return url ? (
            <a key={def.kind} href={url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-vv-lavender-50`} title={a.link ? 'Open the client’s page in this tool' : 'Open the tool (no client link yet)'}>
              {inner}
            </a>
          ) : (
            <span key={def.kind} className={`${cls} opacity-70`} title="No link yet">
              {inner}
            </span>
          )
        })}
      </div>
      <p className="m-0 text-[12px] text-vv-muted">Links and status only. Never usernames or passwords.</p>
    </Panel>
  )
}

/** The 6 core accounts (count toward "pending" + the guide tick), then "More accounts", both always shown. Each row opens the tool. */
function AccountsCard({ client: c, onDone }: { client: ClientDetail; onDone: () => void }) {
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
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-vv-muted">
            {ready} of {counted} ready
          </span>
          <button type="button" className={`${BTN_GHOST} min-h-9 px-4 text-[13px]`} onClick={onDone}>
            Done
          </button>
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

