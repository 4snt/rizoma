import { describe, it, expect } from 'vitest'
import { ANALYSES_CATALOG } from '@/lib/analyses-catalog'

const SHARED_KEYS = ['spieceasi', 'random_forest', 'gsea']

describe('ANALYSES_CATALOG', () => {
  it('16S traz as análises específicas de 16S', () => {
    const keys = ANALYSES_CATALOG['16S'].map(a => a.key)
    expect(keys).toEqual(expect.arrayContaining(['deseq2', 'maaslin2', 'picrust2']))
    expect(keys).not.toContain('ancombc2')
    expect(keys).not.toContain('funguild')
  })

  it('ITS traz as análises específicas de ITS', () => {
    const keys = ANALYSES_CATALOG['ITS'].map(a => a.key)
    expect(keys).toEqual(expect.arrayContaining(['ancombc2', 'funguild']))
    expect(keys).not.toContain('deseq2')
    expect(keys).not.toContain('picrust2')
  })

  it('as análises compartilhadas aparecem nos dois markers', () => {
    for (const marker of ['16S', 'ITS'] as const) {
      const keys = ANALYSES_CATALOG[marker].map(a => a.key)
      expect(keys).toEqual(expect.arrayContaining(SHARED_KEYS))
    }
  })

  it('toda análise tem pelo menos um gráfico e chaves não repetem', () => {
    for (const marker of ['16S', 'ITS'] as const) {
      const keys = ANALYSES_CATALOG[marker].map(a => a.key)
      expect(new Set(keys).size).toBe(keys.length) // sem duplicatas
      for (const a of ANALYSES_CATALOG[marker]) {
        expect(a.charts.length).toBeGreaterThan(0)
        expect(a.label).toBeTruthy()
      }
    }
  })
})
