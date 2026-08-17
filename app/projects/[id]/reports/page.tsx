'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { can } from '@/lib/permissions'

function statusBadge(status: string) {
  if (status === 'published') return <span className="badge badge-green">assinado</span>
  if (status === 'draft') return <span className="badge badge-amber">rascunho</span>
  return <span className="badge">{status}</span>
}

export default function ProjectReportsPage() {
  const params = useParams()
  const projectId = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: project } = useSWR(
    projectId && token ? ['project', projectId, token] : null,
    () => api.getProject(token!, projectId),
  )

  const { data: reports, error, isLoading, mutate } = useSWR(
    projectId && token ? ['reports', projectId, token] : null,
    () => api.getReports(token!, projectId),
  )

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreate() {
    if (!token || !projectId) return
    if (!title.trim()) { setCreateError('Título é obrigatório.'); return }
    setCreating(true)
    setCreateError('')
    try {
      await api.createReport(token, projectId, { title: title.trim(), code: code.trim() || null })
      await mutate()
      setTitle(''); setCode('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao criar laudo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/projects/${projectId}`}>{project?.code ?? '...'}</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Laudos</span>
      </div>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Laudos</h1>
          <p className="page-subtitle">{project?.name ?? '...'}</p>
        </div>
        {can(session?.role, 'report:write') && (
          <button
            onClick={() => setShowCreate(v => !v)}
            style={{
              background: 'var(--cyan)', color: '#050d1a', border: 'none',
              borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
              padding: '8px 16px', cursor: 'pointer', flexShrink: 0, marginTop: 4,
            }}
          >
            {showCreate ? '✕ Fechar' : '+ Novo Laudo'}
          </button>
        )}
      </div>

      {showCreate && can(session?.role, 'report:write') && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Título *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Código (opcional)</label>
              <input
                type="text" value={code} onChange={e => setCode(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          {createError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{createError}</div>}
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            style={{
              padding: '8px 18px',
              background: !creating && title.trim() ? 'var(--cyan)' : 'var(--surface-2)',
              color: !creating && title.trim() ? '#050d1a' : 'var(--text-3)',
              border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
              cursor: !creating && title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {creating ? 'Criando...' : 'Criar Laudo'}
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      )}

      {error && <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar laudos.</div>}

      {!isLoading && !error && reports && reports.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum laudo emitido.</span>
        </div>
      )}

      {!isLoading && !error && reports && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reports.map(r => (
            <Link key={r.id} href={`/reports/${r.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.code}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{r.title}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>v{r.version}</span>
                {statusBadge(r.status)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
