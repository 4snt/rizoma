'use client'

import dynamic from 'next/dynamic'
import type { Picrust2Pathway } from '@/lib/api'
import { DARK, AXIS, PLOT_CONFIG } from './chartTheme'
import { topN } from '@/lib/chart-data'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

/** PICRUSt2: top 25 vias funcionais por abundância média predita. */
export default function FunctionalBar({ pathways }: { pathways: Picrust2Pathway[] }) {
  const top = topN(pathways, p => p.mean_abundance, 25).reverse()

  return (
    <Plot
      data={[{
        type: 'bar', orientation: 'h',
        x: top.map(p => p.mean_abundance),
        y: top.map(p => p.pathway_id),
        hovertemplate: '<b>%{y}</b><br>abundância média: %{x:.2f}<extra></extra>',
        marker: { color: '#10d48a' },
      }]}
      layout={{
        ...DARK,
        margin: { ...DARK.margin, l: 200 },
        title: { text: 'Vias funcionais preditas (PICRUSt2)', font: { color: '#00d4ff', size: 14 }, x: 0.02 },
        xaxis: { ...AXIS, title: { text: 'Abundância média', standoff: 8 } },
        yaxis: { ...AXIS, automargin: true, tickfont: { color: '#7a9cc0', size: 10 } },
        height: Math.max(360, top.length * 22 + 80), autosize: true,
      } as Partial<Plotly.Layout>}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
