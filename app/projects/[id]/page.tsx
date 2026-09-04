'use client'

// Visão geral do projeto. Depois que a metagenômica saiu do escopo, esta tela
// não é mais um painel de pipeline: é a identificação do projeto e a porta de
// entrada para o que se faz dentro dele — registrar amostra e emitir laudo.

import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type LimsSampleListItem } from '@/lib/api'

function statusDot(status: string) {
  const color =
    status === 'in_progress' ? 'var(--green)'
    : status === 'completed' ? 'var(--cyan)'
    : status === 'cancelled' || status === 'archived' ? 'var(--red)'
    : 'var(--text-3)'
  return <span className="dot" style={{ background: color }} />
}

function ModuleLink({
  href, icon, label, hint, color, border, background,
}: {
  href: string
  icon: string
  label: string
  hint: string
  color: string
  border: string
  background: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 18px',
        background,
        border: `1px solid ${border}`,
        borderRadius: 'var(--shape-full)', color,
        fontSize: 13, fontWeight: 600, textDecoration: 'none',
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
      <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>{hint} →</span>
    </Link>
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: project, error: projectError } = useSWR(
    id && token ? ['project', id, token] : null,
    () => api.getProject(token!, id),
  )

  const { data: samples } = useSWR<LimsSampleListItem[]>(
    id && token ? ['project-samples', id, token] : null,
    () => api.getAllSamples(token!, id),
  )

  if (projectError) {
    return (
      <div className="card" style={{ padding: 24, color: 'var(--red)', fontSize: 13 }}>
        Erro ao carregar o projeto: {projectError instanceof Error ? projectError.message : 'desconhecido'}
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{project?.code ?? '...'}</span>
      </div>

      <div className="page-header">
        {project ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title mono" style={{ color: 'var(--cyan)' }}>{project.code}</h1>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
              {statusDot(project.status)} {project.status}
            </span>
          </div>
        ) : (
          <div className="skeleton" style={{ height: 28, width: 240 }} />
        )}
        {project && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{project.name}</p>
            {project.author && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>·</span>
                {project.author.avatar_url ? (
                  <img
                    src={project.author.avatar_url}
                    alt={project.author.name}
                    referrerPolicy="no-referrer"
                    style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                  />
                ) : (
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                  }}>
                    {project.author.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{project.author.name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {project?.description && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {project.description}
        </div>
      )}

      {project && (
        <div style={{ marginBottom: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ModuleLink
            href={`/projects/${id}/samples`}
            icon="🧪"
            label="Amostras (custódia)"
            hint="Registrar · coleta · transporte"
            color="var(--green)"
            border="rgba(16,212,138,0.25)"
            background="rgba(16,212,138,0.08)"
          />
          <ModuleLink
            href={`/projects/${id}/reports`}
            icon="📄"
            label="Laudos"
            hint="Emitir · assinar"
            color="var(--purple)"
            border="rgba(168,85,247,0.25)"
            background="rgba(168,85,247,0.08)"
          />
        </div>
      )}

      {/* Amostras do projeto — resumo; o registro em si mora em /samples */}
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="section-title" style={{ flex: 1, margin: 0 }}>Amostras</span>
        <Link href={`/projects/${id}/samples`} style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}>
          ver todas →
        </Link>
      </div>

      {!samples && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}

      {samples && samples.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhuma amostra registrada neste projeto.</span>
          <span className="empty-state-desc">
            <Link href={`/projects/${id}/samples`} style={{ color: 'var(--cyan)' }}>
              Registrar a primeira amostra
            </Link>
          </span>
        </div>
      )}

      {samples && samples.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {samples.slice(0, 10).map(s => (
            <Link key={s.id} href={`/samples/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{s.code}</span>
                <span className="badge badge-blue">{s.matrix}</span>
                {s.treatment_group && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flex: 1 }}>{s.treatment_group}</span>
                )}
                <span className="badge badge-cyan" style={{ marginLeft: 'auto' }}>{s.status}</span>
              </div>
            </Link>
          ))}
          {samples.length > 10 && (
            <Link href={`/projects/${id}/samples`} style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 2px' }}>
              + {samples.length - 10} amostra(s)
            </Link>
          )}
        </div>
      )}
    </>
  )
}
