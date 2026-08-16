'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import {
  api,
  type Project,
  type Sample,
  type Job,
  type TaxLevel,
  type AsvFullRow,
  type Dada2Params,
} from '@/lib/api'
import { ANALYSES_CATALOG, type AnalysisDefinition } from '@/lib/analyses-catalog'
import { autoPair, dada2Defaults, csvDownload, type BatchPair } from '@/lib/metagenomics-utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

type TabKey = 'projeto' | 'dada2' | 'graficos'

const DADA2_FIELDS: { key: keyof Dada2Params; label: string; hint: string }[] = [
  { key: 'trunc_len_f', label: 'Truncagem Forward', hint: '0 = sem truncagem (ITS)' },
  { key: 'trunc_len_r', label: 'Truncagem Reverse', hint: '0 = sem truncagem (ITS)' },
  { key: 'max_ee_f', label: 'maxEE Forward', hint: 'erros esperados máx.' },
  { key: 'max_ee_r', label: 'maxEE Reverse', hint: 'erros esperados máx.' },
  { key: 'trunc_q', label: 'truncQ', hint: 'trunca no 1º Q ≤ valor' },
  { key: 'max_n', label: 'maxN', hint: 'Ns máximos (DADA2 exige 0)' },
  { key: 'min_len', label: 'minLen (ITS)', hint: 'comprimento mínimo' },
]

const LEVELS: TaxLevel[] = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--mono)',
  padding: '6px 10px',
  boxSizing: 'border-box',
}

const sel: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'var(--mono)',
  cursor: 'pointer',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MetagenomicsHubPage() {
  const { data: session } = useSession()
  const token = (session as any)?.accessToken as string | undefined
  const isAdmin = (session as any)?.role === 'admin'

  // Navigation
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('projeto')

  // Create form
  const [form, setForm] = useState({
    code: '', name: '', description: '',
    marker_type: '16S' as '16S' | 'ITS',
  })
  const [formAnalyses, setFormAnalyses] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // DADA2 params editor (aba DADA2)
  const [paramsDraft, setParamsDraft] = useState<Dada2Params | null>(null)
  const [savingParams, setSavingParams] = useState(false)
  const [paramsSaved, setParamsSaved] = useState(false)

  // Upload
  const [showUpload, setShowUpload] = useState(false)
  const [batchPairs, setBatchPairs] = useState<BatchPair[]>([])
  const [batchUnmatched, setBatchUnmatched] = useState<string[]>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchError, setBatchError] = useState('')
  const [uploadMode, setUploadMode] = useState<'folder' | 'files'>('folder')
  const batchRef = useRef<HTMLInputElement>(null)

  // SRA
  const [showSra, setShowSra] = useState(false)
  const [sraAcc, setSraAcc] = useState('')
  const [sraMeta, setSraMeta] = useState<any>(null)
  const [sraTreatment, setSraTreatment] = useState('')
  const [sraRep, setSraRep] = useState(1)
  const [sraVerifying, setSraVerifying] = useState(false)
  const [sraImporting, setSraImporting] = useState(false)
  const [sraMsg, setSraMsg] = useState('')

  // Pipeline
  const [generatingPhyloseq, setGeneratingPhyloseq] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)

  // Results
  const [level, setLevel] = useState<TaxLevel>('genus')
  const [showRel, setShowRel] = useState(false)
  const [search, setSearch] = useState('')
  const [exportingFull, setExportingFull] = useState(false)

  // ── SWR ─────────────────────────────────────────────────────────────────────

  const { data: projects, mutate: mutateProjects } = useSWR(
    token ? ['meta-hub-projects', token] : null,
    () => api.getProjects(token!),
    { refreshInterval: 30000 }
  )
  const { data: samples, mutate: mutateSamples } = useSWR(
    selectedId ? `meta-samples-${selectedId}` : null,
    () => api.getSamples(selectedId!),
    { refreshInterval: 15000 }
  )
  const { data: artifacts } = useSWR(
    selectedId ? `meta-artifacts-${selectedId}` : null,
    () => api.getArtifacts(selectedId!),
    { refreshInterval: 20000 }
  )
  const { data: metaStatus } = useSWR(
    selectedId ? `meta-status-${selectedId}` : null,
    () => api.getMetagenomicsStatus(selectedId!),
    { refreshInterval: 5000 }
  )
  const { data: dada2Status } = useSWR(
    selectedId ? `dada2-status-${selectedId}` : null,
    () => api.getDada2Status(selectedId!),
    { refreshInterval: 3000 }
  )
  const { data: asvData, isLoading: asvLoading } = useSWR(
    metaStatus?.has_results && selectedId ? `meta-asv-${selectedId}-${level}` : null,
    () => api.getAsvTable(selectedId!, level)
  )
  const { data: jobs, mutate: mutateJobs } = useSWR(
    selectedId && token ? ['meta-jobs', selectedId, token] : null,
    () => api.getJobs(token!, selectedId!),
    { refreshInterval: 5000 }
  )

  const selectedProject = projects?.find((p: Project) => p.id === selectedId)
  const samplesWithFastq = (samples ?? []).filter((s: Sample) => s.fastq_r1_oid && s.fastq_r2_oid)

  // Último job concluído por tipo de análise (para casar análise → jobId do gráfico)
  const latestDoneJobByType = (() => {
    const map: Record<string, Job> = {}
    for (const j of (jobs ?? []) as Job[]) {
      if (j.status === 'done' && !map[j.job_type]) map[j.job_type] = j
    }
    return map
  })()

  const [runningType, setRunningType] = useState<string | null>(null)
  async function handleRunAnalysisType(analysisType: string) {
    if (!selectedId || !token) return
    const oid = artifacts?.available?.[0]?.phyloseq_oid
    if (!oid) { alert('Gere o phyloseq (aba DADA2) antes de rodar as análises.'); return }
    setRunningType(analysisType)
    try {
      await api.enqueueJob(token, selectedId, analysisType, Number(oid))
      await mutateJobs()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setRunningType(null)
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!token) { setCreateError('Sem permissão — faça login'); return }
    if (!form.code || !form.name) { setCreateError('Código e nome são obrigatórios'); return }
    setCreating(true); setCreateError('')
    try {
      // Análises selecionadas → cada uma com todos os seus gráficos do catálogo
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

  async function handleSaveParams() {
    if (!token || !selectedProject || !paramsDraft) return
    setSavingParams(true); setParamsSaved(false)
    try {
      await api.updateProject(token, selectedProject.id, { dada2_params: paramsDraft })
      await mutateProjects()
      setParamsSaved(true)
      setTimeout(() => setParamsSaved(false), 2000)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingParams(false)
    }
  }

  async function handleDeleteProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation()
    if (!token) { alert('Sem permissão — faça login como admin'); return }
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

  function handleBatchSelect(files: FileList | null) {
    if (!files) return
    const { pairs, unmatched } = autoPair(Array.from(files))
    setBatchPairs(pairs); setBatchUnmatched(unmatched); setBatchDone(0); setBatchError('')
  }

  async function handleBatchUpload() {
    if (!batchPairs.length || !selectedId) return
    setBatchUploading(true); setBatchDone(0); setBatchError('')
    let done = 0
    for (const pair of batchPairs) {
      try {
        await api.uploadFastqPair(pair.r1, pair.r2, selectedId)
        done++; setBatchDone(done)
      } catch {
        setBatchError(`Falha em ${pair.name}. ${done}/${batchPairs.length} enviados.`)
        setBatchUploading(false); return
      }
    }
    await mutateSamples()
    setBatchUploading(false)
    setTimeout(() => {
      setBatchPairs([]); setBatchUnmatched([]); setBatchDone(0); setShowUpload(false)
    }, 1500)
  }

  async function handleSraVerify() {
    const acc = sraAcc.trim().toUpperCase()
    if (!acc) return
    setSraVerifying(true); setSraMeta(null); setSraMsg('')
    try {
      const m = await api.sraPreview(acc)
      setSraMeta(m)
      if (m.sample_name) setSraTreatment(m.sample_name)
    } catch (e) {
      setSraMsg((e as Error).message)
    } finally {
      setSraVerifying(false)
    }
  }

  async function handleSraImport() {
    if (!sraMeta || !selectedId) return
    setSraImporting(true); setSraMsg('Baixando FASTQs...')
    try {
      await api.importSra({
        accession: sraMeta.accession,
        project_id: selectedId,
        treatment_group: sraTreatment,
        replicate: sraRep,
      })
      setSraMsg('Concluído')
      await mutateSamples()
      setTimeout(() => {
        setSraMeta(null); setSraAcc(''); setSraMsg(''); setShowSra(false)
      }, 1500)
    } catch (e) {
      setSraMsg((e as Error).message)
    } finally {
      setSraImporting(false)
    }
  }

  async function handleGeneratePhyloseq() {
    if (!selectedId || !token) return
    setGeneratingPhyloseq(true)
    try {
      const payload = (paramsDraft ?? selectedProject?.dada2_params ?? {}) as Record<string, unknown>
      await api.enqueueJob(token, selectedId, 'dada2_pipeline', undefined, payload)
    }
    catch (e) { alert((e as Error).message) }
    finally { setGeneratingPhyloseq(false) }
  }

  async function handleRunAnalysis(oid: number) {
    if (!selectedId) return
    setRunningAnalysis(true)
    try { await api.runMetagenomicsPipeline(selectedId, oid) }
    catch (e) { alert((e as Error).message) }
    finally { setRunningAnalysis(false) }
  }

  function handleExportCsv() {
    if (!asvData) return
    const headers = ['Taxon', 'Total', ...asvData.sample_names]
    const rows = asvData.rows.map((r: any) => [
      r.taxon,
      String(r.total),
      ...asvData.sample_names.map((s: string) => String(r.samples[s] ?? 0)),
    ])
    csvDownload(`${selectedProject?.code ?? selectedId}_${level}.csv`, headers, rows)
  }

  async function handleExportFull(fmt: 'csv' | 'xlsx') {
    if (!selectedId) return
    setExportingFull(true)
    try {
      const data = await api.getAsvTableFull(selectedId)
      const TAX = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']
      const headers = [
        ...TAX,
        ...data.sample_names.map((s: string) => `count_${s}`),
        ...data.sample_names.map((s: string) => `rel_pct_${s}`),
        'total',
      ]
      const base = `${selectedProject?.code ?? selectedId}_taxonomy_full`

      if (fmt === 'xlsx') {
        // Import dinâmico: mantém a lib SheetJS fora do bundle inicial.
        const XLSX = await import('xlsx')
        const aoa: (string | number)[][] = [
          headers,
          ...data.rows.map((r: AsvFullRow) => [
            r.domain ?? '', r.phylum ?? '', r.class ?? '',
            r.order ?? '', r.family ?? '', r.genus ?? '', r.species ?? '',
            ...data.sample_names.map((s: string) => r.samples[s] ?? 0),
            ...data.sample_names.map((s: string) => Number((r.rel_abundance[s] ?? 0).toFixed(4))),
            r.total,
          ]),
        ]
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Abundância')
        XLSX.writeFile(wb, `${base}.xlsx`)
      } else {
        const rows = data.rows.map((r: AsvFullRow) => [
          r.domain ?? '', r.phylum ?? '', r.class ?? '',
          r.order ?? '', r.family ?? '', r.genus ?? '', r.species ?? '',
          ...data.sample_names.map((s: string) => String(r.samples[s] ?? 0)),
          ...data.sample_names.map((s: string) => String((r.rel_abundance[s] ?? 0).toFixed(4))),
          String(r.total),
        ])
        csvDownload(`${base}.csv`, headers, rows)
      }
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setExportingFull(false)
    }
  }

  const filteredRows = useMemo(() => {
    if (!asvData) return []
    const q = search.toLowerCase()
    return q
      ? asvData.rows.filter((r: any) => r.taxon.toLowerCase().includes(q))
      : asvData.rows.slice(0, 300)
  }, [asvData, search])

  // Parâmetros DADA2 em edição (draft) ou os salvos no projeto
  const effectiveParams: Dada2Params = paramsDraft
    ?? selectedProject?.dada2_params
    ?? (selectedProject ? dada2Defaults(selectedProject.marker_type) : {})

  // Critérios de prontidão para rodar o DADA2
  const hasParams = !!selectedProject && Object.keys(selectedProject.dada2_params ?? {}).length > 0
  const readiness = selectedProject ? [
    { label: 'Código, nome e marcador', ok: !!selectedProject.code && !!selectedProject.name && !!selectedProject.marker_type },
    { label: '≥ 2 amostras com par FASTQ', ok: samplesWithFastq.length >= 2 },
    { label: 'Parâmetros DADA2 definidos', ok: hasParams },
    { label: 'Análises/gráficos escolhidos', ok: (selectedProject.analyses?.length ?? 0) > 0 },
  ] : []
  const isReady = readiness.length > 0 && readiness.every(r => r.ok)
  const dada2Running = dada2Status?.job_status === 'running' || dada2Status?.job_status === 'queued'

  function selectProject(id: string) {
    setSelectedId(id === selectedId ? null : id)
    setShowCreate(false)
    setParamsDraft(null)
    setActiveTab('projeto')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
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
            <button
              key={key}
              onClick={() => !disabled && setActiveTab(key)}
              disabled={disabled}
              style={{
                padding: '8px 20px',
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                borderRadius: '6px 6px 0 0',
                border: '1px solid var(--border)',
                borderBottom: active ? '1px solid var(--bg)' : '1px solid var(--border)',
                background: active ? 'var(--bg)' : 'transparent',
                color: disabled ? 'var(--text-3)' : active ? 'var(--cyan)' : 'var(--text-2)',
                marginBottom: -1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: project list ──────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowCreate(v => !v)}
            style={{
              width: '100%', padding: '8px 14px', marginBottom: 10,
              background: showCreate ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.1)',
              border: `1px solid ${showCreate ? 'rgba(239,68,68,0.3)' : 'rgba(0,212,255,0.3)'}`,
              borderRadius: 8,
              color: showCreate ? 'var(--red)' : 'var(--cyan)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            }}
          >
            {showCreate ? '✕ Cancelar' : '⊕ Novo Projeto'}
          </button>

          {/* Create project form */}
          {showCreate && (
            <div className="card" style={{ padding: 14, marginBottom: 10, borderColor: 'rgba(0,212,255,0.2)' }}>
              {([
                { key: 'code',        label: 'Código *',  placeholder: 'INOVAHERB' },
                { key: 'name',        label: 'Nome *',    placeholder: 'Micobioma solo' },
                { key: 'description', label: 'Descrição', placeholder: 'Opcional' },
              ] as const).map(f => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
                    {f.label}
                  </label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={inp}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
                  Marcador
                </label>
                <select
                  value={form.marker_type}
                  onChange={e => { setForm(v => ({ ...v, marker_type: e.target.value as '16S' | 'ITS' })); setFormAnalyses([]) }}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="16S">16S rRNA (Bactérias)</option>
                  <option value="ITS">ITS (Fungos)</option>
                </select>
              </div>

              {/* Análises/gráficos do projeto */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>
                  Análises do projeto
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ANALYSES_CATALOG[form.marker_type].map((def: AnalysisDefinition) => {
                    const checked = formAnalyses.includes(def.key)
                    return (
                      <label
                        key={def.key}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 6,
                          fontSize: 11, color: 'var(--text-2)', cursor: 'pointer',
                          padding: '4px 6px', borderRadius: 5,
                          background: checked ? 'rgba(0,212,255,0.08)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setFormAnalyses(prev =>
                            prev.includes(def.key) ? prev.filter(k => k !== def.key) : [...prev, def.key]
                          )}
                          style={{ marginTop: 2 }}
                        />
                        <span>
                          <strong style={{ color: 'var(--text)' }}>{def.label}</strong>
                          <br />
                          <span style={{ color: 'var(--text-3)' }}>{def.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {createError && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{createError}</div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  width: '100%', padding: '7px',
                  background: creating ? 'var(--surface-2)' : 'var(--cyan)',
                  color: creating ? 'var(--text-3)' : '#050d1a',
                  border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 700,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Criando...' : 'Criar Projeto'}
              </button>
            </div>
          )}

          {/* Project list */}
          {!projects && (
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
          )}

          {projects?.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              Nenhum projeto. Crie o primeiro.
            </div>
          )}

          {projects?.map((p: Project) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => selectProject(p.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px', marginBottom: 6,
                background: p.id === selectedId ? 'rgba(0,212,255,0.1)' : 'var(--surface)',
                border: `1px solid ${p.id === selectedId ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 3,
                opacity: deletingId === p.id ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                  color: p.id === selectedId ? 'var(--cyan)' : 'var(--text)',
                }}>
                  {p.code}
                </span>
                <span
                  className={`badge badge-${p.marker_type === 'ITS' ? 'purple' : 'blue'}`}
                  style={{ fontSize: 9 }}
                >
                  {p.marker_type}
                </span>
                {isAdmin && (
                  <button
                    onClick={e => handleDeleteProject(p, e)}
                    disabled={deletingId === p.id}
                    title="Excluir projeto"
                    style={{
                      marginLeft: 'auto', background: 'transparent', border: 'none',
                      color: 'var(--text-3)', cursor: 'pointer', fontSize: 13,
                      padding: '0 2px', lineHeight: 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
                  >
                    {deletingId === p.id ? '…' : '🗑'}
                  </button>
                )}
              </div>
              <span style={{
                fontSize: 11, color: 'var(--text-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* ── Right: workspace ──────────────────────────────────────────────── */}
        <div>

          {/* Placeholder when no project selected */}
          {!selectedProject && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🧬</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>
                Selecione um projeto à esquerda
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                ou crie um novo para começar
              </div>
            </div>
          )}

          {selectedProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Project identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>
                  {selectedProject.code}
                </span>
                <span className={`badge badge-${selectedProject.marker_type === 'ITS' ? 'purple' : 'blue'}`}>
                  {selectedProject.marker_type}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{selectedProject.name}</span>
              </div>

              {/* ════════════════════ ABA PROJETO ════════════════════ */}
              {activeTab === 'projeto' && (
              <>
              {/* ──────────────────────────────────────────────────────────────
                  SECTION ①  Amostras
              ────────────────────────────────────────────────────────────── */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>
                    ① Amostras
                  </span>
                  <span className="badge badge-cyan">{samplesWithFastq.length} FASTQ</span>
                  <button
                    onClick={() => { setShowSra(false); setShowUpload(v => !v) }}
                    style={{
                      ...sel,
                      color: showUpload ? 'var(--cyan)' : 'var(--text-2)',
                      background: showUpload ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)',
                      border: `1px solid ${showUpload ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    {showUpload ? '✕ Fechar' : '↑ Upload FASTQ'}
                  </button>
                  <button
                    onClick={() => { setShowUpload(false); setShowSra(v => !v) }}
                    style={{
                      ...sel,
                      color: showSra ? 'var(--amber)' : 'var(--text-2)',
                      background: showSra ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)',
                      border: `1px solid ${showSra ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    {showSra ? '✕ Fechar' : '⬇ Importar SRA'}
                  </button>
                </div>

                {/* Upload panel */}
                {showUpload && (
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    {/* Mode toggle: folder vs files */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {([['folder', '📁 Pasta'], ['files', '📄 Arquivos']] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => { setUploadMode(mode); setBatchPairs([]); setBatchUnmatched([]) }}
                          style={{
                            ...sel,
                            color: uploadMode === mode ? 'var(--cyan)' : 'var(--text-2)',
                            background: uploadMode === mode ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)',
                            border: `1px solid ${uploadMode === mode ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                      {uploadMode === 'folder'
                        ? 'Selecione a pasta inteira com os FASTQs.'
                        : 'Selecione todos os arquivos R1 e R2 juntos.'}{' '}
                      Os pares são detectados automaticamente pelo padrão{' '}
                      <code style={{ color: 'var(--cyan)' }}>_R1_</code> / <code style={{ color: 'var(--cyan)' }}>_R2_</code>.
                    </div>
                    <input
                      // key força recriação do input ao trocar de modo (webkitdirectory não muda em runtime)
                      key={uploadMode}
                      ref={batchRef}
                      type="file"
                      accept=".fastq,.fastq.gz,.fq,.fq.gz"
                      multiple
                      onChange={e => handleBatchSelect(e.target.files)}
                      style={{ color: 'var(--text)', fontSize: 12, marginBottom: 10, display: 'block' }}
                      {...(uploadMode === 'folder' ? ({ webkitdirectory: '', directory: '' } as any) : {})}
                    />
                    {batchPairs.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 6 }}>
                        ✓ {batchPairs.length} par(es) R1+R2 detectado(s)
                      </div>
                    )}
                    {batchUnmatched.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 6 }}>
                        ⚠ Sem par R2: {batchUnmatched.join(', ')}
                      </div>
                    )}
                    {batchUploading && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round(batchDone / batchPairs.length * 100)}%`,
                            background: 'var(--cyan)', borderRadius: 99, transition: 'width 0.3s',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          {batchDone}/{batchPairs.length} pares enviados…
                        </div>
                      </div>
                    )}
                    {batchError && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{batchError}</div>
                    )}
                    <button
                      onClick={handleBatchUpload}
                      disabled={!batchPairs.length || batchUploading}
                      style={{
                        padding: '6px 16px',
                        background: batchPairs.length && !batchUploading ? 'var(--cyan)' : 'var(--surface-2)',
                        color: batchPairs.length && !batchUploading ? '#050d1a' : 'var(--text-3)',
                        border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        cursor: batchPairs.length && !batchUploading ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {batchUploading ? `${batchDone}/${batchPairs.length}…` : `Enviar ${batchPairs.length} par(es)`}
                    </button>
                  </div>
                )}

                {/* SRA panel */}
                {showSra && (
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <input
                        value={sraAcc}
                        onChange={e => { setSraAcc(e.target.value.toUpperCase()); setSraMeta(null); setSraMsg('') }}
                        placeholder="SRR9847653 · ERR123456 · GSM…"
                        style={{ ...inp, flex: 1, minWidth: 160 }}
                      />
                      <button
                        onClick={handleSraVerify}
                        disabled={!sraAcc.trim() || sraVerifying}
                        style={{
                          padding: '6px 16px',
                          background: 'rgba(245,158,11,0.15)',
                          border: '1px solid rgba(245,158,11,0.3)',
                          borderRadius: 6, color: 'var(--amber)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {sraVerifying ? '...' : 'Verificar'}
                      </button>
                    </div>

                    {sraMeta && (
                      <div style={{
                        background: 'var(--surface-2)', borderRadius: 8,
                        padding: '10px 12px', marginBottom: 10,
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                          {sraMeta.accession} · {sraMeta.library_layout} · {sraMeta.organism}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>
                              Grupo tratamento
                            </label>
                            <input
                              value={sraTreatment}
                              onChange={e => setSraTreatment(e.target.value)}
                              placeholder="T1 / Control"
                              style={{ ...inp, width: 120 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>
                              Réplica #
                            </label>
                            <input
                              type="number" min={1}
                              value={sraRep}
                              onChange={e => setSraRep(Number(e.target.value))}
                              style={{ ...inp, width: 64 }}
                            />
                          </div>
                          <button
                            onClick={handleSraImport}
                            disabled={sraImporting || !sraTreatment.trim()}
                            style={{
                              padding: '6px 14px',
                              background: sraImporting || !sraTreatment.trim() ? 'var(--surface-2)' : 'var(--amber)',
                              border: 'none', borderRadius: 6,
                              color: sraImporting || !sraTreatment.trim() ? 'var(--text-3)' : '#050d1a',
                              fontSize: 12, fontWeight: 700,
                              cursor: sraImporting || !sraTreatment.trim() ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {sraImporting ? 'Importando…' : 'Importar'}
                          </button>
                        </div>
                      </div>
                    )}

                    {sraMsg && (
                      <div style={{ fontSize: 11, color: sraMsg === 'Concluído' ? 'var(--green)' : 'var(--red)' }}>
                        {sraMsg === 'Concluído' ? '✓ ' : '✗ '}{sraMsg}
                      </div>
                    )}
                  </div>
                )}

                {/* Samples table */}
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {(!samples || samples.length === 0) && (
                    <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                      Nenhuma amostra. Faça upload de FASTQs ou importe do SRA.
                    </div>
                  )}
                  {samples && samples.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Arquivo', 'Grupo', 'Réplica', 'R1 OID'].map(h => (
                            <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {samples.map((s: Sample) => (
                          <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.filename}
                            </td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{s.treatment_group}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{s.replicate}</td>
                            <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text-3)', fontSize: 10 }}>
                              {s.fastq_r1_oid ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              </>
              )}

              {/* ════════════════════ ABA DADA2 ════════════════════ */}
              {activeTab === 'dada2' && (
              <>
                {/* Checklist de prontidão */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
                    Prontidão do projeto
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {readiness.map(c => (
                      <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: c.ok ? 'var(--green)' : 'var(--text-3)' }}>{c.ok ? '✓' : '○'}</span>
                        <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-3)' }}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parâmetros DADA2 */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>
                      Parâmetros DADA2
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {selectedProject.marker_type === '16S' ? 'SILVA 138.1' : 'UNITE'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    {DADA2_FIELDS.map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>
                          {f.label}
                        </label>
                        <input
                          type="number"
                          value={(effectiveParams[f.key] as number | undefined) ?? ''}
                          onChange={e => setParamsDraft({
                            ...effectiveParams,
                            [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                          })}
                          style={inp}
                        />
                        <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{f.hint}</div>
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>
                        Método de quimera
                      </label>
                      <select
                        value={effectiveParams.chimera_method ?? 'consensus'}
                        onChange={e => setParamsDraft({ ...effectiveParams, chimera_method: e.target.value })}
                        style={{ ...inp, cursor: 'pointer' }}
                      >
                        <option value="consensus">consensus</option>
                        <option value="pooled">pooled</option>
                        <option value="per-sample">per-sample</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <button
                      onClick={handleSaveParams}
                      disabled={savingParams || !paramsDraft}
                      style={{
                        ...sel,
                        color: paramsDraft ? 'var(--cyan)' : 'var(--text-3)',
                        background: paramsDraft ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)',
                        cursor: paramsDraft && !savingParams ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {savingParams ? 'Salvando…' : '💾 Salvar parâmetros'}
                    </button>
                    <button
                      onClick={() => setParamsDraft(dada2Defaults(selectedProject.marker_type))}
                      style={{ ...sel, color: 'var(--text-2)' }}
                    >
                      ↺ Restaurar defaults
                    </button>
                    {paramsSaved && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Salvo</span>}
                  </div>
                </div>

                {/* Execução do DADA2 */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                    Executar DADA2 — QC · ASV inference · classificação
                  </div>

                  {dada2Running ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--cyan)', marginBottom: 8 }}>
                        <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />
                        {dada2Status?.job_status === 'queued'
                          ? 'Na fila…'
                          : (dada2Status?.progress_stage ?? 'Rodando…')}
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${dada2Status?.progress_pct ?? 0}%`,
                          background: 'var(--cyan)', borderRadius: 99, transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        {dada2Status?.progress_pct ?? 0}%
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={handleGeneratePhyloseq}
                      disabled={!isReady || generatingPhyloseq}
                      style={{
                        padding: '8px 18px',
                        background: isReady && !generatingPhyloseq ? 'rgba(16,212,138,0.15)' : 'var(--surface-2)',
                        border: `1px solid ${isReady ? 'rgba(16,212,138,0.3)' : 'var(--border)'}`,
                        borderRadius: 6,
                        color: isReady && !generatingPhyloseq ? 'var(--green)' : 'var(--text-3)',
                        fontSize: 13, fontWeight: 700,
                        cursor: isReady && !generatingPhyloseq ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {generatingPhyloseq ? 'Enfileirando…' : '▶ Rodar DADA2'}
                    </button>
                  )}

                  {!isReady && !dada2Running && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8 }}>
                      Complete os critérios de prontidão acima para liberar a execução.
                    </div>
                  )}

                  {dada2Status?.job_status === 'failed' && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>
                        ✗ Erro na execução
                      </div>
                      <pre style={{
                        fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--mono)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                      }}>
                        {dada2Status.error_msg ?? 'Falha desconhecida'}
                      </pre>
                    </div>
                  )}

                  {dada2Status?.job_status === 'done' && dada2Status?.has_phyloseq && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>
                      ✓ phyloseq gerado {dada2Status.completed_at ? `em ${new Date(dada2Status.completed_at).toLocaleString('pt-BR')}` : ''}
                    </div>
                  )}
                </div>

                {/* Análise metagenômica (gera a tabela de ASVs / diversidade) */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                    Análise metagenômica — tabela de ASVs · diversidade · PCoA
                  </div>
                  <div style={{ fontSize: 11, color: artifacts?.available?.length ? 'var(--green)' : 'var(--text-3)', marginBottom: 8 }}>
                    {artifacts?.available?.length
                      ? `✓ ${artifacts.available.length} phyloseq disponível`
                      : '⚠ Rode o DADA2 primeiro para gerar o phyloseq'}
                  </div>

                  {(metaStatus?.job_status === 'running' || metaStatus?.job_status === 'queued') ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--cyan)', marginBottom: 8 }}>
                        <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />
                        {metaStatus.job_status === 'queued' ? 'Na fila…' : (metaStatus.progress_stage ?? 'Rodando…')}
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${metaStatus.progress_pct ?? 0}%`,
                          background: 'var(--cyan)', borderRadius: 99, transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{metaStatus.progress_pct ?? 0}%</div>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        const oid = artifacts?.available?.[0]?.phyloseq_oid
                        if (oid) handleRunAnalysis(Number(oid))
                      }}
                      disabled={!artifacts?.available?.length || runningAnalysis}
                      style={{
                        padding: '8px 18px',
                        background: artifacts?.available?.length && !runningAnalysis ? 'rgba(16,212,138,0.15)' : 'var(--surface-2)',
                        border: `1px solid ${artifacts?.available?.length ? 'rgba(16,212,138,0.3)' : 'var(--border)'}`,
                        borderRadius: 6,
                        color: artifacts?.available?.length && !runningAnalysis ? 'var(--green)' : 'var(--text-3)',
                        fontSize: 13, fontWeight: 700,
                        cursor: artifacts?.available?.length && !runningAnalysis ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {runningAnalysis ? 'Enfileirando…' : '▶ Rodar análise'}
                    </button>
                  )}

                  {metaStatus?.job_status === 'failed' && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>✗ Erro na análise</div>
                      <pre style={{
                        fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--mono)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                      }}>
                        {metaStatus.error_msg ?? 'Falha desconhecida'}
                      </pre>
                    </div>
                  )}
                  {metaStatus?.has_results && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>
                      ✓ Concluído — veja a aba <strong>Gráficos</strong>
                    </div>
                  )}
                </div>
              </>
              )}

              {/* ════════════════════ ABA GRÁFICOS ════════════════════ */}
              {activeTab === 'graficos' && (
              <>
                {/* Análises escolhidas no projeto */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
                    Análises do projeto
                  </div>
                  {(!selectedProject.analyses || selectedProject.analyses.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Nenhuma análise escolhida. Edite o projeto para adicionar.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedProject.analyses.map(a => (
                        <div key={a.analysis_type} style={{
                          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                          padding: '8px 10px', background: 'var(--surface)',
                          border: '1px solid var(--border)', borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>
                            {a.analysis_type}
                          </span>
                          {a.charts.map(c => (
                            <span key={c} className="badge badge-purple" style={{ fontSize: 9 }}>{c}</span>
                          ))}
                          {(() => {
                            const done = latestDoneJobByType[a.analysis_type]
                            const route = a.analysis_type === 'spieceasi' ? 'network' : 'analysis'
                            const running = (jobs ?? []).some((j: Job) =>
                              j.job_type === a.analysis_type && (j.status === 'queued' || j.status === 'running'))
                            return (
                              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                                {done ? (
                                  <Link href={`/${route}/${done.id}`} style={{ fontSize: 11, color: 'var(--cyan)' }}>
                                    abrir gráfico →
                                  </Link>
                                ) : running ? (
                                  <span style={{ fontSize: 11, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span className="dot dot-cyan pulse" style={{ width: 5, height: 5 }} /> rodando…
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleRunAnalysisType(a.analysis_type)}
                                    disabled={runningType === a.analysis_type || !artifacts?.available?.length}
                                    title={artifacts?.available?.length ? 'Enfileirar esta análise' : 'Gere o phyloseq primeiro (aba DADA2)'}
                                    style={{
                                      ...sel,
                                      color: artifacts?.available?.length ? 'var(--green)' : 'var(--text-3)',
                                      cursor: artifacts?.available?.length ? 'pointer' : 'not-allowed',
                                    }}
                                  >
                                    {runningType === a.analysis_type ? '…' : '▶ Rodar'}
                                  </button>
                                )}
                              </span>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              {/* ──────────────────────────────────────────────────────────────
                  SECTION ③  Tabela de Abundância
              ────────────────────────────────────────────────────────────── */}
              {metaStatus?.has_results && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

                  {/* Toolbar */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                      ③ Tabela de Abundância
                    </span>
                    {asvData && (
                      <>
                        <span className="badge badge-cyan">{asvData.rows.length} taxa</span>
                        <span className="badge badge-purple">{asvData.total_asvs} ASVs</span>
                      </>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Nível:</label>
                      <select value={level} onChange={e => setLevel(e.target.value as TaxLevel)} style={sel}>
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button
                        onClick={() => setShowRel(v => !v)}
                        style={{
                          ...sel,
                          color: showRel ? 'var(--cyan)' : 'var(--text-2)',
                          background: showRel ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)',
                          border: `1px solid ${showRel ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                        }}
                      >
                        {showRel ? '% Rel.' : '# Abs.'}
                      </button>
                      <button onClick={handleExportCsv} disabled={!asvData} style={sel} title="CSV do nível atual">
                        ⬇ CSV
                      </button>
                      <button
                        onClick={() => handleExportFull('csv')}
                        disabled={exportingFull}
                        style={{ ...sel, color: exportingFull ? 'var(--text-3)' : 'var(--text-2)' }}
                        title="CSV completo (todos os níveis)"
                      >
                        {exportingFull ? '…' : '⬇ CSV completo'}
                      </button>
                      <button
                        onClick={() => handleExportFull('xlsx')}
                        disabled={exportingFull}
                        style={{ ...sel, color: exportingFull ? 'var(--text-3)' : 'var(--green)' }}
                        title="Planilha Excel (todos os níveis)"
                      >
                        {exportingFull ? '…' : '⬇ Excel'}
                      </button>
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filtrar taxon…"
                        style={{ ...sel, padding: '4px 10px', width: 150, cursor: 'text' }}
                      />
                    </div>
                  </div>

                  {/* Loading */}
                  {asvLoading && (
                    <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                        Carregando tabela…
                      </span>
                    </div>
                  )}

                  {/* Table */}
                  {asvData && (
                    <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                            <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600 }}>
                              Taxon
                            </th>
                            <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600 }}>
                              Total
                            </th>
                            {asvData.sample_names.slice(0, 10).map((s: string) => (
                              <th key={s} style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontWeight: 400, fontSize: 10, whiteSpace: 'nowrap' }}>
                                {s.length > 12 ? s.slice(0, 12) + '…' : s}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row: any, i: number) => (
                            <tr key={row.taxon + i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.taxon}
                              </td>
                              <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>
                                {showRel
                                  ? `${asvData.sample_names.reduce((acc: number, s: string) => acc + (row.rel_abundance?.[s] ?? 0), 0).toFixed(1)}%`
                                  : row.total.toLocaleString('pt-BR')}
                              </td>
                              {asvData.sample_names.slice(0, 10).map((s: string) => (
                                <td key={s} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                                  {showRel
                                    ? `${(row.rel_abundance?.[s] ?? 0).toFixed(2)}%`
                                    : (row.samples[s] ?? 0).toLocaleString('pt-BR')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {search && filteredRows.length === 0 && (
                        <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                          Nenhum taxon para &ldquo;{search}&rdquo;
                        </div>
                      )}
                      {!search && asvData.rows.length > 300 && (
                        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                          Mostrando 300 de {asvData.rows.length} taxa. Use &ldquo;⬇ Excel&rdquo; ou &ldquo;⬇ CSV completo&rdquo; para exportar tudo.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!metaStatus?.has_results && (
                <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                  A tabela de abundância aparece aqui após rodar a análise metagenômica (aba DADA2).
                </div>
              )}
              </>
              )}

            </div>
          )}
        </div>

      </div>
    </>
  )
}
