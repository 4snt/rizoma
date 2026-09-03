'use client'

// Cadastro de projeto. Só a identificação: código, nome, descrição e o
// pesquisador responsável. Não há mais escolha de marcador (16S/ITS),
// catálogo de análise nem parâmetros de DADA2 — a metagenômica saiu do
// escopo, e o projeto virou o que sempre foi no LIMS: o agregador sob o qual
// as amostras são registradas.

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { can } from '@/lib/permissions'
import { roleLabel } from '@/lib/role-labels'

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  fontWeight: 600,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 5,
}

export default function NewProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = session?.accessToken

  const [code, setCode]               = useState('')
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [customerUserId, setCustomerUserId] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // O responsável é sempre um membro real da organização (ADR-011) — daí a
  // lista vir de /identity/members, e não de um cadastro solto de contato.
  const { data: members } = useSWR(
    token ? ['members', token] : null,
    () => api.getMembers(token!),
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!code.trim() || !name.trim()) {
      setError('Código e nome são obrigatórios.')
      return
    }
    if (!token) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    setSubmitting(true)
    try {
      const { id } = await api.createProject(token, {
        code:             code.trim().toUpperCase(),
        name:             name.trim(),
        description:      description.trim(),
        customer_user_id: customerUserId || null,
      })
      // Direto para as amostras: criar o projeto só existe para poder
      // registrar amostra nele.
      router.push(`/projects/${id}/samples`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar projeto.')
      setSubmitting(false)
    }
  }

  if (!can(session?.role, 'project:write')) {
    return (
      <div style={{ padding: 40, color: 'var(--red)' }}>
        Acesso negado. Esta página é restrita a administradores.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-title">Novo Projeto</div>
        <div className="page-subtitle">
          Identifique o projeto. As amostras são registradas depois, dentro dele.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <section>
          <div className="section-title">Identificação</div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 160px' }}>
                <label style={labelStyle}>Código *</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="INOVAHERB"
                  maxLength={20}
                  required
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                  onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={labelStyle}>Nome do projeto *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Micobioma de solo sob herbicida"
                  required
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                  onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Objetivo e contexto do projeto..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 70,
                  fontFamily: 'var(--sans)',
                  lineHeight: 1.5,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Responsável{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (opcional)
                </span>
              </label>
              <select
                value={customerUserId}
                onChange={e => setCustomerUserId(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'var(--sans)' }}
              >
                <option value="">— sem responsável definido —</option>
                {(members ?? []).map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} · {roleLabel(m.role, session?.roleLabels)}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Só membros desta organização. Para trazer alguém novo, use Usuários → convite.
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--red)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 32 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 7,
              color: 'var(--text-3)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              padding: '9px 20px',
              transition: 'color 150ms ease',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--cyan)',
              border: 'none',
              borderRadius: 7,
              color: '#050d1a',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              opacity: submitting ? 0.7 : 1,
              padding: '9px 24px',
              transition: 'opacity 150ms ease',
            }}
          >
            {submitting ? 'Criando...' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--mono)',
  padding: '8px 12px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease',
}
