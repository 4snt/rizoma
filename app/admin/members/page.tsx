'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, ORG_ROLES, type OrgRole } from '@/lib/api'

// Rótulo curto pro papel técnico (nomes vêm de app/shared/context.py PERMISSIONS
// no backend) — só descritivo, não muda o valor enviado.
const ROLE_LABEL: Record<string, string> = {
  org_admin: 'Administrador da organização',
  coordinator: 'Coordenador',
  tech_responsible: 'Responsável técnico',
  field_tech: 'Técnico de campo',
  lab_tech: 'Técnico de laboratório',
  bioinformatician: 'Bioinformata',
  client: 'Acesso externo (só leitura de laudos)',
  viewer: 'Leitor',
}

export default function MembersPage() {
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: members, error: membersError, isLoading: membersLoading } = useSWR(
    token ? ['members', token] : null,
    () => api.getMembers(token!),
  )

  const { data: invitations, error: invitesError, mutate: mutateInvites } = useSWR(
    token ? ['invitations', token] : null,
    () => api.getInvitations(token!),
  )

  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  async function handleInvite() {
    if (!token) return
    if (!email.trim()) { setInviteError('E-mail é obrigatório.'); return }
    setInviting(true)
    setInviteError('')
    try {
      await api.createInvitation(token, { email: email.trim(), role })
      await mutateInvites()
      setEmail('')
      setRole('viewer')
      setShowInvite(false)
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Erro ao convidar.')
    } finally {
      setInviting(false)
    }
  }

  const pendingInvitations = (invitations ?? []).filter(i => !i.accepted_at)

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">Membros da organização e convites pendentes</p>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          style={{
            background: 'var(--cyan)', color: '#050d1a', border: 'none',
            borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
            padding: '8px 16px', cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}
        >
          {showInvite ? '✕ Fechar' : '+ Convidar'}
        </button>
      </div>

      {showInvite && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>Novo Convite</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="pesquisador@ufvjm.edu.br"
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Papel</label>
              <select
                value={role} onChange={e => setRole(e.target.value as OrgRole)}
                style={{
                  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 10px',
                }}
              >
                {ORG_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              style={{
                padding: '8px 18px',
                background: !inviting && email.trim() ? 'var(--cyan)' : 'var(--surface-2)',
                color: !inviting && email.trim() ? '#050d1a' : 'var(--text-3)',
                border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
                cursor: !inviting && email.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {inviting ? 'Enviando...' : 'Convidar'}
            </button>
          </div>
          {inviteError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>{inviteError}</div>}
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Convites pendentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingInvitations.map(i => (
              <div key={i.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="dot dot-amber" />
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{i.email}</span>
                <span className="badge badge-blue">{ROLE_LABEL[i.role] ?? i.role}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  convidado em {new Date(i.invited_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {invitesError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 20 }}>Erro ao carregar convites.</div>}

      <div className="section-title">Membros</div>

      {membersLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      )}

      {membersError && <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar membros.</div>}

      {!membersLoading && !membersError && members && members.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum membro.</span>
        </div>
      )}

      {!membersLoading && !membersError && members && members.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>E-mail</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Papel</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Desde</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{m.name}</td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.email}</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="badge badge-cyan">{ROLE_LABEL[m.role] ?? m.role}</span></td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)' }}>
        Revogar convite, trocar papel e ativar/desativar usuário ainda não têm endpoint no backend
        (ver <span className="mono">rizoma-backend#11</span>) — só listar e convidar por enquanto.
      </p>
    </>
  )
}
