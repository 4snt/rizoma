'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type Project } from '@/lib/api'
import { ANALYSES_CATALOG, type AnalysisDefinition } from '@/lib/analyses-catalog'
import { dada2Defaults } from '@/lib/metagenomics-utils'
import SamplesPanel from '@/components/metagenomics/SamplesPanel'
import Dada2Tab from '@/components/metagenomics/Dada2Tab'
import ChartsTab from '@/components/metagenomics/ChartsTab'

type TabKey = 'projeto' | 'dada2' | 'graficos'

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', padding: '6px 10px', boxSizing: 'border-box',
}

export default function MetagenomicsHubPage() {
  const { data: session } = useSession()
  const token = (session as any)?.accessToken as string | undefined
  const isAdmin = (session as any)?.role === 'admin'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('projeto')

  const [form, setForm] = useState({ code: '', name: '', description: '', marker_type: '16S' as '16S' | 'ITS' })
  const [formAnalyses, setFormAnalyses] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const { data: projects, mutate: mutateProjects } = useSWR('meta-hub-projects', () => api.getProjects(), { refreshInterval: 30000 })
  const selectedProject = projects?.find((p: Project) => p.id === selectedId)

  function selectProject(id: string) {
    setSelectedId(id === selectedId ? null : id)
    setShowCreate(false)
    setActiveTab('projeto')
  }

  async function handleCreate() {
    if (!token) { setCreateError('Sem permissão — faça login'); return }
    if (!form.code || !form.name) { setCreateError('Código e nome são obrigatórios'); return }
    setCreating(true); setCreateError('')
    try {
      const catalog = ANALYSES_CATALOG[form.marker_type]
      const analyses = catalog
        .filter(def => formAnalyses.includes(def.key))
        .map(def => ({ analysis_type: def.key, charts: def.charts.map(c => c.key) }))
      const res = await api.createProject(token, {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        marker_type: form.marker_type,
        analyses,
        dada2_params: dada2Defaults(form.marker_type),
      })
      await mutateProjects()
      setSelectedId(res.id)
      setShowCreate(false)
      setForm({ code: '', name: '', description: '', marker_type: '16S' })
      setFormAnalyses([])
    } catch (e) {
      setCreateError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation()
    if (!token) { alert('Sem permissão — faça login'); return }
    if (!confirm(`Excluir o projeto "${p.code}" e TODOS os seus dados (amostras, jobs, resultados)?\n\nEsta ação não pode ser desfeita.`)) return
    setDeletingId(p.id)
    try {
      await api.deleteProject(token, p.id)
      if (selectedId === p.id) setSelectedId(null)
      await mutateProjects()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Metagenômica</h1>
        <p className="page-subtitle">Projetos de amplicons · FASTQs · Análise de abundância taxonômica</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {([['projeto', 'Projeto'], ['dada2', 'DADA2'], ['graficos', 'Gráficos']] as [TabKey, string][]).map(([key, label]) => {
          const active = activeTab === key
          const disabled = key !== 'projeto' && !selectedProject
          return (
            <button key={key} onClick={() => !disabled && setActiveTab(key)} disabled={disabled}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                borderRadius: '6px 6px 0 0', border: '1px solid var(--border)',
                borderBottom: active ? '1px solid var(--bg)' : '1px solid var(--border)',
                background: active ? 'var(--bg)' : 'transparent',
                color: disabled ? 'var(--text-3)' : active ? 'var(--cyan)' : 'var(--text-2)',
                marginBottom: -1, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
              }}>
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Esquerda: lista + criação ─────────────────────────────────────── */}
        <div>
          <button onClick={() => setShowCreate(v => !v)}
            style={{
              width: '100%', padding: '8px 14px', marginBottom: 10,
              background: showCreate ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.1)',
              border: `1px solid ${showCreate ? 'rgba(239,68,68,0.3)' : 'rgba(0,212,255,0.3)'}`,
              borderRadius: 8, color: showCreate ? 'var(--red)' : 'var(--cyan)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            }}>
            {showCreate ? '✕ Cancelar' : '⊕ Novo Projeto'}
          </button>

          {showCreate && (
            <div className="card" style={{ padding: 14, marginBottom: 10, borderColor: 'rgba(0,212,255,0.2)' }}>
              {([
                { key: 'code', label: 'Código *', placeholder: 'INOVAHERB' },
                { key: 'name', label: 'Nome *', placeholder: 'Micobioma solo' },
                { key: 'description', label: 'Descrição', placeholder: 'Opcional' },
              ] as const).map(f => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inp} />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>Marcador</label>
                <select value={form.marker_type} onChange={e => { setForm(v => ({ ...v, marker_type: e.target.value as '16S' | 'ITS' })); setFormAnalyses([]) }} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="16S">16S rRNA (Bactérias)</option>
                  <option value="ITS">ITS (Fungos)</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>Análises do projeto</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ANALYSES_CATALOG[form.marker_type].map((def: AnalysisDefinition) => {
                    const checked = formAnalyses.includes(def.key)
                    return (
                      <label key={def.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '4px 6px', borderRadius: 5, background: checked ? 'rgba(0,212,255,0.08)' : 'transparent' }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setFormAnalyses(prev => prev.includes(def.key) ? prev.filter(k => k !== def.key) : [...prev, def.key])}
                          style={{ marginTop: 2 }} />
                        <span>
                          <strong style={{ color: 'var(--text)' }}>{def.label}</strong><br />
                          <span style={{ color: 'var(--text-3)' }}>{def.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
              {createError && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{createError}</div>}
              <button onClick={handleCreate} disabled={creating}
                style={{ width: '100%', padding: '7px', background: creating ? 'var(--surface-2)' : 'var(--cyan)', color: creating ? 'var(--text-3)' : '#050d1a', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Criando...' : 'Criar Projeto'}
              </button>
            </div>
          )}

          {!projects && <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />}
          {projects?.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>Nenhum projeto. Crie o primeiro.</div>
          )}
          {projects?.map((p: Project) => (
            <div key={p.id} role="button" tabIndex={0} onClick={() => selectProject(p.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6,
                background: p.id === selectedId ? 'rgba(0,212,255,0.1)' : 'var(--surface)',
                border: `1px solid ${p.id === selectedId ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
                opacity: deletingId === p.id ? 0.5 : 1,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: p.id === selectedId ? 'var(--cyan)' : 'var(--text)' }}>{p.code}</span>
                <span className={`badge badge-${p.marker_type === 'ITS' ? 'purple' : 'blue'}`} style={{ fontSize: 9 }}>{p.marker_type}</span>
                {isAdmin && (
                  <button onClick={e => handleDeleteProject(p, e)} disabled={deletingId === p.id} title="Excluir projeto"
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}>
                    {deletingId === p.id ? '…' : '🗑'}
                  </button>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          ))}
        </div>

        {/* ── Direita: workspace ────────────────────────────────────────────── */}
        <div>
          {!selectedProject && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🧬</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>Selecione um projeto à esquerda</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>ou crie um novo para começar</div>
            </div>
          )}

          {selectedProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Identidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{selectedProject.code}</span>
                <span className={`badge badge-${selectedProject.marker_type === 'ITS' ? 'purple' : 'blue'}`}>{selectedProject.marker_type}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{selectedProject.name}</span>
              </div>

              {activeTab === 'projeto' && <SamplesPanel projectId={selectedProject.id} />}
              {activeTab === 'dada2' && (
                <Dada2Tab projectId={selectedProject.id} project={selectedProject} token={token} onProjectChange={mutateProjects} />
              )}
              {activeTab === 'graficos' && <ChartsTab projectId={selectedProject.id} project={selectedProject} />}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
