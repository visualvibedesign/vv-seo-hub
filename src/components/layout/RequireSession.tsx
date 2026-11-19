import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { getSession } from '../../lib/api'
import { BootLoader } from '../ui/Loading'

// Password guard (same as HQ): pages inside it need the team password.
// Not signed in -> /login, then back to the page you wanted.
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

  if (state === 'checking') return <BootLoader />
  if (state === 'out') {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}
