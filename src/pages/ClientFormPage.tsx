import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone, Spinner } from '../components/ui/Loading'
import { useClient, useSaveClient } from '../hooks/useClients'
import { ApiError, checkSiteId } from '../lib/api'
import { AREA_CODES, CATEGORY_CODES, CATEGORY_HINT, DEFAULT_FAQ_NAME } from '../lib/clientSetup'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, LABEL } from '../lib/ui'
import type { AreaStatus, CategoryCode, ClientDetail, ClientInput, ClientStatus, SiteIdCheck } from '../types/seo'

// Add client (/clients/new) and Edit client (/clients/:siteId/edit). Sam's Day 1 setup:
// site + plugin site id, Home + S1–S3 (+ FAQ) with their services, A1–A3, kickoff answers.
// There is NO address field on purpose: a client's private address is never stored.

type ServiceDraft = { key: string; id?: string; name: string }
type FormState = Omit<ClientInput, 'categories'> & {
  /** pending = text typed in the services box but not added yet (added on save too). */
  categories: { code: CategoryCode; name: string; services: ServiceDraft[]; pending: string }[]
}

/** Category name limit (same as the server). */
const NAME_MAX = 80

let keySeq = 0
const newKey = () => `s${++keySeq}`

function emptyForm(): FormState {
  return {
    siteUrl: '',
    name: '',
    city: '',
    state: '',
    idealClient: '',
    usp: '',
    success12mo: '',
    notes: '',
    status: 'active',
    categories: CATEGORY_CODES.map((code) => ({ code, name: code === 'FAQ' ? DEFAULT_FAQ_NAME : '', services: [], pending: '' })),
    areas: AREA_CODES.map((code) => ({ code, name: '', state: '', status: code === 'A1' ? 'active' : 'n_a' })),
  }
}

function fromClient(c: ClientDetail): FormState {
  return {
    siteUrl: c.siteUrl,
    name: c.name,
    city: c.city ?? '',
    state: c.state ?? '',
    idealClient: c.idealClient ?? '',
    usp: c.usp ?? '',
    success12mo: c.success12mo ?? '',
    notes: c.notes ?? '',
    status: c.status,
    categories: CATEGORY_CODES.map((code) => {
      const k = c.categories.find((x) => x.code === code)
      return { code, name: k?.name ?? '', services: (k?.services ?? []).map((s) => ({ key: newKey(), id: s.id, name: s.name })), pending: '' }
    }),
    areas: AREA_CODES.map((code) => {
      const a = c.areas.find((x) => x.code === code)
      return { code, name: a?.name ?? '', state: a?.state ?? '', status: a?.status ?? 'n_a' }
    }),
  }
}

export default function ClientFormPage() {
  const { siteId } = useParams()
  const q = useClient(siteId)
  if (!siteId) return <ClientForm initial={emptyForm()} />
  if (q.isPending)
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <Bone className="h-12 w-96 max-w-full rounded-xl" />
        <Bone className="h-64 w-full rounded-[22px]" />
      </div>
    )
  if (q.isError || !q.data) return <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t load this client.</p>
  return <ClientForm initial={fromClient(q.data)} existing={q.data} />
}

function ClientForm({ initial, existing }: { initial: FormState; existing?: ClientDetail }) {
  const navigate = useNavigate()
  const save = useSaveClient()
  const [f, setF] = useState<FormState>(initial)
  const [error, setError] = useState('')
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  // Live site id check (debounced): cleaned URL, plugin site id, already used by another client?
  const [site, setSite] = useState<{ check?: SiteIdCheck; error?: string; busy?: boolean }>({})
  const lastUrl = useRef('')
  useEffect(() => {
    const url = f.siteUrl.trim()
    if (!url) {
      lastUrl.current = ''
      return
    }
    const t = setTimeout(() => {
      lastUrl.current = url
      setSite((s) => ({ ...s, busy: true }))
      checkSiteId(url, existing?.siteId)
        .then((check) => lastUrl.current === url && setSite({ check }))
        .catch((e) => lastUrl.current === url && setSite({ error: e instanceof ApiError && e.detail ? e.detail : 'That doesn’t look like a web address.' }))
    }, 400)
    return () => clearTimeout(t)
  }, [f.siteUrl, existing?.siteId])
  const siteShown = f.siteUrl.trim() ? site : {}
  const idChanges = !!existing && !!siteShown.check && siteShown.check.siteId !== existing.siteId

  const updateCategory = (code: CategoryCode, change: (c: FormState['categories'][number]) => FormState['categories'][number]) =>
    setF((s) => ({ ...s, categories: s.categories.map((c) => (c.code === code ? change(c) : c)) }))

  const moveService = (key: string, from: CategoryCode, to: CategoryCode) =>
    setF((s) => {
      const svc = s.categories.find((c) => c.code === from)?.services.find((x) => x.key === key)
      if (!svc) return s
      return {
        ...s,
        categories: s.categories.map((c) =>
          c.code === from ? { ...c, services: c.services.filter((x) => x.key !== key) } : c.code === to ? { ...c, services: [...c.services, svc] } : c,
        ),
      }
    })

  const allServiceNames = f.categories.flatMap((c) => c.services.map((s) => s.name.trim().toLowerCase())).filter(Boolean)
  const dupes = new Set(allServiceNames.filter((n, i) => allServiceNames.indexOf(n) !== i))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (dupes.size) return setError('A service is listed twice. Each service can only be in one category.')
    for (const c of f.categories) {
      if (c.name.trim().length > NAME_MAX)
        return setError(`The ${c.code} category name is too long (${NAME_MAX} characters max). Use a short name and put the services in the ${c.code} services box.`)
    }
    // Text still sitting in a services box counts too (as if Add was clicked).
    const categories = f.categories.map((c) => {
      const extra = splitNames(c.pending, c.services.map((s) => s.name))
      return { code: c.code, name: c.name, services: [...c.services.map((s) => ({ id: s.id, name: s.name })), ...extra.map((name) => ({ name }))] }
    })
    const client: ClientInput = { ...f, categories }
    try {
      const res = await save.mutateAsync({ client, siteId: existing?.siteId })
      navigate(`/clients/${res.siteId}`, { replace: !!existing })
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
        {existing ? (
          <>
            <Link to={`/clients/${existing.siteId}`} className="text-vv-muted no-underline hover:text-vv-purple-deep">
              {existing.name}
            </Link>{' '}
            <span aria-hidden="true">›</span> <strong className="text-vv-ink">Edit</strong>
          </>
        ) : (
          <strong className="text-vv-ink">Add client</strong>
        )}
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
          {existing ? 'Edit' : 'Add a'} <em className="font-medium text-vv-purple">client</em>
        </h1>
        <HeaderTools />
      </header>

      {/* Site */}
      <section className={CARD} aria-labelledby="f-site">
        <h2 id="f-site" className={CARD_TITLE}>
          Site
        </h2>
        <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
          <label className={LABEL}>
            Client name
            <input className={FIELD} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Anassa Wax & Beauty" required />
          </label>
          <label className={LABEL}>
            Website home URL
            <input
              className={FIELD}
              value={f.siteUrl}
              onChange={(e) => set('siteUrl', e.target.value)}
              placeholder="https://anassabeauty.com/"
              inputMode="url"
              autoComplete="off"
              required
            />
          </label>
          <label className={LABEL}>
            Main city
            <input className={FIELD} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Staten Island" />
          </label>
          <label className={LABEL}>
            State
            <input className={FIELD} value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="NY" />
          </label>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-vv-lavender-50 px-4 py-3 text-sm">
          <span className="font-semibold text-vv-body">Vibe SEO site id</span>
          {siteShown.busy && (
            <span className="flex items-center gap-2 text-vv-muted">
              <Spinner /> Working it out…
            </span>
          )}
          {!siteShown.busy && siteShown.check && (
            <>
              <code className="break-all font-mono text-[13px] text-vv-purple-ink">{siteShown.check.siteId}</code>
              <span className="text-vv-muted">
                Same id the Vibe SEO plugin sends for <strong>{siteShown.check.siteUrl}</strong>. This client’s address in SEO Hub: /clients/
                {siteShown.check.siteId.slice(0, 8)}…
              </span>
            </>
          )}
          {!siteShown.busy && siteShown.check?.takenBy && (
            <span role="alert" className="font-semibold text-vv-red">
              {siteShown.check.takenBy} already uses this site.
            </span>
          )}
          {!siteShown.busy && siteShown.error && <span className="font-semibold text-vv-red">{siteShown.error}</span>}
          {!siteShown.busy && !siteShown.check && !siteShown.error && <span className="text-vv-muted">Type the site’s home URL to see it.</span>}
          {idChanges && (
            <span role="alert" className="font-semibold text-vv-orange-ink">
              Changing the site changes its site id, so this client’s links change too (and the plugin must send from the new URL).
            </span>
          )}
        </div>
        <p className="m-0 text-[13px] text-vv-muted">No address here on purpose: a client’s private address is never stored in SEO Hub.</p>
      </section>

      {/* Services */}
      <section className={CARD} aria-labelledby="f-services">
        <div className="flex flex-col gap-1">
          <h2 id="f-services" className={CARD_TITLE}>
            Services
          </h2>
          <p className="m-0 text-sm text-vv-muted">
            Home + the 3 main service categories (S1–S3), each with the services under it. Keywords link to a service; the category follows from it.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {f.categories.map((cat) => (
            <CategoryEditor
              key={cat.code}
              cat={cat}
              dupes={dupes}
              onName={(name) => updateCategory(cat.code, (c) => ({ ...c, name }))}
              onServices={(services) => updateCategory(cat.code, (c) => ({ ...c, services }))}
              onPending={(pending) => updateCategory(cat.code, (c) => ({ ...c, pending }))}
              onMove={(key, to) => moveService(key, cat.code, to)}
            />
          ))}
        </div>
      </section>

      {/* Areas */}
      <section className={CARD} aria-labelledby="f-areas">
        <div className="flex flex-col gap-1">
          <h2 id="f-areas" className={CARD_TITLE}>
            Areas
          </h2>
          <p className="m-0 text-sm text-vv-muted">Top 3 areas (population + where the client wants work). One area only? Mark A2 and A3 N/A.</p>
        </div>
        <div className="flex flex-col gap-3">
          {f.areas.map((a) => (
            <div key={a.code} className="grid grid-cols-[48px_minmax(0,1fr)_120px_96px] items-center gap-3 phone:grid-cols-[30px_minmax(0,1fr)_70px_62px] phone:gap-2">
              <span className="font-display text-lg font-semibold text-vv-purple-deep phone:text-base">{a.code}</span>
              <label className={LABEL}>
                <span className="sr-only">{a.code} name</span>
                <input
                  className={FIELD}
                  value={a.name}
                  disabled={a.status === 'n_a'}
                  onChange={(e) => set('areas', f.areas.map((x) => (x.code === a.code ? { ...x, name: e.target.value } : x)))}
                  placeholder={a.status === 'n_a' ? 'N/A' : a.code === 'A1' ? 'Staten Island' : 'City or area'}
                />
              </label>
              <label className={LABEL}>
                <span className="sr-only">{a.code} state</span>
                <input
                  className={FIELD}
                  value={a.state}
                  disabled={a.status === 'n_a'}
                  onChange={(e) => set('areas', f.areas.map((x) => (x.code === a.code ? { ...x, state: e.target.value } : x)))}
                  placeholder="State"
                />
              </label>
              {a.code === 'A1' ? (
                <span className="text-xs font-semibold text-vv-muted">Main area</span>
              ) : (
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-vv-purple"
                    checked={a.status === 'n_a'}
                    onChange={(e) =>
                      set(
                        'areas',
                        f.areas.map((x) => (x.code === a.code ? { ...x, status: (e.target.checked ? 'n_a' : 'active') as AreaStatus } : x)),
                      )
                    }
                  />
                  N/A
                </label>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Kickoff */}
      <section className={CARD} aria-labelledby="f-kickoff">
        <h2 id="f-kickoff" className={CARD_TITLE}>
          Kickoff answers
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <TextArea label="After 12 months, how will they know this worked?" value={f.success12mo} onChange={(v) => set('success12mo', v)} />
          <TextArea label="Why choose them over a competitor? (USP)" value={f.usp} onChange={(v) => set('usp', v)} />
          <TextArea label="Ideal client and what they need" value={f.idealClient} onChange={(v) => set('idealClient', v)} />
          <TextArea label="Notes" value={f.notes} onChange={(v) => set('notes', v)} />
          {existing && (
            <label className={`${LABEL} max-w-[260px]`}>
              Status
              <select className={FIELD} value={f.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived (hidden from the list)</option>
              </select>
            </label>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 z-[5] -mx-1 flex flex-wrap items-center gap-3 border-t border-solid border-vv-line bg-vv-cream px-1 py-3.5 phone:bottom-0">
        <button type="submit" className={BTN_LIME} disabled={save.isPending || !!siteShown.check?.takenBy}>
          {save.isPending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : existing ? (
            'Save changes'
          ) : (
            'Add client'
          )}
        </button>
        <Link to={existing ? `/clients/${existing.siteId}` : '/clients'} className={BTN_GHOST}>
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

/** "Brazilian, Full bikini\nFull butt." → ["Brazilian", "Full bikini", "Full butt"] (no trailing dots, no repeats). */
function splitNames(text: string, skip: string[] = []): string[] {
  const seen = new Set(skip.map((s) => s.trim().toLowerCase()))
  const out: string[] = []
  for (const raw of text.split(/\r?\n|[,;]/)) {
    const name = raw.trim().replace(/[.\s]+$/, '')
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      out.push(name)
    }
  }
  return out
}

/** A category "name" that's really a list of services (commas, or very long). */
const looksLikeList = (name: string) => name.includes(',') || name.includes('\n') || name.length > 60

function CategoryEditor({
  cat,
  dupes,
  onName,
  onServices,
  onPending,
  onMove,
}: {
  cat: FormState['categories'][number]
  dupes: Set<string>
  onName: (name: string) => void
  onServices: (s: ServiceDraft[]) => void
  onPending: (text: string) => void
  onMove: (key: string, to: CategoryCode) => void
}) {
  const addPasted = () => {
    const names = splitNames(cat.pending, cat.services.map((s) => s.name))
    if (names.length) onServices([...cat.services, ...names.map((name) => ({ key: newKey(), name }))])
    onPending('')
  }
  // Typed the services into the name box? Offer to move them into the services list.
  const moveNameToServices = () => {
    const names = splitNames(cat.name, cat.services.map((s) => s.name))
    onServices([...cat.services, ...names.map((name) => ({ key: newKey(), name }))])
    onName('')
  }
  const nameTooLong = cat.name.trim().length > NAME_MAX
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-solid border-vv-line p-4">
      <div className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 phone:grid-cols-1">
        <span className="pt-8 font-display text-lg font-semibold text-vv-purple-deep phone:hidden">{cat.code}</span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className={LABEL}>
            {cat.code === 'Home' ? 'Home category name' : cat.code === 'FAQ' ? 'Help pages category name' : `${cat.code} category name`}
            <input
              className={`${FIELD} ${nameTooLong ? '!border-vv-error-line' : ''}`}
              value={cat.name}
              onChange={(e) => onName(e.target.value)}
              placeholder={cat.code === 'Home' ? 'e.g. All waxing' : cat.code === 'FAQ' ? DEFAULT_FAQ_NAME : 'e.g. Brazilian & Bikini (short name)'}
              aria-invalid={nameTooLong}
            />
          </label>
          <span className="text-xs text-vv-muted">{CATEGORY_HINT[cat.code]}</span>
          {looksLikeList(cat.name) && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] font-semibold text-vv-orange-ink">
              This looks like a list of services. The name is the category’s short name; services go in the list below.
              <button type="button" className={`${BTN_LINK} min-h-8 text-[13px] underline`} onClick={moveNameToServices}>
                Move them to {cat.code} services
              </button>
            </div>
          )}
        </div>
      </div>

      {cat.services.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 pl-[68px] [@media(max-width:1199px)]:grid-cols-1 phone:pl-0">
          {cat.services.map((s) => {
            const dupe = dupes.has(s.name.trim().toLowerCase())
            return (
              <li key={s.key} className="flex flex-wrap items-center gap-2 phone:gap-1.5">
                <input
                  aria-label={`Service name (${cat.code})`}
                  className={`${FIELD} min-h-10 min-w-0 flex-1 py-2 ${dupe ? '!border-vv-error-line' : ''}`}
                  value={s.name}
                  onChange={(e) => onServices(cat.services.map((x) => (x.key === s.key ? { ...x, name: e.target.value } : x)))}
                />
                <select
                  aria-label={`Move ${s.name || 'service'} to`}
                  className={`${FIELD} min-h-10 w-[92px] flex-none px-3 py-2 text-sm phone:w-[72px] phone:px-2`}
                  value={cat.code}
                  onChange={(e) => onMove(s.key, e.target.value as CategoryCode)}
                >
                  {CATEGORY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c === cat.code ? c : `Move to ${c}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${BTN_LINK} px-2 text-vv-muted`}
                  aria-label={`Remove ${s.name || 'service'}`}
                  title={s.id ? 'Remove (keywords on it become “no service”)' : 'Remove'}
                  onClick={() => onServices(cat.services.filter((x) => x.key !== s.key))}
                >
                  ✕
                </button>
                {dupe && <span className="w-full text-xs font-semibold text-vv-red">Listed twice</span>}
              </li>
            )
          })}
        </ul>
      )}

      {cat.code !== 'FAQ' && (
        <div className="flex flex-wrap items-end gap-2 pl-[68px] phone:pl-0">
          <label className={`${LABEL} flex-[1_1_260px]`}>
            {cat.services.length ? `Add more ${cat.code} services` : `${cat.code} services`} (one per line, or comma-separated)
            <textarea
              className={`${FIELD} min-h-[44px] resize-y py-2`}
              rows={cat.pending.includes('\n') ? 3 : 1}
              value={cat.pending}
              onChange={(e) => onPending(e.target.value)}
              placeholder={cat.code === 'Home' ? 'e.g. Waxing' : 'e.g. Brazilian, Full bikini, Bikini line'}
            />
          </label>
          <button type="button" className={`${BTN_GHOST} min-h-[44px]`} onClick={addPasted} disabled={!cat.pending.trim()}>
            Add
          </button>
          {cat.pending.trim() && <span className="w-full text-xs text-vv-muted">Not added yet: click Add, or they’re added when you save.</span>}
        </div>
      )}
    </div>
  )
}
