'use client'

import dynamic from 'next/dynamic'
import type { AncombcTaxon } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { topN } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** ANCOM-BC2: LFC por táxon (top 30 por |LFC|), destacando os diferencialmente abundantes. */
export default function BarLollipop({ taxa }: { taxa: AncombcTaxon[] }) {
  const top = topN(taxa, t => Math.abs(t.lfc), 30).reverse() // maior no topo

  return (
    <Plot
      data={[{
        type: 'bar', orientation: 'h',
        x: top.map(t => t.lfc),
        y: top.map(t => t.taxon),
        text: top.map(t => `q=${t.q_val < 0.001 ? t.q_val.toExponential(1) : t.q_val.toFixed(3)}`),
        hovertemplate: '<b>%{y}</b><br>LFC: %{x:.3f}<br>%{text}<extra></extra>',
        marker: {
          color: top.map(t => (t.diff_abn ? (t.lfc > 0 ? '#00d4ff' : '#ef4444') : '#3a5578')),
        },
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 220 },
        xaxis: { ...AXIS, title: { text: 'log₂ Fold Change (ANCOM-BC2)', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(360, top.length * 20 + 80), autosize: true,
        shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(0,212,255,0.25)', width: 1 } }],
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
