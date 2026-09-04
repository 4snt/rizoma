/**
 * Utilitários FASTA (puros, sem React).
 *
 * `parseFasta` espelha a normalização feita pelo backend ao receber
 * `CreateSampleGeneBody.sequence`: o que o usuário cola (FASTA, GenBank
 * numerado, sequência crua em minúsculas) vira uma string só de nucleotídeos
 * em maiúsculas. O frontend só usa isso para pré-visualizar comprimento, GC%
 * e caracteres inválidos antes de enviar — a fonte de verdade continua sendo
 * o servidor.
 */

/** Alfabeto IUPAC de nucleotídeos + gap. Qualquer coisa fora disso é inválida. */
export const IUPAC_NUCLEOTIDES = 'ACGTURYKMSWBDHVN-'

export interface ParsedFasta {
  /** Texto da 1ª linha sem o `>`; null quando não há header. */
  header: string | null
  /** Sequência normalizada (uppercase, sem espaços/dígitos/quebras/`*` final). */
  sequence: string
  length: number
  /** (G + C + S) / length × 100, 1 casa decimal; null se a sequência é vazia. */
  gcPercent: number | null
  /** Caracteres fora do IUPAC, únicos, na ordem em que aparecem. */
  invalidChars: string[]
}

export function parseFasta(text: string): ParsedFasta {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Header: só se a primeira linha não-vazia começar com '>'.
  let header: string | null = null
  let firstIdx = 0
  while (firstIdx < lines.length && lines[firstIdx].trim() === '') firstIdx++
  if (firstIdx < lines.length && lines[firstIdx].trimStart().startsWith('>')) {
    header = lines[firstIdx].trimStart().slice(1).trim()
    firstIdx++
  }

  let sequence = lines
    .slice(firstIdx)
    .join('')
    .replace(/[\s\d]/g, '') // espaços, quebras e a numeração do formato GenBank
    .toUpperCase()
  sequence = sequence.replace(/\*+$/, '') // terminador de tradução no fim

  const invalidChars: string[] = []
  for (const ch of sequence) {
    if (!IUPAC_NUCLEOTIDES.includes(ch) && !invalidChars.includes(ch)) invalidChars.push(ch)
  }

  const length = sequence.length
  let gcPercent: number | null = null
  if (length > 0) {
    let gc = 0
    for (const ch of sequence) if (ch === 'G' || ch === 'C' || ch === 'S') gc++
    gcPercent = Math.round((gc / length) * 1000) / 10
  }

  return { header, sequence, length, gcPercent, invalidChars }
}

/** Serializa em FASTA: `>header\n` (se houver) + linhas de `width` colunas. */
export function toFasta(header: string | null, sequence: string, width = 70): string {
  const body: string[] = []
  const w = Math.max(1, width)
  for (let i = 0; i < sequence.length; i += w) body.push(sequence.slice(i, i + w))
  const head = header != null && header !== '' ? `>${header}\n` : ''
  return `${head}${body.join('\n')}\n`
}

/** Dispara download de um .fasta no browser (Blob + `<a download>`). */
export function downloadFasta(filename: string, header: string | null, sequence: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  const blob = new Blob([toFasta(header, sequence)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.fasta') || filename.endsWith('.fa') ? filename : `${filename}.fasta`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
