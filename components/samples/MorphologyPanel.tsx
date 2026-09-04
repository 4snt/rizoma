'use client'

import { useState } from 'react'
import {
  api,
  type LimsSample,
  type SampleMorphologyUpdate,
  type OrganismType,
  type ColoniaForma,
  type ColoniaElevacao,
  type ColoniaMargem,
  type ColoniaTextura,
  type ColoniaOpacidade,
  ORGANISM_TYPES, ORGANISM_TYPE_LABELS,
  COLONIA_FORMAS, COLONIA_FORMA_LABELS,
  COLONIA_ELEVACOES, COLONIA_ELEVACAO_LABELS,
  COLONIA_MARGENS, COLONIA_MARGEM_LABELS,
  COLONIA_TEXTURAS, COLONIA_TEXTURA_LABELS,
  COLONIA_OPACIDADES, COLONIA_OPACIDADE_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
  fontFamily: 'var(--mono)', padding: '7px 10px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }

// Estado do form é sempre string ('' = null) pra selects/inputs controlados.
type FormState = {
  organism_type: string
  colonia_forma: string
  colonia_elevacao: string
  colonia_margem: string
  colonia_cor: string
  colonia_textura: string
  colonia_tamanho_mm: string
  colonia_opacidade: string
}

function toForm(s: LimsSample): FormState {
  return {
    organism_type: s.organism_type ?? '',
    colonia_forma: s.colonia_forma ?? '',
    colonia_elevacao: s.colonia_elevacao ?? '',
    colonia_margem: s.colonia_margem ?? '',
    colonia_cor: s.colonia_cor ?? '',
    colonia_textura: s.colonia_textura ?? '',
    colonia_tamanho_mm: s.colonia_tamanho_mm != null ? String(s.colonia_tamanho_mm) : '',
    colonia_opacidade: s.colonia_opacidade ?? '',
  }
}

function SelectField<T extends string>({ label, value, options, labels, onChange }: {
  label: string; value: string; options: readonly T[]; labels: Record<T, string>; onChange: (v: string) => void
}) {
  return (
    <div style={{ flex: '1 1 160px' }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{labels[o]}</option>)}
      </select>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-3)' }}>{value || '—'}</div>
    </div>
  )
}

export function MorphologyPanel({ token, role, sample, onChanged }: {
  token: string
  role: string | undefined
  sample: LimsSample
  onChanged: () => Promise<unknown> | void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => toForm(sample))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const writable = can(role, 'sample:write')

  function startEdit() {
    setForm(toForm(sample))
    setErr('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      // Envia só o que mudou em relação ao estado atual da amostra.
      const base = toForm(sample)
      const body: SampleMorphologyUpdate = {}
      if (form.organism_type !== base.organism_type) body.organism_type = (form.organism_type || null) as OrganismType | null
      if (form.colonia_forma !== base.colonia_forma) body.colonia_forma = (form.colonia_forma || null) as ColoniaForma | null
      if (form.colonia_elevacao !== base.colonia_elevacao) body.colonia_elevacao = (form.colonia_elevacao || null) as ColoniaElevacao | null
      if (form.colonia_margem !== base.colonia_margem) body.colonia_margem = (form.colonia_margem || null) as ColoniaMargem | null
      if (form.colonia_textura !== base.colonia_textura) body.colonia_textura = (form.colonia_textura || null) as ColoniaTextura | null
      if (form.colonia_opacidade !== base.colonia_opacidade) body.colonia_opacidade = (form.colonia_opacidade || null) as ColoniaOpacidade | null
      if (form.colonia_cor.trim() !== base.colonia_cor) body.colonia_cor = form.colonia_cor.trim() || null
      if (form.colonia_tamanho_mm !== base.colonia_tamanho_mm) {
        const n = form.colonia_tamanho_mm === '' ? null : Number(form.colonia_tamanho_mm)
        if (n != null && (Number.isNaN(n) || n < 0)) { setErr('Tamanho da colônia deve ser um número ≥ 0.'); setSaving(false); return }
        body.colonia_tamanho_mm = n
      }
      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return }
      await api.updateSampleMorphology(token, sample.id, body)
      await onChanged()
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar morfologia.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Morfologia de colônia</span>
        {writable && (
          <button onClick={() => (editing ? setEditing(false) : startEdit())} style={{
            padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {editing ? '✕ Cancelar' : '✎ Editar'}
          </button>
        )}
      </div>

      {sample.organism_type == null && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'rgba(245,158,11,0.3)', fontSize: 12, color: 'var(--amber)' }}>
          Amostra sem tipo de organismo definido — defina para registrar morfologia.
        </div>
      )}

      {editing && writable ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <SelectField label="Tipo de organismo" value={form.organism_type} options={ORGANISM_TYPES} labels={ORGANISM_TYPE_LABELS}
              onChange={v => setForm(f => ({ ...f, organism_type: v }))} />
            <SelectField label="Forma" value={form.colonia_forma} options={COLONIA_FORMAS} labels={COLONIA_FORMA_LABELS}
              onChange={v => setForm(f => ({ ...f, colonia_forma: v }))} />
            <SelectField label="Elevação" value={form.colonia_elevacao} options={COLONIA_ELEVACOES} labels={COLONIA_ELEVACAO_LABELS}
              onChange={v => setForm(f => ({ ...f, colonia_elevacao: v }))} />
            <SelectField label="Margem" value={form.colonia_margem} options={COLONIA_MARGENS} labels={COLONIA_MARGEM_LABELS}
              onChange={v => setForm(f => ({ ...f, colonia_margem: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <SelectField label="Textura" value={form.colonia_textura} options={COLONIA_TEXTURAS} labels={COLONIA_TEXTURA_LABELS}
              onChange={v => setForm(f => ({ ...f, colonia_textura: v }))} />
            <SelectField label="Opacidade" value={form.colonia_opacidade} options={COLONIA_OPACIDADES} labels={COLONIA_OPACIDADE_LABELS}
              onChange={v => setForm(f => ({ ...f, colonia_opacidade: v }))} />
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelStyle}>Cor</label>
              <input type="text" value={form.colonia_cor} placeholder="ex. creme, amarela"
                onChange={e => setForm(f => ({ ...f, colonia_cor: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={labelStyle}>Tamanho (mm)</label>
              <input type="number" step={0.1} min={0} value={form.colonia_tamanho_mm}
                onChange={e => setForm(f => ({ ...f, colonia_tamanho_mm: e.target.value }))}
                style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleSave} disabled={saving} style={{
            padding: '7px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--shape-full)',
            color: '#050d1a', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', rowGap: 14 }}>
            <ReadField label="Tipo de organismo" value={sample.organism_type ? ORGANISM_TYPE_LABELS[sample.organism_type] : null} />
            <ReadField label="Forma" value={sample.colonia_forma ? COLONIA_FORMA_LABELS[sample.colonia_forma] : null} />
            <ReadField label="Elevação" value={sample.colonia_elevacao ? COLONIA_ELEVACAO_LABELS[sample.colonia_elevacao] : null} />
            <ReadField label="Margem" value={sample.colonia_margem ? COLONIA_MARGEM_LABELS[sample.colonia_margem] : null} />
            <ReadField label="Textura" value={sample.colonia_textura ? COLONIA_TEXTURA_LABELS[sample.colonia_textura] : null} />
            <ReadField label="Opacidade" value={sample.colonia_opacidade ? COLONIA_OPACIDADE_LABELS[sample.colonia_opacidade] : null} />
            <ReadField label="Cor" value={sample.colonia_cor} />
            <ReadField label="Tamanho (mm)" value={sample.colonia_tamanho_mm != null ? `${sample.colonia_tamanho_mm} mm` : null} />
          </div>
        </div>
      )}
    </div>
  )
}

export default MorphologyPanel
