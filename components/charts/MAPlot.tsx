'use client'

import dynamic from 'next/dynamic'
import type { DeseqDeg } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { isSig } from './VolcanoPlot'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export default function MAPlot({ degs }: { degs: DeseqDeg[] }) {
  const sig = degs.filter(isSig)
  const ns = degs.filter(d => !isSig(d))

  return (
    <Plot
      data={[
        {
          type: 'scatter', mode: 'markers', name: 'Não significativo',
          x: ns.map(d => Math.log2(d.base_mean + 1)),
          y: ns.map(d => d.log2_fold_change),
          text: ns.map(d => d.gene_id),
          hovertemplate: '<b>%{text}</b><br>log2(mean): %{x:.2f}<br>log2FC: %{y:.3f}<extra></extra>',
          marker: { color: '#3a5578', size: 4, opacity: 0.5 },
        },
        {
          type: 'scatter', mode: 'markers', name: 'Significativo',
          x: sig.map(d => Math.log2(d.base_mean + 1)),
          y: sig.map(d => d.log2_fold_change),
          text: sig.map(d => d.gene_id),
          hovertemplate: '<b>%{text}</b><br>log2(mean): %{x:.2f}<br>log2FC: %{y:.3f}<extra></extra>',
          marker: { color: '#00d4ff', size: 7, opacity: 0.9 },
        },
      ]}
      layout={{
        ...DARK,
        xaxis: { ...AXIS, title: { text: 'log₂ Mean Expression', standoff: 8 } },
        yaxis: { ...AXIS, title: { text: 'log₂ Fold Change', standoff: 8 } },
        shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: 'rgba(0,212,255,0.3)', width: 1 } }],
        height: 380, autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
