// Phase 2a: the client's Google setup (email to add, saved link, properties the service account can see).
import { useQuery } from '@tanstack/react-query'
import { getGoogleSetup } from '../lib/api'

export function useGoogleSetup(siteId: string) {
  return useQuery({ queryKey: ['google', siteId], queryFn: () => getGoogleSetup(siteId), staleTime: 60_000 })
}
