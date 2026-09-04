'use client'

import { useState, type ReactNode } from 'react'
import { dangerButtonStyle, ghostButtonStyle, sectionHeaderStyle, smallButtonStyle } from './styles'

/** Par rótulo/valor em modo leitura; "—" quando vazio. */
export function ReadField({ label, value, mono, flex }: {
  label: string
  value: ReactNode
  mono?: boolean
  flex?: string
}) {
  const empty = value == null || value === '' || value === false
  return (
    <div style={{ flex: flex ?? '1 1 160px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13, color: empty ? 'var(--text-3)' : 'var(--text)',
        fontFamily: mono && !empty ? 'var(--mono)' : undefined, wordBreak: 'break-word',
      }}>
        {empty ? '—' : value}
      </div>
    </div>
  )
}

/**
 * Botão "Excluir" com confirmação inline (dois botões) — sem `window.confirm`,
 * que bloqueia automação/testes.
 */
export function InlineDeleteButton({ onConfirm, disabled, label = 'Excluir' }: {
  onConfirm: () => Promise<unknown> | void
  disabled?: boolean
  label?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false); setConfirming(false) }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} disabled={disabled} style={dangerButtonStyle}>
        {label}
      </button>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 11, color: 'var(--red)' }}>confirmar?</span>
      <button type="button" onClick={run} disabled={busy}
        style={{ ...dangerButtonStyle, background: 'rgba(239,68,68,0.1)', cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? '…' : 'Sim, excluir'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={smallButtonStyle}>
        Não
      </button>
    </span>
  )
}

/** Cabeçalho de seção (título + ação à direita) para panels não-embedded. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={sectionHeaderStyle}>
      <span className="section-title" style={{ margin: 0 }}>{title}</span>
      {action}
    </div>
  )
}

export function ToggleButton({ open, openLabel, closedLabel, onClick }: {
  open: boolean
  openLabel: string
  closedLabel: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={ghostButtonStyle}>
      {open ? openLabel : closedLabel}
    </button>
  )
}
