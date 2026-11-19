import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { useClient } from '../../hooks/useClients'
import { CLIENT_TABS } from '../../lib/clientSetup'
import { BTN_GHOST, BTN_LIME, CARD, PILL_WAITING, siteLabel, splitAccent } from '../../lib/ui'
import type { ClientDetail } from '../../types/seo'
import { Bone } from '../ui/Loading'
import HeaderTools from './HeaderTools'

// Client workspace frame: /clients/{site id}/… (the address the agency hub and Vibe SEO plugin link to).
// Header + the 8 tabs of the hub workspace SEO Hub replaces; each tab is a child route.
export default function ClientLayout() {
  const { siteId } = useParams()
  const q = useClient(siteId)

  if (q.isPending)
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <span role="status" className="sr-only">
          Loading the client
        </span>
        <Bone className="h-4 w-48" />
        <Bone className="h-12 w-[26rem] max-w-full rounded-xl" />
        <Bone className="h-12 w-full rounded-[22px]" />
        <Bone className="h-48 w-full rounded-[22px]" />
      </div>
    )

  if (q.isError || !q.data) {
    const notFound = (q.error as { status?: number } | null)?.status === 404
    return (
      <div className={`${CARD} items-start`}>
        <h1 className="m-0 font-display text-[28px] font-semibold">{notFound ? 'This site isn’t an SEO Hub client yet' : 'Couldn’t load this client'}</h1>
        <p className="m-0 text-[15px] text-vv-body">
          {notFound
            ? 'No client has this site id. Add the client with the site’s home URL and this link will work.'
            : 'Try again in a moment.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {notFound && (
            <Link to="/clients/new" className={BTN_LIME}>
              Add client
            </Link>
          )}
          <Link to="/" className={BTN_GHOST}>
            All clients
          </Link>
        </div>
      </div>
    )
  }

  const c = q.data
  const [lead, accent] = splitAccent(c.name)
  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          Clients
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">{c.name}</strong>
      </span>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            {lead}
            <em className="font-medium text-vv-purple">{accent}</em>
          </h1>
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[17px] leading-normal text-vv-body">
            <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-vv-purple-deep no-underline hover:underline">
              {siteLabel(c.siteUrl)} ↗
            </a>
            {c.city && (
              <span>
                {c.city}
                {c.state ? `, ${c.state}` : ''}
              </span>
            )}
            {c.status !== 'active' && <span className={PILL_WAITING}>{c.status === 'paused' ? 'Paused' : 'Archived'}</span>}
          </p>
        </div>
        <HeaderTools>
          <Link to={`/clients/${c.siteId}/edit`} className={BTN_GHOST}>
            Edit client
          </Link>
        </HeaderTools>
      </header>

      {/* Tabs: same pill bar as HQ's Settings. Not-built tabs still open, showing what's coming. */}
      <nav aria-label="Client sections" className="flex flex-wrap gap-1 rounded-[22px] bg-vv-lavender-50 p-1">
        {CLIENT_TABS.map((t) => (
          <NavLink
            key={t.key}
            to={t.path ? `/clients/${c.siteId}/${t.path}` : `/clients/${c.siteId}`}
            end={!t.path}
            className={({ isActive }) =>
              `inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold no-underline ${
                isActive ? 'bg-vv-surface text-vv-ink shadow-[0_2px_6px_rgba(91,63,208,0.15)]' : 'bg-transparent text-vv-ink hover:bg-vv-surface/60'
              } ${t.live ? '' : 'text-vv-muted'}`
            }
          >
            {t.label}
            {!t.live && (
              <span className="rounded-full bg-vv-lavender-100 px-1.5 py-0.5 text-[10px] font-bold text-vv-purple-deep">
                {t.phase === 'later' ? 'Later' : `P${t.phase}`}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet context={c} />
    </>
  )
}

/** The client loaded by ClientLayout, for its tab pages. */
// eslint-disable-next-line react-refresh/only-export-components
export function useClientContext(): ClientDetail {
  return useOutletContext<ClientDetail>()
}
