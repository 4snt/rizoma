'use client'

import dynamic from 'next/dynamic'
import type { AlphaPoint } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG, PALETTE } from './chartTheme'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

function groupColor(groups: string[], g: string) {
  const idx = Array.from(new Set(groups)).indexOf(g)
  return PALETTE[idx % PALETTE.length]
}

/** Diversidade alfa: boxplot do índice de Shannon por grupo de tratamento. */
export default function AlphaBox({ alpha }: { alpha: AlphaPoint[] }) {
  const groups = Array.from(new Set(alpha.map(p => p.treatment_group)))
  const data = groups.map(g => ({
    type: 'box' as const,
    name: g,
    y: alpha.filter(p => p.treatment_group === g).map(p => p.shannon),
    marker: { color: groupColor(groups, g) },
    fillcolor: groupColor(groups, g) + '22',
    line: { color: groupColor(groups, g) },
  }))

  return (
    <Plot
      data={data}
      layout={{
        ...DARK,
        yaxis: { ...AXIS, title: { text: 'Shannon', standoff: 8 } },
        xaxis: { ...AXIS },
        height: 380, autosize: true, showlegend: false,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
