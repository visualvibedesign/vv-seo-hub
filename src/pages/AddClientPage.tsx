import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AreasEditor, NoAddressNote, ServicesEditor, SiteIdNote } from '../components/client/ClientFormParts'
import { emptyForm, servicesProblem, toInput, useSiteCheck, type FormState } from '../lib/clientForm'
import HeaderTools from '../components/layout/HeaderTools'
import { Spinner } from '../components/ui/Loading'
import { useSaveClient } from '../hooks/useClients'
import { ApiError } from '../lib/api'
import { ACCOUNTS, ACCOUNT_STATUS_LABEL, INDUSTRIES } from '../lib/clientSetup'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, LABEL } from '../lib/ui'
import type { AccountKind, AccountStatus } from '../types/seo'

// Add client (/clients/new): the 4-step wizard from the design (docs/design/NewClient.png):
// Site → Template → Services & areas → Accounts → "Start the step-by-step guide".
// Nothing is saved until the last step. There is NO address field on purpose.

const STEPS = ['Site', 'Template', 'Services & areas', 'Accounts'] as const
type Step = 0 | 1 | 2 | 3

export default function AddClientPage() {
  const navigate = useNavigate()
  const save = useSaveClient()
  const [step, setStep] = useState<Step>(0)
  const [reached, setReached] = useState<Step>(0)
  const [f, setF] = useState<FormState>(emptyForm)
  const [accounts, setAccounts] = useState<Record<AccountKind, AccountStatus>>(
    () => Object.fromEntries(ACCOUNTS.map((a) => [a.kind, 'pending'])) as Record<AccountKind, AccountStatus>,
  )
  const [error, setError] = useState('')
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const site = useSiteCheck(f.siteUrl)

  /** What stops this step, or ''. */
  const problemAt = (s: Step): string => {
    if (s === 0) {
      if (!f.name.trim()) return 'Add the business name.'
      if (!f.siteUrl.trim()) return 'Add the website home URL.'
      if (site.busy || (!site.check && !site.error)) return 'Hold on, the site id is still being worked out.'
      if (site.error) return site.error
      if (site.check?.takenBy) return `${site.check.takenBy} already uses this site.`
    }
    if (s === 1 && !f.industry) return 'Pick a template (Blank is fine).'
    if (s === 2) return servicesProblem(f)
    return ''
  }

  const goTo = (s: Step) => {
    setError('')
    // A1 starts as the main city from step 1, if it's still empty.
    if (s === 2) {
      setF((x) => ({
        ...x,
        areas: x.areas.map((a) => (a.code === 'A1' && !a.name.trim() ? { ...a, name: x.city.trim(), state: a.state || x.state.trim() } : a)),
      }))
    }
    setStep(s)
    setReached((r) => (s > r ? s : r))
    window.scrollTo({ top: 0 })
  }

  const next = async (e: FormEvent) => {
    e.preventDefault()
    const problem = problemAt(step)
    if (problem) return setError(problem)
    if (step < 3) return goTo((step + 1) as Step)
    // Last step: save, then open the guide.
    setError('')
    try {
      const client = { ...toInput(f), accounts: ACCOUNTS.map((a) => ({ kind: a.kind, status: accounts[a.kind] })) }
      const res = await save.mutateAsync({ client })
      navigate(`/clients/${res.siteId}/guide`)
    } catch (err) {
      setError(err instanceof ApiError && err.detail ? err.detail : 'Couldn’t save. Check your connection and try again.')
    }
  }

  return (
    <form onSubmit={next} noValidate className="flex flex-col gap-6">
      <span className="text-[15px] text-vv-muted">
        <Link to="/clients" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          Clients
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">Add client</strong>
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            New client, <em className="font-medium text-vv-purple">head start.</em>
          </h1>
          <p className="m-0 text-[17px] text-vv-body">Four short steps. Everything can be changed later.</p>
        </div>
        <HeaderTools />
      </header>

      <ol aria-label="Steps" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {STEPS.map((label, i) => {
          const current = i === step
          const canGo = i <= reached && !current
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => canGo && goTo(i as Step)}
                disabled={!canGo && !current}
                aria-current={current ? 'step' : undefined}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border border-solid py-1.5 pl-1.5 pr-4 font-body text-[15px] font-semibold text-vv-ink disabled:cursor-default ${
                  current ? 'border-vv-lavender bg-vv-lavender' : 'border-vv-field-line bg-vv-surface hover:enabled:bg-vv-lavender-50'
                } ${!canGo && !current ? 'opacity-70' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${current ? 'bg-vv-ink text-vv-surface' : 'bg-vv-lavender-100 text-vv-body'}`}
                >
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>

      <section className={`${CARD} max-w-[880px]`} aria-labelledby="wiz-h">
        {step === 0 && (
          <>
            <h2 id="wiz-h" className={CARD_TITLE}>
              The site
            </h2>
            <label className={LABEL}>
              Business name
              <input className={FIELD} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="New client" autoFocus required />
            </label>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>
                Website home URL
                <input
                  className={FIELD}
                  value={f.siteUrl}
                  onChange={(e) => set('siteUrl', e.target.value)}
                  placeholder="https://example.com/"
                  inputMode="url"
                  autoComplete="off"
                  required
                />
              </label>
              <SiteIdNote site={site} />
            </div>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 phone:grid-cols-1">
              <label className={LABEL}>
                Main city
                <input className={FIELD} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
              </label>
              <label className={LABEL}>
                State
                <input className={FIELD} value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="ST" />
              </label>
            </div>
            <NoAddressNote />
          </>
        )}

        {step === 1 && (
          <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend id="wiz-h" className={`${CARD_TITLE} mb-1 p-0`}>
              Pick a template
            </legend>
            <p className="m-0 -mt-2 text-sm text-vv-muted">
              The industry template is saved on the client. Seed keywords and checklists from templates come with the Templates step.
            </p>
            <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
              {INDUSTRIES.map((i) => {
                const on = f.industry === i.key
                return (
                  <label
                    key={i.key}
                    className={`flex cursor-pointer flex-col gap-1 rounded-2xl border-[1.5px] border-solid p-4 ${
                      on ? 'border-vv-purple bg-vv-lavender-50' : 'border-vv-field-line bg-vv-surface hover:bg-vv-lavender-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <input type="radio" name="industry" className="h-5 w-5 accent-vv-purple" checked={on} onChange={() => set('industry', i.key)} />
                      <span className="text-[16px] font-bold text-vv-ink">{i.label}</span>
                    </span>
                    <span className="pl-[30px] text-sm text-vv-body">{i.hint}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="wiz-h" className={CARD_TITLE}>
                Services & areas
              </h2>
              <p className="m-0 text-sm text-vv-muted">
                Home + the 3 main service categories (S1–S3) with the services under each, then the top 3 areas. One area only? Mark A2 and A3 N/A.
              </p>
            </div>
            <ServicesEditor f={f} setF={setF} />
            <h3 className="m-0 mt-2 font-display text-[19px] font-semibold">Areas</h3>
            <AreasEditor f={f} set={set} />
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="wiz-h" className={CARD_TITLE}>
                Accounts
              </h2>
              <p className="m-0 text-sm text-vv-muted">What’s ready today. Status only: never passwords or keys. You can change these later on the client’s Overview.</p>
            </div>
            <AccountList list={ACCOUNTS.filter((a) => a.core)} accounts={accounts} setAccounts={setAccounts} />
            <details className="group">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-vv-purple-deep [&::-webkit-details-marker]:hidden">
                More accounts ({ACCOUNTS.filter((a) => !a.core).length})
                <span className="text-[13px] font-normal text-vv-muted">optional, they don’t count toward “accounts pending”</span>
              </summary>
              <AccountList list={ACCOUNTS.filter((a) => !a.core)} accounts={accounts} setAccounts={setAccounts} />
            </details>
          </>
        )}
      </section>

      {error && (
        <p role="alert" className="m-0 max-w-[880px] rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step === 0 ? (
          <Link to="/clients" className={BTN_GHOST}>
            Cancel
          </Link>
        ) : (
          <button type="button" className={BTN_GHOST} onClick={() => goTo((step - 1) as Step)} disabled={save.isPending}>
            ‹ Back
          </button>
        )}
        <button type="submit" className={BTN_LIME} disabled={save.isPending}>
          {save.isPending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : step < 3 ? (
            'Next ›'
          ) : (
            'Start the step-by-step guide ›'
          )}
        </button>
      </div>
    </form>
  )
}

type AccountMap = Record<AccountKind, AccountStatus>

function AccountList({ list, accounts, setAccounts }: { list: typeof ACCOUNTS; accounts: AccountMap; setAccounts: (f: (x: AccountMap) => AccountMap) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {list.map((a) => (
        <li key={a.kind} className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-vv-line py-3 last:border-b-0">
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-vv-ink">{a.label}</span>
            {a.hint && <span className="text-[13px] text-vv-muted">{a.hint}</span>}
          </span>
          <span role="radiogroup" aria-label={`${a.label} status`} className="inline-flex gap-1 rounded-full bg-vv-lavender-50 p-1">
            {(['ready', 'pending', 'n_a'] as AccountStatus[]).map((st) => {
              const on = accounts[a.kind] === st
              return (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAccounts((x) => ({ ...x, [a.kind]: st }))}
                  className={`min-h-9 rounded-full border-0 px-3.5 font-body text-[13px] font-bold ${on ? 'bg-vv-lavender text-vv-ink' : 'bg-transparent text-vv-body hover:bg-vv-surface'}`}
                >
                  {ACCOUNT_STATUS_LABEL[st]}
                </button>
              )
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}
