'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import {
  api,
  type TaxLevel,
  type BetaMetricKey,
  type AlphaPoint,
  type BiomarkerEntry,
  type PcoaPoint,
  type AsvFullRow,
} from '@/lib/api'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'entrada' | 'asv' | 'diversidade' | 'ordenacao' | 'biomarcadores'
const TABS: { id: Tab; label: string }[] = [
  { id: 'entrada',      label: '① Entrada' },
  { id: 'asv',         label: '② ASV Table' },
  { id: 'diversidade', label: '③ Diversidade' },
  { id: 'ordenacao',   label: '④ Ordenação' },
  { id: 'biomarcadores', label: '⑤ Biomarcadores' },
]

const LEVELS: TaxLevel[] = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']
const BETA_METRICS: { key: BetaMetricKey; label: string }[] = [
  { key: 'bray',    label: 'Bray-Curtis' },
  { key: 'jaccard', label: 'Jaccard' },
]

// ── Plotly theme ─────────────────────────────────────────────────────────────

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: '#0a1628',
  plot_bgcolor:  '#050d1a',
  font:   { color: '#e2eeff', family: 'Inter, system-ui, sans-serif', size: 12 },
  margin: { t: 36, b: 52, l: 60, r: 20 },
  legend: {
    bgcolor: 'rgba(10,22,40,0.9)',
    bordercolor: 'rgba(0,212,255,0.15)',
    borderwidth: 1,
    font: { color: '#7a9cc0', size: 11 },
  },
  hoverlabel: { bgcolor: '#0f1e38', bordercolor: '#00d4ff', font: { color: '#e2eeff' } },
}
const AXIS: Partial<Plotly.LayoutAxis> = {
  gridcolor:     'rgba(0,212,255,0.08)',
  zerolinecolor: 'rgba(0,212,255,0.15)',
  tickfont:      { color: '#7a9cc0' },
}

// Palette for treatment groups
const PALETTE = ['#00d4ff','#10d48a','#f59e0b','#a855f7','#ef4444','#3b82f6','#f472b6','#fb923c']
function groupColor(groups: string[], g: string) {
  const idx = Array.from(new Set(groups)).indexOf(g)
  return PALETTE[idx % PALETTE.length]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const map: Record<string, { cls: string; label: string }> = {
    queued:  { cls: 'badge-amber',  label: 'Na fila' },
    running: { cls: 'badge-cyan',   label: 'Rodando' },
    done:    { cls: 'badge-green',  label: 'Concluído' },
    failed:  { cls: 'badge-red',    label: 'Falhou' },
  }
  const m = map[status] ?? { cls: 'badge-purple', label: status }
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

function csvDownload(filename: string, headers: string[], rows: string[][]) {
  const bom = '﻿'
  const content = bom + [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function MetagenomicsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tab, setTab]             = useState<Tab>('entrada')
  const [level, setLevel]         = useState<TaxLevel>('genus')
  const [betaMetric, setBetaMetric] = useState<BetaMetricKey>('bray')
  const [asvSearch, setAsvSearch] = useState('')
  const [runningJob, setRunningJob] = useState(false)
  const [showRelAbund, setShowRelAbund] = useState(false)
  const [exportingFull, setExportingFull] = useState(false)

  // ── SWR fetchers ───────────────────────────────────────────────────────────
  const { data: status, mutate: mutateStatus } = useSWR(
    `meta-status-${id}`,
    () => api.getMetagenomicsStatus(id),
    { refreshInterval: 5000 }
  )

  const { data: artifacts } = useSWR(
    `artifacts-${id}`,
    () => api.getArtifacts(id)
  )

  const { data: asvData, isLoading: asvLoading } = useSWR(
    tab === 'asv' && status?.has_results ? `asv-${id}-${level}` : null,
    () => api.getAsvTable(id, level)
  )

  const { data: divData, isLoading: divLoading } = useSWR(
    tab === 'diversidade' && status?.has_results ? `div-${id}-${level}` : null,
    () => api.getDiversity(id, level)
  )

  const { data: ordData, isLoading: ordLoading } = useSWR(
    tab === 'ordenacao' && status?.has_results ? `ord-${id}-pcoa-${betaMetric}-${level}` : null,
    () => api.getOrdination(id, 'pcoa', betaMetric, level)
  )

  const { data: bioData, isLoading: bioLoading } = useSWR(
    tab === 'biomarcadores' && status?.has_results ? `bio-${id}-${level}` : null,
    () => api.getBiomarkers(id, level)
  )

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleExportCsv() {
    if (!asvData) return
    const headers = ['Taxon', 'Total', ...asvData.sample_names]
    const rows = asvData.rows.map(r => [
      r.taxon,
      String(r.total),
      ...asvData.sample_names.map(s => String(r.samples[s] ?? 0)),
    ])
    csvDownload(`${id}_${level}_abundance.csv`, headers, rows)
  }

  async function handleExportFull() {
    setExportingFull(true)
    try {
      const data = await api.getAsvTableFull(id)
      const TAX = ['domain', 'phylum', 'class', 'order', 'family', 'genus', 'species']
      const headers = [
        ...TAX,
        ...data.sample_names.map(s => `count_${s}`),
        ...data.sample_names.map(s => `rel_pct_${s}`),
        'total',
      ]
      const rows = data.rows.map((r: AsvFullRow) => [
        r.domain ?? '', r.phylum ?? '', r.class ?? '', r.order ?? '',
        r.family ?? '', r.genus ?? '', r.species ?? '',
        ...data.sample_names.map(s => String(r.samples[s] ?? 0)),
        ...data.sample_names.map(s => String((r.rel_abundance[s] ?? 0).toFixed(4))),
        String(r.total),
      ])
      csvDownload(`${id}_taxonomy_full.csv`, headers, rows)
    } catch (e) {
      alert('Erro ao exportar tabela completa: ' + (e as Error).message)
    } finally {
      setExportingFull(false)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleRun(phyloseqOid: number) {
    setRunningJob(true)
    try {
      await api.runMetagenomicsPipeline(id, phyloseqOid)
      await mutateStatus()
    } catch (e) {
      alert('Erro ao enfileirar: ' + (e as Error).message)
    } finally {
      setRunningJob(false)
    }
  }

  // ── ASV table (filtered) ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!asvData) return []
    const q = asvSearch.toLowerCase()
    return q
      ? asvData.rows.filter(r => r.taxon.toLowerCase().includes(q))
      : asvData.rows.slice(0, 200)
  }, [asvData, asvSearch])

  // ── Alpha chart data ───────────────────────────────────────────────────────
  const alphaTraces = useMemo(() => {
    if (!divData?.alpha?.length) return []
    const pts = divData.alpha as AlphaPoint[]
    const allGroups = Array.from(new Set(pts.map(p => p.treatment_group)))
    return allGroups.map(g => ({
      type: 'box' as const,
      name: g,
      y: pts.filter(p => p.treatment_group === g).map(p => p.shannon),
      marker: { color: groupColor(allGroups, g) },
      fillcolor: groupColor(allGroups, g) + '22',
      line: { color: groupColor(allGroups, g) },
    }))
  }, [divData])

  // ── Beta heatmap data ──────────────────────────────────────────────────────
  const betaHeatTrace = useMemo(() => {
    if (!divData?.beta) return null
    const b = divData.beta[betaMetric]
    if (!b?.matrix?.length) return null
    return {
      type: 'heatmap' as const,
      z: b.matrix,
      x: b.sample_names,
      y: b.sample_names,
      colorscale: 'Viridis' as const,
      reversescale: false,
      showscale: true,
    }
  }, [divData, betaMetric])

  // ── PCoA scatter ───────────────────────────────────────────────────────────
  const pcoaTraces = useMemo(() => {
    if (!ordData?.points?.length) return []
    const pts = ordData.points as PcoaPoint[]
    const allGroups = Array.from(new Set(pts.map(p => p.treatment_group)))
    return allGroups.map(g => ({
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: g,
      x: pts.filter(p => p.treatment_group === g).map(p => p.axis1),
      y: pts.filter(p => p.treatment_group === g).map(p => p.axis2),
      text: pts.filter(p => p.treatment_group === g).map(p => p.sample_id),
      hovertemplate: '%{text}<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>',
      marker: { color: groupColor(allGroups, g), size: 9, line: { color: '#000', width: 0.5 } },
    }))
  }, [ordData])

  // ── Biomarkers diverging bar ───────────────────────────────────────────────
  const bioTrace = useMemo(() => {
    if (!bioData?.markers?.length) return null
    const markers = [...(bioData.markers as BiomarkerEntry[])]
      .sort((a, b) => Math.abs(b.effect_size) - Math.abs(a.effect_size))
      .slice(0, 30)
    return {
      type: 'bar' as const,
      orientation: 'h' as const,
      y: markers.map(m => m.taxon),
      x: markers.map(m => m.effect_size),
      marker: {
        color: markers.map(m => m.effect_size > 0 ? '#10d48a' : '#ef4444'),
      },
      hovertemplate: '<b>%{y}</b><br>log2FC: %{x:.3f}<extra></extra>',
    }
  }, [bioData])

  // ── Shared selectors ───────────────────────────────────────────────────────
  const selStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 6, padding: '4px 8px',
    fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Link href={`/projects/${id}`} style={{ color: 'var(--text-2)', fontSize: 13, textDecoration: 'none' }}>
            ← Projeto
          </Link>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--cyan)' }}>Metagenômica</span>
          <StatusBadge status={status?.job_status ?? null} />
        </div>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Módulo de Metagenômica</h1>
      </div>

      {/* Toolbar: tabs + level selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        borderBottom: '1px solid var(--border)', marginBottom: 20,
        overflowX: 'auto', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--mono)', cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              border: '1px solid transparent', borderBottom: 'none',
              background: tab === t.id ? 'var(--bg)' : 'transparent',
              color: tab === t.id ? 'var(--cyan)' : 'var(--text-2)',
              borderColor: tab === t.id ? 'var(--border)' : 'transparent',
              borderBottomColor: tab === t.id ? 'var(--bg)' : 'transparent',
              marginBottom: tab === t.id ? -1 : 0,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', paddingRight: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Nível:</label>
          <select style={selStyle} value={level} onChange={e => setLevel(e.target.value as TaxLevel)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {(tab === 'diversidade' || tab === 'ordenacao') && (
            <>
              <label style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>Beta:</label>
              <select style={selStyle} value={betaMetric} onChange={e => setBetaMetric(e.target.value as BetaMetricKey)}>
                {BETA_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* ── Tab: Entrada ── */}
      {tab === 'entrada' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 12, fontSize: 14 }}>
              Executar pipeline de metagenômica
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              Selecione um artefato phyloseq (.rds) para rodar: vegan (α/β diversidade, PERMANOVA, PCoA) + ANCOM-BC2 (biomarcadores).
            </p>

            {!status?.has_results && status?.job_status === null && (
              <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 12 }}>
                Nenhuma análise encontrada. Selecione um phyloseq abaixo e inicie o pipeline.
              </div>
            )}

            {status?.job_status === 'failed' && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--red)',
              }}>
                Pipeline falhou: {status.error_msg || 'erro desconhecido'}
              </div>
            )}

            {(status?.job_status === 'queued' || status?.job_status === 'running') && (
              <div style={{
                background: 'rgba(0,212,255,0.06)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.2s infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {status.job_status === 'queued' ? 'Aguardando na fila…' : 'Rodando (vegan + ANCOM-BC2)…'}
                </span>
              </div>
            )}

            {/* Artifact list */}
            {artifacts?.available?.length ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Artefatos disponíveis ({artifacts.available.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {artifacts.available.map(a => (
                    <div key={a.job_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 8, gap: 12,
                    }}>
                      <div>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--cyan)' }}>OID {a.phyloseq_oid}</span>
                        {a.created_at && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 10 }}>
                            {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRun(a.phyloseq_oid)}
                        disabled={runningJob || status?.job_status === 'running' || status?.job_status === 'queued'}
                        style={{
                          padding: '5px 14px',
                          background: 'rgba(0,212,255,0.12)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          borderRadius: 6, color: 'var(--cyan)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {runningJob ? 'Enfileirando…' : 'Iniciar pipeline'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Nenhum artefato phyloseq encontrado.{' '}
                <Link href={`/projects/${id}`} style={{ color: 'var(--cyan)' }}>
                  Faça upload na página do projeto.
                </Link>
              </div>
            )}

            {status?.has_results && (
              <div style={{
                marginTop: 14, padding: '8px 12px',
                background: 'rgba(16,212,138,0.08)', border: '1px solid rgba(16,212,138,0.2)',
                borderRadius: 8, fontSize: 12, color: 'var(--green)',
              }}>
                ✓ Análise concluída em {status.completed_at ? new Date(status.completed_at).toLocaleString('pt-BR') : '–'}.
                Navegue pelas abas para explorar os resultados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: ASV Table ── */}
      {tab === 'asv' && (
        <div>
          {!status?.has_results ? (
            <NoResults />
          ) : asvLoading ? (
            <Loading label="Carregando tabela de abundância…" />
          ) : asvData ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  Abundância — nível {level}
                </span>
                <span className="badge badge-cyan">{asvData.rows.length} taxa</span>
                <span className="badge badge-purple">{asvData.total_asvs} ASVs raw</span>
                <button
                  onClick={() => setShowRelAbund(v => !v)}
                  style={{
                    ...selStyle,
                    background: showRelAbund ? 'rgba(0,212,255,0.15)' : 'var(--surface-2)',
                    color: showRelAbund ? 'var(--cyan)' : 'var(--text-2)',
                    border: `1px solid ${showRelAbund ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
                  }}
                  title="Alternar entre contagens absolutas e abundância relativa (%)"
                >
                  {showRelAbund ? '% Rel.' : '# Abs.'}
                </button>
                <button
                  onClick={handleExportCsv}
                  style={{ ...selStyle }}
                  title={`Exportar tabela de ${level} como CSV`}
                >
                  ⬇ CSV
                </button>
                <button
                  onClick={handleExportFull}
                  disabled={exportingFull}
                  style={{
                    ...selStyle,
                    color: exportingFull ? 'var(--text-3)' : 'var(--green)',
                    border: `1px solid ${exportingFull ? 'var(--border)' : 'rgba(16,212,138,0.35)'}`,
                  }}
                  title="Exportar tabela completa com todos os 7 níveis taxonômicos (domain→species) como colunas"
                >
                  {exportingFull ? 'Exportando…' : '⬇ Tabela Completa'}
                </button>
                <input
                  type="text"
                  placeholder="Filtrar taxon…"
                  value={asvSearch}
                  onChange={e => setAsvSearch(e.target.value)}
                  style={{
                    marginLeft: 'auto', ...selStyle,
                    padding: '5px 10px', width: 200,
                  }}
                />
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Taxon
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600 }}>Total</th>
                      {asvData.sample_names.slice(0, 12).map(s => (
                        <th key={s} style={{
                          padding: '8px 8px', textAlign: 'right', color: 'var(--text-3)',
                          fontFamily: 'var(--mono)', fontWeight: 400, fontSize: 10, whiteSpace: 'nowrap',
                        }}>
                          {s.length > 10 ? s.slice(0, 10) + '…' : s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => (
                      <tr key={row.taxon + i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.taxon}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>
                          {showRelAbund
                            ? `${asvData.sample_names.reduce((acc, s) => acc + (row.rel_abundance?.[s] ?? 0), 0).toFixed(1)}%`
                            : row.total.toLocaleString('pt-BR')}
                        </td>
                        {asvData.sample_names.slice(0, 12).map(s => (
                          <td key={s} style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                            {showRelAbund
                              ? `${(row.rel_abundance?.[s] ?? 0).toFixed(2)}%`
                              : (row.samples[s] ?? 0).toLocaleString('pt-BR')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {asvSearch && filteredRows.length === 0 && (
                <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                  Nenhum taxon encontrado para &quot;{asvSearch}&quot;
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab: Diversidade ── */}
      {tab === 'diversidade' && (
        <div>
          {!status?.has_results ? (
            <NoResults />
          ) : divLoading ? (
            <Loading label="Carregando diversidade…" />
          ) : divData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Alpha */}
              <div className="plot-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="section-title" style={{ marginBottom: 0 }}>Alpha Diversity — Shannon por grupo</span>
                  {divData.kruskal && (
                    <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                      Kruskal-Wallis p = {divData.kruskal.p_value.toExponential(2)}
                    </span>
                  )}
                </div>
                <Plot
                  data={alphaTraces}
                  layout={{
                    ...DARK_LAYOUT,
                    height: 340,
                    autosize: true,
                    xaxis: AXIS,
                    yaxis: { ...AXIS, title: { text: 'Shannon H' } },
                  } as Partial<Plotly.Layout>}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Alpha metrics table */}
              {divData.alpha?.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                    Métricas alfa por amostra
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Amostra','Grupo','Shannon','Simpson','Riqueza','Margalef','Pielou'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Amostra' || h === 'Grupo' ? 'left' : 'right', color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(divData.alpha as import('@/lib/api').AlphaPoint[]).map((p, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>{p.sample_id}</td>
                            <td style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-2)' }}>{p.treatment_group}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.shannon?.toFixed(3)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.simpson?.toFixed(3)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.richness}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.margalef?.toFixed(3)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.pielou?.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Beta heatmap */}
              {betaHeatTrace && (
                <div className="plot-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="section-title" style={{ marginBottom: 0 }}>
                      Diversidade Beta — {betaMetric === 'bray' ? 'Bray-Curtis' : 'Jaccard'} (matriz)
                    </span>
                    {divData.permanova?.[betaMetric] && (
                      <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                        PERMANOVA R² = {divData.permanova[betaMetric].r2.toFixed(3)} · p = {divData.permanova[betaMetric].p_value.toFixed(4)}
                      </span>
                    )}
                  </div>
                  <Plot
                    data={[betaHeatTrace]}
                    layout={{
                      ...DARK_LAYOUT,
                      height: 400, autosize: true,
                      xaxis: { ...AXIS, tickangle: -45 },
                      yaxis: { ...AXIS },
                    } as Partial<Plotly.Layout>}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab: Ordenação ── */}
      {tab === 'ordenacao' && (
        <div>
          {!status?.has_results ? (
            <NoResults />
          ) : ordLoading ? (
            <Loading label="Carregando ordenação…" />
          ) : ordData ? (
            <div className="plot-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="section-title" style={{ marginBottom: 0 }}>
                  PCoA — {betaMetric === 'bray' ? 'Bray-Curtis' : 'Jaccard'}
                </span>
                {ordData.variance_explained?.length >= 2 && (
                  <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                    PC1 {ordData.variance_explained[0]?.toFixed(1)}% · PC2 {ordData.variance_explained[1]?.toFixed(1)}%
                  </span>
                )}
              </div>
              {ordData.permanova && (
                <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                  PERMANOVA: R² = {ordData.permanova.r2.toFixed(3)}, p = {ordData.permanova.p_value.toFixed(4)}
                </div>
              )}
              <Plot
                data={pcoaTraces}
                layout={{
                  ...DARK_LAYOUT,
                  height: 480, autosize: true,
                  xaxis: { ...AXIS, title: { text: `PC1 (${ordData.variance_explained?.[0]?.toFixed(1) ?? '?'}%)` } },
                  yaxis: { ...AXIS, title: { text: `PC2 (${ordData.variance_explained?.[1]?.toFixed(1) ?? '?'}%)` } },
                } as Partial<Plotly.Layout>}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum dado de ordenação encontrado para este par de métricas.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Biomarcadores ── */}
      {tab === 'biomarcadores' && (
        <div>
          {!status?.has_results ? (
            <NoResults />
          ) : bioLoading ? (
            <Loading label="Carregando biomarcadores…" />
          ) : bioData ? (
            <div>
              <div className="plot-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className="section-title" style={{ marginBottom: 0 }}>Biomarcadores diferenciais</span>
                  <span className="badge badge-purple">{bioData.method.toUpperCase()}</span>
                  {bioData.comparison && (
                    <span className="badge badge-cyan">{bioData.comparison}</span>
                  )}
                  <span className="badge badge-green">{(bioData.markers as BiomarkerEntry[]).length} significativos</span>
                </div>
                {bioData.note && (
                  <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>{bioData.note}</div>
                )}
                {bioTrace ? (
                  <Plot
                    data={[bioTrace]}
                    layout={{
                      ...DARK_LAYOUT,
                      height: Math.max(320, Math.min(bioData.markers.length * 22 + 60, 700)),
                      autosize: true,
                      margin: { t: 20, b: 52, l: 180, r: 20 },
                      xaxis: { ...AXIS, title: { text: 'log2 fold change' }, zeroline: true },
                      yaxis: { ...AXIS, automargin: true },
                    } as Partial<Plotly.Layout>}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 0' }}>
                    Nenhum biomarcador significativo encontrado.
                    {bioData.note && <span> {bioData.note}</span>}
                  </div>
                )}
              </div>

              {/* Markers table */}
              {(bioData.markers as BiomarkerEntry[]).length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                    Tabela de biomarcadores
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                          {['Taxon','Direção','log2FC','q-valor'].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Taxon' ? 'left' : 'right', color: 'var(--text-2)', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(bioData.markers as BiomarkerEntry[])
                          .sort((a, b) => Math.abs(b.effect_size) - Math.abs(a.effect_size))
                          .map((m, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>{m.taxon}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              <span className={`badge ${m.direction === 'enriched' ? 'badge-green' : 'badge-red'}`}>
                                {m.direction === 'enriched' ? '↑ enriquecido' : '↓ depletado'}
                              </span>
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: m.effect_size > 0 ? 'var(--green)' : 'var(--red)' }}>
                              {m.effect_size > 0 ? '+' : ''}{m.effect_size.toFixed(3)}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                              {m.p_value < 0.001 ? m.p_value.toExponential(2) : m.p_value.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

// ── Helper components ──────────────────────────────────────────────────────────

function NoResults() {
  return (
    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
        Nenhuma análise metagenômica concluída para este projeto.
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Vá para a aba <strong style={{ color: 'var(--text-2)' }}>① Entrada</strong> e inicie o pipeline.
      </div>
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.2s infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{label}</span>
    </div>
  )
}
