import { Navigate, useLocation } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import ComingCard from '../../components/ui/ComingCard'
import { ALL_SECTIONS } from '../../lib/clientSetup'

// Client sections that aren't built yet (/clients/{site id}/<path>): what's coming, and when.
export default function ComingSoonPage() {
  const c = useClientContext()
  const { pathname } = useLocation()
  const path = pathname.replace(`/clients/${c.siteId}`, '').replace(/^\/+|\/+$/g, '')
  const s = ALL_SECTIONS.find((x) => x.path === path && !x.live)
  if (!s) return <Navigate to={`/clients/${c.siteId}`} replace />
  return <ComingCard section={s} />
}
