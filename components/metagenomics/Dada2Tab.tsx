'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { api, type Project, type Sample, type Dada2Params } from '@/lib/api'
import { dada2Defaults } from '@/lib/metagenomics-utils'

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', padding: '6px 10px', boxSizing: 'border-box',
}
const sel: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
}

const DADA2_FIELDS: { key: keyof Dada2Params; label: string; hint: string }[] = [
  { key: 'trunc_len_f', label: 'Truncagem Forward', hint: '0 = sem truncagem (ITS)' },
  { key: 'trunc_len_r', label: 'Truncagem Reverse', hint: '0 = sem truncagem (ITS)' },
  { key: 'max_ee_f', label: 'maxEE Forward', hint: 'erros esperados máx.' },
  { key: 'max_ee_r', label: 'maxEE Reverse', hint: 'erros esperados máx.' },
  { key: 'trunc_q', label: 'truncQ', hint: 'trunca no 1º Q ≤ valor' },
  { key: 'max_n', label: 'maxN', hint: 'Ns máximos (DADA2 exige 0)' },
  { key: 'min_len', label: 'minLen (ITS)', hint: 'comprimento mínimo' },
]

interface Props {
  projectId: string
  project: Project
  token?: string
  onProjectChange: () => void
}

/** Aba DADA2 — autocontida: parâmetros, checklist de prontidão, execução com
 *  progresso real e painel de erros (status via SWR próprio). */
export default function Dada2Tab({ projectId, project, token, onProjectChange }: Props) {
  const { data: samples } = useSWR(`meta-samples-${projectId}`, () => api.getSamples(projectId), { refreshInterval: 15000 })
  const samplesWithFastq = (samples ?? []).filter((s: Sample) => s.fastq_r1_oid && s.fastq_r2_oid).length
  const [paramsDraft, setParamsDraft] = useState<Dada2Params | null>(null)
  const [savingParams, setSavingParams] = useState(false)
  const [paramsSaved, setParamsSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)

  const { data: artifacts } = useSWR(`meta-artifacts-${projectId}`, () => api.getArtifacts(projectId), { refreshInterval: 20000 })
  const { data: metaStatus } = useSWR(`meta-status-${projectId}`, () => api.getMetagenomicsStatus(projectId), { refreshInterval: 5000 })
  const { data: dada2Status } = useSWR(`dada2-status-${projectId}`, () => api.getDada2Status(projectId), { refreshInterval: 3000 })

  const effectiveParams: Dada2Params = paramsDraft ?? project.dada2_params ?? dada2Defaults(project.marker_type)
  const hasParams = Object.keys(project.dada2_params ?? {}).length > 0
  const readiness = [
    { label: 'Código, nome e marcador', ok: !!project.code && !!project.name && !!project.marker_type },
    { label: '≥ 2 amostras com par FASTQ', ok: samplesWithFastq >= 2 },
    { label: 'Parâmetros DADA2 definidos', ok: hasParams },
    { label: 'Análises/gráficos escolhidos', ok: (project.analyses?.length ?? 0) > 0 },
  ]
  const isReady = readiness.every(r => r.ok)
  const dada2Running = dada2Status?.job_status === 'running' || dada2Status?.job_status === 'queued'

  async function saveParams() {
    if (!token || !paramsDraft) return
    setSavingParams(true); setParamsSaved(false)
    try {
      await api.updateProject(token, projectId, { dada2_params: paramsDraft })
      onProjectChange()
      setParamsSaved(true); setTimeout(() => setParamsSaved(false), 2000)
    } catch (e) { alert((e as Error).message) } finally { setSavingParams(false) }
  }

  async function runDada2() {
    if (!token) { alert('Sem permissão — faça login'); return }
    setGenerating(true)
    try {
      const payload = (paramsDraft ?? project.dada2_params ?? {}) as Record<string, unknown>
      await api.enqueueJob(token, projectId, 'dada2_pipeline', undefined, payload)
    } catch (e) { alert((e as Error).message) } finally { setGenerating(false) }
  }

  async function runMetagenomics() {
    const oid = artifacts?.available?.[0]?.phyloseq_oid
    if (!oid) return
    setRunningAnalysis(true)
    try { await api.runMetagenomicsPipeline(projectId, Number(oid)) }
    catch (e) { alert((e as Error).message) } finally { setRunningAnalysis(false) }
  }

  const ErrorPanel = ({ msg }: { msg?: string | null }) => (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>✗ Erro na execução</div>
      <pre style={{ fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{msg ?? 'Falha desconhecida'}</pre>
    </div>
  )

  const ProgressBar = ({ pct, stage }: { pct: number; stage?: string | null }) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--cyan)', marginBottom: 8 }}>
        <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />{stage ?? 'Rodando…'}
      </div>
      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--cyan)', borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{pct}%</div>
    </>
  )

  return (
    <>
      {/* Checklist */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>Prontidão do projeto</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {readiness.map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: c.ok ? 'var(--green)' : 'var(--text-3)' }}>{c.ok ? '✓' : '○'}</span>
              <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-3)' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Parâmetros */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>Parâmetros DADA2</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{project.marker_type === '16S' ? 'SILVA 138.1' : 'UNITE'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {DADA2_FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>{f.label}</label>
              <input type="number" value={(effectiveParams[f.key] as number | undefined) ?? ''}
                onChange={e => setParamsDraft({ ...effectiveParams, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inp} />
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{f.hint}</div>
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>Método de quimera</label>
            <select value={effectiveParams.chimera_method ?? 'consensus'} onChange={e => setParamsDraft({ ...effectiveParams, chimera_method: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
              <option value="consensus">consensus</option>
              <option value="pooled">pooled</option>
              <option value="per-sample">per-sample</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button onClick={saveParams} disabled={savingParams || !paramsDraft}
            style={{ ...sel, color: paramsDraft ? 'var(--cyan)' : 'var(--text-3)', background: paramsDraft ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)', cursor: paramsDraft && !savingParams ? 'pointer' : 'not-allowed' }}>
            {savingParams ? 'Salvando…' : '💾 Salvar parâmetros'}
          </button>
          <button onClick={() => setParamsDraft(dada2Defaults(project.marker_type))} style={{ ...sel, color: 'var(--text-2)' }}>↺ Restaurar defaults</button>
          {paramsSaved && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Salvo</span>}
        </div>
      </div>

      {/* Execução DADA2 */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>Executar DADA2 — QC · ASV inference · classificação</div>
        {dada2Running ? (
          <ProgressBar pct={dada2Status?.progress_pct ?? 0} stage={dada2Status?.job_status === 'queued' ? 'Na fila…' : dada2Status?.progress_stage} />
        ) : (
          <button onClick={runDada2} disabled={!isReady || generating}
            style={{ padding: '8px 18px', background: isReady && !generating ? 'rgba(16,212,138,0.15)' : 'var(--surface-2)', border: `1px solid ${isReady ? 'rgba(16,212,138,0.3)' : 'var(--border)'}`, borderRadius: 6, color: isReady && !generating ? 'var(--green)' : 'var(--text-3)', fontSize: 13, fontWeight: 700, cursor: isReady && !generating ? 'pointer' : 'not-allowed' }}>
            {generating ? 'Enfileirando…' : '▶ Rodar DADA2'}
          </button>
        )}
        {!isReady && !dada2Running && (
          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8 }}>Complete os critérios de prontidão acima para liberar a execução.</div>
        )}
        {dada2Status?.job_status === 'failed' && <ErrorPanel msg={dada2Status.error_msg} />}
        {dada2Status?.job_status === 'done' && dada2Status?.has_phyloseq && (
          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>
            ✓ phyloseq gerado {dada2Status.completed_at ? `em ${new Date(dada2Status.completed_at).toLocaleString('pt-BR')}` : ''}
          </div>
        )}
      </div>

      {/* Análise metagenômica */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>Análise metagenômica — tabela de ASVs · diversidade · PCoA</div>
        <div style={{ fontSize: 11, color: artifacts?.available?.length ? 'var(--green)' : 'var(--text-3)', marginBottom: 8 }}>
          {artifacts?.available?.length ? `✓ ${artifacts.available.length} phyloseq disponível` : '⚠ Rode o DADA2 primeiro para gerar o phyloseq'}
        </div>
        {(metaStatus?.job_status === 'running' || metaStatus?.job_status === 'queued') ? (
          <ProgressBar pct={metaStatus.progress_pct ?? 0} stage={metaStatus.job_status === 'queued' ? 'Na fila…' : metaStatus.progress_stage} />
        ) : (
          <button onClick={runMetagenomics} disabled={!artifacts?.available?.length || runningAnalysis}
            style={{ padding: '8px 18px', background: artifacts?.available?.length && !runningAnalysis ? 'rgba(16,212,138,0.15)' : 'var(--surface-2)', border: `1px solid ${artifacts?.available?.length ? 'rgba(16,212,138,0.3)' : 'var(--border)'}`, borderRadius: 6, color: artifacts?.available?.length && !runningAnalysis ? 'var(--green)' : 'var(--text-3)', fontSize: 13, fontWeight: 700, cursor: artifacts?.available?.length && !runningAnalysis ? 'pointer' : 'not-allowed' }}>
            {runningAnalysis ? 'Enfileirando…' : '▶ Rodar análise'}
          </button>
        )}
        {metaStatus?.job_status === 'failed' && <ErrorPanel msg={metaStatus.error_msg} />}
        {metaStatus?.has_results && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>✓ Concluído — veja a aba Gráficos</div>}
      </div>
    </>
  )
}
