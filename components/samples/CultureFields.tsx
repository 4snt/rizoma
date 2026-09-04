'use client'

import {
  type LimsSample,
  type SampleUpdate,
  type GramStain,
  type CellShape,
  type Motility,
  GRAM_STAINS, GRAM_STAIN_LABELS,
  CELL_SHAPES, CELL_SHAPE_LABELS,
  MOTILITIES, MOTILITY_LABELS,
  CULTURE_MEDIUM_SUGGESTIONS,
} from '@/lib/api'
import { inputStyle, labelStyle } from './styles'
import { SelectField } from './MorphologyFields'

// Cultivo + caracterização celular (controlado, sem fetch/salvar).

export type CultureFormValue = {
  culture_medium: string
  incubation_temp_c: string
  incubation_hours: string
  gram_stain: string
  cell_shape: string
  motility: string
}

export function cultureToForm(s: Partial<LimsSample> | null | undefined): CultureFormValue {
  return {
    culture_medium: s?.culture_medium ?? '',
    incubation_temp_c: s?.incubation_temp_c != null ? String(s.incubation_temp_c) : '',
    incubation_hours: s?.incubation_hours != null ? String(s.incubation_hours) : '',
    gram_stain: s?.gram_stain ?? '',
    cell_shape: s?.cell_shape ?? '',
    motility: s?.motility ?? '',
  }
}

function numOrNull(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function cultureToPatch(v: CultureFormValue, base?: Partial<LimsSample> | null): Partial<SampleUpdate> {
  const b = cultureToForm(base)
  const out: Partial<SampleUpdate> = {}
  const medium = v.culture_medium.trim()
  if (medium !== b.culture_medium) out.culture_medium = medium || null
  if (v.incubation_temp_c.trim() !== b.incubation_temp_c) out.incubation_temp_c = numOrNull(v.incubation_temp_c)
  if (v.incubation_hours.trim() !== b.incubation_hours) out.incubation_hours = numOrNull(v.incubation_hours)
  if (v.gram_stain !== b.gram_stain) out.gram_stain = (v.gram_stain || null) as GramStain | null
  if (v.cell_shape !== b.cell_shape) out.cell_shape = (v.cell_shape || null) as CellShape | null
  if (v.motility !== b.motility) out.motility = (v.motility || null) as Motility | null
  return out
}

const MEDIUM_LIST_ID = 'sample-culture-medium-suggestions'

export function CultureFields({ value, onChange, disabled }: {
  value: CultureFormValue
  onChange: (v: CultureFormValue) => void
  disabled?: boolean
}) {
  const set = (k: keyof CultureFormValue) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <>
      <datalist id={MEDIUM_LIST_ID}>
        {CULTURE_MEDIUM_SUGGESTIONS.map(m => <option key={m} value={m} />)}
      </datalist>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Meio de cultura</label>
          <input list={MEDIUM_LIST_ID} value={value.culture_medium} placeholder="TSA, PDA, King B…" disabled={disabled}
            onChange={e => set('culture_medium')(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Temperatura (°C)</label>
          <input type="number" step={0.5} value={value.incubation_temp_c} placeholder="28" disabled={disabled}
            onChange={e => set('incubation_temp_c')(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Incubação (h)</label>
          <input type="number" step={1} min={0} value={value.incubation_hours} placeholder="48" disabled={disabled}
            onChange={e => set('incubation_hours')(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SelectField label="Gram" value={value.gram_stain} options={GRAM_STAINS} labels={GRAM_STAIN_LABELS}
          onChange={set('gram_stain')} disabled={disabled} />
        <SelectField label="Forma celular" value={value.cell_shape} options={CELL_SHAPES} labels={CELL_SHAPE_LABELS}
          onChange={set('cell_shape')} disabled={disabled} />
        <SelectField label="Motilidade" value={value.motility} options={MOTILITIES} labels={MOTILITY_LABELS}
          onChange={set('motility')} disabled={disabled} />
      </div>
    </>
  )
}

export default CultureFields
