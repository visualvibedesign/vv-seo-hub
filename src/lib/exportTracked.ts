// "Export tracked list": the keywords with Track on, as a CSV for Semrush Position Tracking (Keyword + Tags:
// role; service). A browser download only: nothing leaves SEO Hub. Used on Database and Matrix.
import { ROLE_LABEL } from './keywordUi'
import { siteLabel } from './ui'
import type { ClientDetail, KeywordItem } from '../types/seo'

export function trackedKeywords(all: KeywordItem[]): KeywordItem[] {
  return all.filter((k) => k.track && k.status !== 'rejected')
}

export function downloadTracked(c: ClientDetail, list: KeywordItem[]) {
  const svcName = new Map(c.categories.flatMap((cat) => cat.services.map((s) => [s.id, s.name] as const)))
  const cell = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
  const tags = (k: KeywordItem) => [k.role ? ROLE_LABEL[k.role] : '', k.serviceId ? (svcName.get(k.serviceId) ?? '') : ''].filter(Boolean).join(';')
  const lines = ['Keyword,Tags', ...list.map((k) => [k.keyword, tags(k)].map(cell).join(','))]
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = siteLabel(c.siteUrl).replace(/[^\w.-]+/g, '-') + '-tracked-keywords.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
