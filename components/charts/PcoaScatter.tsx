'use client'

import dynamic from 'next/dynamic'
import type { OrdinationResult } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG, PALETTE } from './chartTheme'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

function groupColor(groups: string[], g: string) {
  const idx = Array.from(new Set(groups)).indexOf(g)
  return PALETTE[idx % PALETTE.length]
}

/** Ordenação PCoA (PC1 × PC2) colorida por grupo, com variância explicada nos eixos. */
export default function PcoaScatter({ ord }: { ord: OrdinationResult }) {
  const pts = ord.points ?? []
  const groups = Array.from(new Set(pts.map(p => p.treatment_group)))
  const v = ord.variance_explained ?? []
  const data = groups.map(g => ({
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: g,
    x: pts.filter(p => p.treatment_group === g).map(p => p.axis1),
    y: pts.filter(p => p.treatment_group === g).map(p => p.axis2),
    text: pts.filter(p => p.treatment_group === g).map(p => p.sample_id),
    hovertemplate: '%{text}<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>',
    marker: { color: groupColor(groups, g), size: 9, line: { color: '#000', width: 0.5 } },
  }))

  return (
    <Plot
      data={data}
      layout={{
        ...DARK,
        xaxis: { ...AXIS, title: { text: `PC1 (${v[0]?.toFixed(1) ?? '?'}%)`, standoff: 8 } },
        yaxis: { ...AXIS, title: { text: `PC2 (${v[1]?.toFixed(1) ?? '?'}%)`, standoff: 8 } },
        height: 420, autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
