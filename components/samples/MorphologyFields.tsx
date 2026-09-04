'use client'

import {
  type LimsSample,
  type SampleUpdate,
  type ColoniaForma,
  type ColoniaElevacao,
  type ColoniaMargem,
  type ColoniaTextura,
  type ColoniaOpacidade,
  COLONIA_FORMAS, COLONIA_FORMA_LABELS,
  COLONIA_ELEVACOES, COLONIA_ELEVACAO_LABELS,
  COLONIA_MARGENS, COLONIA_MARGEM_LABELS,
  COLONIA_TEXTURAS, COLONIA_TEXTURA_LABELS,
  COLONIA_OPACIDADES, COLONIA_OPACIDADE_LABELS,
} from '@/lib/api'
import { inputStyle, selectStyle, labelStyle } from './styles'

// Só os campos de morfologia de colônia (controlado, sem fetch/salvar).
// '' = vazio; `morphologyToPatch` converte '' em null e envia só o que mudou.

export type MorphologyFormValue = {
  colonia_forma: string
  colonia_elevacao: string
  colonia_margem: string
  colonia_cor: string
  colonia_textura: string
  colonia_tamanho_mm: string
  colonia_opacidade: string
}

export function morphologyToForm(s: Partial<LimsSample> | null | undefined): MorphologyFormValue {
  return {
    colonia_forma: s?.colonia_forma ?? '',
    colonia_elevacao: s?.colonia_elevacao ?? '',
    colonia_margem: s?.colonia_margem ?? '',
    colonia_cor: s?.colonia_cor ?? '',
    colonia_textura: s?.colonia_textura ?? '',
    colonia_tamanho_mm: s?.colonia_tamanho_mm != null ? String(s.colonia_tamanho_mm) : '',
    colonia_opacidade: s?.colonia_opacidade ?? '',
  }
}

export function morphologyToPatch(v: MorphologyFormValue, base?: Partial<LimsSample> | null): Partial<SampleUpdate> {
  const b = morphologyToForm(base)
  const out: Partial<SampleUpdate> = {}
  if (v.colonia_forma !== b.colonia_forma) out.colonia_forma = (v.colonia_forma || null) as ColoniaForma | null
  if (v.colonia_elevacao !== b.colonia_elevacao) out.colonia_elevacao = (v.colonia_elevacao || null) as ColoniaElevacao | null
  if (v.colonia_margem !== b.colonia_margem) out.colonia_margem = (v.colonia_margem || null) as ColoniaMargem | null
  if (v.colonia_textura !== b.colonia_textura) out.colonia_textura = (v.colonia_textura || null) as ColoniaTextura | null
  if (v.colonia_opacidade !== b.colonia_opacidade) out.colonia_opacidade = (v.colonia_opacidade || null) as ColoniaOpacidade | null
  const cor = v.colonia_cor.trim()
  if (cor !== b.colonia_cor) out.colonia_cor = cor || null
  const tam = v.colonia_tamanho_mm.trim()
  if (tam !== b.colonia_tamanho_mm) {
    const n = tam === '' ? null : Number(tam)
    out.colonia_tamanho_mm = n != null && Number.isFinite(n) ? n : null
  }
  return out
}

export function SelectField<T extends string>({ label, value, options, labels, onChange, disabled, flex }: {
  label: string
  value: string
  options: readonly T[]
  labels: Record<T, string>
  onChange: (v: string) => void
  disabled?: boolean
  flex?: string
}) {
  return (
    <div style={{ flex: flex ?? '1 1 160px' }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{labels[o]}</option>)}
      </select>
    </div>
  )
}

export function MorphologyFields({ value, onChange, disabled }: {
  value: MorphologyFormValue
  onChange: (v: MorphologyFormValue) => void
  disabled?: boolean
}) {
  const set = (k: keyof MorphologyFormValue) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <SelectField label="Forma" value={value.colonia_forma} options={COLONIA_FORMAS} labels={COLONIA_FORMA_LABELS}
          onChange={set('colonia_forma')} disabled={disabled} />
        <SelectField label="Elevação" value={value.colonia_elevacao} options={COLONIA_ELEVACOES} labels={COLONIA_ELEVACAO_LABELS}
          onChange={set('colonia_elevacao')} disabled={disabled} />
        <SelectField label="Margem" value={value.colonia_margem} options={COLONIA_MARGENS} labels={COLONIA_MARGEM_LABELS}
          onChange={set('colonia_margem')} disabled={disabled} />
        <SelectField label="Textura" value={value.colonia_textura} options={COLONIA_TEXTURAS} labels={COLONIA_TEXTURA_LABELS}
          onChange={set('colonia_textura')} disabled={disabled} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SelectField label="Opacidade" value={value.colonia_opacidade} options={COLONIA_OPACIDADES} labels={COLONIA_OPACIDADE_LABELS}
          onChange={set('colonia_opacidade')} disabled={disabled} />
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Cor</label>
          <input type="text" value={value.colonia_cor} placeholder="ex. creme, amarela" disabled={disabled}
            onChange={e => set('colonia_cor')(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Tamanho (mm)</label>
          <input type="number" step={0.1} min={0} value={value.colonia_tamanho_mm} disabled={disabled}
            onChange={e => set('colonia_tamanho_mm')(e.target.value)}
            style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
      </div>
    </>
  )
}

export default MorphologyFields
