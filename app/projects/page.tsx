'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { api, type Project } from '@/lib/api'
import { can } from '@/lib/permissions'


function statusBadge(status: string) {
  if (status === 'active')    return <span className="badge badge-green">● active</span>
  if (status === 'running')   return <span className="badge badge-cyan">◉ running</span>
  if (status === 'completed') return <span className="badge badge-cyan">✓ done</span>
  return <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>{status}</span>
}

function ProjectCard({ p }: { p: Project }) {
  return (
    <Link href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
      <div className="project-card" style={{ cursor: 'pointer' }}>
        <div className="project-card-header">
          <span className="project-code">{p.code}</span>
        </div>
        <div className="project-name">{p.name}</div>
        {p.description && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-3)',
            marginTop: 4,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {p.description}
          </div>
        )}
        <div className="project-footer">
          {statusBadge(p.status)}
          {p.author ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {p.author.avatar_url ? (
                <img
                  src={p.author.avatar_url}
                  alt={p.author.name}
                  referrerPolicy="no-referrer"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                  }}
                />
              ) : (
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                }}>
                  {p.author.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {p.author.name.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>
              Abrir →
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function ProjectsPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: projects, error, isLoading } = useSWR(
    token ? ['projects', token] : null,
    () => api.getProjects(token!),
  )
  const isAdmin = can(session?.role, 'project:write')

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Projetos</h1>
          <p className="page-subtitle">
            Projetos de análise genômica ativos na plataforma
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/projects/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--cyan)',
              color: '#050d1a',
              borderRadius: 7,
              fontWeight: 700,
              fontSize: 13,
              padding: '8px 16px',
              textDecoration: 'none',
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            + Novo Projeto
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="project-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="project-card">
              <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{ padding: '20px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span>⚠</span>
          <span>Erro ao carregar projetos. Verifique se a API está rodando em{' '}
            <code className="mono">{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}</code>
          </span>
        </div>
      )}

      {!isLoading && !error && projects && projects.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum projeto encontrado</span>
          <span className="empty-state-desc">A API retornou uma lista vazia.</span>
        </div>
      )}

      {!isLoading && !error && projects && projects.length > 0 && (
        <div className="project-grid">
          {projects.map((p: Project) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  )
}
