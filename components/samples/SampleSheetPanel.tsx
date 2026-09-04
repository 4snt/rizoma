'use client'

import { useState } from 'react'
import {
  api,
  type LimsSample,
  type SampleUpdate,
  ORGANISM_TYPE_LABELS,
  GRAM_STAIN_LABELS,
  CELL_SHAPE_LABELS,
  MOTILITY_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'
import { OriginFields, originToForm, originToPatch, type OriginFormValue } from './OriginFields'
import { CultureFields, cultureToForm, cultureToPatch, type CultureFormValue } from './CultureFields'
import { ReadField, SectionHeader, ToggleButton } from './ui'
import { fmtDate, inputStyle, labelStyle, primaryButtonStyle } from './styles'

function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: '0.02em' }}>{title}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', rowGap: 14 }}>{children}</div>
    </div>
  )
}

/** Aba "Ficha": identificação, origem/coleta, cultivo e notas, com edição inline. */
export function SampleSheetPanel({ token, role, sample, onChanged }: {
  token: string
  role: string | undefined
  sample: LimsSample
  onChanged: () => Promise<unknown> | void
}) {
  const [editing, setEditing] = useState(false)
  const [origin, setOrigin] = useState<OriginFormValue>(() => originToForm(sample))
  const [culture, setCulture] = useState<CultureFormValue>(() => cultureToForm(sample))
  const [group, setGroup] = useState(sample.treatment_group ?? '')
  const [replicate, setReplicate] = useState(sample.replicate != null ? String(sample.replicate) : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const writable = can(role, 'sample:write')

  function startEdit() {
    setOrigin(originToForm(sample))
    setCulture(cultureToForm(sample))
    setGroup(sample.treatment_group ?? '')
    setReplicate(sample.replicate != null ? String(sample.replicate) : '')
    setErr('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      if ((origin.lat == null) !== (origin.lon == null)) {
        setErr('Informe latitude e longitude juntas (ou deixe ambas vazias).'); setSaving(false); return
      }
      const body: SampleUpdate = { ...originToPatch(origin, sample), ...cultureToPatch(culture, sample) }
      const g = group.trim()
      if (g !== (sample.treatment_group ?? '')) body.treatment_group = g || null
      const r = replicate.trim()
      if (r !== (sample.replicate != null ? String(sample.replicate) : '')) {
        if (r !== '' && (!Number.isInteger(Number(r)) || Number(r) < 0)) { setErr('Réplica deve ser um inteiro ≥ 0.'); setSaving(false); return }
        body.replicate = r === '' ? null : Number(r)
      }
      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return }
      await api.updateSample(token, sample.id, body)
      await onChanged()
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar ficha.')
    } finally {
      setSaving(false)
    }
  }

  const hasCoords = sample.lat != null && sample.lon != null
  const osmHref = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${sample.lat}&mlon=${sample.lon}#map=15/${sample.lat}/${sample.lon}`
    : null

  return (
    <div style={{ marginBottom: 32 }}>
      <SectionHeader
        title="Ficha do isolado"
        action={writable && (
          <ToggleButton open={editing} openLabel="✕ Cancelar" closedLabel="✎ Editar"
            onClick={() => (editing ? setEditing(false) : startEdit())} />
        )}
      />

      {editing && writable ? (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Identificação</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>Grupo / tratamento</label>
                <input value={group} onChange={e => setGroup(e.target.value)} disabled={saving} style={inputStyle} />
              </div>
              <div style={{ flex: '0 1 120px' }}>
                <label style={labelStyle}>Réplica</label>
                <input type="number" min={0} step={1} value={replicate} onChange={e => setReplicate(e.target.value)} disabled={saving}
                  style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Origem / coleta</div>
            <OriginFields value={origin} onChange={setOrigin} disabled={saving} showNotes />
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Cultivo</div>
            <CultureFields value={culture} onChange={setCulture} disabled={saving} />
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      ) : (
        <>
          <Group title="Identificação">
            <ReadField label="Código" value={sample.code} mono />
            <ReadField label="Nome da linhagem" value={sample.strain_name} mono />
            <ReadField label="Organismo" value={sample.organism_type ? ORGANISM_TYPE_LABELS[sample.organism_type] : null} />
            <ReadField label="Matriz" value={sample.matrix} mono />
            <ReadField label="Grupo" value={sample.treatment_group} />
            <ReadField label="Réplica" value={sample.replicate != null ? String(sample.replicate) : null} mono />
            <ReadField label="Status" value={<span className="badge badge-cyan">{sample.status}</span>} />
          </Group>
          <Group title="Origem / coleta">
            <ReadField label="Fonte de isolamento" value={sample.isolation_source} />
            <ReadField label="Espécie hospedeira" value={sample.host_species ? <em>{sample.host_species}</em> : null} />
            <ReadField label="Cultivar" value={sample.host_cultivar} />
            <ReadField label="Local de coleta" value={sample.collection_site} flex="2 1 240px" />
            <ReadField label="Coleta em" value={fmtDateTime(sample.occurred_at)} mono />
            <ReadField label="Isolado em" value={sample.isolated_at ? fmtDate(sample.isolated_at) : null} mono />
            <ReadField
              label="Coordenadas"
              mono
              value={hasCoords && osmHref ? (
                <a href={osmHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>
                  {sample.lat!.toFixed(6)}, {sample.lon!.toFixed(6)} ↗
                </a>
              ) : null}
            />
          </Group>
          <Group title="Cultivo">
            <ReadField label="Meio" value={sample.culture_medium} />
            <ReadField label="Temperatura" value={sample.incubation_temp_c != null ? `${sample.incubation_temp_c} °C` : null} mono />
            <ReadField label="Tempo" value={sample.incubation_hours != null ? `${sample.incubation_hours} h` : null} mono />
            <ReadField label="Gram" value={sample.gram_stain ? GRAM_STAIN_LABELS[sample.gram_stain] : null} />
            <ReadField label="Forma celular" value={sample.cell_shape ? CELL_SHAPE_LABELS[sample.cell_shape] : null} />
            <ReadField label="Motilidade" value={sample.motility ? MOTILITY_LABELS[sample.motility] : null} />
          </Group>
          <Group title="Notas">
            <ReadField label="Observações" value={sample.notes ? <span style={{ whiteSpace: 'pre-wrap' }}>{sample.notes}</span> : null} flex="1 1 100%" />
          </Group>
        </>
      )}
    </div>
  )
}

export default SampleSheetPanel
