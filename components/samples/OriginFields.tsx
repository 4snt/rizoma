'use client'

import { type LimsSample, type SampleUpdate, ISOLATION_SOURCE_SUGGESTIONS } from '@/lib/api'
import { GpsField } from '@/components/ui/GpsField'
import { inputStyle, labelStyle, textareaStyle } from './styles'

// Origem/coleta do isolado (controlado, sem fetch/salvar).

export type OriginFormValue = {
  strain_name: string
  isolation_source: string
  host_species: string
  host_cultivar: string
  collection_site: string
  occurred_at: string   // datetime-local ('YYYY-MM-DDTHH:mm')
  isolated_at: string   // date ('YYYY-MM-DD')
  lat: number | null
  lon: number | null
  notes: string
}

/** ISO (UTC ou com offset) → valor de `<input type="datetime-local">` no fuso local. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** datetime-local → ISO 8601 (UTC). '' → null. */
function localInputToIso(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function originToForm(s: Partial<LimsSample> | null | undefined): OriginFormValue {
  return {
    strain_name: s?.strain_name ?? '',
    isolation_source: s?.isolation_source ?? '',
    host_species: s?.host_species ?? '',
    host_cultivar: s?.host_cultivar ?? '',
    collection_site: s?.collection_site ?? '',
    occurred_at: isoToLocalInput(s?.occurred_at),
    isolated_at: s?.isolated_at ? s.isolated_at.slice(0, 10) : '',
    lat: s?.lat ?? null,
    lon: s?.lon ?? null,
    notes: s?.notes ?? '',
  }
}

export function originToPatch(v: OriginFormValue, base?: Partial<LimsSample> | null): Partial<SampleUpdate> {
  const b = originToForm(base)
  const out: Partial<SampleUpdate> = {}
  const textKeys = ['strain_name', 'isolation_source', 'host_species', 'host_cultivar', 'collection_site', 'notes'] as const
  for (const k of textKeys) {
    const t = v[k].trim()
    if (t !== b[k]) out[k] = t || null
  }
  if (v.occurred_at !== b.occurred_at) out.occurred_at = localInputToIso(v.occurred_at)
  if (v.isolated_at !== b.isolated_at) out.isolated_at = v.isolated_at || null
  // lat/lon sempre juntos: o backend rejeita só um dos dois. Ambos null limpa.
  if (v.lat !== b.lat || v.lon !== b.lon) {
    const both = v.lat != null && v.lon != null
    out.lat = both ? v.lat : null
    out.lon = both ? v.lon : null
  }
  return out
}

const SOURCE_LIST_ID = 'sample-isolation-source-suggestions'

export function OriginFields({ value, onChange, disabled, showNotes }: {
  value: OriginFormValue
  onChange: (v: OriginFormValue) => void
  disabled?: boolean
  showNotes?: boolean
}) {
  const set = (k: keyof OriginFormValue) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <>
      <datalist id={SOURCE_LIST_ID}>
        {ISOLATION_SOURCE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Nome da linhagem</label>
          <input value={value.strain_name} placeholder="ex. UFVJM-R12" disabled={disabled}
            onChange={e => set('strain_name')(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Fonte de isolamento</label>
          <input list={SOURCE_LIST_ID} value={value.isolation_source} placeholder="rizosfera, endofítico…" disabled={disabled}
            onChange={e => set('isolation_source')(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Espécie hospedeira</label>
          <input value={value.host_species} placeholder="Coffea arabica" disabled={disabled}
            onChange={e => set('host_species')(e.target.value)} style={{ ...inputStyle, fontStyle: value.host_species ? 'italic' : undefined }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Cultivar</label>
          <input value={value.host_cultivar} placeholder="Catuaí Vermelho" disabled={disabled}
            onChange={e => set('host_cultivar')(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '2 1 220px' }}>
          <label style={labelStyle}>Local de coleta</label>
          <input value={value.collection_site} placeholder="Fazenda, município, talhão" disabled={disabled}
            onChange={e => set('collection_site')(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={labelStyle}>Coleta em</label>
          <input type="datetime-local" value={value.occurred_at} disabled={disabled}
            onChange={e => set('occurred_at')(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Isolado em</label>
          <input type="date" value={value.isolated_at} disabled={disabled}
            onChange={e => set('isolated_at')(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
      </div>
      <div style={{ marginBottom: showNotes ? 12 : 0 }}>
        <label style={labelStyle}>Coordenadas</label>
        <GpsField
          value={{ lat: value.lat, lon: value.lon }}
          onChange={c => onChange({ ...value, lat: c.lat, lon: c.lon })}
          disabled={disabled}
        />
      </div>
      {showNotes && (
        <div>
          <label style={labelStyle}>Notas</label>
          <textarea rows={3} value={value.notes} disabled={disabled}
            onChange={e => set('notes')(e.target.value)} style={{ ...textareaStyle, fontFamily: undefined }} />
        </div>
      )}
    </>
  )
}

export default OriginFields
