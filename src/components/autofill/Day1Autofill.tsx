import { useState } from 'react'
import { AiRun, KindRow, Review } from './Day2Autofill'
import { useAutofill, useDecide } from '../../hooks/useAutofill'
import { ApiError } from '../../lib/api'
import { CARD, FIELD } from '../../lib/ui'
import type { AutofillKind, ClientDetail } from '../../types/seo'

// "2 · What Claude filled" for Day 1 (6c-4b): paste notes or the client's Services page text → cost first →
// Run with Claude → two lists to review (services incl. scope / brand words; areas). Kickoff answers are skipped. Every suggestion shows the words it came from.
// The pasted text is used for that one call and never stored. Approve only fills what's empty.

const MAX = 20_000
const FIELD_LABEL: Record<string, string> = {
  notOffered: 'Out of scope word',
  area: 'Area (A2/A3)',
  neighbourhood: 'Neighbourhood word',
  brandWord: 'Brand word',
}

export default function Day1Autofill({ client: c }: { client: ClientDetail }) {
  const q = useAutofill(c.siteId)
  const decide = useDecide(c.siteId)
  const [text, setText] = useState('')
  const [open, setOpen] = useState<AutofillKind | null>(null)
  const rows = q.data ?? []
  const row = (k: AutofillKind) => rows.find((r) => r.kind === k)
  const catName = new Map(c.categories.map((k) => [k.code, k.name]))
  const label = (v: string) => {
    if (['Home', 'S1', 'S2', 'S3'].includes(v)) {
      const own = catName.get(v as 'Home')
      return `${v}${own && own !== v ? ` ${own}` : ''}`
    }
    return FIELD_LABEL[v] ?? v
  }
  const error = decide.error ? (decide.error instanceof ApiError && decide.error.detail ? decide.error.detail : 'Couldn’t save. Try again.') : ''
  const kind = (k: AutofillKind, title: string, what: string) => {
    const r = row(k)
    return (
      <>
        <KindRow title={title} what={what} row={r} open={open === k} onToggle={() => setOpen(open === k ? null : k)} loading={q.isPending} />
        {open === k && r && <Review row={r} label={label} onDecide={(d) => decide.mutate({ autofillId: r.id, decisions: d })} busy={decide.isPending} />}
      </>
    )
  }

  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="filled1-h">
      <h2 id="filled1-h" className="m-0 pb-3 font-display text-[26px] font-semibold phone:text-[21px]">
        2 · What Claude filled
      </h2>
      <label className="flex flex-col gap-1.5 pb-2 text-[13px] font-semibold text-vv-body">
        Paste notes or the client’s Services page text
        <textarea
          className={`${FIELD} min-h-[140px] resize-y text-[14px]`}
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="What they offer, what they don’t, the cities they serve…"
        />
        <span className="text-[12px] font-normal text-vv-muted">
          {text.length.toLocaleString('en-US')} / {MAX.toLocaleString('en-US')} characters. Sent once for this run and never stored. Each suggestion shows a short quote from it while you review; the quote is deleted when you approve or reject.
        </span>
      </label>
      <ul className="m-0 flex list-none flex-col p-0">
        <AiRun
          siteId={c.siteId}
          task="day1"
          hasRow={!!(row('setup_services') || row('setup_areas'))}
          input={text}
          disabledText="Paste some text first"
          sends="Sends only your pasted text and the client’s current category, service and area names."
          emptyText="Nothing to send: paste some text first."
        />
        {error && (
          <li role="alert" className="mb-2 rounded-xl bg-vv-red-100 px-3 py-2 text-[14px] font-semibold text-vv-red">
            {error}
          </li>
        )}
        {kind('setup_services', 'Services · Claude', 'Services by category (you confirm the category), out-of-scope and brand words')}
        {kind('setup_areas', 'Areas · Claude', 'Cities for A2 / A3 (only if N/A), and neighbourhood words')}
      </ul>
      <p className="m-0 border-0 border-t border-solid border-vv-line pt-3.5 text-[14px] text-vv-body">
        Each suggestion quotes your text. Anything Claude can’t quote, and any address, phone number or email, is dropped. Approving only fills what’s empty.
      </p>
    </section>
  )
}
