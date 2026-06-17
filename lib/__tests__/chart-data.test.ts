import { describe, it, expect } from 'vitest'
import { parseRatio, topN, countBy } from '@/lib/chart-data'

describe('parseRatio', () => {
  it('converte "3/100" em fração', () => {
    expect(parseRatio('3/100')).toBeCloseTo(0.03)
  })
  it('aceita número direto', () => {
    expect(parseRatio(0.25)).toBe(0.25)
  })
  it('trata denominador zero e lixo', () => {
    expect(parseRatio('5/0')).toBe(0)
    expect(parseRatio('abc')).toBe(0)
  })
})

describe('topN', () => {
  it('retorna os N maiores por chave, sem mutar', () => {
    const arr = [{ v: 1 }, { v: 9 }, { v: 5 }, { v: 3 }]
    const out = topN(arr, x => x.v, 2)
    expect(out.map(x => x.v)).toEqual([9, 5])
    expect(arr[0].v).toBe(1) // entrada intacta
  })
})

describe('countBy', () => {
  it('conta por categoria e ordena desc', () => {
    const items = [{ g: 'a' }, { g: 'b' }, { g: 'a' }, { g: 'a' }]
    expect(countBy(items, x => x.g)).toEqual([
      { label: 'a', count: 3 },
      { label: 'b', count: 1 },
    ])
  })
  it('usa fallback para nulo/vazio', () => {
    const items = [{ g: null }, { g: '' }, { g: 'x' }]
    const out = countBy(items, x => x.g, 'N/A')
    expect(out.find(o => o.label === 'N/A')?.count).toBe(2)
  })
})
