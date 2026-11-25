import { useState } from 'react'
import { Bone, Spinner } from '../ui/Loading'
import { useAddIndustry, useIndustries } from '../../hooks/useIndustries'
import { ApiError } from '../../lib/api'
import { BTN_GHOST, BTN_LIME, FIELD, LABEL } from '../../lib/ui'
import type { Industry } from '../../types/seo'

// Industries come from the database list (seo_industries). Angel adds one wherever he needs it: the Add client
// wizard ("+ New industry") or Templates ("Add industry"). An industry never needs its own template versions:
// without them the generic templates are used, with the client's own services, areas, scope and brand words.

/** A select over the database list (Edit client, Template editor, Templates filter). An unknown saved key still shows. */
export function IndustrySelect({ value, onChange, empty, className }: { value: string | null; onChange: (key: string | null) => void; empty: string; className?: string }) {
  const q = useIndustries()
  const list = q.data ?? []
  return (
    <select className={className ?? FIELD} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {value && !list.some((i) => i.key === value) && <option value={value}>{q.isPending ? 'Loading…' : value}</option>}
      {list.map((i) => (
        <option key={i.key} value={i.key}>
          {i.label}
        </option>
      ))}
    </select>
  )
}

/** Name + optional hint → saved to the list. Same name as an existing industry → that one is returned. */
export function NewIndustryForm({ onDone, onCancel, cta }: { onDone: (i: Industry) => void; onCancel: () => void; cta: string }) {
  const add = useAddIndustry()
  const [label, setLabel] = useState('')
  const [hint, setHint] = useState('')
  const save = () => {
    if (label.trim()) add.mutate({ label: label.trim(), hint: hint.trim() }, { onSuccess: ({ industry }) => onDone(industry) })
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-solid border-vv-purple bg-vv-lavender-50 p-4">
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        <label className={LABEL}>
          Industry name
          <input
            className={FIELD}
            value={label}
            maxLength={60}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
          />
        </label>
        <label className={LABEL}>
          Short hint (optional)
          <input className={FIELD} value={hint} maxLength={200} onChange={(e) => setHint(e.target.value)} />
        </label>
      </div>
      {add.error && <span className="text-[14px] font-semibold text-vv-red">{add.error instanceof ApiError && add.error.detail ? add.error.detail : 'Couldn’t add it. Try again.'}</span>}
      <span className="flex flex-wrap gap-2">
        <button type="button" className={`${BTN_LIME} min-h-10`} disabled={!label.trim() || add.isPending} onClick={save}>
          {add.isPending && <Spinner />}
          {cta}
        </button>
        <button type="button" className={`${BTN_GHOST} min-h-10`} disabled={add.isPending} onClick={onCancel}>
          Cancel
        </button>
      </span>
    </div>
  )
}

/** Add client wizard, Template step: every industry in the list (Blank = generic templates) + "+ New industry". */
export default function IndustryPicker({ value, onChange }: { value: string | null; onChange: (key: string) => void }) {
  const q = useIndustries()
  const [adding, setAdding] = useState(false)
  const card = (on: boolean) =>
    `flex cursor-pointer flex-col gap-1 rounded-2xl border-[1.5px] border-solid p-4 ${on ? 'border-vv-purple bg-vv-lavender-50' : 'border-vv-field-line bg-vv-surface hover:bg-vv-lavender-50'}`

  if (q.isPending)
    return (
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
    )
  if (q.isError) return <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t load the industries. Check that migration 0009 ran.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        {q.data.map((i) => {
          const on = value === i.key
          return (
            <label key={i.key} className={card(on)}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="industry" className="h-5 w-5 accent-vv-purple" checked={on} onChange={() => onChange(i.key)} />
                <span className="text-[16px] font-bold text-vv-ink">{i.label}</span>
              </span>
              {i.hint && <span className="pl-[30px] text-sm text-vv-body">{i.hint}</span>}
            </label>
          )
        })}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={`${card(false)} items-start border-dashed bg-transparent text-left font-body`}>
            <span className="text-[16px] font-bold text-vv-purple-deep">+ New industry</span>
            <span className="text-sm text-vv-body">Not in the list? Add it here. The generic templates are used until you make a version for it.</span>
          </button>
        )}
      </div>
      {adding && (
        <NewIndustryForm
          cta="Add and pick it"
          onCancel={() => setAdding(false)}
          onDone={(i) => {
            onChange(i.key)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}
