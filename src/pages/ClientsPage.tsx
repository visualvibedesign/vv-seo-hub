import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone } from '../components/ui/Loading'
import { useClients } from '../hooks/useClients'
import { useIndustryLabel } from '../hooks/useIndustries'
import { GUIDE, GUIDE_STEPS, stepDay } from '../lib/guide'
import { needsYouItems } from '../lib/needsYou'
import { BTN_GHOST, BTN_LIME, CARD, FIELD, PILL, PILL_DONE, PILL_TODO, PILL_WAITING, siteLabel } from '../lib/ui'
import type { ClientStatus, ClientSummary } from '../types/seo'

// All clients (/clients), design docs/design/Clients.png: search, status pills, step filter, sort,
// 25 per page. Clients live here (and in the client switcher), never in the sidebar, so it stays tidy with 50+.
// Sam step = the client's current guide step. Not faked: "SEO score" waits for the Vibe SEO plugin ("—").

const PER_PAGE = 25
type StatusFilter = 'all' | ClientStatus
type Sort = 'recent' | 'name' | 'keywords'

/** One row (wraps on small screens): search · status pills · step · sort (design: Clients.png). */
const TOOLBAR =
  'box-border flex flex-wrap items-center gap-3 rounded-[22px] border border-solid border-vv-line bg-vv-surface p-3.5 shadow-[0_14px_30px_-24px_rgba(91,63,208,0.45)] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,.7)] phone:gap-2.5 phone:p-3'

const STEP_PILL = `${PILL} bg-vv-lavender-100 text-vv-purple-ink no-underline hover:text-vv-purple-ink`

const STATUS_PILL: Record<ClientStatus, string> = { active: PILL_DONE, paused: PILL_WAITING, archived: PILL_TODO }
const STATUS_LABEL: Record<ClientStatus, string> = { active: 'Active', paused: 'Paused', archived: 'Archived' }

/** The first thing this client needs from you (src/lib/needsYou.ts, real counts only). */
const needsYou = (c: ClientSummary): string | null => needsYouItems(c)[0]?.title ?? null

export default function ClientsPage() {
  const industryLabel = useIndustryLabel()
  const q = useClients()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  /** '' = any step; '0'…'8' = current guide step; '9' = all done (monthly). */
  const [step, setStep] = useState('')
  const [page, setPage] = useState(0)

  const all = useMemo(() => q.data ?? [], [q.data])
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = all.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (step === '' || c.guide.current === Number(step)) &&
        (!term || [c.name, siteLabel(c.siteUrl), c.city ?? '', c.state ?? ''].some((v) => v.toLowerCase().includes(term))),
    )
    return list.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'keywords'
          ? b.counts.keywords - a.counts.keywords || a.name.localeCompare(b.name)
          : b.counts.lastWorkedAt.localeCompare(a.counts.lastWorkedAt),
    )
  }, [all, search, status, sort, step])

  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const cur = Math.min(page, pages - 1)
  const rows = shown.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE)
  const reset = () => setPage(0)

  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          SEO Hub
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">All clients</strong>
      </span>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            All <em className="font-medium text-vv-purple">clients.</em>
          </h1>
          <p className="m-0 max-w-[680px] text-[17px] leading-normal text-vv-body">Search, filter and sort. Clients live here, not in the sidebar, so it stays tidy with 50+.</p>
        </div>
        <HeaderTools>
          <Link to="/clients/import" className={BTN_GHOST}>
            Add from CSV
          </Link>
          <Link to="/clients/new" className={BTN_LIME}>
            + Add client
          </Link>
        </HeaderTools>
      </header>

      <div role="search" className={TOOLBAR}>
        <label className="relative block min-w-0 flex-[1_1_320px] phone:basis-full">
          <span className="sr-only">Search by name, site or city</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-vv-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            className={`${FIELD} rounded-full pl-11`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              reset()
            }}
            placeholder="Search by name, site or city"
          />
        </label>
        <div role="radiogroup" aria-label="Status" className="flex flex-none flex-wrap gap-1.5 phone:basis-full phone:gap-1">
          {(['all', 'active', 'paused', 'archived'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => {
                setStatus(s)
                reset()
              }}
              className={`min-h-11 rounded-full border border-solid px-4 font-body text-[15px] font-semibold phone:px-3 phone:text-[14px] ${
                status === s ? 'border-vv-lavender bg-vv-lavender text-vv-ink' : 'border-vv-field-line bg-vv-surface text-vv-body hover:bg-vv-lavender-50'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="block w-[170px] flex-none phone:w-auto phone:min-w-0 phone:flex-1">
          <span className="sr-only">Sam step</span>
          <select
            className={`${FIELD} rounded-full`}
            value={step}
            onChange={(e) => {
              setStep(e.target.value)
              reset()
            }}
          >
            <option value="">Any step</option>
            {GUIDE.map((g) => (
              <option key={g.n} value={g.n}>
                {g.day.replace(' + monthly', '')} · {g.title}
              </option>
            ))}
            <option value={GUIDE_STEPS}>Monthly (all done)</option>
          </select>
        </label>
        <label className="block w-[210px] flex-none phone:w-auto phone:min-w-0 phone:flex-1">
          <span className="sr-only">Sort</span>
          <select
            className={`${FIELD} rounded-full`}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort)
              reset()
            }}
          >
            <option value="recent">Recently worked on</option>
            <option value="name">Name A–Z</option>
            <option value="keywords">Most keywords</option>
          </select>
        </label>
      </div>

      {q.isPending && (
        <div aria-busy="true" className={CARD}>
          <span role="status" className="sr-only">
            Loading clients
          </span>
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      )}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the clients. Try again in a moment.
        </p>
      )}

      {q.isSuccess && all.length === 0 && (
        <div className={`${CARD} items-start`}>
          <h2 className="m-0 font-display text-[22px] font-semibold">No clients yet</h2>
          <p className="m-0 text-[15px] text-vv-body">Add the first one: its site, a template, services and areas, and the account checklist.</p>
          <Link to="/clients/new" className={BTN_LIME}>
            + Add client
          </Link>
        </div>
      )}

      {q.isSuccess && all.length > 0 && (
        <section className={`${CARD} !gap-0 !p-3.5`} aria-label="Clients">
          {shown.length === 0 ? (
            <p className="m-0 p-4 text-[15px] text-vv-body">No client matches these filters.</p>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="overflow-x-auto phone:hidden">
                <table className="w-full border-collapse text-left text-[15px]">
                  <thead>
                    <tr className="bg-vv-lavender-50 text-xs font-bold uppercase tracking-[0.1em] text-vv-body">
                      {['Client', 'City', 'Template', 'Sam step', 'SEO score', 'Keywords', 'Needs you', 'Status'].map((h, i) => (
                        <th key={h} scope="col" className={`whitespace-nowrap px-4 py-3.5 font-bold ${i === 0 ? 'rounded-l-xl' : ''} ${i === 7 ? 'rounded-r-xl' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.siteId}
                        onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(`/clients/${c.siteId}`)}
                        className="cursor-pointer border-0 border-b border-solid border-vv-line last:border-b-0 hover:bg-vv-lavender-50"
                      >
                        <td className="px-4 py-3">
                          <Link to={`/clients/${c.siteId}`} className="font-bold text-vv-ink no-underline hover:underline">
                            {c.name}
                          </Link>
                          <span className="block text-sm text-vv-muted">{siteLabel(c.siteUrl)}</span>
                          {c.counts.services === 0 && <span className={`${PILL_WAITING} mt-1`}>Needs services</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{c.city ? `${c.city}${c.state ? `, ${c.state}` : ''}` : <Dash />}</td>
                        <td className="px-4 py-3 text-vv-body">{industryLabel(c.industry) ?? <Dash />}</td>
                        <td className="px-4 py-3">
                          <Link to={`/clients/${c.siteId}/strategy/guide`} className={STEP_PILL} title={GUIDE[c.guide.current]?.title ?? 'All steps done'}>
                            {stepDay(c.guide.current)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Dash title="Comes with the Vibe SEO plugin" />
                        </td>
                        <td className="px-4 py-3 tabular-nums">{c.counts.keywords.toLocaleString('en-US')}</td>
                        <td className="px-4 py-3 text-vv-body">{needsYou(c) ?? <Dash />}</td>
                        <td className="px-4 py-3">
                          <span className={STATUS_PILL[c.status]}>{STATUS_LABEL[c.status]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phones: cards */}
              <ul className="m-0 hidden list-none flex-col gap-2 p-0 phone:flex">
                {rows.map((c) => (
                  <li key={c.siteId}>
                    <Link to={`/clients/${c.siteId}`} className="flex flex-col gap-1.5 rounded-2xl border border-solid border-vv-line p-3.5 text-vv-ink no-underline hover:bg-vv-lavender-50">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{c.name}</span>
                          <span className="block truncate text-sm text-vv-muted">
                            {siteLabel(c.siteUrl)}
                            {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                          </span>
                        </span>
                        <span className={STATUS_PILL[c.status]}>{STATUS_LABEL[c.status]}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5 text-sm">
                        {industryLabel(c.industry) && <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>{industryLabel(c.industry)}</span>}
                        <span className={STEP_PILL}>{stepDay(c.guide.current)}</span>
                        <span className={PILL_TODO}>{c.counts.keywords.toLocaleString('en-US')} keywords</span>
                        {c.counts.services === 0 && <span className={PILL_WAITING}>Needs services</span>}
                      </span>
                      {needsYou(c) && <span className="text-sm text-vv-body">Needs you: {needsYou(c)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-4">
                <span className="text-[15px] text-vv-body">
                  Showing {cur * PER_PAGE + 1}–{cur * PER_PAGE + rows.length} of {shown.length} · {PER_PAGE} per page
                </span>
                {pages > 1 && (
                  <nav aria-label="Pages" className="flex flex-wrap gap-1.5">
                    <PageBtn label="‹" aria="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)} />
                    {Array.from({ length: pages }, (_, i) => (
                      <PageBtn key={i} label={String(i + 1)} aria={`Page ${i + 1}`} current={i === cur} onClick={() => setPage(i)} />
                    ))}
                    <PageBtn label="›" aria="Next page" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)} />
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}

function Dash({ title }: { title?: string }) {
  return (
    <span title={title} aria-label={title ? `None yet: ${title.toLowerCase()}` : 'None'} className="text-vv-muted">
      —
    </span>
  )
}

function PageBtn({ label, aria, current, disabled, onClick }: { label: string; aria: string; current?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={aria}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-solid font-body text-[15px] font-semibold disabled:opacity-40 ${
        current ? 'border-vv-lavender bg-vv-lavender text-vv-ink' : 'border-vv-field-line bg-vv-surface text-vv-ink hover:enabled:bg-vv-lavender-50'
      }`}
    >
      {label}
    </button>
  )
}
