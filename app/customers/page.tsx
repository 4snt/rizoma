'use client'

// UI diz "Pesquisador" (linguagem do público acadêmico, NEBIM/UFVJM) —
// backend/API continuam "customer" (termo de LIMS genérico vindo do estudo
// 07-analise-padroes-compatibilidade.md, pensado pra laboratório comercial).
// Só rótulo visível mudou; tipo/rota/schema seguem Customer/customers de propósito.

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type Customer } from '@/lib/api'

function CustomerCard({ c }: { c: Customer }) {
  return (
    <Link href={`/customers/${c.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: 16, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.name}</span>
          {c.document && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.document}</span>}
        </div>
        {(c.contact_email || c.contact_phone) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {c.contact_email && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>✉ {c.contact_email}</span>}
            {c.contact_phone && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>☎ {c.contact_phone}</span>}
          </div>
        )}
        {c.notes && (
          <div style={{
            marginTop: 8, fontSize: 12, color: 'var(--text-3)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {c.notes}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function CustomersPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: customers, error, isLoading, mutate } = useSWR(
    token ? ['customers', token] : null,
    () => api.getCustomers(token!),
  )

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', document: '', contact_email: '', contact_phone: '', notes: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreate() {
    if (!token) return
    if (!form.name.trim()) { setCreateError('Nome é obrigatório.'); return }
    setCreating(true)
    setCreateError('')
    try {
      await api.createCustomer(token, {
        name: form.name.trim(),
        document: form.document.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        notes: form.notes.trim() || null,
      })
      await mutate()
      setForm({ name: '', document: '', contact_email: '', contact_phone: '', notes: '' })
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao criar pesquisador.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Pesquisadores</h1>
          <p className="page-subtitle">Pesquisadores/orientadores responsáveis pelos projetos (LIMS)</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--cyan)', color: '#050d1a',
            borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
            padding: '8px 16px', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}
        >
          {showCreate ? '✕ Fechar' : '+ Novo Pesquisador'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>Novo Pesquisador</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Nome *</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Documento</label>
              <input
                type="text" value={form.document}
                onChange={e => setForm(f => ({ ...f, document: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>E-mail de contato</label>
              <input
                type="email" value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Telefone</label>
              <input
                type="text" value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                padding: '7px 12px', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          </div>
          {createError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{createError}</div>}
          <button
            onClick={handleCreate}
            disabled={creating || !form.name.trim()}
            style={{
              padding: '8px 18px',
              background: !creating && form.name.trim() ? 'var(--cyan)' : 'var(--surface-2)',
              color: !creating && form.name.trim() ? '#050d1a' : 'var(--text-3)',
              border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
              cursor: !creating && form.name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {creating ? 'Criando...' : 'Criar Pesquisador'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="project-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '80%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 20, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          <span>Erro ao carregar pesquisadores.</span>
        </div>
      )}

      {!isLoading && !error && customers && customers.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum pesquisador cadastrado</span>
          <span className="empty-state-desc">Crie o primeiro pesquisador pra começar a abrir projetos.</span>
        </div>
      )}

      {!isLoading && !error && customers && customers.length > 0 && (
        <div className="project-grid">
          {customers.map(c => <CustomerCard key={c.id} c={c} />)}
        </div>
      )}
    </>
  )
}
