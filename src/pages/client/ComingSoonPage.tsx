import { Navigate, useLocation } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { ALL_SECTIONS, comingLabel, TAB_COMING } from '../../lib/clientSetup'
import { CARD, PILL_REVIEW, PILL_TODO } from '../../lib/ui'

// Sections that aren't built yet (/clients/{site id}/<path>): what's coming, and when.
export default function ComingSoonPage() {
  const c = useClientContext()
  const { pathname } = useLocation()
  const path = pathname.replace(`/clients/${c.siteId}`, '').replace(/^\/+|\/+$/g, '')
  const s = ALL_SECTIONS.find((x) => x.path === path && !x.live)
  if (!s) return <Navigate to={`/clients/${c.siteId}`} replace />
  const building = s.tag.startsWith('Step')

  return (
    <section className={`${CARD} items-start`} aria-labelledby="coming-h">
      <span className={building ? PILL_REVIEW : PILL_TODO}>{comingLabel(s)}</span>
      <h2 id="coming-h" className="m-0 font-display text-[28px] font-semibold leading-tight">
        {s.label}
      </h2>
      <p className="m-0 max-w-[640px] text-[15px] leading-normal text-vv-body">{TAB_COMING[s.key]}</p>
    </section>
  )
}
