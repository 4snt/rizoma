import { describe, it, expect } from 'vitest'
import { autoPair, dada2Defaults, toCsv } from '@/lib/metagenomics-utils'

// Mock leve de File — autoPair só usa `.name`
const f = (name: string) => ({ name } as File)

describe('autoPair', () => {
  it('pareia R1/R2 pelo padrão _R1_/_R2_', () => {
    const { pairs, unmatched } = autoPair([
      f('16S-A04_T2B1_L001_R1_001.fastq.gz'),
      f('16S-A04_T2B1_L001_R2_001.fastq.gz'),
      f('ITS-B01_T1B2_L001_R1_001.fastq.gz'),
      f('ITS-B01_T1B2_L001_R2_001.fastq.gz'),
    ])
    expect(pairs).toHaveLength(2)
    expect(unmatched).toHaveLength(0)
    expect(pairs[0].name).toContain('_R1_')
  })

  it('reporta R1 sem R2 correspondente', () => {
    const { pairs, unmatched } = autoPair([
      f('16S-A04_T2B1_L001_R1_001.fastq.gz'),
    ])
    expect(pairs).toHaveLength(0)
    expect(unmatched).toEqual(['16S-A04_T2B1_L001_R1_001.fastq.gz'])
  })

  it('ignora arquivos sem padrão de par', () => {
    const { pairs, unmatched } = autoPair([f('leiame.txt'), f('amostra.fastq.gz')])
    expect(pairs).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })
})

describe('dada2Defaults', () => {
  it('16S usa truncagem 230/180', () => {
    const d = dada2Defaults('16S')
    expect(d.trunc_len_f).toBe(230)
    expect(d.trunc_len_r).toBe(180)
    expect(d.chimera_method).toBe('consensus')
  })

  it('ITS sem truncagem (0/0) e minLen 50', () => {
    const d = dada2Defaults('ITS')
    expect(d.trunc_len_f).toBe(0)
    expect(d.trunc_len_r).toBe(0)
    expect(d.min_len).toBe(50)
  })
})

describe('toCsv', () => {
  it('inclui BOM UTF-8 e separa por vírgula', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"a","b"')
    expect(csv).toContain('"1","2"')
  })

  it('faz escape de aspas duplicando-as', () => {
    const csv = toCsv(['x'], [['valor "com" aspas']])
    expect(csv).toContain('"valor ""com"" aspas"')
  })
})
