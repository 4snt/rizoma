'use client'

import dynamic from 'next/dynamic'
import type { GseaPathway } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { parseRatio, topN } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** GSEA/clusterProfiler: x=gene ratio, y=via; tamanho/cor pela significância. */
export default function BubblePlot({ pathways }: { pathways: GseaPathway[] }) {
  const top = topN(pathways, p => parseRatio(p.gene_ratio), 25).reverse()
  const ratios = top.map(p => parseRatio(p.gene_ratio))

  return (
    <Plot
      data={[{
        type: 'scatter', mode: 'markers',
        x: ratios,
        y: top.map(p => p.description),
        text: top.map(p => `${p.go_id} · p.adj=${p.p_adjust < 0.001 ? p.p_adjust.toExponential(1) : p.p_adjust.toFixed(3)}`),
        hovertemplate: '<b>%{y}</b><br>gene ratio: %{x:.3f}<br>%{text}<extra></extra>',
        marker: {
          size: top.map(p => 8 + parseRatio(p.gene_ratio) * 40),
          color: top.map(p => -Math.log10(p.p_adjust + 1e-300)),
          colorscale: 'Viridis',
          colorbar: { title: { text: '-log₁₀(p.adj)' }, tickfont: { color: '#7a9cc0' } },
          line: { color: 'rgba(0,0,0,0.3)', width: 0.5 },
        },
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 280 },
        xaxis: { ...AXIS, title: { text: 'Gene Ratio', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(360, top.length * 24 + 80), autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
