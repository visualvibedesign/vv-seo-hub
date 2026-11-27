// Phase 3 · shared labels for pages (Sitemap + hotspots, Site plan, Page briefs).
import type { PageAction, PageType, RedirectStatus, SiteStructure } from '../types/seo'

export const STRUCTURE_LABEL: Record<SiteStructure, string> = { service_first: 'service first', location_first: 'location first', flat: 'flat' }
export const TYPE_LABEL: Record<PageType, string> = { home: 'Home page', service: 'Service page', location: 'Location page', supporting: 'Supporting page' }
export const ACTION_LABEL: Record<PageAction, string> = { keep: 'Keep', improve: 'Improve', new: 'New' }
export const ACTION_TONE: Record<PageAction, string> = { keep: 'bg-vv-green-100 text-vv-green-ink', improve: 'bg-vv-lavender-100 text-vv-purple-ink', new: 'bg-vv-orange-100 text-vv-orange-ink' }
export const REDIRECT_LABEL: Record<RedirectStatus, string> = { queued: 'Queued', sent: 'Sent to site', live: 'Live' }
export const REDIRECT_TONE: Record<RedirectStatus, string> = { queued: 'bg-vv-st-todo text-vv-st-todo-ink', sent: 'bg-vv-lavender-100 text-vv-purple-ink', live: 'bg-vv-green-100 text-vv-green-ink' }
/** Queued → Sent to site → Live (Live goes back to Queued if clicked again, e.g. a redirect that didn't stick). */
export const NEXT_REDIRECT: Record<RedirectStatus, RedirectStatus> = { queued: 'sent', sent: 'live', live: 'queued' }
