'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useSession, signOut } from 'next-auth/react'
import { api, type WorkerStatus } from '@/lib/api'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV_ITEMS = [
  { href: '/',             label: 'Dashboard',    icon: '⬡' },
  { href: '/metagenomics', label: 'Metagenômica', icon: '◎' },
  { href: '/jobs',         label: 'Fila de Jobs', icon: '◈' },
  { href: '/docs',         label: 'API Docs',     icon: '◫' },
]

// LIMS (v2/lims, v2/inventory, v2/interop, v2/laboratory, v2/reports) —
// ver epic 4snt/rizoma#5. Cresce conforme #7-#12 forem fechando.
//
// Não existe mais "Pesquisadores" separado (ADR-011, rizoma-backend):
// pesquisador é sempre um organization_member de verdade, gerenciado em
// Usuários (ADMIN_NAV_ITEMS abaixo) — não um contato solto com página própria.
const LIMS_NAV_ITEMS = [
  { href: '/inventory', label: 'Inventário', icon: '▢' },
  { href: '/interop',   label: 'Interop',    icon: '⇄' },
]

const ADMIN_NAV_ITEMS = [
  // "Novo Projeto" tinha saído do menu num commit anterior (a página
  // /admin/projects/new continuava existindo e funcionando, só ficou sem
  // atalho). Restaurado junto da correção do bug isAdmin (ver auth.ts).
  { href: '/admin/projects/new', label: 'Novo Projeto', icon: '⊕' },
  // Único cadastro de pessoa do sistema agora: convidar, trocar papel,
  // remover — e é aqui que se escolhe o "pesquisador" de um projeto.
  { href: '/admin/members', label: 'Usuários', icon: '◉' },
]

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function timeAgo(s: number): string {
  if (s < 60)   return `${s}s atrás`
  if (s < 3600) return `${Math.floor(s / 60)}m atrás`
  return `${Math.floor(s / 3600)}h atrás`
}

function WorkerPanel() {
  const [apiOnline, setApiOnline] = useState(true)

  const { data, isLoading } = useSWR<WorkerStatus>(
    'worker-status',
    () => api.getWorkerStatus(),
    {
      refreshInterval: 5000,
      onSuccess: () => setApiOnline(true),
      onError:   () => setApiOnline(false),
    }
  )

  const running = data?.running      ?? []
  const queued  = data?.queued_count ?? 0
  const recent  = data?.recent       ?? []

  return (
    <div className="worker-panel">
      {/* Cabeçalho */}
      <div className="worker-panel-header">
        <span className="worker-panel-title">R WORKER</span>
        <div className="worker-online-badge">
          <span className={`dot ${apiOnline ? 'dot-green pulse' : 'dot-red'}`} />
          <span style={{ color: apiOnline ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>
            {isLoading ? '...' : apiOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Jobs em execução */}
      {running.map(job => (
        <div key={job.id} className="worker-job-running">
          <div className="worker-job-row">
            <span className="worker-job-type">{job.job_type}</span>
            <span className="worker-job-project">{job.project_code}</span>
          </div>
          <div className="worker-progress-bar-track">
            <div className="worker-progress-bar-fill" style={{ width: `${job.progress_pct}%` }} />
          </div>
          <div className="worker-job-meta">
            <span>{job.progress_pct}%</span>
            <span>≈ {fmtSeconds(job.remaining_s)} restantes</span>
          </div>
        </div>
      ))}

      {/* Idle */}
      {running.length === 0 && queued === 0 && !isLoading && (
        <div className="worker-idle">
          <span className="dot dot-gray" style={{ marginRight: 6 }} />
          <span>Aguardando jobs</span>
        </div>
      )}

      {/* Fila */}
      {queued > 0 && (
        <div className="worker-queue-row">
          <span style={{ color: 'var(--amber)' }}>◌</span>
          <span>{queued} job{queued > 1 ? 's' : ''} na fila</span>
        </div>
      )}

      {/* Recentes */}
      {recent.length > 0 && <div className="worker-divider" />}
      {recent.slice(0, 4).map(job => (
        <div key={job.id} className="worker-recent-row">
          <span style={{ color: job.status === 'done' ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>
            {job.status === 'done' ? '✓' : '✗'}
          </span>
          <span className="worker-recent-type">{job.job_type}</span>
          <span className="worker-recent-project">{job.project_code}</span>
          <span className="worker-recent-time">{timeAgo(job.seconds_ago)}</span>
        </div>
      ))}
    </div>
  )
}

function UserPanel() {
  const { data: session } = useSession()

  // Auto sign-out if session has NotInvited error
  useEffect(() => {
    if (session?.error === 'NotInvited') {
      signOut({ callbackUrl: '/login?error=NotInvited' })
    }
  }, [session?.error])

  if (!session) return null

  const name  = session.userName  ?? session.user?.name  ?? 'Usuário'
  const email = session.userEmail ?? session.user?.email ?? ''
  const role  = session.role ?? 'researcher'

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 12px',
      marginTop: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {(session as any).userPicture ? (
          <img
            src={(session as any).userPicture}
            alt={name}
            referrerPolicy="no-referrer"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              border: '1px solid var(--border)',
            }}
          />
        ) : (
          <span style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {email}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`badge badge-${role === 'org_admin' ? 'amber' : 'cyan'}`} style={{ fontSize: 10 }}>
          {role}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 5,
            color: 'var(--text-3)',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 8px',
            transition: 'color 150ms ease, border-color 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--red)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-3)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)
  // Papel real do backend é "org_admin" (app/shared/context.py PERMISSIONS) —
  // nunca "admin" sozinho. Comparar com "admin" nunca bate pra ninguém real.
  const isAdmin  = session?.role === 'org_admin'

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">🧬</span>
            <div className="sidebar-logo-text glow-cyan">Rizoma</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThemeToggle />
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Fechar menu"
                style={{
                  display: 'none', // visível apenas em mobile via CSS abaixo
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '3px 7px',
                }}
                className="sidebar-close-btn"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="sidebar-subtitle">BIOINFORMÁTICA · UFVJM</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-item-label">{item.label}</span>
          </Link>
        ))}

        <div style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-3)',
          padding: '10px 10px 4px',
          fontWeight: 700,
        }}>
          LIMS
        </div>
        {LIMS_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-item-label">{item.label}</span>
          </Link>
        ))}

        {isAdmin && (
          <>
            <div style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-3)',
              padding: '10px 10px 4px',
              fontWeight: 700,
            }}>
              Admin
            </div>
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? ' active' : ''}`}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <WorkerPanel />
        <UserPanel />
      </div>
    </aside>
  )
}
