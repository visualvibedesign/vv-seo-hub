// Client form logic shared by the Add client wizard and Edit client: form state, checks, the live
// site id check. Components are in src/components/client/ClientFormParts.tsx. No address field, on purpose.
import { useEffect, useRef, useState } from 'react'
import { ApiError, checkSiteId } from './api'
import { AREA_CODES, CATEGORY_CODES, DEFAULT_FAQ_NAME } from './clientSetup'
import type { CategoryCode, ClientDetail, ClientInput, SiteIdCheck } from '../types/seo'

export type ServiceDraft = { key: string; id?: string; name: string }
export type CategoryDraft = { code: CategoryCode; name: string; services: ServiceDraft[]; pending: string }
export type FormState = Omit<ClientInput, 'categories'> & {
  /** pending = text typed in the services box but not added yet (added on save too). */
  categories: CategoryDraft[]
}
export type SetField = <K extends keyof FormState>(k: K, v: FormState[K]) => void

/** Category name limit (same as the server). */
export const NAME_MAX = 80

let keySeq = 0
export const newKey = () => `s${++keySeq}`

export function emptyForm(): FormState {
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
    industry: null,
    categories: CATEGORY_CODES.map((code) => ({ code, name: code === 'FAQ' ? DEFAULT_FAQ_NAME : '', services: [], pending: '' })),
    areas: AREA_CODES.map((code) => ({ code, name: '', state: '', status: code === 'A1' ? 'active' : 'n_a' })),
  }
}

export function fromClient(c: ClientDetail): FormState {
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
    industry: c.industry,
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

/** What the server gets: text still sitting in a services box counts too (as if Add was clicked). */
export function toInput(f: FormState): ClientInput {
  const categories = f.categories.map((c) => {
    const extra = splitNames(c.pending, c.services.map((s) => s.name))
    return { code: c.code, name: c.name, services: [...c.services.map((s) => ({ id: s.id, name: s.name })), ...extra.map((name) => ({ name }))] }
  })
  return { ...f, categories }
}

/** Service names used twice (a service can only be in one category). */
export function duplicateServices(f: FormState): Set<string> {
  const names = f.categories.flatMap((c) => c.services.map((s) => s.name.trim().toLowerCase())).filter(Boolean)
  return new Set(names.filter((n, i) => names.indexOf(n) !== i))
}

/** First problem with the services/areas part, or '' (the server checks the same). */
export function servicesProblem(f: FormState): string {
  if (duplicateServices(f).size) return 'A service is listed twice. Each service can only be in one category.'
  for (const c of f.categories) {
    if (c.name.trim().length > NAME_MAX)
      return `The ${c.code} category name is too long (${NAME_MAX} characters max). Use a short name and put the services in the ${c.code} services box.`
    if (c.code !== 'FAQ' && !c.name.trim()) return `Name the ${c.code} category.`
  }
  for (const a of f.areas) if (a.status === 'active' && !a.name.trim()) return `Name area ${a.code}, or mark it N/A.`
  return ''
}

/** "Service A, Service B\nService C." → ["Service A", "Service B", "Service C"] (no trailing dots, no repeats). */
export function splitNames(text: string, skip: string[] = []): string[] {
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

// ---- Site id check ----------------------------------------------------------------------

export type SiteState = { check?: SiteIdCheck; error?: string; busy?: boolean }

/** Live site id check (debounced): cleaned URL, plugin site id, already used by another client? */
export function useSiteCheck(siteUrl: string, currentSiteId?: string): SiteState {
  const [site, setSite] = useState<SiteState>({})
  const lastUrl = useRef('')
  useEffect(() => {
    const url = siteUrl.trim()
    if (!url) {
      lastUrl.current = ''
      return
    }
    const t = setTimeout(() => {
      lastUrl.current = url
      setSite((s) => ({ ...s, busy: true }))
      checkSiteId(url, currentSiteId)
        .then((check) => lastUrl.current === url && setSite({ check }))
        .catch((e) => lastUrl.current === url && setSite({ error: e instanceof ApiError && e.detail ? e.detail : 'That doesn’t look like a web address.' }))
    }, 400)
    return () => clearTimeout(t)
  }, [siteUrl, currentSiteId])
  return siteUrl.trim() ? site : {}
}

