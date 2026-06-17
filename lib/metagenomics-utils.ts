// Funções puras do módulo de metagenômica — extraídas para serem testáveis
// (usadas por app/metagenomics/page.tsx).
import type { Dada2Params } from '@/lib/api'

export interface BatchPair { r1: File; r2: File; name: string }

/**
 * Detecta pares R1/R2 numa lista de arquivos pelo padrão `_R1_`/`_R2_`.
 * Retorna os pares casados e os nomes de R1 sem R2 correspondente.
 */
export function autoPair(files: File[]): { pairs: BatchPair[]; unmatched: string[] } {
  const r1s = files.filter(f => /_R1[_.]/.test(f.name))
  const r2s = files.filter(f => /_R2[_.]/.test(f.name))
  const pairs: BatchPair[] = []
  const unmatched: string[] = []
  for (const r1 of r1s) {
    const key = r1.name.replace(/_R1([_.])/, '_R2$1')
    const r2 = r2s.find(f => f.name === key)
    if (r2) pairs.push({ r1, r2, name: r1.name })
    else unmatched.push(r1.name)
  }
  return { pairs, unmatched }
}

/** Defaults DADA2 por marcador (espelham r-worker/analyses/dada2_silva.R). */
export function dada2Defaults(marker: '16S' | 'ITS'): Required<Dada2Params> {
  const is16S = marker === '16S'
  return {
    trunc_len_f: is16S ? 230 : 0,
    trunc_len_r: is16S ? 180 : 0,
    max_ee_f: 2,
    max_ee_r: 2,
    trunc_q: 2,
    max_n: 0,
    min_len: 50,
    chimera_method: 'consensus',
  }
}

/** Monta o conteúdo CSV (com BOM UTF-8 e escape de aspas). Função pura. */
export function toCsv(headers: string[], rows: string[][]): string {
  const bom = '﻿'
  return bom + [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

/** Dispara o download de um CSV no navegador (wrapper com efeito de DOM). */
export function csvDownload(filename: string, headers: string[], rows: string[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
