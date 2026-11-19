// HQ's recurring class strings in one place, so every SEO Hub page looks the same as HQ.
// (Copied from HQ pages: KeyNumbers card, SeoPage buttons/selects, Settings pill tabs, NotesView fields.)

/** White card: 22px radius, #ECE8FB border, soft purple shadow. */
export const CARD =
  'box-border flex min-w-0 flex-col gap-4 rounded-[22px] border border-solid border-vv-line bg-vv-surface px-6 py-[22px] shadow-[0_14px_30px_-24px_rgba(91,63,208,0.45)] phone:p-[18px] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,.7)]'

/** Card heading (Fraunces). */
export const CARD_TITLE = 'm-0 font-display text-[22px] font-semibold leading-tight'

/** Lime pill button (main action). */
export const BTN_LIME =
  'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border-0 bg-vv-green px-[22px] text-[15px] font-bold text-vv-on-green no-underline hover:text-vv-on-green disabled:cursor-not-allowed disabled:opacity-60'

/** White pill button (second action). */
export const BTN_GHOST =
  'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-solid border-vv-toggle-line bg-vv-surface px-[22px] text-[15px] font-semibold text-vv-ink no-underline hover:bg-vv-lavender-50 disabled:opacity-60'

/** Small text link-button. */
export const BTN_LINK = 'min-h-9 border-0 bg-transparent p-0 text-sm font-bold text-vv-purple-deep no-underline'

/** Text field / textarea / select. */
export const FIELD = 'box-border w-full rounded-2xl border-[1.5px] border-solid border-vv-field-line bg-vv-field px-4 py-2.5 font-body text-[15px] text-vv-ink'

export const LABEL = 'flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold text-vv-body'

/** Status pill colors (HQ status tokens). */
export const PILL = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold'
export const PILL_DONE = `${PILL} bg-vv-st-done text-vv-st-done-ink`
export const PILL_PROGRESS = `${PILL} bg-vv-st-progress text-vv-st-progress-ink`
export const PILL_TODO = `${PILL} bg-vv-st-todo text-vv-st-todo-ink`
export const PILL_REVIEW = `${PILL} bg-vv-st-review text-vv-st-review-ink`
export const PILL_WAITING = `${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`

/** "Fraunces heading with a purple italic word": the last word goes purple italic. */
export function splitAccent(text: string): [string, string] {
  const t = text.trim()
  const i = t.lastIndexOf(' ')
  return i < 0 ? ['', t] : [t.slice(0, i + 1), t.slice(i + 1)]
}

/** "anassabeauty.com" from "https://anassabeauty.com/" (path kept). */
export function siteLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
}
