'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { api, type OrgRole, PROJECT_WRITE_ROLES } from '@/lib/api'
import { ANALYSES_CATALOG, type AnalysisDefinition } from '@/lib/analyses-catalog'

type MarkerType = '16S' | 'ITS'

interface AnalysisState {
  enabled: boolean
  charts: Set<string>
}

function Badge({ children, color }: { children: React.ReactNode; color: 'blue' | 'purple' }) {
  const bg = color === 'blue' ? 'rgba(6,182,212,0.12)' : 'rgba(168,85,247,0.12)'
  const border = color === 'blue' ? 'rgba(6,182,212,0.3)' : 'rgba(168,85,247,0.3)'
  const text = color === 'blue' ? 'var(--cyan)' : '#a855f7'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 5,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: bg,
      border: `1px solid ${border}`,
      color: text,
    }}>
      {children}
    </span>
  )
}

function AnalysisCard({
  def,
  state,
  onChange,
}: {
  def: AnalysisDefinition
  state: AnalysisState
  onChange: (enabled: boolean, charts: Set<string>) => void
}) {
  function toggleEnabled() {
    if (state.enabled) {
      onChange(false, new Set())
    } else {
      // enable with all charts pre-selected
      onChange(true, new Set(def.charts.map(c => c.key)))
    }
  }

  function toggleChart(chartKey: string) {
    const next = new Set(state.charts)
    if (next.has(chartKey)) {
      next.delete(chartKey)
    } else {
      next.add(chartKey)
    }
    onChange(state.enabled, next)
  }

  return (
    <div style={{
      border: `1px solid ${state.enabled ? 'var(--cyan)' : 'var(--border)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'border-color 150ms ease',
      background: state.enabled ? 'rgba(6,182,212,0.04)' : 'var(--surface)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={toggleEnabled}
      >
        {/* Checkbox */}
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${state.enabled ? 'var(--cyan)' : 'var(--border)'}`,
          background: state.enabled ? 'var(--cyan)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 150ms ease',
        }}>
          {state.enabled && (
            <span style={{ color: '#050d1a', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{def.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{def.description}</div>
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {def.charts.length} gráfico{def.charts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Charts (only when enabled) */}
      {state.enabled && def.charts.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 16px 12px 46px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {def.charts.map(chart => {
            const active = state.charts.has(chart.key)
            return (
              <button
                key={chart.key}
                type="button"
                onClick={() => toggleChart(chart.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
                  background: active ? 'rgba(6,182,212,0.1)' : 'var(--bg)',
                  color: active ? 'var(--cyan)' : 'var(--text-3)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {active ? '◉' : '○'} {chart.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function NewProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [code, setCode]                   = useState('')
  const [name, setName]                   = useState('')
  const [description, setDescription]     = useState('')
  const [bioprojectAcc, setBioprojectAcc] = useState('')
  const [markerType, setMarkerType]       = useState<MarkerType>('16S')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // analyses state: key → { enabled, charts }
  const initAnalysesState = (mt: MarkerType): Record<string, AnalysisState> => {
    const result: Record<string, AnalysisState> = {}
    for (const def of ANALYSES_CATALOG[mt]) {
      result[def.key] = { enabled: false, charts: new Set() }
    }
    return result
  }
  const [analysesState, setAnalysesState] = useState<Record<string, AnalysisState>>(
    () => initAnalysesState('16S')
  )

  function handleMarkerTypeChange(mt: MarkerType) {
    setMarkerType(mt)
    setAnalysesState(initAnalysesState(mt))
  }

  function handleAnalysisChange(key: string, enabled: boolean, charts: Set<string>) {
    setAnalysesState(prev => ({ ...prev, [key]: { enabled, charts } }))
  }

  const catalog = ANALYSES_CATALOG[markerType]
  const enabledCount = Object.values(analysesState).filter(s => s.enabled).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!code.trim() || !name.trim()) {
      setError('Código e nome são obrigatórios.')
      return
    }
    if (enabledCount === 0) {
      setError('Selecione ao menos uma análise.')
      return
    }

    const token = session?.accessToken ?? ''
    if (!token) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    setSubmitting(true)
    try {
      const analyses = catalog
        .filter(def => analysesState[def.key]?.enabled)
        .map(def => ({
          analysis_type: def.key,
          charts: Array.from(analysesState[def.key].charts),
        }))

      const { id } = await api.createProject(token, {
        code:                 code.trim().toUpperCase(),
        name:                 name.trim(),
        description:          description.trim(),
        marker_type:          markerType,
        analyses,
      })

      router.push(`/projects/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar projeto.')
      setSubmitting(false)
    }
  }

  if (!session?.role || !PROJECT_WRITE_ROLES.includes(session.role as OrgRole)) {
    return (
      <div style={{ padding: 40, color: 'var(--red)' }}>
        Acesso negado. Esta página é restrita a administradores.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-title">Novo Projeto</div>
        <div className="page-subtitle">Configure o projeto, as análises e os gráficos gerados</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Identificação ── */}
        <section>
          <div className="section-title">Identificação</div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {/* Code + Marker type */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 160px' }}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Código *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="INOVAHERB"
                  maxLength={20}
                  required
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                  onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Nome do projeto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Análise fatorial de micobioma"
                  required
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                  onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Descrição
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Objetivo científico e contexto do projeto..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 70,
                  fontFamily: 'var(--sans)',
                  lineHeight: 1.5,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* BioProject */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                BioProject NCBI <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
              </label>
              <input
                type="text"
                value={bioprojectAcc}
                onChange={e => setBioprojectAcc(e.target.value)}
                placeholder="PRJNA123456"
                maxLength={20}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Vincula o projeto a um BioProject para importar runs SRA diretamente.
              </div>
            </div>

            {/* Marker type */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Marcador *
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['16S', 'ITS'] as const).map(mt => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => handleMarkerTypeChange(mt)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 7,
                      border: `1px solid ${markerType === mt ? (mt === '16S' ? 'var(--cyan)' : '#a855f7') : 'var(--border)'}`,
                      background: markerType === mt
                        ? (mt === '16S' ? 'rgba(6,182,212,0.1)' : 'rgba(168,85,247,0.1)')
                        : 'var(--bg)',
                      color: markerType === mt
                        ? (mt === '16S' ? 'var(--cyan)' : '#a855f7')
                        : 'var(--text-3)',
                      fontWeight: markerType === mt ? 700 : 400,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {mt === '16S' ? (
                      <><Badge color="blue">16S</Badge><span style={{ marginLeft: 8 }}>Primers 515F/806R · SILVA 138</span></>
                    ) : (
                      <><Badge color="purple">ITS</Badge><span style={{ marginLeft: 8 }}>Primers ITS1/ITS4 · UNITE v10</span></>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Análises ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              Análises disponíveis
            </div>
            <span style={{ fontSize: 12, color: enabledCount > 0 ? 'var(--cyan)' : 'var(--text-3)' }}>
              {enabledCount} selecionada{enabledCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {catalog.map(def => (
              <AnalysisCard
                key={def.key}
                def={def}
                state={analysesState[def.key] ?? { enabled: false, charts: new Set() }}
                onChange={(enabled, charts) => handleAnalysisChange(def.key, enabled, charts)}
              />
            ))}
          </div>
        </section>

        {/* ── Error + Submit ── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--red)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 32 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 7,
              color: 'var(--text-3)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              padding: '9px 20px',
              transition: 'color 150ms ease',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--cyan)',
              border: 'none',
              borderRadius: 7,
              color: '#050d1a',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              opacity: submitting ? 0.7 : 1,
              padding: '9px 24px',
              transition: 'opacity 150ms ease',
            }}
          >
            {submitting ? 'Criando...' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--mono)',
  padding: '8px 12px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease',
}
