'use client'

import { useEffect, useState } from 'react'
import { flushOutbox, subscribeOutbox, type OutboxEntry } from '@/lib/offline-outbox'

/** Estado da fila offline + status da rede. */
export function useOutbox(): { entries: OutboxEntry[]; online: boolean; flush: () => void } {
  const [entries, setEntries] = useState<OutboxEntry[]>([])
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeOutbox(setEntries)
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      unsubscribe()
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return {
    entries,
    online,
    flush: () => {
      void flushOutbox()
    },
  }
}

/** Badge "N pendentes de sincronização" — visível em toda a aplicação. */
export function OutboxBadge() {
  const { entries, online } = useOutbox()

  if (entries.length === 0 && online) return null

  return (
    <span
      className={`badge ${entries.length > 0 ? 'badge-amber' : 'badge-red'}`}
      title={online ? 'Sincronizando ao voltar a rede' : 'Sem rede — trabalhando offline'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span className={`dot ${online ? 'dot-amber' : 'dot-red'}`} />
      {entries.length > 0
        ? `${entries.length} pendente${entries.length > 1 ? 's' : ''} de sincronização`
        : 'Offline'}
    </span>
  )
}
