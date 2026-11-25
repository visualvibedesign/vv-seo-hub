import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone, Spinner } from '../components/ui/Loading'
import { useClient, useClients } from '../hooks/useClients'
import { useApplyTemplate, useTemplates } from '../hooks/useTemplates'
import { ApiError } from '../lib/api'
import { IndustrySelect, NewIndustryForm } from '../components/client/IndustryPicker'
import { useIndustryLabel } from '../hooks/useIndustries'
import { stepDay } from '../lib/guide'
import { fill, fillSearch, seedsFor, varsFromClient, WORD_GROUP_LABEL } from '../lib/templates'
import { BTN_GHOST, BTN_LIME, CARD, FIELD, PILL } from '../lib/ui'
import type { ClientIndustry, Template, WordGroup } from '../types/seo'

// Templates (/templates), design docs/design/Templates.png: one template per step of Sam's 10 days. Pick an
// industry to see its versions (falls back to the generic one). Apply stores a copy on the client, so editing a
// template later never changes clients it was already applied to.

const DAY_PILL = `${PILL} bg-vv-lavender-100 text-vv-purple-ink`

/** For an industry: its own version of each kind, else the generic one. "All industries": the generic ones. */
function visible(all: Template[], industry: ClientIndustry | ''): Template[] {
  if (!industry) return all.filter((t) => t.industry === null)
  const own = all.filter((t) => t.industry === industry)
  const kinds = new Set(own.map((t) => t.kind))
  return [...all.filter((t) => t.industry === null && !kinds.has(t.kind)), ...own].sort(
    (a, b) => all.indexOf(a) - all.indexOf(b),
  )
}

export default function TemplatesPage() {
  const q = useTemplates()
  const [params, setParams] = useSearchParams()
  const industry = (params.get('industry') ?? '') as ClientIndustry | ''
  const list = visible(q.data ?? [], industry)
  const [adding, setAdding] = useState(false)
  const industryLabel = useIndustryLabel()
  const selected = list.find((t) => t.id === params.get('t')) ?? list[0]
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'industry') next.delete('t')
    setParams(next, { replace: true })
  }

  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          SEO Hub
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">Templates</strong>
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Set it up once. <em className="font-medium text-vv-purple">Reuse it.</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">
            One template per step of Sam’s 10 days. Apply it to a client and their services, city and state fill in.
          </p>
        </div>
        <HeaderTools>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-vv-ink">
            Industry
            <IndustrySelect className={`${FIELD} w-auto rounded-full`} value={industry || null} onChange={(k) => set('industry', k ?? '')} empty="All industries (generic)" />
          </label>
          <button type="button" className={BTN_GHOST} onClick={() => setAdding(true)} disabled={adding}>
            Add industry
          </button>
          <Link to={`/templates/new${industry ? `?industry=${industry}` : ''}`} className={BTN_LIME}>
            + New template
          </Link>
        </HeaderTools>
      </header>

      {adding && (
        <NewIndustryForm
          cta="Add industry"
          onCancel={() => setAdding(false)}
          onDone={(i) => {
            setAdding(false)
            set('industry', i.key)
          }}
        />
      )}
      {industry && q.isSuccess && !(q.data ?? []).some((t) => t.industry === industry) && (
        <p className="m-0 rounded-2xl bg-vv-lavender-50 px-4 py-3 text-[14px] text-vv-body">
          {industryLabel(industry)} has no versions of its own, so clients in it use these generic templates with their own services, areas, scope and brand words. Make a
          version with “+ New template” only when the rules miss words for this type of business.
        </p>
      )}

      {q.isPending && (
        <div aria-busy="true" className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-6 [@media(max-width:1100px)]:grid-cols-1">
          <span role="status" className="sr-only">
            Loading templates
          </span>
          <Bone className="h-[480px] rounded-[22px]" />
          <Bone className="h-[480px] rounded-[22px]" />
        </div>
      )}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the templates. If migration 0004 hasn’t run yet, run it in Supabase first.
        </p>
      )}
      {q.isSuccess && list.length === 0 && (
        <div className={`${CARD} items-start`}>
          <p className="m-0 text-[15px] text-vv-body">No templates yet. Run migration 0004 (it adds the 7 built-in ones), or make one.</p>
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 phone:grid-cols-1">
            {list.map((t) => {
              const on = t.id === selected.id
              const clients = new Set(t.applied.map((a) => a.siteId)).size
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      set('t', t.id)
                      // Narrow screens show the details above the cards: bring them into view.
                      if (window.matchMedia('(max-width: 1100px)').matches) document.getElementById('tpl-detail')?.scrollIntoView({ block: 'start' })
                    }}
                    aria-pressed={on}
                    className={`${CARD} h-full w-full cursor-pointer text-left font-body ${on ? '!border-[1.5px] !border-vv-lavender' : 'hover:!border-vv-lavender'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={DAY_PILL}>{stepDay(t.samStep)}</span>
                      <span className="text-[13px] text-vv-body">{clients ? `${clients} client${clients === 1 ? '' : 's'}` : 'Not used yet'}</span>
                    </span>
                    <span className="font-display text-[24px] font-semibold leading-tight text-vv-ink phone:text-[21px]">{t.name}</span>
                    <span className="text-[15px] leading-normal text-vv-body">{t.description}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Detail key={selected.id} t={selected} />
        </div>
      )}
    </>
  )
}

function Detail({ t }: { t: Template }) {
  const industryLabel = useIndustryLabel()
  const clients = (useClients().data ?? []).filter((c) => c.status !== 'archived')
  const [siteId, setSiteId] = useState(t.applied[0]?.siteId ?? clients[0]?.siteId ?? '')
  const pick = siteId || clients[0]?.siteId || ''
  const client = useClient(pick || undefined).data
  const apply = useApplyTemplate()
  const [copied, setCopied] = useState(false)

  const patterns = t.items.filter((i) => i.kind === 'pattern')
  const words = (['money', 'faq', 'service'] as WordGroup[]).map((g) => ({ g, list: t.items.filter((i) => i.kind === 'word' && i.wordGroup === g).map((i) => i.body) })).filter((w) => w.list.length)
  const others = t.items.filter((i) => i.kind === 'rule' || i.kind === 'export' || i.kind === 'text')
  const vars = client ? varsFromClient(client) : null
  const search = t.kind === 'keyword_research'
  const preview = vars ? patterns.map((p) => (search ? fillSearch(p.body, vars) : fill(p.body, vars))) : []
  const textPreview = vars && !patterns.length ? others.filter((i) => i.kind === 'text').map((i) => fill(i.body, vars)) : []
  const seeds = client && search ? seedsFor(t.items, client) : []
  const appliedHere = t.applied.find((a) => a.siteId === pick)
  const error = apply.error ? (apply.error instanceof ApiError && apply.error.detail ? apply.error.detail : 'Couldn’t apply. Try again.') : ''

  return (
    <section id="tpl-detail" className={`${CARD} !gap-4 !p-7 phone:!p-5 [@media(max-width:1100px)]:order-first`} aria-labelledby="tpl-h">
      <span className={`${DAY_PILL} self-start`}>{stepDay(t.samStep)}</span>
      <div className="flex flex-col gap-1.5">
        <h2 id="tpl-h" className="m-0 font-display text-[30px] font-semibold leading-tight">
          {t.name}
        </h2>
        <p className="m-0 text-[16px] text-vv-body">{t.description}</p>
        <span className="text-[13px] text-vv-muted">
          {t.industry ? industryLabel(t.industry) : 'All industries (generic)'}
          {t.builtIn ? ' · built in' : ''}
        </span>
      </div>

      <div className="flex flex-col">
        <h3 className="m-0 border-0 border-b border-solid border-vv-line pb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-vv-body">What’s in it</h3>
        <ul className="m-0 flex list-none flex-col p-0">
          {patterns.length > 0 && <Bullet>{search ? 'Seed patterns' : 'Patterns'}: {patterns.map((p) => p.body).join(' · ')}</Bullet>}
          {words.map((w) => (
            <Bullet key={w.g}>
              {WORD_GROUP_LABEL[w.g]}: {w.list.join(', ')}
            </Bullet>
          ))}
          {others.map((i, n) => (
            <Bullet key={n}>
              {i.kind === 'export' ? 'Export: ' : ''}
              {i.body}
            </Bullet>
          ))}
        </ul>
      </div>

      {(preview.length > 0 || textPreview.length > 0) && (
        <div className="flex flex-col gap-2 rounded-[18px] border border-solid border-vv-line bg-vv-lavender-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-vv-body">Preview for</span>
            <select aria-label="Preview for client" className={`${FIELD} w-auto max-w-[220px] rounded-full py-1.5 text-[14px]`} value={pick} onChange={(e) => setSiteId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.siteId} value={c.siteId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {[...preview, ...textPreview].slice(0, 8).map((line, n) => (
              <li key={n} className="text-[15px] text-vv-ink">
                {line}
              </li>
            ))}
          </ul>
          {seeds.length > 0 && (
            <button
              type="button"
              className="self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-vv-purple-deep underline"
              onClick={() => {
                void navigator.clipboard.writeText(seeds.join('\n')).then(() => setCopied(true))
              }}
            >
              {copied ? 'Copied ✓' : `Copy all ${seeds.length} seeds (every service × area) for Keyword Planner`}
            </button>
          )}
        </div>
      )}
      {!client && clients.length > 0 && <Bone className="h-24 w-full rounded-[18px]" />}

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-vv-red-100 px-3 py-2 text-[14px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_LIME} disabled={!pick || apply.isPending} onClick={() => apply.mutate({ templateId: t.id, siteId: pick })}>
          {apply.isPending && <Spinner />}
          Apply to {clients.find((c) => c.siteId === pick)?.name ?? 'a client'}
        </button>
        <Link to={`/templates/${t.id}/edit`} className={BTN_GHOST}>
          Edit template
        </Link>
      </div>
      {appliedHere && (
        <span role="status" className="text-[14px] text-vv-green-ink">
          Applied to {appliedHere.name} on {new Date(appliedHere.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Applying again saves a new copy.
        </span>
      )}
      <p className="m-0 text-[14px] text-vv-body">Editing a template never changes clients it was already applied to.</p>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-0 border-b border-solid border-vv-line py-2.5 text-[15px] leading-snug text-vv-ink last:border-b-0">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-vv-purple" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}
