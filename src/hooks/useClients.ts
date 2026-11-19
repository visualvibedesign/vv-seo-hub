// Client data (TanStack Query, same pattern as HQ's hooks).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getClient, getClients, saveAccount, saveClient } from '../lib/api'
import type { AccountKind, AccountStatus, ClientDetail, ClientInput } from '../types/seo'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: getClients, select: (d) => d.clients })
}

export function useClient(siteId: string | undefined) {
  return useQuery({
    queryKey: ['client', siteId],
    queryFn: () => getClient(siteId!),
    select: (d) => d.client,
    enabled: !!siteId,
    retry: (n, err) => (err as { status?: number }).status !== 404 && n < 1,
  })
}

export function useSaveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ client, siteId }: { client: ClientInput; siteId?: string }) => saveClient(client, siteId),
    onSuccess: async (_res, vars) => {
      if (vars.siteId) qc.removeQueries({ queryKey: ['client', vars.siteId] })
      await qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useSaveAccount(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { kind: AccountKind; status: AccountStatus; nextAction: string; note: string }) => saveAccount(siteId, a),
    onSuccess: ({ account }) => {
      qc.setQueryData<{ client: ClientDetail }>(['client', siteId], (old) =>
        old ? { client: { ...old.client, accounts: old.client.accounts.map((a) => (a.kind === account.kind ? account : a)) } } : old,
      )
    },
  })
}
