import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router'
import { useClients } from '../../hooks/useClients'
import { clientPath, HUB_SECTIONS, OVERVIEW_SECTIONS, STRATEGY_GROUPS, STRATEGY_TOP, strategyPath, type ClientGroup, type ClientSection } from '../../lib/clientSetup'
import { stepDay, stepLabel, strategyCurrent } from '../../lib/guide'
import type { ClientSummary } from '../../types/seo'
import Logo from '../ui/Logo'
import NavIcon, { type NavIconName } from '../ui/NavIcon'
import ThemeToggle from '../ui/ThemeToggle'

// Left navigation (design: docs/design/Sidebar.png, Client.png). Same colors, Switch app and phone Menu as HQ.
// Modes:
//   - Hub (no client open): Overview · Clients · Templates · Settings, + Add client. Clients are NEVER listed
//     here (50+ clients): they live on Clients and in the client switcher.
//   - Client Overview (/clients/{site id}, /baseline, /results, /site, /notes…): ← All clients, the switcher,
//     the Overview items, and the Strategy Builder button.
//   - Strategy Builder (/clients/{site id}/strategy/…): ← Client overview, the switcher, Strategy home, guide,
//     uploads, then one group per Sam day; each folds (remembered in this browser), the current day is always open.
// Collapse-to-icons (desktop) is kept (Angel, Nov 25): icons only show in that mode, like a rail.

// HQ's Apps page (the one-login portal). On localhost: HQ's dev server (cookies ignore ports, so you
// stay signed in). Override with VITE_HQ_URL (public address, not a secret).
const HQ_URL = import.meta.env.VITE_HQ_URL || (import.meta.env.DEV ? 'http://localhost:5173' : 'https://visual-vibe-dashboard.vercel.app')
const HQ_APPS_URL = `${HQ_URL.endsWith('/') ? HQ_URL.slice(0, -1) : HQ_URL}/apps`

const COLLAPSE_KEY = 'vv-seo-sidebar-collapsed'
const FOLDED_KEY = 'vv-seo-sidebar-folded'
const PHONE = '(max-width: 900px)'

/** Icons for the collapsed (icon-only) sidebar. */
const ICON: Record<string, NavIconName> = {
  'hub-overview': 'overview',
  clients: 'projects',
  templates: 'sops',
  automation: 'automations',
  settings: 'settings',
  overview: 'overview',
  baseline: 'reports',
  results: 'review',
  strategy: 'plan',
  setup: 'settings',
  guide: 'plan',
  uploads: 'queue',
  matrix: 'seo',
  database: 'builds',
  clusters: 'ideas',
  import: 'yesterday',
  reports: 'reports',
  review: 'review',
  pages: 'sops',
  plan: 'projects',
  briefs: 'notes',
  gbp: 'vibe',
  'gbp-care': 'calendar',
  links: 'team',
  site: 'settings',
  notes: 'notes',
  conversions: 'review',
}

function readStored<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : parse(raw)
  } catch {
    return fallback
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* per-browser convenience only */
  }
}

export default function Sidebar() {
  const clients = (useClients().data ?? []).filter((c) => c.status !== 'archived')
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => readStored(COLLAPSE_KEY, false, (r) => r === '1'))
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const mini = collapsed && !phone
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      store(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Which client is open? Only a real site id (32 hex): /clients/new and /clients/import are hub pages, not clients.
  const match = useMatch('/clients/:siteId/*')
  const openId = match?.params.siteId && /^[0-9a-f]{32}$/.test(match.params.siteId) ? match.params.siteId : null
  const close = () => setMenuOpen(false)

  return (
    <nav
      aria-label="Main"
      className={`sticky top-0 box-border flex h-screen flex-none flex-col gap-6 overflow-y-auto overflow-x-hidden bg-vv-lavender-100 py-7 transition-[width] duration-200 motion-reduce:transition-none phone:z-[35] phone:h-auto phone:w-auto phone:flex-row phone:flex-wrap phone:items-center phone:justify-between phone:gap-0 phone:overflow-visible phone:px-4 phone:py-2.5 phone:shadow-[0_10px_24px_-20px_rgba(75,51,181,.6)] ${
        mini ? 'w-[84px] px-3' : 'w-[272px] px-4'
      }`}
    >
      {/* Logo + "SEO HUB", collapse button (desktop) */}
      <div className={`flex items-center gap-2 phone:contents ${mini ? 'flex-col' : 'justify-between'}`}>
        <Link to="/" className={`flex flex-col text-vv-ink no-underline ${mini ? '' : 'px-2.5'}`} aria-label="SEO Hub home">
          {mini ? <img src="/brand/icon-192.png" alt="" className="h-10 w-10 rounded-full" /> : <Logo height={36} className="phone:hidden" />}
          <Logo height={28} className="hidden phone:inline-flex" />
          {!mini && <span className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-vv-purple-deep phone:hidden">SEO Hub</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={mini ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}
          aria-pressed={mini}
          title={mini ? 'Expand' : 'Collapse'}
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border-0 bg-transparent text-vv-purple-deep hover:bg-vv-lavender-50 phone:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {mini ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
          </svg>
        </button>
      </div>

      {/* Phones: dark mode icon in the top bar */}
      <ThemeToggle iconOnly className="hidden phone:ml-auto phone:mr-2 phone:inline-flex phone:min-h-11 phone:min-w-11 phone:justify-center phone:px-0" />

      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-controls="vv-navlinks"
        className="hidden min-h-11 items-center gap-2 rounded-full bg-vv-surface px-4 text-sm font-bold text-vv-purple-ink phone:inline-flex"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
        Menu
      </button>

      <div
        id="vv-navlinks"
        className={`contents ${
          menuOpen ? 'phone:flex phone:max-h-[calc(100vh-72px)] phone:w-full phone:flex-col phone:gap-4 phone:overflow-y-auto phone:pb-1.5 phone:pt-3.5' : 'phone:hidden'
        }`}
      >
        {openId ? <ClientNav siteId={openId} clients={clients} mini={mini} onGo={close} /> : <HubNav mini={mini} onGo={close} />}

        {/* Switch app: same as HQ's sidebar: one button pinned to the bottom (in the Menu on phones) that
            opens HQ's Apps page and stays signed in. */}
        <div className="sticky -bottom-7 z-[1] -mx-1 mt-auto bg-vv-lavender-100 px-1 pb-7 pt-2 phone:static phone:m-0 phone:p-0">
          <a
            href={HQ_APPS_URL}
            onClick={close}
            title={mini ? 'Switch app' : undefined}
            className={`box-border flex min-h-[52px] w-full items-center gap-3 rounded-full border border-solid border-vv-field-line bg-vv-surface text-left text-[15px] font-semibold text-vv-ink no-underline hover:bg-vv-lavender-50 hover:text-vv-ink ${
              mini ? 'justify-center px-0' : 'px-5'
            }`}
          >
            <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center text-vv-purple-deep">
              <NavIcon name="apps" />
            </span>
            <span className={mini ? 'sr-only' : 'whitespace-nowrap'}>Switch app</span>
          </a>
        </div>
      </div>
    </nav>
  )
}

// ---- Pieces ---------------------------------------------------------------------

/** Nav row: lavender pill (#BFAFFF) when active, bold. */
const rowClass = (mini: boolean, active: boolean, dim = false) =>
  `box-border flex min-h-[44px] w-full items-center gap-2.5 rounded-[14px] text-left text-[15px] text-vv-ink no-underline ${
    mini ? 'justify-center px-0' : 'justify-between px-4'
  } ${active ? 'bg-vv-lavender font-bold' : 'bg-transparent font-medium hover:bg-vv-lavender-50'} ${dim && !active ? 'text-vv-muted' : ''}`

function Item({ to, label, iconKey, mini, end, tag, onGo }: { to: string; label: string; iconKey: string; mini: boolean; end?: boolean; tag?: string; onGo: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onGo} title={mini ? (tag ? `${label} (${tag})` : label) : undefined} className={({ isActive }) => rowClass(mini, isActive, tag === 'Later')}>
      {mini ? (
        <span className="inline-flex h-[26px] w-[26px] items-center justify-center text-vv-purple-deep">
          <NavIcon name={ICON[iconKey] ?? 'overview'} />
          <span className="sr-only">{label}</span>
        </span>
      ) : (
        <>
          <span className="min-w-0 leading-tight [overflow-wrap:anywhere]">{label}</span>
          {tag && <Tag text={tag} />}
        </>
      )}
    </NavLink>
  )
}

function Tag({ text }: { text: string }) {
  return <span className="flex-none whitespace-nowrap rounded-full bg-vv-surface px-2 py-0.5 text-[11px] font-semibold text-vv-body">{text}</span>
}

/** Only "Later" shows in the sidebar; the phase of a not-built section shows on its page. */
const sidebarTag = (s: ClientSection) => (s.tag === 'Later' ? s.tag : undefined)

/** No client open. */
function HubNav({ mini, onGo }: { mini: boolean; onGo: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        {HUB_SECTIONS.map((s) => (
          // All clients stays active on /clients/new (the Add client page, design NewClient.png).
          <Item key={s.key} to={s.path} end={s.path === '/'} label={s.label} iconKey={s.key} mini={mini} onGo={onGo} />
        ))}
      </div>
      <Link
        to="/clients/new"
        onClick={onGo}
        title={mini ? 'Add client' : undefined}
        aria-label={mini ? 'Add client' : undefined}
        className={`box-border inline-flex min-h-[50px] items-center justify-center gap-1.5 rounded-full bg-vv-green text-[16px] font-bold text-vv-on-green no-underline hover:text-vv-on-green ${
          mini ? 'mx-auto h-[50px] w-[50px] px-0' : 'mx-1'
        }`}
      >
        <span aria-hidden="true">+</span>
        {!mini && 'Add client'}
      </Link>
    </>
  )
}

/**
 * A client open. Two areas (Angel, Nov 26), picked from the address:
 *   - Overview (/clients/{id}, /baseline, /results, /site, /notes…): results + quick access, and the Strategy Builder button.
 *   - Strategy Builder (/clients/{id}/strategy/…): Strategy home, guide, uploads, then one foldable group per Sam day.
 */
function ClientNav({ siteId, clients, mini, onGo }: { siteId: string; clients: ClientSummary[]; mini: boolean; onGo: () => void }) {
  const base = clientPath(siteId)
  const { pathname } = useLocation()
  const inStrategy = pathname === strategyPath(siteId) || pathname.startsWith(`${strategyPath(siteId)}/`)
  const current = clients.find((c) => c.siteId === siteId)
  const [folded, setFolded] = useState<string[]>(() => readStored(FOLDED_KEY, [], (r) => (JSON.parse(r) as unknown[]).filter((x): x is string => typeof x === 'string')))
  const toggleGroup = (key: string) =>
    setFolded((f) => {
      const next = f.includes(key) ? f.filter((k) => k !== key) : [...f, key]
      store(FOLDED_KEY, JSON.stringify(next))
      return next
    })
  const done = new Set(current?.guide.doneSteps ?? [])
  const strategyNow = strategyCurrent((n) => done.has(n))
  const back = inStrategy ? { to: base, label: 'Client overview' } : { to: '/clients', label: 'All clients' }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to={back.to}
          onClick={onGo}
          title={mini ? back.label : undefined}
          className={`flex min-h-8 items-center gap-1.5 rounded-[14px] text-[15px] font-medium text-vv-body no-underline hover:text-vv-purple-deep ${mini ? 'justify-center' : 'px-3'}`}
        >
          <span aria-hidden="true">←</span>
          <span className={mini ? 'sr-only' : ''}>{back.label}</span>
        </Link>
        {mini ? (
          <Link to={base} onClick={onGo} title={current?.name ?? 'Client'} className="mx-auto no-underline">
            <Avatar name={current?.name ?? '?'} />
          </Link>
        ) : (
          <ClientSwitcher siteId={siteId} current={current} clients={clients} onGo={onGo} />
        )}
      </div>

      {inStrategy ? (
        <>
          {!mini && <span className="-mb-4 px-4 text-xs font-bold uppercase tracking-[0.18em] text-vv-purple-deep">Strategy Builder</span>}
          <div className="flex flex-col gap-1">
            {STRATEGY_TOP.map((s) => (
              <Item
                key={s.key}
                to={clientPath(siteId, s.path)}
                end
                label={s.label}
                iconKey={s.key}
                mini={mini}
                tag={s.key === 'guide' && current ? stepDay(strategyNow) : sidebarTag(s)}
                onGo={onGo}
              />
            ))}
          </div>
          {STRATEGY_GROUPS.map((g) => (
            <Group key={g.key} group={g} siteId={siteId} mini={mini} open={mini || g.step === strategyNow || !folded.includes(g.key)} onToggle={() => toggleGroup(g.key)} onGo={onGo} />
          ))}
          <div className="-mt-2 flex flex-col gap-1 border-0 border-t border-solid border-vv-field-line pt-3">
            <Item to={clientPath(siteId, 'notes')} end label="Notes & links" iconKey="notes" mini={mini} onGo={onGo} />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {OVERVIEW_SECTIONS.map((s) => (
              <Item key={s.key} to={clientPath(siteId, s.path)} end label={s.label} iconKey={s.key} mini={mini} tag={sidebarTag(s)} onGo={onGo} />
            ))}
          </div>
          <Link
            to={strategyPath(siteId)}
            onClick={onGo}
            title={mini ? 'Strategy Builder' : undefined}
            aria-label={mini ? 'Strategy Builder' : undefined}
            className={`box-border inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-vv-green text-[16px] font-bold text-vv-on-green no-underline hover:text-vv-on-green ${
              mini ? 'mx-auto h-[50px] w-[50px] px-0' : 'mx-1'
            }`}
          >
            {mini ? <NavIcon name="plan" /> : <>Strategy Builder <span aria-hidden="true">→</span></>}
          </Link>
        </>
      )}
    </>
  )
}

function Group({ group: g, siteId, mini, open, onToggle, onGo }: { group: ClientGroup; siteId: string; mini: boolean; open: boolean; onToggle: () => void; onGo: () => void }) {
  const listId = useId()
  return (
    <div className="-mt-2 flex flex-col gap-1 border-0 border-t border-solid border-vv-field-line pt-3">
      {!mini && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-h-9 w-full items-center justify-between rounded-[10px] border-0 bg-transparent px-4 font-body text-xs font-semibold uppercase tracking-[0.14em] text-vv-muted hover:text-vv-ink"
        >
          {g.label}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      {open && (
        <div id={listId} className="flex flex-col gap-1">
          {g.items.map((s) => (
            <Item key={s.key} to={clientPath(siteId, s.path)} end label={s.label} iconKey={s.key} mini={mini} tag={sidebarTag(s)} onGo={onGo} />
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-vv-green font-body text-[15px] font-bold text-vv-on-green">
      {initials(name)}
    </span>
  )
}

/**
 * Client card + switcher (design: avatar, name on one line, a line under it, ⇅ button). Opens a list with
 * search; switching keeps you in the same section (…/keywords/import → other client's …/keywords/import).
 * The line under the name is the client's guide step ("Day 2 · Keywords").
 */
function ClientSwitcher({ siteId, current, clients, onGo }: { siteId: string; current?: ClientSummary; clients: ClientSummary[]; onGo: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()
  const base = `/clients/${siteId}`
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const term = q.trim().toLowerCase()
  const shown = term
    ? clients.filter((c) => [c.name, c.siteUrl, c.city ?? ''].some((v) => v.toLowerCase().includes(term)))
    : clients

  const go = (id: string) => {
    setOpen(false)
    setQ('')
    if (id !== siteId) navigate(`/clients/${id}${rest}`) // same page, other client (…/strategy/keywords → its Matrix)
    onGo()
  }

  const name = current?.name ?? 'Loading…'
  const sub = current ? stepLabel(current.guide.current) : ''

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Client: ${name}. Switch client`}
        className="box-border flex w-full items-center gap-3 rounded-[18px] border border-solid border-vv-field-line bg-vv-surface p-2.5 text-left font-body shadow-[0_14px_30px_-24px_rgba(91,63,208,.45)] hover:border-vv-lavender"
      >
        <Avatar name={current?.name ?? '?'} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-[14px] font-bold leading-tight text-vv-ink" title={name}>{name}</span>
          {sub && (
            <span className="flex items-center gap-1.5 truncate text-[13px] text-vv-body">
              <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-vv-purple" />
              <span className="truncate">{sub}</span>
            </span>
          )}
        </span>
        <span aria-hidden="true" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-vv-lavender-100 text-vv-purple-deep">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
          </svg>
        </span>
      </button>

      {open && (
        <div id={listId} className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 flex flex-col gap-1.5 rounded-[18px] border border-solid border-vv-field-line bg-vv-surface p-2 shadow-[0_18px_40px_-20px_rgba(75,51,181,.55)] phone:static phone:mt-1.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) {
                e.preventDefault()
                go(shown[0].siteId)
              }
            }}
            placeholder="Search clients"
            aria-label="Search clients"
            className="box-border min-h-10 w-full rounded-xl border-[1.5px] border-solid border-vv-field-line bg-vv-field px-3 font-body text-[14px] text-vv-ink"
          />
          <ul aria-label="Clients" className="m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto p-0">
            {shown.length === 0 && <li className="px-3 py-2 text-[14px] text-vv-muted">No client matches “{q.trim()}”.</li>}
            {shown.map((c) => (
              <li key={c.siteId}>
                <button
                  type="button"
                  onClick={() => go(c.siteId)}
                  aria-current={c.siteId === siteId ? 'true' : undefined}
                  className={`box-border flex min-h-11 w-full flex-col items-start justify-center rounded-xl border-0 px-3 py-1.5 text-left font-body ${
                    c.siteId === siteId ? 'bg-vv-lavender' : 'bg-transparent hover:bg-vv-lavender-50'
                  }`}
                >
                  <span className="line-clamp-2 w-full text-[14px] font-bold leading-tight text-vv-ink">{c.name}</span>
                  <span className="w-full truncate text-[12px] text-vv-body">
                    {[stepLabel(c.guide.current), [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/clients" onClick={() => { setOpen(false); onGo() }} className="px-3 py-1.5 text-[13px] font-bold text-vv-purple-deep no-underline hover:underline">
            All clients ›
          </Link>
        </div>
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
