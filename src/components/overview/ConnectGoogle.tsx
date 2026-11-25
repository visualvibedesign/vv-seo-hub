import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGoogleSetup } from '../../hooks/useGoogle'
import { ApiError, saveGoogleLink, testGoogle } from '../../lib/api'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, LABEL, PILL } from '../../lib/ui'
import type { ClientDetail, GoogleSetup, GoogleTestResult } from '../../types/seo'
import { Spinner } from '../ui/Loading'

// Client Overview › Connect Search Console + GA4 (phase 2a). The agency's service account reads both (read-only);
// its email is added once per client. Here: pick the properties, Test (7 days, nothing saved), Save the ids.
// The numbers themselves (daily pull, tiles, charts) come in step 2b.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

export default function ConnectGoogle({ client: c, open, setOpen }: { client: ClientDetail; open: boolean; setOpen: (v: boolean) => void }) {
  const q = useGoogleSetup(c.siteId)
  const s = q.data
  const linked = !!(s?.link?.gscProperty || s?.link?.ga4Property)

  // Linked: nothing here (the Sources button shows the properties; its Change opens this panel).
  if (linked && !open) return null

  return (
    <section className={`${CARD} !rounded-[20px] !border-dashed !border-vv-lavender !gap-2.5 !p-8 phone:!p-5 items-start`} aria-labelledby="ov-google">
      <span className={`${PILL} ${linked ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-lavender-100 text-vv-purple-ink'}`}>Search Console + GA4 · {linked ? 'linked' : 'not connected'}</span>
      <h2 id="ov-google" className="m-0 font-display text-[26px] font-semibold leading-tight">
        {linked ? 'Google is linked. The numbers arrive with the daily pull.' : 'Connect Google to see searches, clicks and CTR here.'}
      </h2>
      {linked && s?.link && (
        <p className="m-0 text-[14px] text-vv-body">
          Search Console: <strong>{s.link.gscProperty ?? '—'}</strong> · GA4: <strong>{s.link.ga4Property ?? '—'}</strong>
          {s.link.queryWords.length ? ` · local query words: ${s.link.queryWords.join(', ')}` : ''}
        </p>
      )}
      {!linked && (
        <p className="m-0 max-w-[640px] text-[15px] leading-normal text-vv-body">
          Impressions, clicks, CTR, average position, top searches, top pages and organic sessions come from the free Google APIs, read-only, through the agency’s service account.
        </p>
      )}
      {!open ? (
        <span className="flex flex-wrap items-center gap-3">
          <button type="button" className={linked ? BTN_GHOST : BTN_LIME} onClick={() => setOpen(true)} disabled={q.isPending}>
            {q.isPending && <Spinner />}
            {linked ? 'Change' : 'Connect Search Console + GA4'}
          </button>
        </span>
      ) : s ? (
        <Panel client={c} setup={s} onClose={() => setOpen(false)} />
      ) : (
        <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the Google setup.')}</p>
      )}
    </section>
  )
}

function Panel({ client: c, setup: s, onClose }: { client: ClientDetail; setup: GoogleSetup; onClose: () => void }) {
  const qc = useQueryClient()
  const [gsc, setGsc] = useState(s.link?.gscProperty ?? '')
  const [ga4, setGa4] = useState(s.link?.ga4Property ?? '')
  const [words, setWords] = useState((s.link?.queryWords ?? []).join(', '))
  const [copied, setCopied] = useState(false)
  const test = useMutation({ mutationFn: () => testGoogle(gsc.trim(), ga4.trim()) })
  const save = useMutation({
    mutationFn: () => saveGoogleLink(c.siteId, { gscProperty: gsc.trim(), ga4Property: ga4.trim(), queryWords: words.split(',').map((w) => w.trim()).filter(Boolean) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['google', c.siteId] })
      onClose()
    },
  })

  if (!s.serviceEmail)
    return (
      <div className="flex w-full flex-col gap-2 rounded-2xl bg-vv-red-100 p-4 text-[14px] text-vv-red">
        <strong>Google isn’t set up on the server yet.</strong>
        <span>Add the service account key as GOOGLE_SERVICE_ACCOUNT_JSON (in .env.local and Vercel, server only), then reload.</span>
        <button type="button" className={`${BTN_LINK} self-start text-[13px]`} onClick={onClose}>
          Close
        </button>
      </div>
    )

  return (
    <div className="flex w-full flex-col gap-4">
      <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[14px] text-vv-body">
        <li>
          Add{' '}
          <button
            type="button"
            className="rounded-md border-0 bg-vv-lavender-100 px-1.5 py-0.5 font-mono text-[13px] text-vv-purple-ink"
            title="Copy"
            onClick={() => void navigator.clipboard?.writeText(s.serviceEmail!).then(() => setCopied(true))}
          >
            {s.serviceEmail}
          </button>{' '}
          {copied && <span className="text-[12px] text-vv-green-ink">copied</span>} in <strong>Search Console › Settings › Users and permissions</strong> (Restricted is enough) and in <strong>GA4 › Admin › Property access management</strong> (Viewer).
        </li>
        <li>Pick the two properties below (or type them), press Test, then Save.</li>
      </ol>
      {!s.tableReady && <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] font-semibold text-vv-orange-ink">Migration 0016 hasn’t been run yet: Test works, Save needs it.</p>}
      {s.listErrors.map((e) => (
        <p key={e} className="m-0 text-[13px] text-vv-orange-ink">
          {e}
        </p>
      ))}
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        <label className={LABEL}>
          Search Console property
          <input className={FIELD} list="gsc-sites" value={gsc} placeholder="sc-domain:example.com" onChange={(e) => setGsc(e.target.value)} />
          <datalist id="gsc-sites">
            {s.gscSites.map((x) => (
              <option key={x.property} value={x.property}>
                {x.permission}
              </option>
            ))}
          </datalist>
          <span className="text-[12px] font-normal text-vv-muted">{s.gscSites.length ? `${s.gscSites.length} the service account can see` : 'None visible yet: add the email first, or type it'}</span>
        </label>
        <label className={LABEL}>
          GA4 property
          <select className={FIELD} value={s.ga4Properties.some((p) => p.property === ga4) ? ga4 : ''} onChange={(e) => setGa4(e.target.value)}>
            <option value="">{s.ga4Properties.length ? 'Pick a property…' : 'None visible yet'}</option>
            {s.ga4Properties.map((p) => (
              <option key={p.property} value={p.property}>
                {p.name} · {p.property.replace('properties/', '')}
                {p.account ? ` (${p.account})` : ''}
              </option>
            ))}
          </select>
          <input className={`${FIELD} mt-1`} value={ga4} placeholder="or type the property number, e.g. 123456789" onChange={(e) => setGa4(e.target.value)} />
        </label>
      </div>
      <label className={LABEL}>
        Local query words (optional)
        <input className={FIELD} value={words} placeholder="e.g. staten island, waxing, brazilian" onChange={(e) => setWords(e.target.value)} />
        <span className="text-[12px] font-normal text-vv-muted">City + service words for the “local searches” view (comma-separated).</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_GHOST} disabled={test.isPending || (!gsc.trim() && !ga4.trim())} onClick={() => test.mutate()}>
          {test.isPending && <Spinner />}
          Test (7 days, nothing saved)
        </button>
        <button type="button" className={BTN_LIME} disabled={save.isPending || !s.tableReady} onClick={() => save.mutate()}>
          {save.isPending && <Spinner />}
          Save
        </button>
        <button type="button" className={`${BTN_LINK} text-[13px]`} onClick={onClose}>
          Cancel
        </button>
      </div>
      {test.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(test.error, 'The test didn’t go through.')}</p>}
      {test.data && <TestResult r={test.data} />}
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save.')}</p>}
    </div>
  )
}

function TestResult({ r }: { r: GoogleTestResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
      {r.gsc && (
        <div className={`rounded-2xl p-3.5 text-[13px] ${r.gsc.ok ? 'bg-vv-lavender-50' : 'bg-vv-red-100 text-vv-red'}`}>
          <strong className="block">Search Console · {r.from} → {r.to}</strong>
          {r.gsc.ok ? `${num(r.gsc.impressions)} impressions · ${num(r.gsc.clicks)} clicks · CTR ${num(r.gsc.ctr * 100)}% · avg position ${num(r.gsc.position)}` : r.gsc.error}
        </div>
      )}
      {r.ga4 && (
        <div className={`rounded-2xl p-3.5 text-[13px] ${r.ga4.ok ? 'bg-vv-green-100' : 'bg-vv-red-100 text-vv-red'}`}>
          <strong className="block">GA4 organic · last 7 days</strong>
          {r.ga4.ok ? `${num(r.ga4.sessions)} sessions · ${num(r.ga4.engagedSessions)} engaged · ${num(r.ga4.users)} users` : r.ga4.error}
        </div>
      )}
    </div>
  )
}
