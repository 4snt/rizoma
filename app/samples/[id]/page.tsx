'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type LimsSampleStatus, type CustodyEvent } from '@/lib/api'

const STATUS_OPTIONS: LimsSampleStatus[] = [
  'planned', 'collected', 'in_transit', 'received', 'accepted',
  'rejected', 'processing', 'analyzed', 'stored', 'consumed', 'disposed',
]

const EVENT_ICON: Record<string, string> = {
  coleta: '◉', transporte: '→', recebimento: '◇', transferencia: '⇄',
  processamento: '⚙', armazenamento: '▢', retirada: '↑', devolucao: '↓', descarte: '✕',
}

function CustodyRow({ e }: { e: CustodyEvent }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '10px 14px', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--cyan)', width: 18, textAlign: 'center', flexShrink: 0 }}>
        {EVENT_ICON[e.event_type] ?? '•'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>
            {e.event_type}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {new Date(e.occurred_at).toLocaleString('pt-BR')}
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>#{e.seq}</span>
        </div>
        {(e.temperature_c != null || e.condition) && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 12 }}>
            {e.temperature_c != null && <span>🌡 {e.temperature_c}°C</span>}
            {e.condition && <span>{e.condition}</span>}
          </div>
        )}
        {e.notes && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>{e.notes}</div>}
        <div style={{ marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }} title={e.hash}>
            hash: {e.hash.slice(0, 12)}…
          </span>
        </div>
      </div>
    </div>
  )
}

export default function SampleDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: sample, error: sampleError, mutate: mutateSample } = useSWR(
    id && token ? ['lims-sample', id, token] : null,
    () => api.getLimsSample(token!, id),
  )

  const { data: custody, mutate: mutateCustody } = useSWR(
    id && token ? ['custody', id, token] : null,
    () => api.getCustodyChain(token!, id),
  )

  const [showTransition, setShowTransition] = useState(false)
  const [toStatus, setToStatus] = useState<LimsSampleStatus>('collected')
  const [notes, setNotes] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState('')

  async function handleTransition() {
    if (!token || !id) return
    setTransitioning(true)
    setTransitionError('')
    try {
      await api.transitionLimsSample(token, id, { to_status: toStatus, notes: notes.trim() || null })
      await Promise.all([mutateSample(), mutateCustody()])
      setNotes('')
      setShowTransition(false)
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : 'Transição inválida.')
    } finally {
      setTransitioning(false)
    }
  }

  if (sampleError) {
    return <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar amostra.</div>
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        {sample && (
          <>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/projects/${sample.project_id}/samples`}>Amostras</Link>
          </>
        )}
        <span className="breadcrumb-sep">/</span>
        <span>{sample?.code ?? '...'}</span>
      </div>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          {sample ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title mono" style={{ color: 'var(--cyan)' }}>{sample.code}</h1>
              <span className="badge badge-blue">{sample.matrix}</span>
              <span className="badge badge-cyan">{sample.status}</span>
            </div>
          ) : (
            <div className="skeleton" style={{ height: 28, width: 200 }} />
          )}
          {sample && (
            <p className="page-subtitle" style={{ marginTop: 4 }}>
              {sample.treatment_group ? `Grupo ${sample.treatment_group}` : ''}
              {sample.replicate ? ` · Réplica ${sample.replicate}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowTransition(v => !v)}
          style={{
            background: 'rgba(16,212,138,0.1)', border: '1px solid rgba(16,212,138,0.25)',
            borderRadius: 'var(--shape-full)', color: 'var(--green)', fontSize: 13, fontWeight: 600,
            padding: '8px 16px', cursor: 'pointer',
          }}
        >
          {showTransition ? '✕ Fechar' : '▶ Transicionar Status'}
        </button>
      </div>

      {showTransition && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>Nova Transição</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Novo status</label>
              <select
                value={toStatus}
                onChange={e => setToStatus(e.target.value as LimsSampleStatus)}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', padding: '7px 10px',
                  fontSize: 13, fontFamily: 'var(--mono)',
                }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Notas</label>
              <input
                type="text" value={notes} onChange={e => setNotes(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
                  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={handleTransition}
              disabled={transitioning}
              style={{
                padding: '7px 18px',
                background: !transitioning ? 'var(--green)' : 'var(--surface-2)',
                color: !transitioning ? '#050d1a' : 'var(--text-3)',
                border: 'none', borderRadius: 'var(--shape-full)', fontSize: 13, fontWeight: 700,
                cursor: !transitioning ? 'pointer' : 'not-allowed',
              }}
            >
              {transitioning ? 'Enviando...' : 'Confirmar'}
            </button>
          </div>
          {transitionError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>{transitionError}</div>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Cadeia de Custódia</span>
        {custody && (
          <span className={`badge ${custody.chain_valid ? 'badge-green' : 'badge-red'}`}>
            {custody.chain_valid ? '✓ íntegra' : '✗ violada'}
          </span>
        )}
      </div>

      {!custody && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
        </div>
      )}

      {custody && custody.events.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum evento de custódia ainda.</span>
        </div>
      )}

      {custody && custody.events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {custody.events.map(e => <CustodyRow key={e.id} e={e} />)}
        </div>
      )}
    </>
  )
}
