'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { apiV2Client, setApiV2Auth, type Identity, type Organization } from '@/lib/api-v2'
import { qk } from '@/lib/query-client'

const STORAGE_KEY = 'rizoma.active_org'

interface OrgContextValue {
  organizationId: string | null
  organization: Organization | null
  organizations: Organization[]
  setOrganizationId: (id: string) => void
  isLoading: boolean
  token: string | null
}

const OrgContext = createContext<OrgContextValue>({
  organizationId: null,
  organization: null,
  organizations: [],
  setOrganizationId: () => {},
  isLoading: false,
  token: null,
})

export function useOrg(): OrgContextValue {
  return useContext(OrgContext)
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const token = session?.accessToken ?? null

  const [organizationId, setOrgIdState] = useState<string | null>(null)

  // localStorage só existe no browser — leitura depois da montagem.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) setOrgIdState(stored)
  }, [])

  // O header X-Organization precisa estar setado ANTES de qualquer query disparar.
  setApiV2Auth({ token, organizationId })

  const { data: identity, isLoading } = useQuery<Identity>({
    queryKey: [...qk.identity, token],
    queryFn: () => apiV2Client.me(),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const organizations = useMemo(() => identity?.organizations ?? [], [identity])

  // Sem org escolhida (primeiro acesso), assume a primeira do usuário.
  useEffect(() => {
    if (organizationId === null && organizations.length > 0) {
      const first = organizations[0].id
      window.localStorage.setItem(STORAGE_KEY, first)
      setOrgIdState(first)
    }
  }, [organizationId, organizations])

  const setOrganizationId = useCallback(
    (id: string) => {
      if (id === organizationId) return
      window.localStorage.setItem(STORAGE_KEY, id)
      setOrgIdState(id)
      setApiV2Auth({ token, organizationId: id })
      // Trocar de org troca o tenant inteiro: o cache anterior não vale mais.
      void queryClient.invalidateQueries()
    },
    [organizationId, queryClient, token]
  )

  const organization =
    organizations.find((o) => o.id === organizationId) ?? identity?.organization ?? null

  const value = useMemo<OrgContextValue>(
    () => ({ organizationId, organization, organizations, setOrganizationId, isLoading, token }),
    [organizationId, organization, organizations, setOrganizationId, isLoading, token]
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
