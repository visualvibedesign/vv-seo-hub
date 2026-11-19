import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useClients } from '../../hooks/useClients'
import type { ClientSummary } from '../../types/seo'
import Logo from '../ui/Logo'
import NavIcon, { type NavIconName } from '../ui/NavIcon'
import ThemeToggle from '../ui/ThemeToggle'

// Left navigation, built from HQ's Sidebar (same sizes, colors, collapse button and phone Menu).
// "SEO Hub": all clients + add. "Clients": a shortcut to each active client's workspace
// (/clients/{site id}); the client's tabs live on its page, not here.
type NavItem = { label: string; icon: NavIconName; to?: string; phase?: string; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

function navGroups(clients: ClientSummary[]): NavGroup[] {
  const active = clients.filter((c) => c.status !== 'archived')
  return [
    {
      label: 'SEO Hub',
      items: [
        { label: 'All clients', icon: 'projects', to: '/', end: true },
        { label: 'Add client', icon: 'ideas', to: '/clients/new', end: true },
      ],
    },
    ...(active.length ? [{ label: 'Clients', items: active.map((c) => ({ label: c.name, icon: 'seo' as NavIconName, to: `/clients/${c.siteId}` })) }] : []),
  ]
}

// HQ's Apps page (the one-login portal). On localhost: HQ's dev server (cookies ignore ports, so you
// stay signed in). Override with VITE_HQ_URL (public address, not a secret).
const HQ_URL = import.meta.env.VITE_HQ_URL || (import.meta.env.DEV ? 'http://localhost:5173' : 'https://visual-vibe-dashboard.vercel.app')
const HQ_APPS_URL = `${HQ_URL.endsWith('/') ? HQ_URL.slice(0, -1) : HQ_URL}/apps`

const COLLAPSE_KEY = 'vv-seo-sidebar-collapsed'
const PHONE = '(max-width: 900px)'

export default function Sidebar() {
  const groups = navGroups(useClients().data ?? [])
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

  const row = `box-border flex min-h-[46px] w-full items-center gap-2.5 rounded-[14px] text-left text-[15px] text-vv-ink no-underline ${
    mini ? 'justify-center px-0' : 'justify-between px-3'
  }`

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
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-[3px]">
            {mini ? (
              <span className="mx-2 mb-1.5 border-t border-vv-field-line" aria-hidden="true" />
            ) : (
              <span className="whitespace-nowrap px-3 pb-1.5 text-xs font-semibold text-vv-muted">{group.label}</span>
            )}
            {group.items.map((item) =>
              item.to ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  title={mini ? item.label : undefined}
                  className={({ isActive }) => `${row} ${isActive ? 'bg-vv-lavender font-bold' : 'bg-transparent font-medium'}`}
                >
                  {({ isActive }) => <ItemLabel item={item} mini={mini} active={isActive} />}
                </NavLink>
              ) : (
                <span key={item.label} aria-disabled="true" title={`${item.label}: coming in ${item.phase}`} className={`${row} cursor-default font-medium opacity-60`}>
                  <ItemLabel item={item} mini={mini} active={false} />
                  {!mini && <span className="whitespace-nowrap rounded-full bg-vv-surface px-2 py-0.5 text-[11px] font-bold text-vv-muted">{item.phase}</span>}
                </span>
              ),
            )}
          </div>
        ))}

        {/* Switch app: same as HQ's sidebar (HQ commit caeac2f, 2026-11-20): one button pinned to the
            bottom (in the Menu on phones) that opens HQ's Apps page and stays signed in. Log out lives
            on HQ's Apps page, like in HQ. Dark mode is in the page header (HeaderTools), like HQ. */}
        <div className="sticky -bottom-7 z-[1] -mx-1 mt-auto bg-vv-lavender-100 px-1 pb-7 pt-2 phone:static phone:m-0 phone:p-0">
          <a
            href={HQ_APPS_URL}
            onClick={() => setMenuOpen(false)}
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

function ItemLabel({ item, mini, active }: { item: NavItem; mini: boolean; active: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep ${active ? 'bg-vv-surface' : 'bg-transparent'}`}>
        <NavIcon name={item.icon} />
      </span>
      <span className={mini ? 'sr-only' : 'truncate'} title={item.label}>{item.label}</span>
    </span>
  )
}
