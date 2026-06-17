'use client'

import dynamic from 'next/dynamic'
import type { FunguildAnnotation } from '@/lib/api'
import { DARK, PLOT_CONFIG, PALETTE } from './chartTheme'
import { countBy } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** FUNGuild: distribuição de táxons por modo trófico (donut). */
export default function DonutChart({ annotations }: { annotations: FunguildAnnotation[] }) {
  const dist = countBy(annotations, a => a.trophic_mode, 'Não atribuído')

  return (
    <Plot
      data={[{
        type: 'pie', hole: 0.55,
        labels: dist.map(d => d.label),
        values: dist.map(d => d.count),
        textinfo: 'label+percent',
        hovertemplate: '<b>%{label}</b><br>%{value} táxons (%{percent})<extra></extra>',
        marker: { colors: PALETTE, line: { color: '#0a1628', width: 1 } },
      }]}
      layout={{
        ...DARK,
        title: { text: 'Modo trófico (FUNGuild)', font: { color: '#00d4ff', size: 14 }, x: 0.02 },
        height: 380, autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
