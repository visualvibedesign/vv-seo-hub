import { Navigate, useParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { CLIENT_TABS, TAB_COMING } from '../../lib/clientSetup'
import { CARD, PILL_REVIEW, PILL_TODO } from '../../lib/ui'

// Tabs that aren't built yet (/clients/{site id}/{tab}): what's coming, and in which phase.
export default function ComingSoonPage() {
  const { tab } = useParams()
  const c = useClientContext()
  const t = CLIENT_TABS.find((x) => x.path === tab && !x.live)
  if (!t) return <Navigate to={`/clients/${c.siteId}`} replace />
  const building = t.key === 'keywords'

  return (
    <section className={`${CARD} items-start`} aria-labelledby="coming-h">
      <span className={building ? PILL_REVIEW : PILL_TODO}>
        {building ? 'Building now · phase 1' : t.phase === 'later' ? 'Coming later' : `Coming in phase ${t.phase}`}
      </span>
      <h2 id="coming-h" className="m-0 font-display text-[28px] font-semibold leading-tight">
        {t.label}
      </h2>
      <p className="m-0 max-w-[640px] text-[15px] leading-normal text-vv-body">{TAB_COMING[t.key]}</p>
    </section>
  )
}
