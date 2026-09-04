'use client'

import { useState } from 'react'
import {
  api,
  type LimsSample,
  type SampleUpdate,
  type OrganismType,
  ORGANISM_TYPES, ORGANISM_TYPE_LABELS,
  COLONIA_FORMA_LABELS,
  COLONIA_ELEVACAO_LABELS,
  COLONIA_MARGEM_LABELS,
  COLONIA_TEXTURA_LABELS,
  COLONIA_OPACIDADE_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'
import { MorphologyFields, SelectField, morphologyToForm, morphologyToPatch, type MorphologyFormValue } from './MorphologyFields'
import { ReadField, SectionHeader, ToggleButton } from './ui'
import { primaryButtonStyle } from './styles'

export function MorphologyPanel({ token, role, sample, onChanged }: {
  token: string
  role: string | undefined
  sample: LimsSample
  onChanged: () => Promise<unknown> | void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<MorphologyFormValue>(() => morphologyToForm(sample))
  const [organismType, setOrganismType] = useState<string>(sample.organism_type ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const writable = can(role, 'sample:write')

  function startEdit() {
    setForm(morphologyToForm(sample))
    setOrganismType(sample.organism_type ?? '')
    setErr('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const tam = form.colonia_tamanho_mm.trim()
      if (tam !== '' && (!Number.isFinite(Number(tam)) || Number(tam) < 0)) {
        setErr('Tamanho da colônia deve ser um número ≥ 0.'); setSaving(false); return
      }
      // Envia só o que mudou em relação ao estado atual da amostra.
      const body: SampleUpdate = morphologyToPatch(form, sample)
      if (organismType !== (sample.organism_type ?? '')) body.organism_type = (organismType || null) as OrganismType | null
      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return }
      await api.updateSample(token, sample.id, body)
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
      <SectionHeader
        title="Morfologia de colônia"
        action={writable && (
          <ToggleButton open={editing} openLabel="✕ Cancelar" closedLabel="✎ Editar"
            onClick={() => (editing ? setEditing(false) : startEdit())} />
        )}
      />

      {sample.organism_type == null && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'rgba(245,158,11,0.3)', fontSize: 12, color: 'var(--amber)' }}>
          Amostra sem tipo de organismo definido — defina para registrar morfologia.
        </div>
      )}

      {editing && writable ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <SelectField label="Tipo de organismo" value={organismType} options={ORGANISM_TYPES} labels={ORGANISM_TYPE_LABELS}
              onChange={setOrganismType} flex="0 1 220px" />
          </div>
          <MorphologyFields value={form} onChange={setForm} disabled={saving} />
          {err && <div style={{ fontSize: 12, color: 'var(--red)', margin: '10px 0 0' }}>{err}</div>}
          <div style={{ marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
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
