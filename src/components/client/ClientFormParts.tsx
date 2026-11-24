// Client form pieces shared by the Add client wizard (AddClientPage) and Edit client (ClientFormPage):
// site id note, no-address note, the services editor (Home + S1–S3 + FAQ) and the areas editor.
// Logic (form state, checks, site id check) is in src/lib/clientForm.ts. No address field, on purpose.
import { duplicateServices, NAME_MAX, newKey, splitNames, type CategoryDraft, type FormState, type ServiceDraft, type SetField, type SiteState } from '../../lib/clientForm'
import { CATEGORY_CODES, CATEGORY_HINT, DEFAULT_FAQ_NAME } from '../../lib/clientSetup'
import { BTN_GHOST, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { AreaStatus, CategoryCode } from '../../types/seo'
import { Spinner } from '../ui/Loading'

/** Under the URL field: the site id (same as Vibe SEO and the agency hub), or why it's not OK. */
export function SiteIdNote({ site, idChanges }: { site: SiteState; idChanges?: boolean }) {
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-snug" aria-live="polite">
      {site.busy && (
        <span className="flex items-center gap-2 text-vv-muted">
          <Spinner /> Working out the site id…
        </span>
      )}
      {!site.busy && site.check && (
        <span className="text-vv-body">
          Site id <code className="break-all font-mono text-[12px] text-vv-purple-ink">{site.check.siteId}</code> · the same id Vibe SEO and the agency hub use.
        </span>
      )}
      {!site.busy && site.check?.takenBy && (
        <span role="alert" className="font-semibold text-vv-red">
          {site.check.takenBy} already uses this site.
        </span>
      )}
      {!site.busy && site.error && <span className="font-semibold text-vv-red">{site.error}</span>}
      {!site.busy && !site.check && !site.error && <span className="text-vv-muted">The site id is worked out from this, the same id Vibe SEO and the agency hub use.</span>}
      {idChanges && (
        <span role="alert" className="font-semibold text-vv-orange-ink">
          Changing the site changes its site id, so this client’s links change too (and the plugin must send from the new URL).
        </span>
      )}
    </div>
  )
}

/** Dashed note: there's no address field on purpose. */
export function NoAddressNote() {
  return (
    <p className="m-0 rounded-2xl border-[1.5px] border-dashed border-vv-field-line bg-vv-lavender-50 px-4 py-3 text-[14px] text-vv-body">
      There’s no address field on purpose. Private addresses are never stored.
    </p>
  )
}

// ---- Services ---------------------------------------------------------------------------

/** Home + S1–S3 + FAQ, each with its services. */
export function ServicesEditor({ f, setF }: { f: FormState; setF: (change: (s: FormState) => FormState) => void }) {
  const dupes = duplicateServices(f)
  const updateCategory = (code: CategoryCode, change: (c: CategoryDraft) => CategoryDraft) =>
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
  return (
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
  )
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
  cat: CategoryDraft
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

// ---- Areas ------------------------------------------------------------------------------

/** A1 (main area, required) + A2/A3 (or N/A). */
export function AreasEditor({ f, set }: { f: FormState; set: SetField }) {
  return (
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
              placeholder={a.status === 'n_a' ? 'N/A' : a.code === 'A1' ? 'Main city or area' : 'City or area'}
            />
          </label>
          <label className={LABEL}>
            <span className="sr-only">{a.code} state</span>
            <input
              className={FIELD}
              value={a.state}
              disabled={a.status === 'n_a'}
              onChange={(e) => set('areas', f.areas.map((x) => (x.code === a.code ? { ...x, state: e.target.value } : x)))}
              placeholder="ST"
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
                  set('areas', f.areas.map((x) => (x.code === a.code ? { ...x, status: (e.target.checked ? 'n_a' : 'active') as AreaStatus } : x)))
                }
              />
              N/A
            </label>
          )}
        </div>
      ))}
    </div>
  )
}
