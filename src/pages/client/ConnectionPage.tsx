import { useClientContext } from '../../components/layout/ClientLayout'
import { PageHead, Panel, Soon } from '../../components/overview/OverviewParts'
import { BTN_LIME, CARD, PILL, siteLabel } from '../../lib/ui'

// Client Overview › Site connection (/clients/{site id}/site): the Vibe SEO plugin's daily check-in, the per-site
// SEO Hub key and the work log. Design: docs/design/overview/Connection.dc.html. The plugin connection is built after
// SEO Hub phases 1–4 (Angel, Nov 26): this is the "not connected" shell. No key is made here yet.

const STEPS = [
  { t: 'Make a key', d: 'SEO Hub makes a key for this site. It’s shown once, so copy it.' },
  { t: 'Paste it in WordPress', d: 'Vibe SEO › Settings › SEO Hub key.' },
  { t: 'Add the SEO Hub address', d: 'Same screen: the SEO Hub web address.' },
  { t: 'Save + check in', d: 'Saving sends the first check-in. This page turns green.' },
]
const INBOUND = ['Every page’s title, meta, keyphrase + score', 'Missing alt text, orphan pages', 'Form entries + visitors', 'QA scan summary', 'What changed this week']
const OUTBOUND = ['Approved titles + metas', 'Focus keyphrases', 'Redirects', 'Target keyword in the WP pages list']

export default function ConnectionPage() {
  const c = useClientContext()
  const site = siteLabel(c.siteUrl)
  return (
    <>
      <PageHead lead="Site connection," accent="via Vibe SEO." sub={`The plugin on ${site} checks in once a day. Nothing is pushed to the site without your OK.`} />

      <section className={`${CARD} !gap-4 !rounded-[24px] !border-dashed !border-vv-lavender !p-6 phone:!p-5`} aria-labelledby="cn-h">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`${PILL} bg-vv-pink-100 text-vv-pill-red-ink`}>Not connected</span>
          <span className="text-[13px] text-vv-body">No check-in yet</span>
        </div>
        <h2 id="cn-h" className="m-0 font-display text-[26px] font-semibold leading-tight">
          Connect {site} in 4 steps
        </h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-0">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex flex-col gap-1.5 rounded-[18px] bg-vv-lavender-50 p-4">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-vv-purple font-bold text-white">{i + 1}</span>
              <strong>{s.t}</strong>
              <span className="text-[13px] leading-normal text-vv-body">{s.d}</span>
            </li>
          ))}
        </ol>
        <span className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN_LIME} disabled>
            Generate SEO Hub key
          </button>
          <Soon>Comes with the Vibe SEO plugin, after phases 1–4</Soon>
        </span>
      </section>

      <div className="grid grid-cols-2 items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Panel title="Connection key">
          <p className="m-0 rounded-[14px] bg-vv-lavender-50 p-3.5 text-[13px] text-vv-body">No key yet.</p>
          <p className="m-0 text-[13px] leading-relaxed text-vv-body">One key per site, shown once and stored safely (never shown again). A new key stops the old one right away.</p>
        </Panel>
        <Panel title="What syncs">
          <div className="grid grid-cols-2 gap-3.5 phone:grid-cols-1">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-vv-green-ink">Site → SEO Hub</span>
              {INBOUND.map((x) => (
                <span key={x} className="text-[13px]">
                  {x}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-vv-purple-ink">SEO Hub → site · later</span>
              {OUTBOUND.map((x) => (
                <span key={x} className="text-[13px] text-vv-body">
                  {x}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <Panel title="Check-in log">
          <p className="m-0 text-[13px] text-vv-body">No check-ins yet. Each daily check-in is listed here: when, the result, pages seen and what changed on the site.</p>
        </Panel>
        <Panel title="Work log" right={<Soon>Later</Soon>}>
          <p className="m-0 text-[13px] leading-relaxed text-vv-body">Every title, meta or keyphrase pushed from SEO Hub shows here: before → after, who and when. Pushes wait for your confirm first.</p>
        </Panel>
      </div>
    </>
  )
}
