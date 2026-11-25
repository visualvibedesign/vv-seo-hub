import { Navigate, useLocation, useParams } from 'react-router'
import { clientPath, legacyClientPath } from '../../lib/clientSetup'

// Old client addresses (before the Overview / Strategy Builder split, Nov 26) keep working: bookmarks, history and links
// in notes go to the same page in its new place, with ?day= and #… kept. Unknown paths go to the client Overview.
export default function LegacyRedirect() {
  const { siteId = '', '*': rest = '' } = useParams()
  const { search, hash } = useLocation()
  const next = legacyClientPath(rest, search)
  const query = next === 'baseline' || next === 'results' ? '' : search // ?day=day3 / day10 isn't needed on those pages
  return <Navigate to={`${clientPath(siteId, next)}${query}${hash}`} replace />
}
