'use client'

import dynamic from 'next/dynamic'
import type { BiomarkerEntry } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** Biomarcadores (ANCOM-BC2): barra divergente de effect size, top 30 por |LFC|. */
export default function BiomarkerBar({ markers }: { markers: BiomarkerEntry[] }) {
  const top = [...markers]
    .sort((a, b) => Math.abs(b.effect_size) - Math.abs(a.effect_size))
    .slice(0, 30)
    .reverse()

  return (
    <Plot
      data={[{
        type: 'bar', orientation: 'h',
        y: top.map(m => m.taxon),
        x: top.map(m => m.effect_size),
        marker: { color: top.map(m => (m.effect_size > 0 ? '#10d48a' : '#ef4444')) },
        hovertemplate: '<b>%{y}</b><br>log2FC: %{x:.3f}<extra></extra>',
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 220 },
        xaxis: { ...AXIS, title: { text: 'Effect size (log₂FC)', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(360, top.length * 20 + 80), autosize: true,
        shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(0,212,255,0.25)', width: 1 } }],
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
