import { describe, it, expect } from 'vitest'
import { IUPAC_NUCLEOTIDES, parseFasta, toFasta } from '@/lib/fasta'

describe('parseFasta', () => {
  it('FASTA com header e quebras de linha', () => {
    const out = parseFasta('>NEBIM0001 16S rRNA\nACGTAC\r\nGTACGT\nAC\n')
    expect(out.header).toBe('NEBIM0001 16S rRNA')
    expect(out.sequence).toBe('ACGTACGTACGTAC')
    expect(out.length).toBe(14)
    expect(out.invalidChars).toEqual([])
  })

  it('sequência crua minúscula, sem header', () => {
    const out = parseFasta('acgtnn')
    expect(out.header).toBeNull()
    expect(out.sequence).toBe('ACGTNN')
    expect(out.length).toBe(6)
  })

  it('formato GenBank: dígitos e espaços são removidos', () => {
    const out = parseFasta('        1 acgtacgtac gtacgtacgt\n       21 acgt')
    expect(out.header).toBeNull()
    expect(out.sequence).toBe('ACGTACGTACGTACGTACGTACGT')
    expect(out.length).toBe(24)
  })

  it('caracteres inválidos: únicos, na ordem; "*" final é tolerado', () => {
    const out = parseFasta('ACGXTZXQ*')
    expect(out.sequence).toBe('ACGXTZXQ')
    expect(out.invalidChars).toEqual(['X', 'Z', 'Q'])
  })

  it('GC%: (G+C+S)/length, 1 casa; null em sequência vazia', () => {
    expect(parseFasta('GGCCAATT').gcPercent).toBe(50)
    expect(parseFasta('GCS').gcPercent).toBe(100)
    expect(parseFasta('GCA').gcPercent).toBe(66.7)
    expect(parseFasta('>only header\n').gcPercent).toBeNull()
    expect(parseFasta('').length).toBe(0)
  })

  it('aceita todo o alfabeto IUPAC e o gap', () => {
    expect(parseFasta(IUPAC_NUCLEOTIDES.toLowerCase()).invalidChars).toEqual([])
  })
})

describe('toFasta', () => {
  it('quebra em linhas de 70 e inclui o header', () => {
    const seq = 'A'.repeat(150)
    const out = toFasta('seq1', seq)
    const lines = out.trimEnd().split('\n')
    expect(lines[0]).toBe('>seq1')
    expect(lines[1]).toHaveLength(70)
    expect(lines[2]).toHaveLength(70)
    expect(lines[3]).toHaveLength(10)
  })

  it('sem header omite a linha ">"', () => {
    expect(toFasta(null, 'ACGT')).toBe('ACGT\n')
    expect(toFasta('x', 'ACGTACGT', 4)).toBe('>x\nACGT\nACGT\n')
  })
})
