'use client'

/**
 * Primitivas visuais das telas do MVP (Fatia 1).
 * Seguem os tokens do `globals.css` (--surface, --border, --cyan…) — sem biblioteca nova.
 */

import { forwardRef } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} style={{ ...inputStyle, ...props.style }} />
  }
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} style={{ ...inputStyle, minHeight: 72, ...props.style }} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return <select ref={ref} {...props} style={{ ...inputStyle, ...props.style }} />
  }
)

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.03em' }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{hint}</span>}
    </label>
  )
}

type ButtonVariant = 'primary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const palette: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'rgba(0,212,255,0.12)',
      border: '1px solid rgba(0,212,255,0.35)',
      color: 'var(--cyan)',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid var(--border)',
      color: 'var(--text-2)',
    },
    danger: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.35)',
      color: 'var(--red)',
    },
  }
  return (
    <button
      {...rest}
      style={{
        borderRadius: 8,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 14px',
        opacity: rest.disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...palette[variant],
        ...rest.style,
      }}
    >
      {children}
    </button>
  )
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        color: 'var(--red)',
        fontSize: 12,
        padding: '8px 12px',
        marginBottom: 12,
      }}
    >
      {message}
    </div>
  )
}

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {desc && <div className="empty-state-desc">{desc}</div>}
    </div>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  )
}

/* Tabela simples, no visual de `.jobs-table` */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
    </div>
  )
}

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 10px',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-3)',
        borderBottom: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

export function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', ...style }}>
      {children}
    </td>
  )
}

const STATUS_BADGE: Record<string, string> = {
  planned: 'badge-blue',
  collected: 'badge-cyan',
  in_transit: 'badge-amber',
  received: 'badge-purple',
  accepted: 'badge-green',
  rejected: 'badge-red',
  queued: 'badge-amber',
  running: 'badge-cyan',
  done: 'badge-green',
  error: 'badge-red',
  cancelled: 'badge-red',
  draft: 'badge-amber',
  signed: 'badge-green',
  pending: 'badge-amber',
  approved: 'badge-green',
  retracted: 'badge-red',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_BADGE[status] ?? 'badge-blue'}`}>{status}</span>
}
