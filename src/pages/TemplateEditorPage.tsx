import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone, Spinner } from '../components/ui/Loading'
import { useClient, useClients } from '../hooks/useClients'
import { useSaveTemplate, useTemplates } from '../hooks/useTemplates'
import { ApiError } from '../lib/api'
import { IndustrySelect } from '../components/client/IndustryPicker'
import { GUIDE } from '../lib/guide'
import { fill, fillSearch, stateName, TEMPLATE_KINDS, VARIABLES, varsFromClient, WORD_GROUP_LABEL } from '../lib/templates'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, LABEL } from '../lib/ui'
import type { ClientIndustry, Template, TemplateInput, TemplateItem, TemplateKind, WordGroup } from '../types/seo'

// Template editor (/templates/new, /templates/:id/edit), design docs/design/TemplateEditor.png: name, type, Sam day,
// industry, variables, the lines (patterns, words, rules, exports, steps) and a live preview with a sample client.
// Saving never changes clients it was already applied to (they keep their copy).

type Line = TemplateItem & { key: number }
let seq = 0
const withKeys = (items: TemplateItem[]): Line[] => items.map((i) => ({ ...i, key: ++seq }))

export default function TemplateEditorPage() {
  const { id } = useParams()
  const q = useTemplates()
  if (!id) return <Editor />
  if (q.isPending)
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <span role="status" className="sr-only">
          Loading the template
        </span>
        <Bone className="h-12 w-96 max-w-full rounded-xl" />
        <Bone className="h-[480px] w-full rounded-[22px]" />
      </div>
    )
  const t = q.data?.find((x) => x.id === id)
  if (!t) return <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t find this template.</p>
  return <Editor key={t.id} existing={t} />
}

function Editor({ existing }: { existing?: Template }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const save = useSaveTemplate()
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<TemplateKind>(existing?.kind ?? 'keyword_research')
  const [samStep, setSamStep] = useState(existing?.samStep ?? 1)
  const [industry, setIndustry] = useState<ClientIndustry | ''>(existing?.industry ?? ((params.get('industry') ?? '') as ClientIndustry | ''))
  const [description, setDescription] = useState(existing?.description ?? '')
  const [lines, setLines] = useState<Line[]>(() => withKeys(existing?.items ?? []))
  const [error, setError] = useState('')

  // Live preview: sample values from a real client (editable).
  const clients = (useClients().data ?? []).filter((c) => c.status !== 'archived')
  const sampleClient = useClient(clients[0]?.siteId).data
  const base = sampleClient ? varsFromClient(sampleClient) : null
  const [sample, setSample] = useState<{ service?: string; city?: string; st?: string }>({})
  // Keyword research reads like searches (lower case); titles, H1s and posts keep normal case.
  const lc = (s: string) => (kind === 'keyword_research' ? s.toLowerCase() : s)
  const vars = {
    service: sample.service ?? lc(base?.service ?? ''),
    city: sample.city ?? lc(base?.city ?? ''),
    st: sample.st ?? lc(base?.st ?? ''),
    brand: base?.brand ?? '',
  }
  const full = { ...vars, state: vars.st ? stateName(vars.st) : '' }

  const add = (item: TemplateItem) => setLines((l) => [...l, { ...item, key: ++seq }])
  const remove = (key: number) => setLines((l) => l.filter((x) => x.key !== key))
  const patterns = lines.filter((l) => l.kind === 'pattern')
  const search = kind === 'keyword_research'

  const submit = async () => {
    setError('')
    const input: TemplateInput = { id: existing?.id, kind, name, samStep, industry: industry || null, description, items: lines.map(({ kind: k, wordGroup, body }) => ({ kind: k, wordGroup, body })) }
    try {
      const res = await save.mutateAsync(input)
      navigate(`/templates?t=${res.template.id}${res.template.industry ? `&industry=${res.template.industry}` : ''}`)
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : 'Couldn’t save. Check your connection and try again.')
    }
  }

  return (
    <>
      <span className="text-[15px] text-vv-muted">
        <Link to="/templates" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          Templates
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">{existing ? existing.name : 'New template'}</strong>
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Make it <em className="font-medium text-vv-purple">once.</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">Write patterns with variables. Each client fills them in with their own services, city and state.</p>
        </div>
        <HeaderTools>
          <Link to="/templates" className={BTN_GHOST}>
            Cancel
          </Link>
          <button type="button" className={BTN_LIME} onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending && <Spinner />}
            Save template
          </button>
        </HeaderTools>
      </header>

      {existing && existing.applied.length > 0 && (
        <p className="m-0 rounded-2xl bg-vv-lavender-50 px-4 py-3 text-[14px] text-vv-body">
          Applied to {new Set(existing.applied.map((a) => a.siteId)).size} client(s). They keep the copy they got; saving changes this template for next time only.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
        <section className={CARD} aria-label="Template">
          <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
            <label className={LABEL}>
              Template name
              <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Keyword research · Med spa" maxLength={80} />
            </label>
            <label className={LABEL}>
              Type
              <select
                className={FIELD}
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as TemplateKind
                  setKind(k)
                  if (!existing) setSamStep(TEMPLATE_KINDS.find((x) => x.kind === k)!.step)
                }}
              >
                {TEMPLATE_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Sam day
              <select className={FIELD} value={samStep} onChange={(e) => setSamStep(Number(e.target.value))}>
                {GUIDE.map((g) => (
                  <option key={g.n} value={g.n}>
                    {g.day.replace(' + monthly', '')} · {g.short}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Industry
              <IndustrySelect value={industry || null} onChange={(k) => setIndustry(k ?? '')} empty="All industries (generic)" />
            </label>
            <label className={`${LABEL} col-span-2 phone:col-span-1`}>
              Description
              <input className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="One line: what this template sets up" />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-bold text-vv-ink">Variables</span>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {VARIABLES.map((v) => (
                <li key={v.name} className="rounded-full bg-vv-lavender-100 px-3 py-1 text-[14px] text-vv-body">
                  <code className="font-mono font-bold text-vv-purple-deep">{`{${v.name}}`}</code> {v.hint}
                </li>
              ))}
            </ul>
          </div>

          <LineList title={`Patterns (${patterns.length})`} lines={patterns} mono onRemove={remove} onAdd={(body) => add({ kind: 'pattern', wordGroup: null, body })} placeholder="e.g. {service} cost {city}" />
          {(['money', 'faq', 'service'] as WordGroup[]).map((g) => (
            <WordList key={g} title={WORD_GROUP_LABEL[g]} words={lines.filter((l) => l.kind === 'word' && l.wordGroup === g)} onRemove={remove} onAdd={(body) => add({ kind: 'word', wordGroup: g, body })} />
          ))}
          <LineList title="Exports" lines={lines.filter((l) => l.kind === 'export')} onRemove={remove} onAdd={(body) => add({ kind: 'export', wordGroup: null, body })} placeholder="e.g. Semrush Keyword Magic: one per service, database US, export" />
          <LineList title="Steps / text" lines={lines.filter((l) => l.kind === 'text')} onRemove={remove} onAdd={(body) => add({ kind: 'text', wordGroup: null, body })} placeholder="e.g. Week 1: meet {brand}" />
          <LineList title="Rules" lines={lines.filter((l) => l.kind === 'rule')} onRemove={remove} onAdd={(body) => add({ kind: 'rule', wordGroup: null, body })} placeholder="e.g. Volumes exactly as exported" />
        </section>

        <section className={`${CARD} !gap-4`} aria-labelledby="live-h">
          <h2 id="live-h" className={CARD_TITLE}>
            Live preview
          </h2>
          <p className="-mt-2 m-0 text-[15px] text-vv-body">Try it with a sample client before saving.</p>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)] gap-2">
            <label className={LABEL}>
              Service
              <input className={FIELD} value={vars.service} onChange={(e) => setSample((s) => ({ ...s, service: e.target.value }))} />
            </label>
            <label className={LABEL}>
              City
              <input className={FIELD} value={vars.city} onChange={(e) => setSample((s) => ({ ...s, city: e.target.value }))} />
            </label>
            <label className={LABEL}>
              ST
              <input className={FIELD} value={vars.st} onChange={(e) => setSample((s) => ({ ...s, st: e.target.value }))} maxLength={4} />
            </label>
          </div>
          <ul className="m-0 flex list-none flex-col rounded-[18px] border border-solid border-vv-line bg-vv-lavender-50 px-4 py-2" aria-live="polite">
            {[...patterns, ...lines.filter((l) => l.kind === 'text')].length === 0 && <li className="py-2 text-[14px] text-vv-muted">Add a pattern or a step to see it filled in.</li>}
            {[...patterns, ...lines.filter((l) => l.kind === 'text')].map((l) => (
              <li key={l.key} className="border-0 border-b border-solid border-vv-line py-2.5 text-[15px] text-vv-ink last:border-b-0">
                {l.kind === 'pattern' && search ? fillSearch(l.body, full) : fill(l.body, full)}
              </li>
            ))}
          </ul>
          <p className="m-0 text-[14px] text-vv-body">
            {search ? 'These become seed keywords. Real volumes only come from your KP and Semrush imports.' : 'Unknown facts stay in [brackets] until they’re confirmed.'}
          </p>
        </section>
      </div>
    </>
  )
}

function LineList({ title, lines, mono, onRemove, onAdd, placeholder }: { title: string; lines: Line[]; mono?: boolean; onRemove: (k: number) => void; onAdd: (body: string) => void; placeholder: string }) {
  const [text, setText] = useState('')
  const commit = () => {
    if (text.trim()) onAdd(text.trim())
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold text-vv-ink">{title}</span>
      {lines.map((l) => (
        <div key={l.key} className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-solid border-vv-field-line bg-vv-surface px-4 py-2">
          <span className={`min-w-0 break-words text-[15px] ${mono ? 'font-mono' : ''}`}>{l.body}</span>
          <button type="button" aria-label={`Remove ${l.body}`} className="flex-none border-0 bg-transparent p-1 text-[16px] font-bold text-vv-body hover:text-vv-red" onClick={() => onRemove(l.key)}>
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className={`${FIELD} ${mono ? 'font-mono' : ''}`}
          value={text}
          placeholder={placeholder}
          aria-label={`Add to ${title}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
        <button type="button" className={BTN_GHOST} onClick={commit} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

function WordList({ title, words, onRemove, onAdd }: { title: string; words: Line[]; onRemove: (k: number) => void; onAdd: (body: string) => void }) {
  const [text, setText] = useState('')
  const commit = () => {
    for (const w of text.split(',').map((x) => x.trim()).filter(Boolean)) onAdd(w)
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold text-vv-ink">
        {title} <span className="font-normal text-vv-muted">({words.length})</span>
      </span>
      {words.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {words.map((w) => (
            <li key={w.key} className="inline-flex items-center gap-1 rounded-full bg-vv-lavender-100 py-0.5 pl-3 pr-1 text-[14px] text-vv-purple-ink">
              {w.body}
              <button type="button" aria-label={`Remove ${w.body}`} className="h-6 w-6 rounded-full border-0 bg-transparent text-[12px] text-vv-body hover:text-vv-red" onClick={() => onRemove(w.key)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className={FIELD}
          value={text}
          placeholder="Add words, comma-separated"
          aria-label={`Add to ${title}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
        <button type="button" className={BTN_GHOST} onClick={commit} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
