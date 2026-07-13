'use client'

import { useEffect, useState } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { onlineManager, type QueryClient } from '@tanstack/react-query'
import { CACHE_MAX_AGE, createIdbPersister, createQueryClient } from '@/lib/query-client'
import { startOutboxAutoFlush } from '@/lib/offline-outbox'

/**
 * Provider do TanStack Query v5 (ADR-004) com:
 *  - persistência do cache em IndexedDB (idb-keyval), para o modo campo offline;
 *  - `resumePausedMutations()` na restauração e a cada reconexão de rede;
 *  - flush automático da outbox (§6).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Um client por montagem — nunca no escopo do módulo (vazaria entre requests no SSR).
  const [queryClient] = useState<QueryClient>(() => createQueryClient())
  const [persister] = useState(() => createIdbPersister())

  useEffect(() => {
    const stopOutbox = startOutboxAutoFlush()
    const unsubscribe = onlineManager.subscribe((online) => {
      if (online) void queryClient.resumePausedMutations()
    })
    return () => {
      stopOutbox()
      unsubscribe()
    }
  }, [queryClient])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'v2' }}
      onSuccess={() => {
        // Cache restaurado do IndexedDB: reenvia o que ficou pausado sem rede.
        void queryClient.resumePausedMutations()
      }}
    >
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  )
}
