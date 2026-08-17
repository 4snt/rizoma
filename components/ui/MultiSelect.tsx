'use client'

/**
 * Multi-select genérico, estilizado com os tokens do tema (`var(--*)`) —
 * não é específico de nenhuma tela. Primeiro uso: escolher quais papéis
 * técnicos um rótulo customizado cobre (`app/admin/members`, ADR-013),
 * mas qualquer tela que precise "escolher vários itens de uma lista" deve
 * reaproveitar este componente em vez de montar outro dropdown do zero.
 */

import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Selecione...' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])
  }

  const selectedLabels = options.filter(o => selected.includes(o.value)).map(o => o.label)

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--shape-sm)', color: selectedLabels.length ? 'var(--text)' : 'var(--text-3)',
          fontSize: 13, padding: '7px 10px', cursor: 'pointer', textAlign: 'left', minHeight: 34,
          boxSizing: 'border-box',
        }}
      >
        {selectedLabels.length === 0 && placeholder}
        {selectedLabels.map(l => (
          <span key={l} className="badge badge-cyan" style={{ fontSize: 11, padding: '2px 8px' }}>{l}</span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--shape-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          maxHeight: 240, overflowY: 'auto', padding: 4,
        }}>
          {options.map(o => {
            const checked = selected.includes(o.value)
            return (
              <label
                key={o.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 'var(--shape-sm)', cursor: 'pointer', fontSize: 13,
                  color: 'var(--text)', background: checked ? 'var(--cyan-dim)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(o.value)}
                  style={{ accentColor: 'var(--cyan)', cursor: 'pointer' }}
                />
                {o.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
