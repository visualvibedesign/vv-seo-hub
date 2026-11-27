import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { getSession } from '../../lib/api'
import { hqSignInUrl } from '../../lib/hq'
import { BootLoader } from '../ui/Loading'

// Password guard (same as HQ): pages inside it need the team password.
// Not signed in -> HQ's sign-in, then back to the page you wanted, signed in here too (2026-11-27:
// HQ is the one login; see hqSignInUrl). On localhost (both apps share the cookie there), or when
// that didn't work a moment ago (so it can never loop), this app's own /login is used instead.
const TRIED_KEY = 'vv-seo-hq-signin-tried'
const RETRY_MS = 60_000

export default function RequireSession() {
  const location = useLocation()
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((signedIn) => !cancelled && setState(signedIn ? 'in' : 'out'))
      .catch(() => !cancelled && setState('out'))
    return () => {
      cancelled = true
    }
  }, [])

  const goToHq = state === 'out' && !import.meta.env.DEV && !triedRecently()
  useEffect(() => {
    if (!goToHq) return
    try {
      sessionStorage.setItem(TRIED_KEY, String(Date.now()))
    } catch {
      /* storage blocked: a failed handoff still lands on /login, which stops any loop */
    }
    window.location.replace(hqSignInUrl(window.location.href))
  }, [goToHq])

  if (state === 'checking' || goToHq) return <BootLoader />
  if (state === 'out') {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

function triedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(TRIED_KEY) ?? 0) < RETRY_MS
  } catch {
    return false
  }
}
