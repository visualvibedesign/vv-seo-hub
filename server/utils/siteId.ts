// Site id: the same id the Vibe SEO plugin sends in its check-in and the agency hub uses.
// Plugin code (vibe-seo/includes/class-seo-link.php):
//   md5( untrailingslashit( strtolower( preg_replace( '#^https?://(www\.)?#', '', home_url( '/' ) ) ) ) )
// So: remove "http(s)://" and "www." from the start, lowercase, remove trailing / and \, then md5.
// The path is kept (example.com/shop ≠ example.com). Client pages live at /clients/{site id}.
import { createHash } from 'node:crypto'

export class SiteUrlError extends Error {}

/** Cleans what was typed into a full home URL ("anassabeauty.com" → "https://anassabeauty.com/"). */
export function normalizeSiteUrl(input: string): string {
  let raw = input.trim()
  if (!raw) throw new SiteUrlError('Add the site’s home URL.')
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SiteUrlError('That doesn’t look like a web address.')
  }
  if (!url.hostname.includes('.')) throw new SiteUrlError('That doesn’t look like a web address.')
  // The home URL has no query or #hash; keep scheme + host + path only.
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  return `${url.protocol}//${url.host}${path}`
}

/** The plugin's site id for a home URL. Mirrors the PHP exactly (the www. strip happens before lowercasing). */
export function siteIdFor(homeUrl: string): string {
  const stripped = homeUrl.replace(/^https?:\/\/(www\.)?/, '').toLowerCase()
  let end = stripped.length
  while (end > 0 && (stripped[end - 1] === '/' || stripped[end - 1] === '\\')) end--
  return createHash('md5').update(stripped.slice(0, end)).digest('hex')
}
