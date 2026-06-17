'use client'

import dynamic from 'next/dynamic'
import type { FunguildAnnotation } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { countBy } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** FUNGuild: contagem de táxons por guilda (barras horizontais, top 20). */
export default function GuildBar({ annotations }: { annotations: FunguildAnnotation[] }) {
  const dist = countBy(annotations, a => a.guild, 'Não atribuído').slice(0, 20).reverse()

  return (
    <Plot
      data={[{
        type: 'bar', orientation: 'h',
        x: dist.map(d => d.count),
        y: dist.map(d => d.label),
        hovertemplate: '<b>%{y}</b><br>%{x} táxons<extra></extra>',
        marker: { color: '#a855f7' },
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 240 },
        title: { text: 'Guildas (FUNGuild)', font: { color: '#00d4ff', size: 14 }, x: 0.02 },
        xaxis: { ...AXIS, title: { text: 'Nº de táxons', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(320, dist.length * 22 + 80), autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
