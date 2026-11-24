import { Link, Navigate, useLocation } from 'react-router'
import ComingCard from '../components/ui/ComingCard'
import { HUB_SECTIONS } from '../lib/clientSetup'
import { splitAccent } from '../lib/ui'

// Hub pages that aren't built yet (/templates, /automation): title, breadcrumb and a "coming" card.
export default function HubComingSoonPage() {
  const { pathname } = useLocation()
  const s = HUB_SECTIONS.find((x) => x.path === pathname.replace(/\/+$/, '') && !x.live)
  if (!s) return <Navigate to="/" replace />
  const [lead, accent] = splitAccent(s.label)
  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          SEO Hub
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">{s.label}</strong>
      </span>
      <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
        {lead}
        <em className="font-medium text-vv-purple">{accent}</em>
      </h1>
      <ComingCard section={s} />
    </>
  )
}
