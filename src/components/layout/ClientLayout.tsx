import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { useClient } from '../../hooks/useClients'
import { useGuide } from '../../hooks/useGuide'
import { ALL_SECTIONS, clientPath, strategyPath } from '../../lib/clientSetup'
import { BTN_GHOST, BTN_LIME, CARD, PILL_WAITING, siteLabel, splitAccent } from '../../lib/ui'
import type { ClientDetail } from '../../types/seo'
import { Bone } from '../ui/Loading'
import HeaderTools from './HeaderTools'

// Client frame: /clients/{site id}/… (the Overview area: the address the agency hub and Vibe SEO plugin link to) and
// /clients/{site id}/strategy/… (the Strategy Builder). Breadcrumb + header + the current section (child routes).
export default function ClientLayout() {
  const { siteId } = useParams()
  const q = useClient(siteId)
  const { pathname } = useLocation()
  // Pages that show guide progress: start loading it now, not after the client has loaded.
  const rest = pathname.replace(`/clients/${siteId}`, '').replace(/^\/+|\/+$/g, '')
  useGuide(siteId ?? '', ['strategy', 'strategy/guide', 'baseline', 'results'].includes(rest))

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
          <Link to="/clients" className={BTN_GHOST}>
            All clients
          </Link>
        </div>
      </div>
    )
  }

  const c = q.data
  const [lead, accent] = splitAccent(c.name)
  const path = pathname
    .replace(`/clients/${c.siteId}`, '')
    .split('/')
    .filter(Boolean)
    .join('/')
  const section = path ? ALL_SECTIONS.find((s) => s.path === path) : undefined
  const inStrategy = path === 'strategy' || path.startsWith('strategy/')
  // Redesigned sections draw their own title (docs/design/); the rest still get the client-name header.
  const ownHeader = !path || OWN_HEADER.has(section?.key ?? '')
  const crumb = (to: string, text: string) => (
    <>
      <Link to={to} className="text-vv-muted no-underline hover:text-vv-purple-deep">
        {text}
      </Link>{' '}
      <span aria-hidden="true">›</span>{' '}
    </>
  )
  return (
    <>
      <span className="text-[15px] text-vv-muted">
        {crumb('/clients', 'Clients')}
        {path ? (
          <>
            {crumb(clientPath(c.siteId), c.name)}
            {inStrategy && path !== 'strategy' && crumb(strategyPath(c.siteId), 'Strategy Builder')}
            <strong className="text-vv-ink">{section ? (section.group ? `${section.group} › ${section.label}` : section.key === 'strategy' ? 'Strategy Builder' : section.label) : path}</strong>
          </>
        ) : (
          <>
            {c.name} <span aria-hidden="true">›</span> <strong className="text-vv-ink">Overview</strong>
          </>
        )}
      </span>

      {!ownHeader && <header className="flex flex-wrap items-end justify-between gap-5">
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
          <Link to={strategyPath(c.siteId, 'setup')} className={BTN_GHOST}>
            Client setup
          </Link>
        </HeaderTools>
      </header>}

      <Outlet context={c} />
    </>
  )
}

/** Sections that have their own page header (title + tools) from the design. */
const OWN_HEADER = new Set(['guide', 'uploads', 'database', 'matrix', 'clusters', 'notes', 'strategy', 'baseline', 'results', 'site-check', 'site'])

/** The client loaded by ClientLayout, for its tab pages. */
// eslint-disable-next-line react-refresh/only-export-components
export function useClientContext(): ClientDetail {
  return useOutletContext<ClientDetail>()
}
