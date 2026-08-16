'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import {
  api,
  type LimsSample,
  type LimsSampleMatrix,
  type LimsSampleStatus,
} from '@/lib/api'

const MATRIX_OPTIONS: LimsSampleMatrix[] = [
  'solo', 'sedimento', 'agua', 'tecido_vegetal', 'raiz', 'folha',
  'biomassa', 'cultura_microbiana', 'dna', 'rna', 'extrato',
  'biochar', 'formulado', 'substrato',
]

function statusBadge(status: LimsSampleStatus) {
  const map: Record<LimsSampleStatus, string> = {
    planned: 'badge-blue', collected: 'badge-cyan', in_transit: 'badge-amber',
    received: 'badge-cyan', accepted: 'badge-green', rejected: 'badge-red',
    processing: 'badge-amber', analyzed: 'badge-green', stored: 'badge-purple',
    consumed: 'badge-purple', disposed: 'badge-red',
  }
  return <span className={`badge ${map[status] ?? ''}`}>{status}</span>
}

export default function ProjectSamplesPage() {
  const params = useParams()
  const projectId = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: project } = useSWR(
    projectId && token ? ['project', projectId, token] : null,
    () => api.getProject(token!, projectId),
  )

  const { data: samples, error, isLoading, mutate } = useSWR(
    projectId && token ? ['lims-samples', projectId, token] : null,
    () => api.getLimsSamples(token!, projectId),
  )

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    code: '', matrix: 'solo' as LimsSampleMatrix,
    treatment_group: '', replicate: '', notes: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreate() {
    if (!token || !projectId) return
    if (!form.code.trim()) { setCreateError('Código é obrigatório.'); return }
    setCreating(true)
    setCreateError('')
    try {
      await api.createLimsSample(token, projectId, {
        code: form.code.trim(),
        matrix: form.matrix,
        treatment_group: form.treatment_group.trim() || null,
        replicate: form.replicate ? Number(form.replicate) : null,
        notes: form.notes.trim() || null,
      })
      await mutate()
      setForm({ code: '', matrix: 'solo', treatment_group: '', replicate: '', notes: '' })
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao registrar amostra.')
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
        <span>Amostras (LIMS)</span>
      </div>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Amostras</h1>
          <p className="page-subtitle">Cadeia de custódia · {project?.name ?? '...'}</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            background: 'var(--cyan)', color: '#050d1a', border: 'none',
            borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
            padding: '8px 16px', cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}
        >
          {showCreate ? '✕ Fechar' : '+ Registrar Amostra'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>Nova Amostra</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Código *</label>
              <input
                type="text" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Matriz</label>
              <select
                value={form.matrix}
                onChange={e => setForm(f => ({ ...f, matrix: e.target.value as LimsSampleMatrix }))}
                style={{
                  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                  padding: '7px 10px',
                }}
              >
                {MATRIX_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Grupo</label>
              <input
                type="text" value={form.treatment_group}
                onChange={e => setForm(f => ({ ...f, treatment_group: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Réplica</label>
              <input
                type="number" min={1} value={form.replicate}
                onChange={e => setForm(f => ({ ...f, replicate: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)',
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Notas</label>
            <textarea
              value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                padding: '7px 12px', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          </div>
          {createError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{createError}</div>}
          <button
            onClick={handleCreate}
            disabled={creating || !form.code.trim()}
            style={{
              padding: '8px 18px',
              background: !creating && form.code.trim() ? 'var(--cyan)' : 'var(--surface-2)',
              color: !creating && form.code.trim() ? '#050d1a' : 'var(--text-3)',
              border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
              cursor: !creating && form.code.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {creating ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar amostras.</div>
      )}

      {!isLoading && !error && samples && samples.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhuma amostra registrada.</span>
        </div>
      )}

      {!isLoading && !error && samples && samples.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Código</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Matriz</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Grupo</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Registrada em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {samples.map((s: LimsSample) => (
                <tr key={s.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}><span className="mono">{s.code}</span></td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.matrix}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.treatment_group ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(s.status)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(s.recorded_at).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Link href={`/samples/${s.id}`} style={{ color: 'var(--cyan)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      Ver custódia →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
