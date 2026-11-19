import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { logout } from '../../lib/api'
import Logo from '../ui/Logo'
import NavIcon, { type NavIconName } from '../ui/NavIcon'
import ThemeToggle from '../ui/ThemeToggle'

// Left navigation, built from HQ's Sidebar (same sizes, colors, collapse button and phone Menu).
// Setup only: Overview is the one live page; the rest show which phase builds them.
type NavItem = { label: string; icon: NavIconName; to?: string; phase?: string }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  { label: 'SEO Hub', items: [{ label: 'Overview', icon: 'overview', to: '/' }] },
  {
    label: 'Clients',
    items: [
      { label: 'Clients', icon: 'projects', phase: 'Phase 1' },
      { label: 'Keywords & matrix', icon: 'seo', phase: 'Phase 1' },
      { label: 'Baseline & results', icon: 'reports', phase: 'Phase 2' },
      { label: 'Sitemap & hotspots', icon: 'builds', phase: 'Phase 3' },
      { label: 'GBP & links', icon: 'review', phase: 'Phase 4' },
      { label: 'Sites & automation', icon: 'automations', phase: 'Phase 5' },
    ],
  },
]

// HQ's Apps page (the one-login portal). Opens in HQ.
const HQ_APPS_URL = 'https://visual-vibe-dashboard.vercel.app/apps'

const COLLAPSE_KEY = 'vv-seo-sidebar-collapsed'
const PHONE = '(max-width: 900px)'

export default function Sidebar() {
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

  // Log out (same as HQ): drop the session cookie and everything cached, then go to Sign in.
  // It's the shared cookie, so this also signs this browser out of HQ.
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const signOut = async () => {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      qc.clear()
      setMenuOpen(false)
      navigate('/login', { replace: true })
    }
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
        {NAV_GROUPS.map((group) => (
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
                  end
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

        {/* Bottom: dark mode (desktop) + back to HQ's Apps page */}
        <div className="sticky -bottom-7 z-[1] -mx-1 mt-auto flex flex-col gap-1.5 bg-vv-lavender-100 px-1 pb-7 pt-2 phone:static phone:m-0 phone:p-0">
          <ThemeToggle iconOnly={mini} className={`justify-center border border-solid border-vv-toggle-line phone:hidden ${mini ? 'px-0' : ''}`} />
          <a href={HQ_APPS_URL} title={mini ? 'All apps' : undefined} className={`${row} font-semibold hover:bg-vv-lavender hover:text-vv-ink ${mini ? '' : '!justify-start gap-3'}`}>
            <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep">
              <NavIcon name="apps" />
            </span>
            <span className={mini ? 'sr-only' : 'whitespace-nowrap'}>All apps</span>
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            title={mini ? 'Log out' : undefined}
            className={`box-border flex min-h-[46px] w-full items-center gap-3 rounded-[14px] border border-solid border-vv-field-line bg-vv-surface text-left text-[15px] font-semibold text-vv-ink hover:bg-vv-lavender disabled:opacity-60 ${
              mini ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep">
              <NavIcon name="logout" />
            </span>
            <span className={mini ? 'sr-only' : 'whitespace-nowrap'}>{signingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

function ItemLabel({ item, mini, active }: { item: NavItem; mini: boolean; active: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-vv-purple-deep ${active ? 'bg-vv-surface' : 'bg-transparent'}`}>
        <NavIcon name={item.icon} />
      </span>
      <span className={mini ? 'sr-only' : 'whitespace-nowrap'}>{item.label}</span>
    </span>
  )
}
