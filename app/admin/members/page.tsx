'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, ORG_ROLES, type OrgRole } from '@/lib/api'
import { roleLabel, DEFAULT_ROLE_LABEL, type RoleLabelEntry } from '@/lib/role-labels'

// Nome técnico padrão do papel — usado só na tela de configuração pra
// identificar qual dos 8 papéis um rótulo customizado representa (nunca
// pra exibição de um membro real, que sempre passa por roleLabel()).
const DEFAULT_ROLE_LABEL_OF = (role: OrgRole) => DEFAULT_ROLE_LABEL[role]

export default function MembersPage() {
  const { data: session, update: updateSession } = useSession()
  const token = session?.accessToken
  const myLabels = session?.roleLabels
  const isOrgAdmin = session?.role === 'org_admin'

  // Catálogo em edição: lista de {label, role} — vários rótulos podem
  // apontar pro mesmo papel (ADR-013), por isso não é mais um input por
  // papel, e sim "adicionar rótulo" + escolher o papel via dropdown.
  const [catalogDraft, setCatalogDraft] = useState<RoleLabelEntry[] | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newLabelRole, setNewLabelRole] = useState<OrgRole>('lab_tech')
  const [savingLabels, setSavingLabels] = useState(false)
  const [labelsError, setLabelsError] = useState('')
  const catalog = catalogDraft ?? myLabels ?? []

  function handleAddLabel() {
    const label = newLabel.trim()
    if (!label) return
    setCatalogDraft([...catalog, { label, role: newLabelRole }])
    setNewLabel('')
  }

  function handleRemoveLabel(index: number) {
    setCatalogDraft(catalog.filter((_, i) => i !== index))
  }

  async function handleSaveLabels() {
    if (!token) return
    setSavingLabels(true)
    setLabelsError('')
    try {
      await api.updateRoleLabels(token, catalog)
      await updateSession()
      setCatalogDraft(null)
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
            Adicione os rótulos que este laboratório usa e escolha, pra cada um, qual dos 8 papéis
            técnicos ele representa (ex.: "Mestrando" → Técnico de laboratório). Mais de um rótulo
            pode apontar pro mesmo papel — a permissão real nunca muda, só o texto exibido na tela.
          </p>
          <div className="card" style={{ padding: 20 }}>
            {catalog.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                Nenhum rótulo customizado ainda — todos os papéis usam o nome padrão em português.
              </div>
            )}
            {catalog.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {catalog.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      flex: '1 1 200px', fontSize: 13, color: 'var(--text)',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--shape-sm)', padding: '6px 12px',
                    }}>
                      {entry.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>→</span>
                    <span className="badge badge-blue" style={{ flex: '0 0 auto' }}>
                      {DEFAULT_ROLE_LABEL_OF(entry.role)}
                    </span>
                    <button
                      onClick={() => handleRemoveLabel(i)}
                      title="Remover rótulo"
                      style={{
                        background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6, color: 'var(--red)', cursor: 'pointer',
                        fontSize: 12, padding: '3px 10px', marginLeft: 'auto',
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Novo rótulo</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="ex.: Mestrando"
                  style={{
                    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                    padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Papel do sistema</label>
                <select
                  value={newLabelRole}
                  onChange={e => setNewLabelRole(e.target.value as OrgRole)}
                  style={{
                    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                    padding: '7px 10px',
                  }}
                >
                  {ORG_ROLES.map(r => <option key={r} value={r}>{DEFAULT_ROLE_LABEL_OF(r)}</option>)}
                </select>
              </div>
              <button
                onClick={handleAddLabel}
                disabled={!newLabel.trim()}
                style={{
                  padding: '8px 16px',
                  background: newLabel.trim() ? 'var(--surface-2)' : 'var(--surface-2)',
                  color: newLabel.trim() ? 'var(--text)' : 'var(--text-3)',
                  border: '1px solid var(--border)', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 600,
                  cursor: newLabel.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                + Adicionar
              </button>
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
              {catalogDraft && (
                <button
                  onClick={() => setCatalogDraft(null)}
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
