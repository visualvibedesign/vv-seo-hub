// Industries list from the database (TanStack Query). Every page reads this one list.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addIndustry, getIndustries, renameIndustry } from '../lib/api'
import type { Industry } from '../types/seo'

export function useIndustries() {
  return useQuery({ queryKey: ['industries'], queryFn: getIndustries, select: (d) => d.industries, staleTime: 5 * 60_000 })
}

/** key → label (null when no industry or not loaded yet; an unknown key shows as typed). */
export function useIndustryLabel(): (key: string | null | undefined) => string | null {
  const q = useIndustries()
  return (key) => (key ? (q.data?.find((i) => i.key === key)?.label ?? key) : null)
}

function useUpsert() {
  const qc = useQueryClient()
  return (i: Industry) =>
    qc.setQueryData<{ industries: Industry[] }>(['industries'], (old) =>
      old
        ? { industries: (old.industries.some((x) => x.key === i.key) ? old.industries.map((x) => (x.key === i.key ? i : x)) : [...old.industries, i]).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label)) }
        : old,
    )
}

export function useAddIndustry() {
  const upsert = useUpsert()
  return useMutation({ mutationFn: ({ label, hint }: { label: string; hint?: string }) => addIndustry(label, hint), onSuccess: ({ industry }) => upsert(industry) })
}

export function useRenameIndustry() {
  const upsert = useUpsert()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, label, hint }: { key: string; label: string; hint?: string }) => renameIndustry(key, label, hint),
    onSuccess: ({ industry }) => {
      upsert(industry)
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
