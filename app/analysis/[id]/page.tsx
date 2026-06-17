'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  api,
  type AnalysisResult,
  type DeseqResult, type DeseqDeg,
  type AncombcResult, type Maaslin2Result,
  type GseaResult, type FunguildResult, type Picrust2Result,
} from '@/lib/api'

import VolcanoPlot, { isSig } from '@/components/charts/VolcanoPlot'
import MAPlot from '@/components/charts/MAPlot'
import BarLollipop from '@/components/charts/BarLollipop'
import CoefficientPlot from '@/components/charts/CoefficientPlot'
import BubblePlot from '@/components/charts/BubblePlot'
import DonutChart from '@/components/charts/DonutChart'
import GuildBar from '@/components/charts/GuildBar'
import FunctionalBar from '@/components/charts/FunctionalBar'

// ── Helpers de UI ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: color ?? 'var(--cyan)' }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function fmtP(p: number) {
  if (p === 0) return '< 1e-300'
  if (p < 0.001) return p.toExponential(2)
  return p.toFixed(4)
}

/** Tabela genérica de resultados (colunas configuráveis). */
function ResultTable({ title, columns, rows }: {
  title: string
  columns: { key: string; label: string; align?: 'left' | 'right' }[]
  rows: Record<string, unknown>[]
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows
  const grid = columns.map(c => (c.align === 'right' ? '140px' : '1fr')).join(' ')

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {title}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            {filtered.length} de {rows.length}
          </span>
        </span>
        <input
          type="text" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 10px', fontSize: 12, fontFamily: 'var(--mono)', width: 220 }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: grid, padding: '8px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        {columns.map(c => (
          <span key={c.key} style={{ color: 'var(--text-3)', textAlign: c.align ?? 'left' }}>{c.label}</span>
        ))}
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {filtered.slice(0, 500).map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, padding: '7px 16px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
            {columns.map(c => (
              <span key={c.key} className="mono" style={{ color: 'var(--text-2)', textAlign: c.align ?? 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(r[c.key] ?? '')}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Renderizadores por tipo ──────────────────────────────────────────────────

function DeseqView({ data }: { data: DeseqResult }) {
  const degs = data.degs ?? []
  const sig = degs.filter(isSig)
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="ASVs testados" value={degs.length} color="var(--text)" />
        <StatCard label="Significativos" value={data.n_significant ?? sig.length} color="var(--cyan)" />
        <StatCard label="Up-regulated" value={sig.filter(d => d.log2_fold_change > 0).length} color="var(--green)" />
        <StatCard label="Down-regulated" value={sig.filter(d => d.log2_fold_change < 0).length} color="var(--red)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <ChartCard title="Volcano Plot"><VolcanoPlot degs={degs} /></ChartCard>
        <ChartCard title="MA Plot"><MAPlot degs={degs} /></ChartCard>
      </div>
      <ResultTable
        title="Resultados DESeq2"
        columns={[
          { key: 'gene_id', label: 'ASV ID' },
          { key: 'log2_fold_change', label: 'log2FC', align: 'right' },
          { key: 'p_adjusted', label: 'padj', align: 'right' },
          { key: 'base_mean', label: 'Base Mean', align: 'right' },
        ]}
        rows={degs.map((d: DeseqDeg) => ({
          gene_id: d.gene_id,
          log2_fold_change: d.log2_fold_change.toFixed(3),
          p_adjusted: fmtP(d.p_adjusted),
          base_mean: d.base_mean.toFixed(1),
        }))}
      />
    </>
  )
}

function AncombcView({ data }: { data: AncombcResult }) {
  const taxa = data.taxa ?? []
  const sig = taxa.filter(t => t.diff_abn)
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Táxons testados" value={taxa.length} color="var(--text)" />
        <StatCard label="Diferenciais" value={sig.length} color="var(--cyan)" />
      </div>
      <div style={{ marginBottom: 28 }}>
        <ChartCard title="Log Fold Change por táxon (ANCOM-BC2)"><BarLollipop taxa={taxa} /></ChartCard>
      </div>
      <ResultTable
        title="Resultados ANCOM-BC2"
        columns={[
          { key: 'taxon', label: 'Táxon' },
          { key: 'lfc', label: 'LFC', align: 'right' },
          { key: 'q_val', label: 'q-value', align: 'right' },
          { key: 'diff_abn', label: 'Diferencial', align: 'right' },
        ]}
        rows={taxa.map(t => ({ taxon: t.taxon, lfc: t.lfc.toFixed(3), q_val: fmtP(t.q_val), diff_abn: t.diff_abn ? 'sim' : '—' }))}
      />
    </>
  )
}

function Maaslin2View({ data }: { data: Maaslin2Result }) {
  const assoc = data.associations ?? []
  const sig = assoc.filter(a => a.qval < 0.05)
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Associações" value={assoc.length} color="var(--text)" />
        <StatCard label="Significativas (q<0.05)" value={sig.length} color="var(--cyan)" />
      </div>
      <div style={{ marginBottom: 28 }}>
        <ChartCard title="Coeficientes (MaAsLin2)"><CoefficientPlot associations={assoc} /></ChartCard>
      </div>
      <ResultTable
        title="Resultados MaAsLin2"
        columns={[
          { key: 'feature', label: 'Feature' },
          { key: 'metadata', label: 'Metadata' },
          { key: 'coef', label: 'Coef', align: 'right' },
          { key: 'qval', label: 'q-value', align: 'right' },
        ]}
        rows={assoc.map(a => ({ feature: a.feature, metadata: a.metadata, coef: a.coef.toFixed(3), qval: fmtP(a.qval) }))}
      />
    </>
  )
}

function GseaView({ data }: { data: GseaResult }) {
  const pw = data.pathways ?? []
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Vias enriquecidas" value={pw.length} color="var(--cyan)" />
        <StatCard label="Método" value={(data.method ?? '—').toUpperCase()} color="var(--text-2)" />
      </div>
      <div style={{ marginBottom: 28 }}>
        <ChartCard title="Enriquecimento de vias (GSEA / clusterProfiler)"><BubblePlot pathways={pw} /></ChartCard>
      </div>
      <ResultTable
        title="Vias"
        columns={[
          { key: 'go_id', label: 'ID' },
          { key: 'description', label: 'Descrição' },
          { key: 'gene_ratio', label: 'Gene Ratio', align: 'right' },
          { key: 'p_adjust', label: 'p.adj', align: 'right' },
        ]}
        rows={pw.map(p => ({ go_id: p.go_id, description: p.description, gene_ratio: String(p.gene_ratio), p_adjust: fmtP(p.p_adjust) }))}
      />
    </>
  )
}

function FunguildView({ data }: { data: FunguildResult }) {
  const ann = data.annotations ?? []
  const assigned = ann.filter(a => a.guild)
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Táxons" value={ann.length} color="var(--text)" />
        <StatCard label="Com guilda" value={assigned.length} color="var(--cyan)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <ChartCard title="Modo trófico"><DonutChart annotations={ann} /></ChartCard>
        <ChartCard title="Guildas"><GuildBar annotations={ann} /></ChartCard>
      </div>
      <ResultTable
        title="Anotações FUNGuild"
        columns={[
          { key: 'taxon', label: 'Táxon' },
          { key: 'guild', label: 'Guilda' },
          { key: 'trophic_mode', label: 'Modo trófico' },
          { key: 'confidence_ranking', label: 'Confiança', align: 'right' },
        ]}
        rows={ann.map(a => ({ taxon: a.taxon, guild: a.guild ?? '—', trophic_mode: a.trophic_mode ?? '—', confidence_ranking: a.confidence_ranking ?? '—' }))}
      />
    </>
  )
}

function Picrust2View({ data }: { data: Picrust2Result }) {
  const pw = data.pathways ?? []
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Vias preditas" value={pw.length} color="var(--cyan)" />
      </div>
      <div style={{ marginBottom: 28 }}>
        <ChartCard title="Predição funcional (PICRUSt2)"><FunctionalBar pathways={pw} /></ChartCard>
      </div>
      <ResultTable
        title="Vias funcionais"
        columns={[
          { key: 'pathway_id', label: 'Pathway' },
          { key: 'mean_abundance', label: 'Abundância média', align: 'right' },
        ]}
        rows={pw.map(p => ({ pathway_id: p.pathway_id, mean_abundance: p.mean_abundance.toFixed(2) }))}
      />
    </>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

const TITLES: Record<string, string> = {
  deseq2: 'DESeq2', ancombc2: 'ANCOM-BC2', maaslin2: 'MaAsLin2',
  gsea: 'GSEA / clusterProfiler', funguild: 'FUNGuild', picrust2: 'PICRUSt2',
}

export default function AnalysisPage() {
  const params = useParams()
  const jobId = params?.id as string
  const shortId = jobId?.slice(0, 8)

  const { data, error, isLoading } = useSWR(
    jobId ? ['analysis', jobId] : null,
    () => api.getAnalysisResults(jobId),
  )

  const result = (data?.[0] as AnalysisResult | undefined)
  const type = result?.analysis_type ?? 'deseq2'
  const rd = result?.result_data as Record<string, unknown> | undefined

  if (isLoading) return (
    <div style={{ padding: 32 }}>
      <div className="skeleton" style={{ height: 28, width: 300, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 500, borderRadius: 8 }} />
    </div>
  )

  if (error) return (
    <div className="card" style={{ padding: 24, color: 'var(--red)', margin: 24 }}>
      ⚠ Erro ao carregar resultados. Verifique se o job existe.
    </div>
  )

  function renderByType() {
    if (!rd) {
      return (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Sem resultados</span>
          <span className="empty-state-desc">O job não gerou dados.</span>
        </div>
      )
    }
    switch (type) {
      case 'deseq2':   return <DeseqView   data={rd as unknown as DeseqResult} />
      case 'ancombc2': return <AncombcView data={rd as unknown as AncombcResult} />
      case 'maaslin2': return <Maaslin2View data={rd as unknown as Maaslin2Result} />
      case 'gsea':     return <GseaView    data={rd as unknown as GseaResult} />
      case 'funguild': return <FunguildView data={rd as unknown as FunguildResult} />
      case 'picrust2': return <Picrust2View data={rd as unknown as Picrust2Result} />
      case 'spieceasi':
        return (
          <div className="card" style={{ padding: 24 }}>
            Esta análise é uma rede microbiana. <Link href={`/network/${jobId}`} style={{ color: 'var(--cyan)' }}>Abrir visualização de rede →</Link>
          </div>
        )
      default:
        return (
          <div className="card" style={{ padding: 24, color: 'var(--text-2)' }}>
            Tipo de análise <strong>{type}</strong> ainda sem visualização dedicada.
          </div>
        )
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Análise</span>
        <span className="breadcrumb-sep">/</span>
        <span className="mono">{shortId}…</span>
      </div>

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">{TITLES[type] ?? type.toUpperCase()}</h1>
          <span className="badge badge-cyan" style={{ fontSize: 11 }}>done</span>
        </div>
        <p className="page-subtitle mono" style={{ marginTop: 4 }}>{jobId}</p>
      </div>

      {renderByType()}
    </>
  )
}
