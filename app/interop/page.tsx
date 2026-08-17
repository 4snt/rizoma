'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, WEBHOOK_EVENT_TYPES, type WebhookEventType } from '@/lib/api'
import { can } from '@/lib/permissions'

export default function InteropPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role
  const canRead = can(role, 'member:read')
  const canWrite = can(role, 'member:write')

  const { data: webhooks, error, isLoading, mutate } = useSWR(
    token && canRead ? ['webhooks', token] : null,
    () => api.getWebhooks(token!),
  )

  const [showCreate, setShowCreate] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)

  function toggleEvent(e: WebhookEventType) {
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }

  async function handleCreate() {
    if (!token) return
    if (!url.trim() || events.length === 0) { setCreateError('URL e ao menos um evento são obrigatórios.'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await api.createWebhook(token, { url: url.trim(), event_types: events })
      await mutate()
      setNewSecret(created.secret)
      setUrl('')
      setEvents([])
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao criar webhook.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    if (!confirm('Remover este webhook?')) return
    try {
      await api.deleteWebhook(token, id)
      await mutate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Interop</h1>
          <p className="page-subtitle">Webhooks de eventos · import/export de amostras fica na página de cada projeto</p>
        </div>
        {canWrite && (
          <button
            onClick={() => { setShowCreate(v => !v); setNewSecret(null) }}
            style={{
              background: 'var(--cyan)', color: '#050d1a', border: 'none',
              borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
              padding: '8px 16px', cursor: 'pointer', flexShrink: 0, marginTop: 4,
            }}
          >
            {showCreate ? '✕ Fechar' : '+ Novo Webhook'}
          </button>
        )}
      </div>

      {!canRead && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Seu papel não tem acesso a webhooks — fale com um administrador da organização.</span>
        </div>
      )}

      {newSecret && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'rgba(16,212,138,0.3)' }}>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginBottom: 6 }}>
            ✓ Webhook criado — copie o secret agora, ele não aparece de novo:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code className="mono" style={{
              flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--shape-sm)', fontSize: 12, wordBreak: 'break-all',
            }}>
              {newSecret}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(newSecret); }}
              style={{
                padding: '6px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--shape-full)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
              }}
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      {showCreate && canWrite && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>Novo Webhook</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>URL de destino</label>
            <input
              type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://seu-sistema.com/webhooks/rizoma"
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Eventos</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {WEBHOOK_EVENT_TYPES.map(evt => (
                <label
                  key={evt}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    background: events.includes(evt) ? 'var(--cyan-dim)' : 'var(--surface-2)',
                    border: `1px solid ${events.includes(evt) ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
                    borderRadius: 'var(--shape-full)', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
                    color: events.includes(evt) ? 'var(--cyan)' : 'var(--text-2)',
                  }}
                >
                  <input type="checkbox" checked={events.includes(evt)} onChange={() => toggleEvent(evt)} style={{ display: 'none' }} />
                  {evt}
                </label>
              ))}
            </div>
          </div>
          {createError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{createError}</div>}
          <button
            onClick={handleCreate}
            disabled={creating || !url.trim() || events.length === 0}
            style={{
              padding: '8px 18px',
              background: !creating && url.trim() && events.length > 0 ? 'var(--cyan)' : 'var(--surface-2)',
              color: !creating && url.trim() && events.length > 0 ? '#050d1a' : 'var(--text-3)',
              border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
              cursor: !creating && url.trim() && events.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {creating ? 'Criando...' : 'Criar Webhook'}
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 8 }} />)}
        </div>
      )}

      {error && <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar webhooks.</div>}

      {!isLoading && !error && webhooks && webhooks.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum webhook cadastrado.</span>
        </div>
      )}

      {!isLoading && !error && webhooks && webhooks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map(w => (
            <div key={w.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`dot ${w.is_active ? 'dot-green' : 'dot-gray'}`} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>{w.url}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {w.event_types.map(e => <span key={e} className="badge badge-cyan">{e}</span>)}
              </div>
              {canWrite && (
                <button
                  onClick={() => handleDelete(w.id)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--shape-full)',
                    color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, padding: '3px 10px', flexShrink: 0,
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
