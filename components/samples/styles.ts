// Estilos compartilhados dos painéis/forms de amostra. Antes cada panel
// repetia estas constantes; agora todos importam daqui.

export const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
}

export const selectStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
  fontFamily: 'var(--mono)', padding: '7px 10px', boxSizing: 'border-box',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle, fontFamily: 'var(--mono)', resize: 'vertical', lineHeight: 1.5,
}

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6,
}

export const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
export const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-2)' }

export const primaryButtonStyle: React.CSSProperties = {
  padding: '7px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--shape-full)',
  color: '#050d1a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
}

export const ghostButtonStyle: React.CSSProperties = {
  padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
  borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
}

export const smallButtonStyle: React.CSSProperties = {
  padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-full)', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const dangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.35)',
}

/** Cabeçalho de seção usado quando o panel NÃO está `embedded`. */
export const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

/** Data de hoje em 'YYYY-MM-DD' no fuso local. */
export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
