'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { api, type Project } from '@/lib/api'

function markerBadge(marker: string) {
  if (marker === 'ITS') return <span className="badge badge-purple">ITS</span>
  return <span className="badge badge-blue">16S</span>
}

function statusDot(status: string) {
  if (status === 'active')     return <span className="dot dot-green" />
  if (status === 'running')    return <span className="dot dot-cyan pulse" />
  if (status === 'completed')  return <span className="dot dot-cyan" />
  return <span className="dot dot-gray" />
}

function MetricCard({
  icon,
  label,
  value,
  footer,
}: {
  icon: string
  label: string
  value: string | number
  footer?: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        <span className="metric-icon">{icon}</span>
        {label}
      </div>
      <div className="metric-value">{value}</div>
      {footer && <div className="metric-footer">{footer}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: projects, isLoading } = useSWR(
    token ? ['projects', token] : null,
    () => api.getProjects(token!),
  )

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const activeCount = projects?.filter((p) => p.status === 'active').length ?? 0

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{today}</p>
      </div>

      {/* Metric cards */}
      <div className="metric-grid">
        <MetricCard
          icon="◈"
          label="Projetos Ativos"
          value={isLoading ? '—' : String(activeCount)}
          footer={isLoading ? 'carregando...' : `${projects?.length ?? 0} projetos no total`}
        />
        <MetricCard
          icon="◉"
          label="Jobs na Fila"
          value="0"
          footer="aguardando R Worker"
        />
        <MetricCard
          icon="✓"
          label="Análises Concluídas"
          value="0"
          footer="este ciclo"
        />
        <MetricCard
          icon="⬡"
          label="Worker Status"
          value="—"
          footer="verifique a sidebar"
        />
      </div>

      {/* Projects section */}
      <div className="section-title">Projetos</div>

      {isLoading && (
        <div className="project-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="project-card">
              <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && projects && projects.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum projeto encontrado</span>
          <span className="empty-state-desc">Aguardando dados da API.</span>
        </div>
      )}

      {!isLoading && projects && projects.length > 0 && (
        <div className="project-grid">
          {projects.map((p: Project) => (
            <div key={p.id} className="project-card">
              <div className="project-card-header">
                <span className="project-code">{p.code}</span>
                {markerBadge(p.marker_type)}
              </div>
              <div className="project-name">{p.name}</div>
              <div className="project-footer">
                <div className="flex items-center gap-2">
                  {statusDot(p.status)}
                  <span className="text-sm text-muted">{p.status}</span>
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  style={{
                    fontSize: 12,
                    color: 'var(--cyan)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Ver →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
