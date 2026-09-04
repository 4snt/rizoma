/**
 * TanStack Query v5 (ADR-004 — substitui o SWR nas telas novas).
 *
 * O critério de desempate não foi gosto: o trabalho de campo é offline e o SWR
 * não tem fila de mutações offline. Aqui ficam o QueryClient e o persister em
 * IndexedDB usados pelo `components/providers/QueryProvider.tsx`.
 */

import { QueryClient } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { ApiV2Error } from '@/lib/api-v2'

const PERSIST_KEY = 'rizoma.query-cache.v1'

/** 24h — o técnico pode ficar um dia inteiro fora de sinal. */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: CACHE_MAX_AGE,
        refetchOnWindowFocus: false,
        // Serve o cache primeiro e revalida quando houver rede.
        networkMode: 'offlineFirst',
        retry: (failureCount, error) => {
          // 4xx (exceto 408/429) não melhora com retry.
          if (error instanceof ApiV2Error) {
            const s = error.status
            if (s >= 400 && s < 500 && s !== 408 && s !== 429) return false
          }
          return failureCount < 3
        },
      },
      mutations: {
        // Sem rede, a mutação fica PAUSADA — é isso que permite o resumePausedMutations.
        networkMode: 'offlineFirst',
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
    },
  })
}

/** Persister em IndexedDB (idb-keyval) — localStorage não aguenta o cache de campo. */
export function createIdbPersister(key: string = PERSIST_KEY): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(key, client)
    },
    restoreClient: async () => get<PersistedClient>(key),
    removeClient: async () => {
      await del(key)
    },
  }
}

/* ── Chaves de query (uma fonte só, para invalidar sem errar a string) ── */

export const qk = {
  identity: ['v2', 'identity'] as const,
  organizations: ['v2', 'organizations'] as const,
  members: ['v2', 'members'] as const,
  projects: (orgId: string | null) => ['v2', 'projects', orgId] as const,
  project: (orgId: string | null, id: string) => ['v2', 'project', orgId, id] as const,
  samples: (orgId: string | null, projectId: string) =>
    ['v2', 'samples', orgId, projectId] as const,
  custody: (orgId: string | null, sampleId: string) => ['v2', 'custody', orgId, sampleId] as const,
  files: (orgId: string | null, projectId: string) => ['v2', 'files', orgId, projectId] as const,
  results: (orgId: string | null, sampleId: string) => ['v2', 'results', orgId, sampleId] as const,
  reports: (orgId: string | null, projectId: string) =>
    ['v2', 'reports', orgId, projectId] as const,
}
