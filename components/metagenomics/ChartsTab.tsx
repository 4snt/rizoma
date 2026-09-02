'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { api, type Project, type Job, type TaxLevel, type AsvFullRow } from '@/lib/api'
import { csvDownload } from '@/lib/metagenomics-utils'
import AlphaBox from '@/components/charts/AlphaBox'
import PcoaScatter from '@/components/charts/PcoaScatter'
import BiomarkerBar from '@/components/charts/BiomarkerBar'

const LEVELS: TaxLevel[] = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']

const sel: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
}

interface Props {
  projectId: string
  project: Project
  token?: string
}

/** Aba Gráficos — autocontida: lista de análises, tabela de abundância e
 *  gráficos de diversidade/PCoA/biomarcadores (dados via SWR próprio). */
export default function ChartsTab({ projectId, project, token }: Props) {
  const [level, setLevel] = useState<TaxLevel>('genus')
  const [showRel, setShowRel] = useState(false)
  const [search, setSearch] = useState('')
  const [exportingFull, setExportingFull] = useState(false)
  const [runningType, setRunningType] = useState<string | null>(null)

  const { data: metaStatus } = useSWR(`meta-status-${projectId}`, () => api.getMetagenomicsStatus(projectId), { refreshInterval: 5000 })
  const { data: artifacts } = useSWR(`meta-artifacts-${projectId}`, () => api.getArtifacts(projectId), { refreshInterval: 20000 })
  const hasResults = !!metaStatus?.has_results
  const artifactOid = artifacts?.available?.[0]?.phyloseq_oid

  const { data: jobs, mutate: mutateJobs } = useSWR(
    token ? `meta-jobs-${projectId}` : null, () => api.getJobs(token!, projectId), { refreshInterval: 5000 })
  const { data: asvData, isLoading: asvLoading } = useSWR(
    hasResults ? `meta-asv-${projectId}-${level}` : null, () => api.getAsvTable(projectId, level))
  const { data: divData } = useSWR(
    hasResults ? `meta-div-${projectId}` : null, () => api.getDiversity(projectId))
  const { data: ordData } = useSWR(
    hasResults ? `meta-ord-${projectId}` : null, () => api.getOrdination(projectId))
  const { data: bioData } = useSWR(
    hasResults ? `meta-bio-${projectId}` : null, () => api.getBiomarkers(projectId))

  const latestDoneByType = useMemo(() => {
    const map: Record<string, Job> = {}
    for (const j of (jobs ?? []) as Job[]) {
      if (j.status === 'done' && !map[j.job_type]) map[j.job_type] = j
    }
    return map
  }, [jobs])

  async function runType(analysisType: string) {
    if (!token) { alert('Sem permissão — faça login'); return }
    if (!artifactOid) { alert('Gere o phyloseq (aba DADA2) antes de rodar as análises.'); return }
    setRunningType(analysisType)
    try {
      await api.enqueueJob(token, projectId, analysisType, Number(artifactOid))
      await mutateJobs()
    } catch (e) { alert((e as Error).message) } finally { setRunningType(null) }
  }

  const filteredRows = useMemo(() => {
    if (!asvData) return []
    const q = search.toLowerCase()
    return q ? asvData.rows.filter(r => r.taxon.toLowerCase().includes(q)) : asvData.rows.slice(0, 300)
  }, [asvData, search])

  function exportLevelCsv() {
    if (!asvData) return
    const headers = ['Taxon', 'Total', ...asvData.sample_names]
    const rows = asvData.rows.map(r => [
      r.taxon, String(r.total), ...asvData.sample_names.map(s => String(r.samples[s] ?? 0)),
    ])
    csvDownload(`${project.code}_${level}.csv`, headers, rows)
  }

  async function exportFull(fmt: 'csv' | 'xlsx') {
    setExportingFull(true)
    try {
      const data = await api.getAsvTableFull(projectId)
      const TAX = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']
      const headers = [
        ...TAX,
        ...data.sample_names.map(s => `count_${s}`),
        ...data.sample_names.map(s => `rel_pct_${s}`),
        'total',
      ]
      const base = `${project.code}_taxonomy_full`
      if (fmt === 'xlsx') {
        const XLSX = await import('xlsx')
        const aoa: (string | number)[][] = [
          headers,
          ...data.rows.map((r: AsvFullRow) => [
            r.domain ?? '', r.phylum ?? '', r.class ?? '', r.order ?? '', r.family ?? '', r.genus ?? '', r.species ?? '',
            ...data.sample_names.map(s => r.samples[s] ?? 0),
            ...data.sample_names.map(s => Number((r.rel_abundance[s] ?? 0).toFixed(4))),
            r.total,
          ]),
        ]
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Abundância')
        XLSX.writeFile(wb, `${base}.xlsx`)
      } else {
        const rows = data.rows.map((r: AsvFullRow) => [
          r.domain ?? '', r.phylum ?? '', r.class ?? '', r.order ?? '', r.family ?? '', r.genus ?? '', r.species ?? '',
          ...data.sample_names.map(s => String(r.samples[s] ?? 0)),
          ...data.sample_names.map(s => String((r.rel_abundance[s] ?? 0).toFixed(4))),
          String(r.total),
        ])
        csvDownload(`${base}.csv`, headers, rows)
      }
    } catch (e) { alert((e as Error).message) } finally { setExportingFull(false) }
  }

  return (
    <>
      {/* Análises escolhidas */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>Análises do projeto</div>
        {(!project.analyses || project.analyses.length === 0) ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhuma análise escolhida. Edite o projeto para adicionar.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {project.analyses.map(a => {
              const done = latestDoneByType[a.analysis_type]
              const route = a.analysis_type === 'spieceasi' ? 'network' : 'analysis'
              const running = (jobs ?? []).some((j: Job) => j.job_type === a.analysis_type && (j.status === 'queued' || j.status === 'running'))
              return (
                <div key={a.analysis_type} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>{a.analysis_type}</span>
                  {a.charts.map(c => <span key={c} className="badge badge-purple" style={{ fontSize: 9 }}>{c}</span>)}
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {done ? (
                      <Link href={`/${route}/${done.id}`} style={{ fontSize: 11, color: 'var(--cyan)' }}>abrir gráfico →</Link>
                    ) : running ? (
                      <span style={{ fontSize: 11, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="dot dot-cyan pulse" style={{ width: 5, height: 5 }} /> rodando…
                      </span>
                    ) : (
                      <button onClick={() => runType(a.analysis_type)} disabled={runningType === a.analysis_type || !artifactOid}
                        title={artifactOid ? 'Enfileirar esta análise' : 'Gere o phyloseq primeiro (aba DADA2)'}
                        style={{ ...sel, color: artifactOid ? 'var(--green)' : 'var(--text-3)', cursor: artifactOid ? 'pointer' : 'not-allowed' }}>
                        {runningType === a.analysis_type ? '…' : '▶ Rodar'}
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!hasResults && (
        <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
          A tabela de abundância e os gráficos aparecem aqui após rodar a análise metagenômica (aba DADA2).
        </div>
      )}

      {/* Diversidade / PCoA / Biomarcadores */}
      {hasResults && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {divData?.alpha?.length ? (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Diversidade α — Shannon</div>
              <AlphaBox alpha={divData.alpha} />
            </div>
          ) : null}
          {ordData?.points?.length ? (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Ordenação — PCoA ({ordData.beta_metric})
                {ordData.permanova && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)' }}>
                    PERMANOVA R²={ordData.permanova.r2.toFixed(3)} · p={ordData.permanova.p_value.toFixed(4)}
                  </span>
                )}
              </div>
              <PcoaScatter ord={ordData} />
            </div>
          ) : null}
          {bioData?.markers?.length ? (
            <div className="card" style={{ padding: 16, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Biomarcadores ({bioData.method})
              </div>
              <BiomarkerBar markers={bioData.markers} />
            </div>
          ) : null}
        </div>
      )}

      {/* Tabela de abundância */}
      {hasResults && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Tabela de Abundância</span>
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
              <button onClick={() => setShowRel(v => !v)} style={{ ...sel, color: showRel ? 'var(--cyan)' : 'var(--text-2)', background: showRel ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)' }}>
                {showRel ? '% Rel.' : '# Abs.'}
              </button>
              <button onClick={exportLevelCsv} disabled={!asvData} style={sel} title="CSV do nível atual">⬇ CSV</button>
              <button onClick={() => exportFull('csv')} disabled={exportingFull} style={{ ...sel, color: 'var(--text-2)' }} title="CSV completo">{exportingFull ? '…' : '⬇ CSV completo'}</button>
              <button onClick={() => exportFull('xlsx')} disabled={exportingFull} style={{ ...sel, color: 'var(--green)' }} title="Excel">{exportingFull ? '…' : '⬇ Excel'}</button>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar taxon…" style={{ ...sel, padding: '4px 10px', width: 150, cursor: 'text' }} />
            </div>
          </div>

          {asvLoading && (
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Carregando tabela…</span>
            </div>
          )}

          {asvData && (
            <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600 }}>Taxon</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600 }}>Total</th>
                    {asvData.sample_names.slice(0, 10).map(s => (
                      <th key={s} style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontWeight: 400, fontSize: 10, whiteSpace: 'nowrap' }}>
                        {s.length > 12 ? s.slice(0, 12) + '…' : s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={row.taxon + i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.taxon}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>
                        {showRel
                          ? `${asvData.sample_names.reduce((acc, s) => acc + (row.rel_abundance?.[s] ?? 0), 0).toFixed(1)}%`
                          : row.total.toLocaleString('pt-BR')}
                      </td>
                      {asvData.sample_names.slice(0, 10).map(s => (
                        <td key={s} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {showRel ? `${(row.rel_abundance?.[s] ?? 0).toFixed(2)}%` : (row.samples[s] ?? 0).toLocaleString('pt-BR')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {search && filteredRows.length === 0 && (
                <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Nenhum taxon para &ldquo;{search}&rdquo;</div>
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
    </>
  )
}
