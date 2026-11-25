import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { AreasEditor, NoAddressNote, ServicesEditor, SiteIdNote } from '../components/client/ClientFormParts'
import { fromClient, servicesProblem, splitNames, toInput, useSiteCheck, type FormState } from '../lib/clientForm'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone, Spinner } from '../components/ui/Loading'
import { useClient, useSaveClient } from '../hooks/useClients'
import { ApiError } from '../lib/api'
import { domainName } from '../lib/autofillRules'
import { IndustrySelect } from '../components/client/IndustryPicker'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, LABEL } from '../lib/ui'
import type { ClientDetail, ClientStatus } from '../types/seo'

// Edit client (/clients/:siteId/edit): everything on one page. Adding a client is the 4-step wizard
// (AddClientPage, /clients/new). There is NO address field on purpose.
export default function ClientFormPage() {
  const { siteId } = useParams()
  const q = useClient(siteId)
  if (!siteId) return <Navigate to="/clients/new" replace />
  if (q.isPending)
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <span role="status" className="sr-only">
          Loading the client
        </span>
        <Bone className="h-12 w-96 max-w-full rounded-xl" />
        <Bone className="h-64 w-full rounded-[22px]" />
      </div>
    )
  if (q.isError || !q.data) return <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t load this client.</p>
  return <EditForm key={q.data.siteId} existing={q.data} />
}

function EditForm({ existing }: { existing: ClientDetail }) {
  const navigate = useNavigate()
  const save = useSaveClient()
  const [f, setF] = useState<FormState>(() => fromClient(existing))
  const [error, setError] = useState('')
  // Scope words (migration 0008), typed as comma / line separated text.
  const [outOfScope, setOutOfScope] = useState(existing.outOfScopeWords.join(', '))
  const [hoods, setHoods] = useState(existing.neighbourhoodWords.join(', '))
  const [brand, setBrand] = useState(existing.brandWords.join(', ')) // migration 0009
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const site = useSiteCheck(f.siteUrl, existing.siteId)
  const idChanges = !!site.check && site.check.siteId !== existing.siteId

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!f.name.trim()) return setError('Add the client’s name.')
    const problem = servicesProblem(f)
    if (problem) return setError(problem)
    try {
      // Only sent when there's something to save (so Edit client still works before migration 0008 runs).
      const scope = splitNames(outOfScope)
      const hood = splitNames(hoods)
      const brandWords = splitNames(brand)
      const words = {
        ...(scope.length || hood.length || existing.outOfScopeWords.length || existing.neighbourhoodWords.length ? { outOfScopeWords: scope, neighbourhoodWords: hood } : {}),
        ...(brandWords.length || existing.brandWords.length ? { brandWords } : {}),
      }
      const res = await save.mutateAsync({ client: { ...toInput(f), ...words }, siteId: existing.siteId })
      navigate(`/clients/${res.siteId}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.detail ? err.detail : 'Couldn’t save. Check your connection and try again.')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <span className="text-[15px] text-vv-muted">
        <Link to="/clients" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          Clients
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <Link to={`/clients/${existing.siteId}`} className="text-vv-muted no-underline hover:text-vv-purple-deep">
          {existing.name}
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">Edit</strong>
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
          Edit <em className="font-medium text-vv-purple">client.</em>
        </h1>
        <HeaderTools />
      </header>

      <section className={CARD} aria-labelledby="f-site">
        <h2 id="f-site" className={CARD_TITLE}>
          The site
        </h2>
        <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
          <label className={LABEL}>
            Business name
            <input className={FIELD} value={f.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>
              Website home URL
              <input className={FIELD} value={f.siteUrl} onChange={(e) => set('siteUrl', e.target.value)} inputMode="url" autoComplete="off" required />
            </label>
            <SiteIdNote site={site} idChanges={idChanges} />
          </div>
          <label className={LABEL}>
            Main city
            <input className={FIELD} value={f.city} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label className={LABEL}>
            State
            <input className={FIELD} value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="ST" />
          </label>
          <label className={LABEL}>
            Industry template
            <IndustrySelect value={f.industry} onChange={(k) => set('industry', k)} empty="No industry yet" />
          </label>
          <label className={LABEL}>
            Status
            <select className={FIELD} value={f.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <NoAddressNote />
      </section>

      <section className={CARD} aria-labelledby="f-services">
        <div className="flex flex-col gap-1">
          <h2 id="f-services" className={CARD_TITLE}>
            Services
          </h2>
          <p className="m-0 text-sm text-vv-muted">Home + the 3 main service categories (S1–S3), each with the services under it. Keywords link to a service.</p>
        </div>
        <ServicesEditor f={f} setF={setF} />
      </section>

      <section className={CARD} aria-labelledby="f-areas">
        <div className="flex flex-col gap-1">
          <h2 id="f-areas" className={CARD_TITLE}>
            Areas
          </h2>
          <p className="m-0 text-sm text-vv-muted">Top 3 areas (population + where the client wants work). One area only? Mark A2 and A3 N/A.</p>
        </div>
        <AreasEditor f={f} set={set} />
      </section>

      <section className={CARD} aria-labelledby="f-scope">
        <div className="flex flex-col gap-1">
          <h2 id="f-scope" className={CARD_TITLE}>
            Scope &amp; brand words
          </h2>
          <p className="m-0 text-sm text-vv-muted">
            Keywords with one of these words get no role, service or intent suggestions. They go to the “Out of scope &amp; neighbourhoods” list on Uploads → Day 2 for you to confirm. Separate with commas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
          <label className={LABEL}>
            Out of scope (suggest Rejected)
            <textarea className={`${FIELD} min-h-[76px] resize-y`} value={outOfScope} onChange={(e) => setOutOfScope(e.target.value)} placeholder="Words for services this client doesn’t offer" />
          </label>
          <label className={LABEL}>
            Neighbourhoods, not an area yet (suggest Later)
            <textarea className={`${FIELD} min-h-[76px] resize-y`} value={hoods} onChange={(e) => setHoods(e.target.value)} placeholder="Neighbourhoods inside the main area" />
          </label>
          <label className={`${LABEL} col-span-2 phone:col-span-1`}>
            Brand words (the client’s own name, never a competitor)
            <input className={FIELD} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={`Empty = “${existing.name.toLowerCase()}” and “${domainName(existing.siteUrl)}” are used`} />
          </label>
        </div>
      </section>

      {/* Kickoff answers (12-month goal, USP, ideal client) are skipped at our agency: not asked here. Saved values stay
          in the database untouched (the form sends back what was loaded). */}
      <section className={CARD} aria-labelledby="f-notes">
        <h2 id="f-notes" className={CARD_TITLE}>
          Notes
        </h2>
        <TextArea label="Notes about this client" value={f.notes} onChange={(v) => set('notes', v)} />
      </section>

      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 z-[5] -mx-1 flex flex-wrap items-center gap-3 border-t border-solid border-vv-line bg-vv-cream px-1 py-3.5">
        <button type="submit" className={BTN_LIME} disabled={save.isPending || !!site.check?.takenBy}>
          {save.isPending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
        <Link to={`/clients/${existing.siteId}`} className={BTN_GHOST}>
          Cancel
        </Link>
      </div>
    </form>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={LABEL}>
      {label}
      <textarea className={`${FIELD} min-h-[76px] resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
