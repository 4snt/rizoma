'use client'

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { api, type AdminUser, type Invite } from "@/lib/api"

const ROLES = ["researcher", "admin"] as const
type Role = typeof ROLES[number]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const token = session?.accessToken ?? ""

  const [users,       setUsers]       = useState<AdminUser[]>([])
  const [invites,     setInvites]     = useState<Invite[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // New invite form state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole,  setInviteRole]  = useState<Role>("researcher")
  const [submitting,  setSubmitting]  = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!token) return
    setLoadingData(true)
    setError(null)
    try {
      const [u, i] = await Promise.all([
        api.getAdminUsers(token),
        api.getAdminInvites(token),
      ])
      setUsers(u)
      setInvites(i)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados")
    } finally {
      setLoadingData(false)
    }
  }, [token])

  useEffect(() => {
    if (status === "authenticated") loadData()
  }, [status, loadData])

  // Guard: only admin can access (middleware already redirects, but belt-and-suspenders)
  if (status === "loading") {
    return (
      <div style={{ padding: 40, color: "var(--text-2)" }}>Carregando...</div>
    )
  }
  if (session?.role !== "org_admin") {
    return (
      <div style={{ padding: 40, color: "var(--red)" }}>
        Acesso negado. Esta página é restrita a administradores.
      </div>
    )
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    if (!inviteEmail.endsWith("@ufvjm.edu.br")) {
      setInviteError("O email deve pertencer ao domínio @ufvjm.edu.br")
      return
    }
    setSubmitting(true)
    try {
      await api.createInvite(token, inviteEmail, inviteRole)
      setInviteEmail("")
      setInviteRole("researcher")
      await loadData()
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Erro ao criar convite")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteInvite(id: string) {
    try {
      await api.deleteInvite(token, id)
      await loadData()
    } catch {
      /* ignore — UI will reflect old state until next load */
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await api.updateUserRole(token, userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar role")
    }
  }

  async function handleToggleActive(user: AdminUser) {
    if (!user.is_active) return // only deactivate for now; reactivate not in spec
    try {
      await api.deactivateUser(token, user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: false } : u))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao desativar usuário")
    }
  }

  const pendingInvites = invites.filter(i => !i.used_at)

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Gestão de Usuários</div>
        <div className="page-subtitle">Convites e controle de acesso</div>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8,
          padding: "10px 14px",
          color: "var(--red)",
          marginBottom: 24,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Convites pendentes ── */}
      <section style={{ marginBottom: 32 }}>
        <div className="section-title">Convites pendentes</div>

        {loadingData ? (
          <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        ) : pendingInvites.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <span className="empty-state-icon" style={{ fontSize: 24 }}>✉</span>
            <span className="empty-state-title" style={{ fontSize: 13 }}>Nenhum convite pendente</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingInvites.map(invite => (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "var(--text)", fontSize: 13, fontFamily: "var(--mono)" }}>
                    {invite.email}
                  </span>
                  <span className={`badge badge-${invite.role === "org_admin" ? "amber" : "cyan"}`}>
                    {invite.role}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    Convidado em {formatDate(invite.invited_at)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  title="Cancelar convite"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 6,
                    color: "var(--red)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 8px",
                    lineHeight: 1.4,
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Novo convite ── */}
      <section style={{ marginBottom: 32 }}>
        <div className="section-title">Novo convite</div>
        <form
          onSubmit={handleInvite}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="email@ufvjm.edu.br"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
              style={{
                flex: 1,
                minWidth: 220,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "var(--mono)",
                padding: "8px 12px",
                outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--cyan)")}
              onBlur={e  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as Role)}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--text-2)",
                fontSize: 13,
                padding: "8px 12px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="researcher">researcher</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "var(--cyan)",
                color: "#050d1a",
                border: "none",
                borderRadius: 7,
                fontWeight: 700,
                fontSize: 13,
                padding: "8px 18px",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                transition: "opacity 150ms ease",
              }}
            >
              {submitting ? "Enviando..." : "Convidar"}
            </button>
          </div>
          {inviteError && (
            <div style={{ fontSize: 12, color: "var(--red)" }}>{inviteError}</div>
          )}
        </form>
      </section>

      {/* ── Usuários cadastrados ── */}
      <section>
        <div className="section-title">Usuários cadastrados</div>

        {loadingData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <span className="empty-state-title">Nenhum usuário registrado ainda.</span>
          </div>
        ) : (
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 110px 120px 100px",
              gap: 12,
              padding: "8px 16px",
              fontSize: 11,
              textTransform: "uppercase" as const,
              letterSpacing: "0.07em",
              color: "var(--text-3)",
              fontWeight: 600,
              borderBottom: "1px solid var(--border)",
            }}>
              <span>Nome / Email</span>
              <span>Último login</span>
              <span>Role</span>
              <span>Status</span>
              <span></span>
            </div>

            {users.map((user, idx) => (
              <div
                key={user.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 110px 120px 100px",
                  gap: 12,
                  padding: "12px 16px",
                  alignItems: "center",
                  borderBottom: idx < users.length - 1 ? "1px solid var(--border)" : "none",
                  background: user.is_active ? "transparent" : "rgba(239,68,68,0.03)",
                  opacity: user.is_active ? 1 : 0.7,
                }}
              >
                {/* Name + email */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "var(--text-3)", flexShrink: 0,
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)", marginTop: 1 }}>
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* Last login */}
                <div style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
                  {formatDate(user.last_login)}
                </div>

                {/* Role (inline select) */}
                <div>
                  <select
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    disabled={!user.is_active}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-2)",
                      fontSize: 12,
                      padding: "4px 8px",
                      cursor: user.is_active ? "pointer" : "not-allowed",
                      outline: "none",
                    }}
                  >
                    <option value="researcher">researcher</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                {/* Status badge */}
                <div>
                  <span className={`badge badge-${user.is_active ? "green" : "red"}`}>
                    {user.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {/* Deactivate button */}
                <div>
                  {user.is_active && (
                    <button
                      onClick={() => handleToggleActive(user)}
                      title="Desativar usuário"
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 6,
                        color: "var(--red)",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: "3px 8px",
                        transition: "background 150ms ease",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      Desativar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
