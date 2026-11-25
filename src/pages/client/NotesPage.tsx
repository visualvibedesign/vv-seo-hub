import { useState } from 'react'
import { Link } from 'react-router'
import { OpenButton } from '../../components/client/AccountParts'
import { useClientContext } from '../../components/layout/ClientLayout'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useAddNote, useDeleteLink, useDeleteNote, useEditNote, useMoveEarlier, useNotes, useSaveLink } from '../../hooks/useNotes'
import { ApiError } from '../../lib/api'
import { ACCOUNTS, accountOpenUrl } from '../../lib/clientSetup'
import { GUIDE, stepDay } from '../../lib/guide'
import { AUTHOR_MAX, LINK_LABEL_MAX, LINK_NOTE_MAX, NOTE_KIND_LABEL, NOTE_KINDS, NOTE_MAX, linkInitials, linkProblem, noteProblem, rememberAuthor, savedAuthor, shortLink } from '../../lib/notes'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, LABEL, PILL, siteLabel } from '../../lib/ui'
import type { AccountKind, ClientDetail, ClientLink, ClientNote, NoteKind } from '../../types/seo'

// Site › Notes & links (/clients/{site id}/notes), design docs/design/Notes.png.
// Links: the website, the client's account links (same rows as Overview › Accounts, not stored twice) and extra links
// (the Sheet, ClickUp…). Notes: Rule / Decision / Note feed with author + guide day; agency rules show on every client.
// Links only, never logins. Never a street address in a note.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e ? fallback : '')

export default function NotesPage() {
  const c = useClientContext()
  const q = useNotes(c.siteId)
  return (
    <>
      <header className="flex min-w-0 flex-col gap-2.5">
        <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
          Everything in <em className="font-medium text-vv-purple">one place.</em>
        </h1>
        <p className="m-0 text-[17px] leading-normal text-vv-body">Quick links to the client’s tools, and the decisions the team needs to remember</p>
      </header>

      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load notes and links. Try again in a moment.
        </p>
      )}
      {q.isSuccess && (
        <div className="grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
          <LinksCard client={c} links={q.data.links} />
          <NotesCard client={c} notes={q.data.notes} earlier={q.data.earlier} />
        </div>
      )}
    </>
  )
}

// ---- Links -------------------------------------------------------------------------------------------------

function Icon({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-vv-lavender-50 text-[13px] font-bold text-vv-purple-deep">
      {text}
    </span>
  )
}

/** wrap: on a phone the buttons go to their own line (rows with Edit + Remove + Open). */
function Row({ icon, label, sub, wrap = false, children }: { icon: string; label: string; sub: React.ReactNode; wrap?: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 border-0 border-t border-solid border-vv-line py-3 first:border-t-0 ${wrap ? 'phone:flex-wrap' : ''}`}>
      <Icon text={icon} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold leading-snug text-vv-ink">{label}</span>
        <span className="truncate text-[13px] text-vv-muted">{sub}</span>
      </span>
      <span className={`flex flex-none items-center gap-2 ${wrap ? 'phone:w-full phone:justify-end' : ''}`}>{children}</span>
    </li>
  )
}

/** Fixed two-letter icons for the account tools (initials alone would clash: Clarity / Cloudflare, GA4 / Google Ads). */
const ACCOUNT_ICON: Partial<Record<AccountKind, string>> = { gsc: 'SC', ga4: 'GA', gbp: 'GB', semrush: 'SR', whitespark: 'WS', clarity: 'MC', domain_dns: 'DN', hosting: 'HO', platform: 'WP', cloudflare: 'CF', google_ads: 'KP', ai_visibility: 'AI' }

function LinksCard({ client: c, links }: { client: ClientDetail; links: ClientLink[] }) {
  const [adding, setAdding] = useState(false)
  // Accounts that open something (client link, else the tool's main page). Not "N/A" ones; the website platform
  // only with its own link (else it's the same as Website).
  const accounts = ACCOUNTS.flatMap((def) => {
    const a = c.accounts.find((x) => x.kind === def.kind)
    if (!a || a.status === 'n_a') return []
    if (def.kind === 'platform' && !a.link) return []
    const url = accountOpenUrl(a.kind, a.link, c.siteUrl)
    return url ? [{ def, a, url }] : []
  })
  return (
    <section className={CARD} aria-labelledby="nl-links">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="nl-links" className={CARD_TITLE}>
          Links
        </h2>
        {!adding && (
          <button type="button" className={`${BTN_GHOST} min-h-10 px-4 text-[14px]`} onClick={() => setAdding(true)}>
            + Add link
          </button>
        )}
      </div>
      {adding && <LinkForm siteId={c.siteId} onDone={() => setAdding(false)} />}
      <ul className="m-0 list-none p-0">
        <Row icon="WB" label="Website" sub={siteLabel(c.siteUrl)}>
          <OpenButton url={c.siteUrl} label="Website" />
        </Row>
        {links.map((l) => (
          <ExtraLink key={l.id} siteId={c.siteId} link={l} />
        ))}
        {accounts.map(({ def, a, url }) => (
          <Row key={def.kind} icon={ACCOUNT_ICON[def.kind] ?? linkInitials(def.label)} label={def.label} sub={a.link ? shortLink(a.link) : 'Tool’s main page · client link not added yet'}>
            <OpenButton url={url} label={def.label} />
          </Row>
        ))}
      </ul>
      <p className="m-0 text-[12px] text-vv-muted">
        Account links are edited in <Link to={`/clients/${c.siteId}`} className="font-semibold text-vv-purple-deep">Overview › Accounts</Link>. Links only, never usernames or passwords.
      </p>
    </section>
  )
}

function ExtraLink({ siteId, link }: { siteId: string; link: ClientLink }) {
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const del = useDeleteLink(siteId)
  if (editing)
    return (
      <li className="border-0 border-t border-solid border-vv-line py-3 first:border-t-0">
        <LinkForm siteId={siteId} link={link} onDone={() => setEditing(false)} />
      </li>
    )
  return (
    <Row icon={linkInitials(link.label)} label={link.label} sub={link.note || shortLink(link.url)} wrap>
      <button type="button" className={`${BTN_LINK} text-[12px]`} onClick={() => setEditing(true)} aria-label={`Edit ${link.label}`}>
        Edit
      </button>
      <button type="button" className={`${BTN_LINK} text-[12px] text-vv-muted`} onClick={() => setAsking(true)} aria-label={`Remove ${link.label}`}>
        Remove
      </button>
      <OpenButton url={link.url} label={link.label} />
      <ConfirmDialog
        open={asking}
        title={`Remove “${link.label}”?`}
        body="Only the link is removed from SEO Hub. Nothing changes in the tool it points to."
        confirmLabel="Remove link"
        busy={del.isPending}
        onCancel={() => setAsking(false)}
        onConfirm={() => del.mutate(link.id, { onSettled: () => setAsking(false) })}
      />
    </Row>
  )
}

function LinkForm({ siteId, link, onDone }: { siteId: string; link?: ClientLink; onDone: () => void }) {
  const save = useSaveLink(siteId)
  const [label, setLabel] = useState(link?.label ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [note, setNote] = useState(link?.note ?? '')
  const [tried, setTried] = useState(false)
  const problem = linkProblem(label, url)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem) return
    save.mutate({ id: link?.id, label: label.trim(), url: url.trim(), note: note.trim() }, { onSuccess: onDone })
  }
  const err = errText(save.error, 'Couldn’t save the link.')
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-2xl bg-vv-lavender-50 p-4">
      <label className={LABEL}>
        Name
        <input className={FIELD} value={label} maxLength={LINK_LABEL_MAX} autoFocus placeholder="e.g. Master Keyword Database (Sheet)" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className={LABEL}>
        Link
        <input className={FIELD} value={url} inputMode="url" autoComplete="off" placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className={LABEL}>
        Line under the name (optional)
        <input className={FIELD} value={note} maxLength={LINK_NOTE_MAX} placeholder="e.g. Website project + SEO list" onChange={(e) => setNote(e.target.value)} />
      </label>
      {(tried || url) && problem ? <span className="text-[12px] font-semibold text-vv-red">{problem}</span> : <span className="text-[12px] text-vv-muted">Links only, never usernames or passwords.</span>}
      {err && (
        <span role="alert" className="text-[12px] font-semibold text-vv-red">
          {err}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={`${BTN_LIME} min-h-10 px-5 text-[14px]`} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {link ? 'Save link' : 'Add link'}
        </button>
        <button type="button" className={`${BTN_LINK} text-[13px]`} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---- Notes -------------------------------------------------------------------------------------------------

const KIND_STYLE: Record<NoteKind, string> = {
  rule: `${PILL} bg-vv-pill-red text-vv-pill-red-ink`,
  decision: `${PILL} bg-vv-lavender-100 text-vv-purple-ink`,
  note: `${PILL} bg-vv-st-todo text-vv-st-todo-ink`,
}

/** Guide step index → "Day 1" … "Days 8–9", 9 = "Monthly". */
const dayLabel = (d: number | null) => (d === null ? '' : stepDay(d))
const DAY_OPTIONS = [...GUIDE.map((_, i) => i), GUIDE.length]

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

function KindPicker({ value, onChange, name }: { value: NoteKind; onChange: (k: NoteKind) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-1.5">
      {NOTE_KINDS.map((k) => (
        <label key={k.kind} className={`${PILL} cursor-pointer border border-solid ${value === k.kind ? `${KIND_STYLE[k.kind]} border-transparent` : 'border-vv-line bg-vv-surface text-vv-body'}`}>
          <input type="radio" name={name} className="sr-only" checked={value === k.kind} onChange={() => onChange(k.kind)} />
          {k.label}
        </label>
      ))}
    </div>
  )
}

function NotesCard({ client: c, notes, earlier }: { client: ClientDetail; notes: ClientNote[]; earlier: string | null }) {
  const add = useAddNote(c.siteId)
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<NoteKind>('note')
  const [agency, setAgency] = useState(false)
  const [day, setDay] = useState<number | null>(Math.min(Math.max(c.guide.current, 0), GUIDE.length))
  const [author, setAuthor] = useState(savedAuthor)
  const [tried, setTried] = useState(false)
  const problem = noteProblem(body)
  const isAgency = kind === 'rule' && agency
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem) return
    rememberAuthor(author)
    add.mutate(
      { kind, body: body.trim(), author: author.trim(), day: isAgency ? null : day, agency: isAgency },
      {
        onSuccess: () => {
          setBody('')
          setTried(false)
          setAgency(false)
        },
      },
    )
  }
  const err = errText(add.error, 'Couldn’t save the note.')
  return (
    <section className={CARD} aria-labelledby="nl-notes">
      <h2 id="nl-notes" className={CARD_TITLE}>
        Notes
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={LABEL}>
          Add a note
          <textarea
            className={`${FIELD} min-h-[96px] resize-y`}
            value={body}
            maxLength={NOTE_MAX}
            placeholder="e.g. Client prefers we don’t mention prices on the home page"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-vv-body">Tag</span>
            <KindPicker value={kind} onChange={setKind} name="new-note-kind" />
          </div>
          <label className={`${LABEL} w-[150px]`}>
            Day
            <select className={`${FIELD} min-h-10 py-1.5 text-[14px]`} value={isAgency || day === null ? '' : String(day)} disabled={isAgency} onChange={(e) => setDay(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">No day</option>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label className={`${LABEL} w-[170px]`}>
            Your name
            <input className={`${FIELD} min-h-10 py-1.5 text-[14px]`} value={author} maxLength={AUTHOR_MAX} placeholder="e.g. Angel" autoComplete="name" onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        {kind === 'rule' && (
          <label className="flex items-center gap-2 text-[14px] text-vv-body">
            <input type="checkbox" checked={agency} onChange={(e) => setAgency(e.target.checked)} className="h-4 w-4 accent-[#7C5CE6]" />
            Agency rule: show it on every client
          </label>
        )}
        {tried && problem ? <span className="text-[12px] font-semibold text-vv-red">{problem}</span> : null}
        {err && (
          <span role="alert" className="text-[12px] font-semibold text-vv-red">
            {err}
          </span>
        )}
        <div>
          <button type="submit" className={BTN_LIME} disabled={add.isPending}>
            {add.isPending ? <Spinner /> : null}
            Add note
          </button>
        </div>
      </form>

      {earlier && <EarlierNotes siteId={c.siteId} text={earlier} author={author} />}

      {notes.length === 0 ? (
        <p className="m-0 border-0 border-t border-solid border-vv-line pt-4 text-[14px] text-vv-muted">No notes yet. Rules and decisions the team needs to remember go here.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {notes.map((n) => (
            <NoteRow key={n.id} siteId={c.siteId} note={n} />
          ))}
        </ul>
      )}
    </section>
  )
}

function EarlierNotes({ siteId, text, author }: { siteId: string; text: string; author: string }) {
  const move = useMoveEarlier(siteId)
  const [asking, setAsking] = useState(false)
  const err = errText(move.error, 'Couldn’t move the notes.')
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-vv-lavender p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-bold text-vv-ink">Earlier notes</h3>
        <button type="button" className={`${BTN_GHOST} min-h-9 px-3.5 text-[13px]`} onClick={() => setAsking(true)}>
          Move to notes
        </button>
      </div>
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-vv-body">{text}</p>
      <p className="m-0 text-[12px] text-vv-muted">From the old Notes box in Edit client.</p>
      {err && (
        <span role="alert" className="text-[12px] font-semibold text-vv-red">
          {err}
        </span>
      )}
      <ConfirmDialog
        open={asking}
        title="Move the earlier notes?"
        body="The text becomes one Note in the feed (as written, you can edit it after), and the old Notes box in Edit client is emptied. Nothing is lost."
        confirmLabel="Move to notes"
        cancelLabel="Not now"
        busy={move.isPending}
        onCancel={() => setAsking(false)}
        onConfirm={() => move.mutate(author.trim(), { onSettled: () => setAsking(false) })}
      />
    </div>
  )
}

function NoteRow({ siteId, note: n }: { siteId: string; note: ClientNote }) {
  const edit = useEditNote(siteId)
  const del = useDeleteNote(siteId)
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [body, setBody] = useState(n.body)
  const [kind, setKind] = useState<NoteKind>(n.kind)
  const problem = noteProblem(body)
  const meta = [n.agency ? 'Agency rule' : '', n.author ?? '', dayLabel(n.day), when(n.createdAt)].filter(Boolean).join(' · ')
  const err = errText(edit.error, 'Couldn’t save the note.') || errText(del.error, 'Couldn’t delete the note.')
  return (
    <li className="flex gap-3 border-0 border-t border-solid border-vv-line py-4 first:border-t-0">
      <span className="flex-none pt-0.5">
        <span className={KIND_STYLE[n.kind]}>{NOTE_KIND_LABEL[n.kind]}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (problem) return
              edit.mutate({ id: n.id, kind, body: body.trim() }, { onSuccess: () => setEditing(false) })
            }}
          >
            <textarea aria-label="Note" className={`${FIELD} min-h-[80px] resize-y text-[14px]`} value={body} maxLength={NOTE_MAX} autoFocus onChange={(e) => setBody(e.target.value)} />
            {n.agency ? <span className="text-[12px] text-vv-muted">An agency rule stays a Rule.</span> : <KindPicker value={kind} onChange={setKind} name={`kind-${n.id}`} />}
            {problem && <span className="text-[12px] font-semibold text-vv-red">{problem}</span>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={`${BTN_LIME} min-h-9 px-4 text-[13px]`} disabled={edit.isPending || !!problem}>
                {edit.isPending ? <Spinner /> : null}
                Save
              </button>
              <button
                type="button"
                className={`${BTN_LINK} text-[13px]`}
                onClick={() => {
                  setEditing(false)
                  setBody(n.body)
                  setKind(n.kind)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-vv-ink">{n.body}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 text-[13px] text-vv-muted">
          {meta && <span>{meta}</span>}
          {!editing && (
            <>
              <button type="button" className={`${BTN_LINK} min-h-6 text-[12px]`} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className={`${BTN_LINK} min-h-6 text-[12px] text-vv-muted`} onClick={() => setAsking(true)}>
                Delete
              </button>
            </>
          )}
        </div>
        {err && (
          <span role="alert" className="text-[12px] font-semibold text-vv-red">
            {err}
          </span>
        )}
      </div>
      <ConfirmDialog
        open={asking}
        title={n.agency ? 'Delete this agency rule?' : 'Delete this note?'}
        body={n.agency ? 'It’s shown on every client, so it goes from all of them.' : 'This can’t be undone.'}
        confirmLabel="Delete"
        busy={del.isPending}
        onCancel={() => setAsking(false)}
        onConfirm={() => del.mutate({ id: n.id, agency: n.agency }, { onSettled: () => setAsking(false) })}
      />
    </li>
  )
}
