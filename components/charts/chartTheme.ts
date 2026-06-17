// Tema escuro compartilhado dos gráficos Plotly (extraído de app/analysis/[id]).
import type { Layout } from 'plotly.js'

export const DARK: Partial<Layout> = {
  paper_bgcolor: '#0a1628',
  plot_bgcolor: '#050d1a',
  font: { color: '#e2eeff', family: 'Inter, system-ui', size: 12 },
  margin: { t: 48, b: 56, l: 70, r: 24 },
  legend: {
    bgcolor: 'rgba(10,22,40,0.8)',
    bordercolor: 'rgba(0,212,255,0.15)',
    borderwidth: 1,
    font: { color: '#7a9cc0', size: 11 },
  },
  hoverlabel: { bgcolor: '#0f1e38', bordercolor: '#00d4ff', font: { color: '#e2eeff' } },
}

export const AXIS = {
  gridcolor: 'rgba(0,212,255,0.07)',
  zerolinecolor: 'rgba(0,212,255,0.2)',
  tickfont: { color: '#7a9cc0' },
}

export const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const

// Paleta categórica para guildas/grupos
export const PALETTE = [
  '#00d4ff', '#a855f7', '#10d48a', '#f59e0b', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#eab308', '#8b5cf6',
]
