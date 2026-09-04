'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type LimsSampleStatus, type CustodyEvent, type LabResult, ORGANISM_TYPE_LABELS } from '@/lib/api'
import { can } from '@/lib/permissions'
import { MorphologyPanel } from '@/components/samples/MorphologyPanel'
import { TestsPanel } from '@/components/samples/TestsPanel'
import { GenesPanel } from '@/components/samples/GenesPanel'
import { SampleSheetPanel } from '@/components/samples/SampleSheetPanel'
import { AliquotsPanel } from '@/components/samples/AliquotsPanel'
import { SampleFilesPanel } from '@/components/samples/SampleFilesPanel'

type Tab = 'sheet' | 'custody' | 'morphology' | 'tests' | 'genes' | 'aliquots' | 'files' | 'results'

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

function resultStatusBadge(status: string) {
  if (status === 'approved') return <span className="badge badge-green">approved</span>
  if (status === 'retracted') return <span className="badge badge-red">retracted</span>
  return <span className="badge badge-amber">{status}</span>
}

function ResultRow({ token, role, result, onChanged }: { token: string; role: string | undefined; result: LabResult; onChanged: () => void }) {
  const [showCorrect, setShowCorrect] = useState(false)
  const [correctForm, setCorrectForm] = useState({ value_numeric: '', unit: result.current.unit, change_reason: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleCorrect() {
    if (!correctForm.change_reason.trim()) { setErr('Justificativa da correção é obrigatória (ISO 17025).'); return }
    setBusy(true); setErr('')
    try {
      await api.correctResult(token, result.id, {
        value_numeric: correctForm.value_numeric ? Number(correctForm.value_numeric) : undefined,
        unit: correctForm.unit || undefined,
        change_reason: correctForm.change_reason.trim(),
      })
      onChanged()
      setShowCorrect(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao corrigir resultado.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReview(status: 'approved' | 'retracted') {
    setBusy(true)
    try {
      await api.reviewResult(token, result.id, { status })
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao revisar resultado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{result.analyte}</span>
        {result.method && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{result.method}</span>}
        <span className="mono" style={{ fontSize: 13, color: 'var(--cyan)', marginLeft: 'auto' }}>
          {result.current.display_value} {result.current.unit}
        </span>
        {resultStatusBadge(result.current.status)}
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>v{result.current.version}</span>
      </div>

      {(can(role, 'result:write') || can(role, 'result:review')) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {can(role, 'result:write') && (
            <button onClick={() => setShowCorrect(v => !v)} style={{
              padding: '4px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--shape-full)', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer',
            }}>
              Corrigir
            </button>
          )}
          {can(role, 'result:review') && result.current.status !== 'approved' && (
            <button onClick={() => handleReview('approved')} disabled={busy} style={{
              padding: '4px 12px', background: 'rgba(16,212,138,0.08)', border: '1px solid rgba(16,212,138,0.25)',
              borderRadius: 'var(--shape-full)', color: 'var(--green)', fontSize: 11, cursor: 'pointer',
            }}>
              Aprovar
            </button>
          )}
          {can(role, 'result:review') && result.current.status !== 'retracted' && (
            <button onClick={() => handleReview('retracted')} disabled={busy} style={{
              padding: '4px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--shape-full)', color: 'var(--red)', fontSize: 11, cursor: 'pointer',
            }}>
              Retratar
            </button>
          )}
        </div>
      )}

      {showCorrect && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input
            type="number" placeholder="Novo valor" value={correctForm.value_numeric}
            onChange={e => setCorrectForm(f => ({ ...f, value_numeric: e.target.value }))}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', width: 120 }}
          />
          <input
            type="text" placeholder="Unidade" value={correctForm.unit}
            onChange={e => setCorrectForm(f => ({ ...f, unit: e.target.value }))}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', width: 90 }}
          />
          <input
            type="text" placeholder="Justificativa (obrigatória) *" value={correctForm.change_reason}
            onChange={e => setCorrectForm(f => ({ ...f, change_reason: e.target.value }))}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', flex: 1, minWidth: 200 }}
          />
          <button onClick={handleCorrect} disabled={busy} style={{
            padding: '6px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--shape-full)',
            color: '#050d1a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {busy ? '...' : 'Salvar correção'}
          </button>
          {err && <div style={{ width: '100%', fontSize: 11, color: 'var(--red)' }}>{err}</div>}
        </div>
      )}

      {result.history.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-3)' }}>
          {result.history.length} versão(ões) anterior(es)
        </div>
      )}
    </div>
  )
}

function ResultsPanel({ token, role, sampleId }: { token: string; role: string | undefined; sampleId: string }) {
  const { data: results, mutate } = useSWR(['lab-results', sampleId, token], () => api.getResults(token, sampleId))
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ analyte: '', method: '', value_numeric: '', unit: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    if (!form.analyte.trim() || !form.unit.trim()) { setErr('Analito e unidade são obrigatórios.'); return }
    setSaving(true); setErr('')
    try {
      await api.createResult(token, sampleId, {
        analyte: form.analyte.trim(),
        method: form.method.trim() || null,
        value_numeric: form.value_numeric ? Number(form.value_numeric) : null,
        unit: form.unit.trim(),
      })
      await mutate()
      setForm({ analyte: '', method: '', value_numeric: '', unit: '' })
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao lançar resultado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Resultados</span>
        {can(role, 'result:write') && (
          <button onClick={() => setShowCreate(v => !v)} style={{
            padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {showCreate ? '✕ Fechar' : '+ Lançar Resultado'}
          </button>
        )}
      </div>

      {showCreate && can(role, 'result:write') && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input placeholder="Analito *" value={form.analyte} onChange={e => setForm(f => ({ ...f, analyte: e.target.value }))}
              style={{ flex: '1 1 160px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, padding: '7px 12px' }} />
            <input placeholder="Método" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              style={{ flex: '1 1 140px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, padding: '7px 12px' }} />
            <input type="number" placeholder="Valor" value={form.value_numeric} onChange={e => setForm(f => ({ ...f, value_numeric: e.target.value }))}
              style={{ flex: '1 1 100px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, padding: '7px 12px' }} />
            <input placeholder="Unidade *" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              style={{ flex: '1 1 90px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13, padding: '7px 12px' }} />
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleCreate} disabled={saving} style={{
            padding: '7px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--shape-full)',
            color: '#050d1a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {saving ? 'Salvando...' : 'Lançar'}
          </button>
        </div>
      )}

      {!results && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {results && results.length === 0 && (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum resultado lançado.</span>
        </div>
      )}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(r => <ResultRow key={r.id} token={token} role={role} result={r} onChanged={() => mutate()} />)}
        </div>
      )}
    </div>
  )
}

export default function SampleDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role

  const { data: sample, error: sampleError, mutate: mutateSample } = useSWR(
    id && token ? ['lims-sample', id, token] : null,
    () => api.getLimsSample(token!, id),
  )

  const { data: custody, mutate: mutateCustody } = useSWR(
    id && token ? ['custody', id, token] : null,
    () => api.getCustodyChain(token!, id),
  )

  const [tab, setTab] = useState<Tab>('sheet')
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title mono" style={{ color: 'var(--cyan)' }}>{sample.code}</h1>
              <span className="badge badge-blue">{sample.matrix}</span>
              <span className="badge badge-cyan">{sample.status}</span>
              {sample.organism_type && (
                <span className="badge badge-purple">{ORGANISM_TYPE_LABELS[sample.organism_type]}</span>
              )}
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
        {can(role, 'sample:write') && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {sample && (
              <Link
                href={`/projects/${sample.project_id}/samples/new?sample=${sample.id}`}
                style={{
                  background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
                  borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 13, fontWeight: 600,
                  padding: '8px 16px', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Continuar cadastro →
              </Link>
            )}
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
        )}
      </div>

      {showTransition && can(role, 'sample:write') && (
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

      {/* Abas: ficha / custódia / morfologia / testes / genes / armazenamento / anexos / resultados */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.filter(t => t.id !== 'results' || can(role, 'result:read')).map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id} role="tab" aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--cyan)' : 'transparent'}`,
                color: active ? 'var(--cyan)' : 'var(--text-2)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'sheet' && token && (
        sample
          ? <SampleSheetPanel token={token} role={role} sample={sample} onChanged={() => mutateSample()} />
          : <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
      )}

      {tab === 'results' && token && can(role, 'result:read') && (
        <ResultsPanel token={token} role={role} sampleId={id} />
      )}

      {tab === 'morphology' && token && (
        sample
          ? <MorphologyPanel token={token} role={role} sample={sample} onChanged={() => mutateSample()} />
          : <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      )}

      {tab === 'tests' && token && <TestsPanel token={token} role={role} sampleId={id} />}

      {tab === 'genes' && token && (
        sample
          ? <GenesPanel token={token} role={role} sampleId={id} organismType={sample.organism_type} projectId={sample.project_id} />
          : <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      )}

      {tab === 'aliquots' && token && <AliquotsPanel token={token} role={role} sampleId={id} />}

      {tab === 'files' && (
        sample
          ? <SampleFilesPanel projectId={sample.project_id} sampleId={sample.id} />
          : <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      )}

      {tab === 'custody' && (
        <>
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
      )}
    </>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'sheet', label: 'Ficha' },
  { id: 'custody', label: 'Custódia' },
  { id: 'morphology', label: 'Morfologia' },
  { id: 'tests', label: 'Testes' },
  { id: 'genes', label: 'Genes' },
  { id: 'aliquots', label: 'Armazenamento' },
  { id: 'files', label: 'Anexos' },
  { id: 'results', label: 'Resultados' },
]
