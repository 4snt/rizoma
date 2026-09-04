'use client'

// Tela única do projeto (unificação de /projects e do antigo /projects-v2).
// Depois que a metagenômica saiu do escopo, isto não é mais um painel de
// pipeline: é a identificação do projeto e a porta de entrada para o que se
// faz dentro dele — registrar amostra, anexar arquivo, ver resultado e emitir
// laudo. As abas que têm tela própria (Amostras, Laudos) são links: o registro
// biológico e o fluxo de laudo já moram em /projects/[id]/samples e
// /projects/[id]/reports, e não vale duplicar formulário aqui.

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type LimsSampleListItem, type ResultListItem } from '@/lib/api'
import { FilesTab } from '@/components/mvp/FilesTab'

type Tab = 'overview' | 'files' | 'results'

function statusDot(status: string) {
  const color =
    status === 'in_progress' ? 'var(--green)'
    : status === 'completed' ? 'var(--cyan)'
    : status === 'cancelled' || status === 'archived' ? 'var(--red)'
    : 'var(--text-3)'
  return <span className="dot" style={{ background: color }} />
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--cyan)' : 'transparent'}`,
  color: active ? 'var(--cyan)' : 'var(--text-2)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
})

function SamplesSummary({ projectId, samples }: { projectId: string; samples?: LimsSampleListItem[] }) {
  return (
    <>
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="section-title" style={{ flex: 1, margin: 0 }}>Amostras</span>
        <Link href={`/projects/${projectId}/samples`} style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}>
          registrar / ver todas →
        </Link>
      </div>

      {!samples && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}

      {samples && samples.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhuma amostra registrada neste projeto.</span>
          <span className="empty-state-desc">
            <Link href={`/projects/${projectId}/samples`} style={{ color: 'var(--cyan)' }}>
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
            <Link href={`/projects/${projectId}/samples`} style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 2px' }}>
              + {samples.length - 10} amostra(s)
            </Link>
          )}
        </div>
      )}
    </>
  )
}

// Resultados do projeto: só a versão corrente de cada resultado, agrupada
// por amostra. Registrar/corrigir/revisar continua na tela da amostra
// (/samples/[id]) — resultado é sempre de uma amostra, não do projeto.
function ProjectResults({ projectId, token }: { projectId: string; token: string }) {
  const { data: results, error, isLoading } = useSWR<ResultListItem[]>(
    ['project-results', projectId, token],
    () => api.getAllResults(token, { projectId }),
  )

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
      </div>
    )
  }
  if (error) return <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar resultados.</div>
  if (!results || results.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <span className="empty-state-icon">⚗</span>
        <span className="empty-state-title">Nenhum resultado registrado neste projeto.</span>
        <span className="empty-state-desc">
          Resultados são registrados na tela de cada amostra —{' '}
          <Link href={`/projects/${projectId}/samples`} style={{ color: 'var(--cyan)' }}>ver amostras</Link>.
        </span>
      </div>
    )
  }

  const reviewBadge = (status: string) =>
    status === 'approved' ? 'badge-green'
    : status === 'retracted' ? 'badge-red'
    : 'badge-amber'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {results.map(r => (
        <Link key={r.id} href={`/samples/${r.sample_id}`} style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.sample_code}</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.analyte}</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{r.current.display_value}</span>
            {r.method && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.method}</span>}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>v{r.current.version}</span>
            <span className={`badge ${reviewBadge(r.current.status)}`}>{r.current.status}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken
  const [tab, setTab] = useState<Tab>('overview')

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

      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        <button role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')} style={tabStyle(tab === 'overview')}>
          Visão geral
        </button>
        <Link href={`/projects/${id}/samples`} role="tab" style={tabStyle(false)}>
          🧪 Amostras <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)' }}>↗</span>
        </Link>
        <button role="tab" aria-selected={tab === 'files'} onClick={() => setTab('files')} style={tabStyle(tab === 'files')}>
          Arquivos
        </button>
        <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')} style={tabStyle(tab === 'results')}>
          Resultados
        </button>
        <Link href={`/projects/${id}/reports`} role="tab" style={tabStyle(false)}>
          📄 Laudos <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)' }}>↗</span>
        </Link>
      </div>

      {tab === 'overview' && (
        <>
          {project?.description && (
            <div className="card" style={{ padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
              {project.description}
            </div>
          )}
          <SamplesSummary projectId={id} samples={samples} />
        </>
      )}

      {tab === 'files' && <FilesTab projectId={id} />}

      {tab === 'results' && (token ? <ProjectResults projectId={id} token={token} /> : null)}
    </>
  )
}
