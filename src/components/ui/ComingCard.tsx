import { comingLabel, TAB_COMING, type ClientSection } from '../../lib/clientSetup'
import { CARD, PILL_REVIEW, PILL_TODO } from '../../lib/ui'

/** "Coming" card for a section that isn't built yet: when it comes and what it will hold. */
export default function ComingCard({ section: s }: { section: ClientSection }) {
  return (
    <section className={`${CARD} items-start`} aria-labelledby="coming-h">
      <span className={s.tag === 'P1' ? PILL_REVIEW : PILL_TODO}>{comingLabel(s)}</span>
      <h2 id="coming-h" className="m-0 font-display text-[28px] font-semibold leading-tight">
        {s.label}
      </h2>
      <p className="m-0 max-w-[640px] text-[15px] leading-normal text-vv-body">{TAB_COMING[s.key]}</p>
    </section>
  )
}
