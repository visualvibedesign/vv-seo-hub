// Checks server/utils/siteId.ts against the Vibe SEO plugin's id. Run: npm run check:site-id
// Anassa's id was worked out from the plugin's own formula (class-seo-link.php) on 2026-11-20.
import { normalizeSiteUrl, siteIdFor } from '../server/utils/siteId.ts'

const ANASSA = 'c6e74adc272c98005f3086f85c88b9da' // md5('anassabeauty.com')

const cases: [input: string, expected: string][] = [
  ['https://anassabeauty.com/', ANASSA],
  ['https://www.anassabeauty.com/', ANASSA],
  ['http://anassabeauty.com', ANASSA],
  ['anassabeauty.com', ANASSA],
  ['  https://AnassaBeauty.com//  ', ANASSA],
]

let failed = 0
for (const [input, expected] of cases) {
  const got = siteIdFor(normalizeSiteUrl(input))
  const ok = got === expected
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(input)} → ${got}`)
}
// A path changes the id (WordPress in a subfolder)
const sub = siteIdFor(normalizeSiteUrl('https://anassabeauty.com/shop/'))
if (sub === ANASSA) failed++
console.log(`${sub !== ANASSA ? 'ok  ' : 'FAIL'} subfolder site gets its own id → ${sub}`)

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log('All site id checks passed.')
