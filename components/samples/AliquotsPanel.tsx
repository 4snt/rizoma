'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import {
  api,
  type SampleAliquot,
  type StorageMethod,
  type AliquotStatus,
  type CreateSampleAliquotBody,
  STORAGE_METHODS, STORAGE_METHOD_LABELS,
  ALIQUOT_STATUSES, ALIQUOT_STATUS_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'
import { fmtDate, inputStyle, labelStyle, primaryButtonStyle, selectStyle, smallButtonStyle, tdStyle, thStyle, todayIso } from './styles'
import { InlineDeleteButton, SectionHeader, ToggleButton } from './ui'

type AliquotForm = {
  label: string
  storage_method: StorageMethod
  freezer: string
  box: string
  position: string
  stored_at: string
  notes: string
}

function emptyForm(label = ''): AliquotForm {
  return { label, storage_method: 'glicerol_-80', freezer: '', box: '', position: '', stored_at: todayIso(), notes: '' }
}

function aliquotToForm(a: SampleAliquot): AliquotForm {
  return {
    label: a.label,
    storage_method: a.storage_method,
    freezer: a.freezer ?? '',
    box: a.box ?? '',
    position: a.position ?? '',
    stored_at: a.stored_at ? a.stored_at.slice(0, 10) : '',
    notes: a.notes ?? '',
  }
}

function formToBody(f: AliquotForm): CreateSampleAliquotBody {
  return {
    label: f.label.trim(),
    storage_method: f.storage_method,
    freezer: f.freezer.trim() || null,
    box: f.box.trim() || null,
    position: f.position.trim() || null,
    stored_at: f.stored_at || null,
    notes: f.notes.trim() || null,
  }
}

function friendlyError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : ''
  if (/\b409\b/.test(msg)) return 'Já existe uma alíquota com esse rótulo nesta amostra — use outro (ex. R2).'
  return msg || fallback
}

const STATUS_COLOR: Record<AliquotStatus, string> = {
  disponivel: 'var(--green)', consumida: 'var(--text-3)', descartada: 'var(--text-3)', contaminada: 'var(--red)',
}

export function AliquotsPanel({ token, role, sampleId, embedded, suggestDefaults }: {
  token: string
  role: string | undefined
  sampleId: string
  embedded?: boolean
  suggestDefaults?: boolean
}) {
  const { data: aliquots, mutate } = useSWR(['sample-aliquots', sampleId, token], () => api.getSampleAliquots(token, sampleId))
  const [showForm, setShowForm] = useState(!!embedded)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AliquotForm>(() => emptyForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)
  const writable = can(role, 'sample:write')

  const isEmpty = !!aliquots && aliquots.length === 0
  const showHint = !!suggestDefaults && isEmpty

  // suggestDefaults: lista vazia → pré-preenche "R1" uma única vez.
  useEffect(() => {
    if (suggestDefaults && isEmpty && !seeded && !editingId) {
      setForm(f => (f.label ? f : { ...f, label: 'R1' }))
      setShowForm(true)
      setSeeded(true)
    }
  }, [suggestDefaults, isEmpty, seeded, editingId])

  function nextSuggestedLabel(): string {
    if (!suggestDefaults || !aliquots) return ''
    const labels = new Set(aliquots.map(a => a.label))
    for (const l of ['R1', 'R2']) if (!labels.has(l)) return l
    return ''
  }

  function openCreate() {
    setEditingId(null); setForm(emptyForm(nextSuggestedLabel())); setErr(''); setShowForm(true)
  }
  function openEdit(a: SampleAliquot) {
    setEditingId(a.id); setForm(aliquotToForm(a)); setErr(''); setShowForm(true)
  }
  function closeForm() {
    setEditingId(null); setForm(emptyForm()); setErr('')
    if (!embedded) setShowForm(false)
  }

  async function handleSave() {
    if (!form.label.trim()) { setErr('Rótulo é obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      const body = formToBody(form)
      if (editingId) await api.updateSampleAliquot(token, sampleId, editingId, body)
      else await api.createSampleAliquot(token, sampleId, body)
      await mutate()
      setEditingId(null)
      setErr('')
      // Depois de criar, já sugere a próxima (R2) quando aplicável.
      const next = !editingId && suggestDefaults ? nextAfter(form.label.trim()) : ''
      setForm(emptyForm(next))
      if (!embedded && !next) setShowForm(false)
    } catch (e) {
      setErr(friendlyError(e, 'Erro ao salvar alíquota.'))
    } finally {
      setSaving(false)
    }
  }

  function nextAfter(justCreated: string): string {
    const labels = new Set([...(aliquots ?? []).map(a => a.label), justCreated])
    for (const l of ['R1', 'R2']) if (!labels.has(l)) return l
    return ''
  }

  async function handleStatus(a: SampleAliquot, status: AliquotStatus) {
    if (status === a.status) return
    setStatusBusy(a.id); setErr('')
    try {
      await api.updateSampleAliquot(token, sampleId, a.id, { status })
      await mutate()
    } catch (e) {
      setErr(friendlyError(e, 'Erro ao atualizar status.'))
    } finally {
      setStatusBusy(null)
    }
  }

  async function handleDelete(id: string) {
    setErr('')
    try {
      await api.deleteSampleAliquot(token, sampleId, id)
      if (editingId === id) closeForm()
      await mutate()
    } catch (e) {
      setErr(friendlyError(e, 'Erro ao excluir alíquota.'))
    }
  }

  const upd = (k: keyof AliquotForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const aliquotForm = (
    <div className={embedded ? undefined : 'card'} style={{ padding: embedded ? 0 : 16, marginBottom: 14 }}>
      {editingId && (
        <div style={{ fontSize: 12, color: 'var(--cyan)', marginBottom: 10, fontWeight: 600 }}>
          Editando alíquota <span className="mono">{form.label}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '0 1 120px' }}>
          <label style={labelStyle}>Rótulo *</label>
          <input placeholder="R1" value={form.label} onChange={upd('label')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Método</label>
          <select value={form.storage_method} onChange={upd('storage_method')} style={selectStyle}>
            {STORAGE_METHODS.map(m => <option key={m} value={m}>{STORAGE_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <label style={labelStyle}>Armazenada em</label>
          <input type="date" value={form.stored_at} onChange={upd('stored_at')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Freezer</label>
          <input placeholder="Ultra-1" value={form.freezer} onChange={upd('freezer')} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Caixa</label>
          <input placeholder="C03" value={form.box} onChange={upd('box')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Posição</label>
          <input placeholder="A5" value={form.position} onChange={upd('position')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label style={labelStyle}>Notas</label>
          <input value={form.notes} onChange={upd('notes')} style={inputStyle} />
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Registrar'}
        </button>
        {editingId && <button type="button" onClick={closeForm} style={smallButtonStyle}>Cancelar edição</button>}
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: embedded ? 0 : 32 }}>
      {!embedded && (
        <SectionHeader
          title="Armazenamento / alíquotas"
          action={writable && (
            <ToggleButton open={showForm} openLabel="✕ Fechar" closedLabel="+ Registrar Alíquota"
              onClick={() => (showForm ? closeForm() : openCreate())} />
          )}
        />
      )}

      {showHint && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'rgba(0,212,255,0.3)', fontSize: 12, color: 'var(--cyan)' }}>
          Você imprime R1 e R2 por isolado — cadastre as duas.
        </div>
      )}

      {showForm && writable && aliquotForm}
      {!showForm && err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}

      {!aliquots && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {aliquots && aliquots.length === 0 && (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <span className="empty-state-icon">▢</span>
          <span className="empty-state-title">Nenhuma alíquota registrada.</span>
        </div>
      )}
      {aliquots && aliquots.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={thStyle}>Rótulo</th>
                <th style={thStyle}>Método</th>
                <th style={thStyle}>Local</th>
                <th style={thStyle}>Armazenada em</th>
                <th style={thStyle}>Status</th>
                {writable && <th style={thStyle}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {aliquots.map(a => {
                const loc = [a.freezer, a.box, a.position].filter(Boolean).join(' / ')
                return (
                  <tr key={a.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}><span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{a.label}</span></td>
                    <td style={tdStyle}>{STORAGE_METHOD_LABELS[a.storage_method] ?? a.storage_method}</td>
                    <td style={tdStyle}><span className="mono" style={{ fontSize: 12 }}>{loc || '—'}</span></td>
                    <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(a.stored_at)}</td>
                    <td style={tdStyle}>
                      {writable ? (
                        <select
                          value={a.status}
                          disabled={statusBusy === a.id}
                          onChange={e => handleStatus(a, e.target.value as AliquotStatus)}
                          aria-label={`Status da alíquota ${a.label}`}
                          style={{ ...selectStyle, width: undefined, padding: '4px 8px', fontSize: 12, color: STATUS_COLOR[a.status] }}
                        >
                          {ALIQUOT_STATUSES.map(s => <option key={s} value={s}>{ALIQUOT_STATUS_LABELS[s]}</option>)}
                        </select>
                      ) : (
                        <span style={{ color: STATUS_COLOR[a.status], fontWeight: 600, fontSize: 12 }}>{ALIQUOT_STATUS_LABELS[a.status]}</span>
                      )}
                    </td>
                    {writable && (
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button type="button" onClick={() => openEdit(a)} style={{ ...smallButtonStyle, color: 'var(--cyan)' }}>Editar</button>
                          <InlineDeleteButton onConfirm={() => handleDelete(a.id)} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AliquotsPanel
