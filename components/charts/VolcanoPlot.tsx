'use client'

import dynamic from 'next/dynamic'
import type { DeseqDeg } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export function isSig(d: DeseqDeg) {
  return Math.abs(d.log2_fold_change) > 1 && d.p_adjusted < 0.05
}

export default function VolcanoPlot({ degs }: { degs: DeseqDeg[] }) {
  const sig = degs.filter(isSig)
  const ns = degs.filter(d => !isSig(d))

  return (
    <Plot
      data={[
        {
          type: 'scatter', mode: 'markers', name: 'Não significativo',
          x: ns.map(d => d.log2_fold_change),
          y: ns.map(d => -Math.log10(d.p_adjusted)),
          text: ns.map(d => d.gene_id),
          hovertemplate: '<b>%{text}</b><br>log2FC: %{x:.3f}<br>-log10(padj): %{y:.3f}<extra></extra>',
          marker: { color: '#3a5578', size: 4, opacity: 0.5 },
        },
        {
          type: 'scatter', mode: 'markers', name: 'Significativo',
          x: sig.map(d => d.log2_fold_change),
          y: sig.map(d => -Math.log10(d.p_adjusted)),
          text: sig.map(d => d.gene_id),
          hovertemplate: '<b>%{text}</b><br>log2FC: %{x:.3f}<br>-log10(padj): %{y:.3f}<extra></extra>',
          marker: { color: '#00d4ff', size: 7, opacity: 0.9, line: { color: 'rgba(0,0,0,0.3)', width: 0.5 } },
        },
      ]}
      layout={{
        ...DARK,
        xaxis: { ...AXIS, title: { text: 'log₂ Fold Change', standoff: 8 } },
        yaxis: { ...AXIS, title: { text: '-log₁₀(padj)', standoff: 8 } },
        shapes: [
          { type: 'line', x0: -1, x1: -1, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
          { type: 'line', x0: 1, x1: 1, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
          { type: 'line', x0: -10, x1: 10, y0: -Math.log10(0.05), y1: -Math.log10(0.05), line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
        ],
        height: 380, autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
