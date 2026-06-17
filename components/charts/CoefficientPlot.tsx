'use client'

import dynamic from 'next/dynamic'
import type { Maaslin2Association } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { topN } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** MaAsLin2: coeficiente por feature (top 30 por |coef|); destaque para qval < 0.05. */
export default function CoefficientPlot({ associations }: { associations: Maaslin2Association[] }) {
  const top = topN(associations, a => Math.abs(a.coef), 30).reverse()

  return (
    <Plot
      data={[{
        type: 'scatter', mode: 'markers',
        x: top.map(a => a.coef),
        y: top.map(a => `${a.feature} · ${a.metadata}`),
        text: top.map(a => `q=${a.qval < 0.001 ? a.qval.toExponential(1) : a.qval.toFixed(3)}`),
        hovertemplate: '<b>%{y}</b><br>coef: %{x:.3f}<br>%{text}<extra></extra>',
        marker: {
          size: 10,
          color: top.map(a => (a.qval < 0.05 ? '#00d4ff' : '#3a5578')),
          line: { color: 'rgba(0,0,0,0.3)', width: 0.5 },
        },
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 240 },
        xaxis: { ...AXIS, title: { text: 'Coeficiente (MaAsLin2)', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(360, top.length * 22 + 80), autosize: true,
        shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(0,212,255,0.25)', width: 1 } }],
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
