'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, ORG_ROLES, type OrgRole } from '@/lib/api'
import { roleLabel } from '@/lib/role-labels'

export default function MembersPage() {
  const { data: session, update: updateSession } = useSession()
  const token = session?.accessToken
  const myLabels = session?.roleLabels
  const isOrgAdmin = session?.role === 'org_admin'

  const [labelDraft, setLabelDraft] = useState<Record<string, string> | null>(null)
  const [savingLabels, setSavingLabels] = useState(false)
  const [labelsError, setLabelsError] = useState('')
  const labels = labelDraft ?? Object.fromEntries(ORG_ROLES.map(r => [r, roleLabel(r, myLabels)]))

  async function handleSaveLabels() {
    if (!token) return
    setSavingLabels(true)
    setLabelsError('')
    try {
      await api.updateRoleLabels(token, labels)
      await updateSession()
      setLabelDraft(null)
    } catch (e) {
      setLabelsError(e instanceof Error ? e.message : 'Erro ao salvar rótulos.')
    } finally {
      setSavingLabels(false)
    }
  }

  const { data: members, error: membersError, isLoading: membersLoading, mutate: mutateMembers } = useSWR(
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
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  async function handleRevoke(invitationId: string) {
    if (!token) return
    setBusyId(invitationId)
    setRowError(null)
    try {
      await api.revokeInvitation(token, invitationId)
      await mutateInvites()
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Erro ao revogar convite.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!token) return
    setBusyId(userId)
    setRowError(null)
    try {
      await api.updateMemberRole(token, userId, newRole as OrgRole)
      await mutateMembers()
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Erro ao trocar papel.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!token) return
    if (!confirm(`Remover ${name} desta organização?`)) return
    setBusyId(userId)
    setRowError(null)
    try {
      await api.removeMember(token, userId)
      await mutateMembers()
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Erro ao remover membro.')
    } finally {
      setBusyId(null)
    }
  }

  const pendingInvitations = (invitations ?? []).filter(i => !i.accepted_at)
  const myEmail = session?.userEmail

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
                {ORG_ROLES.map(r => <option key={r} value={r}>{roleLabel(r, myLabels)}</option>)}
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

      {rowError && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13 }}>
          {rowError}
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
                <span className="badge badge-blue">{roleLabel(i.role, myLabels)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  convidado em {new Date(i.invited_at).toLocaleDateString('pt-BR')}
                </span>
                <button
                  onClick={() => handleRevoke(i.id)}
                  disabled={busyId === i.id}
                  title="Revogar convite"
                  style={{
                    background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 6, color: 'var(--red)', cursor: busyId === i.id ? 'not-allowed' : 'pointer',
                    fontSize: 12, padding: '3px 10px', opacity: busyId === i.id ? 0.6 : 1,
                  }}
                >
                  Revogar
                </button>
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
                <th style={{ padding: '8px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isSelf = myEmail != null && m.email === myEmail
                return (
                  <tr key={m.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{m.name}</td>
                    <td style={{ padding: '10px 12px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.email}</span></td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.user_id, e.target.value)}
                        disabled={isSelf || busyId === m.user_id}
                        title={isSelf ? 'Peça a outro administrador pra mudar seu próprio papel' : undefined}
                        style={{
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 12,
                          padding: '4px 8px', cursor: isSelf ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {ORG_ROLES.map(r => <option key={r} value={r}>{roleLabel(r, myLabels)}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 12 }}>
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {!isSelf && (
                        <button
                          onClick={() => handleRemove(m.user_id, m.name)}
                          disabled={busyId === m.user_id}
                          title="Remover desta organização"
                          style={{
                            background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 6, color: 'var(--red)',
                            cursor: busyId === m.user_id ? 'not-allowed' : 'pointer',
                            fontSize: 12, padding: '3px 10px', opacity: busyId === m.user_id ? 0.6 : 1,
                          }}
                        >
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isOrgAdmin && (
        <div style={{ marginTop: 32 }}>
          <div className="section-title">Rótulos de papel</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
            Personalize o nome exibido de cada papel pra este laboratório (ex.: "Técnico de laboratório" → "Mestrando").
            A permissão real não muda, só o texto na tela.
          </p>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {ORG_ROLES.map(r => (
                <div key={r}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{r}</label>
                  <input
                    type="text"
                    value={labels[r] ?? ''}
                    onChange={e => setLabelDraft({ ...labels, [r]: e.target.value })}
                    style={{
                      width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                      padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                onClick={handleSaveLabels}
                disabled={savingLabels}
                style={{
                  padding: '8px 18px',
                  background: !savingLabels ? 'var(--cyan)' : 'var(--surface-2)',
                  color: !savingLabels ? '#050d1a' : 'var(--text-3)',
                  border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
                  cursor: !savingLabels ? 'pointer' : 'not-allowed',
                }}
              >
                {savingLabels ? 'Salvando...' : 'Salvar rótulos'}
              </button>
              {labelDraft && (
                <button
                  onClick={() => setLabelDraft(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}
                >
                  Descartar
                </button>
              )}
              {labelsError && <span style={{ fontSize: 12, color: 'var(--red)' }}>{labelsError}</span>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
