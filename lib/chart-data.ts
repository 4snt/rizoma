// Transformações puras de dados para os gráficos (testáveis sem Plotly).

/** Converte gene_ratio do GSEA ("3/100" ou 0.03) em número. */
export function parseRatio(value: string | number): number {
  if (typeof value === 'number') return value
  const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (m) {
    const den = Number(m[2])
    return den === 0 ? 0 : Number(m[1]) / den
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Retorna os N itens com maior valor de `key` (desc), sem mutar a entrada. */
export function topN<T>(items: T[], key: (t: T) => number, n: number): T[] {
  return [...items].sort((a, b) => key(b) - key(a)).slice(0, n)
}

/** Conta ocorrências por categoria; nulos/vazios viram o rótulo `fallback`. */
export function countBy<T>(
  items: T[],
  key: (t: T) => string | null | undefined,
  fallback = 'Desconhecido',
): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const it of items) {
    const raw = key(it)
    const label = raw && String(raw).trim() ? String(raw).trim() : fallback
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}
