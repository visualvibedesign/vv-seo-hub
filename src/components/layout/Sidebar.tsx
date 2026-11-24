import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router'
import { useClients } from '../../hooks/useClients'
import { CLIENT_SECTIONS, type ClientSection } from '../../lib/clientSetup'
import type { ClientSummary } from '../../types/seo'
import Logo from '../ui/Logo'
import NavIcon, { type NavIconName } from '../ui/NavIcon'
import ThemeToggle from '../ui/ThemeToggle'

// Left navigation, built from HQ's Sidebar (same sizes, colors, collapse button, phone Menu, Switch app).
// Two modes (Angel, 2026-11-20):
//   - No client open: Overview + All clients, then the client list (+ Add client).
//   - Client open (/clients/{site id}/…): "← All clients", a client switcher, then the client's sections
//     (the agency hub's workspace tabs). Keywords has sub-items. Not-built sections are greyed with their tag.

// HQ's Apps page (the one-login portal). On localhost: HQ's dev server (cookies ignore ports, so you
// stay signed in). Override with VITE_HQ_URL (public address, not a secret).
const HQ_URL = import.meta.env.VITE_HQ_URL || (import.meta.env.DEV ? 'http://localhost:5173' : 'https://visual-vibe-dashboard.vercel.app')
const HQ_APPS_URL = `${HQ_URL.endsWith('/') ? HQ_URL.slice(0, -1) : HQ_URL}/apps`

const COLLAPSE_KEY = 'vv-seo-sidebar-collapsed'
const PHONE = '(max-width: 900px)'

const SECTION_ICON: Record<string, NavIconName> = {
  overview: 'overview',
  keywords: 'seo',
  pages: 'sops',
  plan: 'builds',
  reports: 'reports',
  conversions: 'review',
  log: 'yesterday',
  notes: 'notes',
}

export default function Sidebar() {
  const clients = (useClients().data ?? []).filter((c) => c.status !== 'archived')
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
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
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* per-browser convenience only */
      }
      return !c
    })
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Which client is open? (/clients/new is the Add form, not a client.)
  const match = useMatch('/clients/:siteId/*')
  const openId = match?.params.siteId && match.params.siteId !== 'new' ? match.params.siteId : null
  const close = () => setMenuOpen(false)

  return (
    <nav
      aria-label="Main"
      className={`sticky top-0 box-border flex h-screen flex-none flex-col gap-6 overflow-y-auto overflow-x-hidden bg-vv-lavender-100 py-7 transition-[width] duration-200 motion-reduce:transition-none phone:z-[35] phone:h-auto phone:w-auto phone:flex-row phone:flex-wrap phone:items-center phone:justify-between phone:gap-0 phone:overflow-visible phone:px-4 phone:py-2.5 phone:shadow-[0_10px_24px_-20px_rgba(75,51,181,.6)] ${
        mini ? 'w-[84px] px-3' : 'w-[272px] px-4'
      }`}
    >
      {/* Logo + "SEO Hub" label, collapse button (desktop) */}
      <div className={`flex items-center gap-2 phone:contents ${mini ? 'flex-col' : 'justify-between'}`}>
        <Link to="/" className={`flex flex-col text-vv-ink no-underline ${mini ? '' : 'px-2.5'}`} aria-label="SEO Hub home">
          {mini ? <img src="/brand/icon-192.png" alt="" className="h-10 w-10 rounded-full" /> : <Logo height={36} className="phone:hidden" />}
          <Logo height={28} className="hidden phone:inline-flex" />
          {!mini && <span className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-vv-purple-deep phone:hidden">SEO Hub</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={mini ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}
          aria-pressed={mini}
          title={mini ? 'Expand' : 'Collapse'}
          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-solid border-vv-field-line bg-vv-surface text-vv-purple-deep phone:hidden"
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
        {openId ? <ClientNav siteId={openId} clients={clients} mini={mini} onGo={close} /> : <HubNav clients={clients} mini={mini} onGo={close} />}

        {/* Switch app: same as HQ's sidebar (HQ commit caeac2f, 2026-11-20): one button pinned to the
            bottom (in the Menu on phones) that opens HQ's Apps page and stays signed in. Log out lives
            on HQ's Apps page, like in HQ. Dark mode is in the page header (HeaderTools), like HQ. */}
        <div className="sticky -bottom-7 z-[1] -mx-1 mt-auto bg-vv-lavender-100 px-1 pb-7 pt-2 phone:static phone:m-0 phone:p-0">
          <a
            href={HQ_APPS_URL}
            onClick={close}
            title={mini ? 'Switch app' : undefined}
            className={`box-border flex min-h-[46px] w-full items-center gap-3 rounded-[14px] border border-solid border-vv-field-line bg-vv-surface text-left text-[15px] font-semibold text-vv-ink no-underline hover:bg-vv-lavender hover:text-vv-ink ${
              mini ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep">
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

/** HQ's nav row: 46px, 14px radius, lavender pill when active. */
const rowClass = (mini: boolean, active: boolean, dim = false) =>
  `box-border flex min-h-[46px] w-full items-center gap-2.5 rounded-[14px] text-left text-[15px] text-vv-ink no-underline ${
    mini ? 'justify-center px-0' : 'justify-between px-3'
  } ${active ? 'bg-vv-lavender font-bold' : 'bg-transparent font-medium hover:bg-vv-lavender-50'} ${dim && !active ? 'opacity-60' : ''}`

function GroupLabel({ label, mini }: { label: string; mini: boolean }) {
  return mini ? (
    <span className="mx-2 mb-1.5 border-t border-vv-field-line" aria-hidden="true" />
  ) : (
    <span className="whitespace-nowrap px-3 pb-1.5 text-xs font-semibold text-vv-muted">{label}</span>
  )
}

function Icon({ name, active }: { name: NavIconName; active: boolean }) {
  return (
    <span className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep ${active ? 'bg-vv-surface' : 'bg-transparent'}`}>
      <NavIcon name={name} />
    </span>
  )
}

function Item({ to, label, icon, mini, end, tag, onGo }: { to: string; label: string; icon: NavIconName; mini: boolean; end?: boolean; tag?: string; onGo: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onGo} title={mini ? (tag ? `${label} (${tag})` : label) : undefined} className={({ isActive }) => rowClass(mini, isActive, !!tag)}>
      {({ isActive }) => (
        <>
          <span className="flex min-w-0 items-center gap-3">
            <Icon name={icon} active={isActive} />
            <span className={mini ? 'sr-only' : 'truncate'}>{label}</span>
          </span>
          {!mini && tag && <Tag text={tag} />}
        </>
      )}
    </NavLink>
  )
}

function Tag({ text }: { text: string }) {
  return <span className="flex-none whitespace-nowrap rounded-full bg-vv-surface px-2 py-0.5 text-[11px] font-bold text-vv-muted">{text}</span>
}

/** No client open: Overview + All clients, then each client + Add client. */
function HubNav({ clients, mini, onGo }: { clients: ClientSummary[]; mini: boolean; onGo: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-[3px]">
        <GroupLabel label="SEO Hub" mini={mini} />
        <Item to="/" end label="Overview" icon="overview" mini={mini} onGo={onGo} />
        <Item to="/clients" end label="All clients" icon="projects" mini={mini} onGo={onGo} />
      </div>
      <div className="flex flex-col gap-[3px]">
        <GroupLabel label="Clients" mini={mini} />
        {clients.map((c) => (
          <Item key={c.siteId} to={`/clients/${c.siteId}`} label={c.name} icon="seo" mini={mini} onGo={onGo} />
        ))}
        <Item to="/clients/new" end label="Add client" icon="ideas" mini={mini} onGo={onGo} />
      </div>
    </>
  )
}

/** A client open: back link, client switcher, then the client's sections. */
function ClientNav({ siteId, clients, mini, onGo }: { siteId: string; clients: ClientSummary[]; mini: boolean; onGo: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = `/clients/${siteId}`
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  const current = clients.find((c) => c.siteId === siteId)
  const inKeywords = rest.startsWith('/keywords')

  // Switching client keeps you in the same section (…/keywords/import → other client's …/keywords/import).
  const switchTo = (id: string) => {
    if (!id || id === siteId) return
    navigate(`/clients/${id}${rest === '/edit' ? '' : rest}`)
    onGo()
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to="/clients"
          onClick={onGo}
          title={mini ? 'All clients' : undefined}
          className={`flex min-h-9 items-center gap-2 rounded-[14px] text-sm font-semibold text-vv-purple-deep no-underline hover:bg-vv-lavender-50 ${mini ? 'justify-center' : 'px-3'}`}
        >
          <span aria-hidden="true">←</span>
          <span className={mini ? 'sr-only' : ''}>All clients</span>
        </Link>
        {mini ? (
          <Link
            to={base}
            onClick={onGo}
            title={current?.name ?? 'Client'}
            className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-vv-surface font-display text-base font-semibold text-vv-purple-deep no-underline"
          >
            {initials(current?.name ?? '?')}
          </Link>
        ) : (
          <label className="flex flex-col gap-1 px-1">
            <span className="px-2 text-xs font-semibold text-vv-muted">Client</span>
            <select
              value={siteId}
              onChange={(e) => switchTo(e.target.value)}
              className="min-h-11 w-full truncate rounded-[14px] border-[1.5px] border-solid border-vv-toggle-line bg-vv-surface px-3 font-body text-[15px] font-bold text-vv-ink"
            >
              {!current && <option value={siteId}>Loading…</option>}
              {clients.map((c) => (
                <option key={c.siteId} value={c.siteId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-[3px]">
        <GroupLabel label="Workspace" mini={mini} />
        {CLIENT_SECTIONS.map((s) =>
          s.children ? (
            <div key={s.key} className="flex flex-col gap-[3px]">
              {/* Keywords: the parent opens Matrix; it's bold (not a pill) while one of its sub-items is open. */}
              <Link
                to={`${base}/${s.path}`}
                onClick={onGo}
                title={mini ? s.label : undefined}
                className={`${rowClass(mini, mini && inKeywords)} ${inKeywords && !mini ? '!font-bold' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon name={SECTION_ICON[s.key]} active={inKeywords} />
                  <span className={mini ? 'sr-only' : 'truncate'}>{s.label}</span>
                </span>
              </Link>
              {!mini && (
                <div className="ml-[22px] flex flex-col gap-[2px] border-l-2 border-solid border-vv-field-line pl-2">
                  {s.children.map((sub) => (
                    <SubItem key={sub.key} base={base} s={sub} onGo={onGo} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Item
              key={s.key}
              to={s.path ? `${base}/${s.path}` : base}
              end={!s.path}
              label={s.label}
              icon={SECTION_ICON[s.key]}
              mini={mini}
              tag={s.live ? undefined : s.tag}
              onGo={onGo}
            />
          ),
        )}
      </div>
    </>
  )
}

function SubItem({ base, s, onGo }: { base: string; s: ClientSection; onGo: () => void }) {
  return (
    <NavLink
      to={`${base}/${s.path}`}
      end
      onClick={onGo}
      className={({ isActive }) =>
        `box-border flex min-h-[38px] items-center justify-between gap-2 rounded-xl px-3 text-[14px] text-vv-ink no-underline ${
          isActive ? 'bg-vv-lavender font-bold' : 'font-medium hover:bg-vv-lavender-50'
        } ${!s.live && !isActive ? 'opacity-60' : ''}`
      }
    >
      <span className="truncate">{s.label}</span>
      {!s.live && <Tag text={s.tag} />}
    </NavLink>
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
