'use client'

// Extraído de app/inventory/page.tsx na reorganização da sidebar em seções
// básicas de LIMS (Reagentes e Equipamentos viraram itens próprios —
// pesquisa de mercado: LabWare/STARLIMS separam os dois). Mesma lógica,
// só compartilhada entre /inventory/reagentes e /inventory/equipamentos.

import { useState } from 'react'
import useSWR from 'swr'
import {
  api,
  type Reagent, type ReagentLot,
  type Equipment, type EquipmentStatus, type EquipmentReservation,
} from '@/lib/api'
import { can } from '@/lib/permissions'

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-sm)', color: 'var(--text)', fontSize: 13,
  padding: '7px 12px', outline: 'none', boxSizing: 'border-box',
}

const pillBtn = (bg: string, color: string): React.CSSProperties => ({
  padding: '6px 14px', background: bg, border: `1px solid ${color}40`,
  borderRadius: 'var(--shape-full)', color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
})

function daysColor(days: number) {
  if (days < 0) return 'var(--red)'
  if (days <= 7) return 'var(--red)'
  if (days <= 15) return 'var(--amber)'
  return 'var(--text-2)'
}

// ── Alertas ──────────────────────────────────────────────────────────────

export function AlertsPanel({ token }: { token: string }) {
  const { data: alerts } = useSWR(['inventory-alerts', token], () => api.getInventoryAlerts(token, 30))
  const expiring = alerts?.expiring_lots ?? []
  const dueCalib = alerts?.calibrations_due ?? []
  if (!alerts) return null
  if (expiring.length === 0 && dueCalib.length === 0) {
    return (
      <div className="card" style={{ padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--green)' }}>✓</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Nenhum lote ou calibração vencendo nos próximos 30 dias.</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
      {expiring.map(a => (
        <div key={a.reagent_lot_id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(245,158,11,0.25)' }}>
          <span style={{ color: 'var(--amber)' }}>⚠</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            Lote <span className="mono">{a.lot_number}</span> de <strong>{a.reagent_name}</strong> vence em{' '}
            <span style={{ color: daysColor(a.days_remaining), fontWeight: 700 }}>{a.days_remaining}d</span>
          </span>
        </div>
      ))}
      {dueCalib.map(a => (
        <div key={a.equipment_id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(239,68,68,0.25)' }}>
          <span style={{ color: 'var(--red)' }}>⚠</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            Calibração de <strong>{a.equipment_name}</strong> vence em{' '}
            <span style={{ color: daysColor(a.days_remaining), fontWeight: 700 }}>{a.days_remaining}d</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Reagentes ────────────────────────────────────────────────────────────

function LotsPanel({ token, role, reagentId, unit }: { token: string; role: string | undefined; reagentId: string; unit: string }) {
  const { data: lots, mutate } = useSWR(['reagent-lots', reagentId, token], () => api.getReagentLots(token, reagentId))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ lot_number: '', supplier: '', quantity_received: '', expires_at: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleAddLot() {
    if (!form.lot_number.trim() || !form.quantity_received) return
    setSaving(true); setErr('')
    try {
      await api.createReagentLot(token, reagentId, {
        lot_number: form.lot_number.trim(),
        supplier: form.supplier.trim() || null,
        quantity_received: Number(form.quantity_received),
        unit,
        expires_at: form.expires_at || null,
      })
      await mutate()
      setForm({ lot_number: '', supplier: '', quantity_received: '', expires_at: '' })
      setShowAdd(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar lote.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConsume(lot: ReagentLot) {
    const qtyStr = prompt(`Baixar quanto de ${lot.lot_number} (${unit})? Disponível: ${lot.quantity_remaining}`)
    if (!qtyStr) return
    const qty = Number(qtyStr)
    if (!qty || qty <= 0) return
    try {
      await api.consumeReagentLot(token, lot.id, { quantity: qty })
      await mutate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro na baixa — verifique se informou sample_id/job_id ou se há saldo.')
    }
  }

  return (
    <div style={{ padding: '10px 16px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lotes</span>
        {can(role, 'reagent:write') && (
          <button onClick={() => setShowAdd(v => !v)} style={pillBtn('rgba(0,212,255,0.08)', 'var(--cyan)')}>
            {showAdd ? '✕' : '+ Lote'}
          </button>
        )}
      </div>

      {showAdd && can(role, 'reagent:write') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input placeholder="Nº do lote" value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
          <input placeholder="Fornecedor" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
          <input type="number" placeholder={`Qtd (${unit})`} value={form.quantity_received} onChange={e => setForm(f => ({ ...f, quantity_received: e.target.value }))} style={{ ...inputStyle, flex: '1 1 100px' }} />
          <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={{ ...inputStyle, flex: '1 1 130px' }} />
          <button onClick={handleAddLot} disabled={saving} style={pillBtn('var(--cyan)', '#050d1a')}>{saving ? '...' : 'Salvar'}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}

      {!lots && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>carregando...</div>}
      {lots && lots.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum lote.</div>}
      {lots && lots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lots.map(lot => (
            <div key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-xs)', fontSize: 12 }}>
              <span className="mono" style={{ color: 'var(--text)' }}>{lot.lot_number}</span>
              <span style={{ color: 'var(--text-2)', flex: 1 }}>{lot.quantity_remaining}/{lot.quantity_received} {lot.unit}</span>
              {lot.expires_at && <span style={{ color: 'var(--text-3)' }}>vence {new Date(lot.expires_at).toLocaleDateString('pt-BR')}</span>}
              {can(role, 'reagent:write') && (
                <button onClick={() => handleConsume(lot)} style={pillBtn('rgba(168,85,247,0.08)', 'var(--purple)')}>Baixar</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReagentsSection({ token, role }: { token: string; role: string | undefined }) {
  const { data: reagents, mutate } = useSWR(['reagents', token], () => api.getReagents(token))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', manufacturer: '', catalog_number: '', unit: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    if (!form.name.trim() || !form.unit.trim()) { setErr('Nome e unidade são obrigatórios.'); return }
    setSaving(true); setErr('')
    try {
      await api.createReagent(token, {
        name: form.name.trim(), unit: form.unit.trim(),
        manufacturer: form.manufacturer.trim() || null,
        catalog_number: form.catalog_number.trim() || null,
      })
      await mutate()
      setForm({ name: '', manufacturer: '', catalog_number: '', unit: '' })
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar reagente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Reagentes</span>
        {can(role, 'reagent:write') && (
          <button onClick={() => setShowCreate(v => !v)} style={pillBtn('var(--cyan-dim)', 'var(--cyan)')}>
            {showCreate ? '✕ Fechar' : '+ Novo Reagente'}
          </button>
        )}
      </div>

      {showCreate && can(role, 'reagent:write') && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, flex: '1 1 180px' }} />
            <input placeholder="Fabricante" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} style={{ ...inputStyle, flex: '1 1 140px' }} />
            <input placeholder="Nº catálogo" value={form.catalog_number} onChange={e => setForm(f => ({ ...f, catalog_number: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
            <input placeholder="Unidade * (mL, g...)" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inputStyle, flex: '1 1 100px' }} />
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleCreate} disabled={saving} style={pillBtn('var(--cyan)', '#050d1a')}>{saving ? 'Criando...' : 'Criar'}</button>
        </div>
      )}

      {!reagents && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {reagents && reagents.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum reagente cadastrado.</span>
        </div>
      )}
      {reagents && reagents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reagents.map(r => (
            <div key={r.id} className="card" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{r.name}</span>
                {r.manufacturer && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.manufacturer}</span>}
                <span className="badge badge-blue">{r.unit}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{expanded === r.id ? '▲' : '▼'}</span>
              </div>
              {expanded === r.id && <LotsPanel token={token} role={role} reagentId={r.id} unit={r.unit} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Equipamentos ─────────────────────────────────────────────────────────

function statusBadgeClass(s: EquipmentStatus) {
  if (s === 'active') return 'badge-green'
  if (s === 'maintenance') return 'badge-amber'
  return 'badge-red'
}

function CalibrationsPanel({ token, role, equipmentId }: { token: string; role: string | undefined; equipmentId: string }) {
  const { data: calibrations, mutate } = useSWR(['calibrations', equipmentId, token], () => api.getCalibrations(token, equipmentId))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ calibrated_at: '', next_calibration_due: '', certificate_number: '', performed_by: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleAdd() {
    if (!form.calibrated_at || !form.next_calibration_due) { setErr('Datas são obrigatórias.'); return }
    setSaving(true); setErr('')
    try {
      await api.recordCalibration(token, equipmentId, {
        calibrated_at: new Date(form.calibrated_at).toISOString(),
        next_calibration_due: form.next_calibration_due,
        certificate_number: form.certificate_number.trim() || null,
        performed_by: form.performed_by.trim() || null,
      })
      await mutate()
      setForm({ calibrated_at: '', next_calibration_due: '', certificate_number: '', performed_by: '' })
      setShowAdd(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao registrar calibração.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '10px 16px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calibrações</span>
        {can(role, 'equipment:write') && (
          <button onClick={() => setShowAdd(v => !v)} style={pillBtn('rgba(0,212,255,0.08)', 'var(--cyan)')}>
            {showAdd ? '✕' : '+ Calibração'}
          </button>
        )}
      </div>

      {showAdd && can(role, 'equipment:write') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input type="date" value={form.calibrated_at} onChange={e => setForm(f => ({ ...f, calibrated_at: e.target.value }))} style={{ ...inputStyle, flex: '1 1 130px' }} />
          <input type="date" placeholder="Próxima" value={form.next_calibration_due} onChange={e => setForm(f => ({ ...f, next_calibration_due: e.target.value }))} style={{ ...inputStyle, flex: '1 1 130px' }} />
          <input placeholder="Certificado" value={form.certificate_number} onChange={e => setForm(f => ({ ...f, certificate_number: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
          <input placeholder="Executado por" value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
          <button onClick={handleAdd} disabled={saving} style={pillBtn('var(--cyan)', '#050d1a')}>{saving ? '...' : 'Salvar'}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}

      {!calibrations && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>carregando...</div>}
      {calibrations && calibrations.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhuma calibração registrada.</div>}
      {calibrations && calibrations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {calibrations.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-xs)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>{new Date(c.calibrated_at).toLocaleDateString('pt-BR')}</span>
              <span style={{ color: 'var(--text-3)' }}>próxima: {new Date(c.next_calibration_due).toLocaleDateString('pt-BR')}</span>
              {c.certificate_number && <span className="mono" style={{ color: 'var(--text-3)' }}>{c.certificate_number}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function reservationErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  if (e.message.includes('409')) return 'Equipamento já reservado nesse período.'
  if (e.message.includes('404')) return 'Equipamento não encontrado.'
  if (e.message.includes('400')) return 'Data/hora de término precisa ser depois do início.'
  return e.message || fallback
}

function ReservationsPanel({ token, role, equipmentId }: { token: string; role: string | undefined; equipmentId: string }) {
  const { data: reservations, mutate } = useSWR(['reservations', equipmentId, token], () => api.getReservations(token, equipmentId))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ starts_at: '', ends_at: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleAdd() {
    if (!form.starts_at || !form.ends_at) { setErr('Início e término são obrigatórios.'); return }
    if (new Date(form.ends_at).getTime() <= new Date(form.starts_at).getTime()) {
      setErr('O término precisa ser depois do início.')
      return
    }
    setSaving(true); setErr('')
    try {
      await api.createReservation(token, equipmentId, {
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        notes: form.notes.trim() || null,
      })
      await mutate()
      setForm({ starts_at: '', ends_at: '', notes: '' })
      setShowAdd(false)
    } catch (e) {
      setErr(reservationErrorMessage(e, 'Erro ao criar reserva.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(reservation: EquipmentReservation) {
    if (!confirm('Cancelar esta reserva?')) return
    try {
      await api.cancelReservation(token, equipmentId, reservation.id)
      await mutate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao cancelar reserva.')
    }
  }

  return (
    <div style={{ padding: '10px 16px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reservas</span>
        {can(role, 'equipment:write') && (
          <button onClick={() => setShowAdd(v => !v)} style={pillBtn('rgba(0,212,255,0.08)', 'var(--cyan)')}>
            {showAdd ? '✕' : '+ Reservar'}
          </button>
        )}
      </div>

      {showAdd && can(role, 'equipment:write') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} style={{ ...inputStyle, flex: '1 1 180px' }} />
          <input type="datetime-local" placeholder="Término" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} style={{ ...inputStyle, flex: '1 1 180px' }} />
          <input placeholder="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, flex: '1 1 140px' }} />
          <button onClick={handleAdd} disabled={saving} style={pillBtn('var(--cyan)', '#050d1a')}>{saving ? '...' : 'Salvar'}</button>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}

      {!reservations && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>carregando...</div>}
      {reservations && reservations.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhuma reserva registrada.</div>}
      {reservations && reservations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {reservations.map(r => {
            const ended = new Date(r.ends_at).getTime() < Date.now()
            const inactive = r.status === 'cancelled' || ended
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-xs)', fontSize: 12, color: inactive ? 'var(--text-3)' : undefined }}>
                <span style={{ color: inactive ? 'var(--text-3)' : 'var(--text-2)' }}>
                  {new Date(r.starts_at).toLocaleString('pt-BR')} → {new Date(r.ends_at).toLocaleString('pt-BR')}
                </span>
                {r.notes && <span style={{ color: 'var(--text-3)', flex: 1 }}>{r.notes}</span>}
                {r.status === 'cancelled' && <span className="badge badge-red">cancelada</span>}
                {r.status === 'confirmed' && ended && <span className="badge badge-amber">encerrada</span>}
                {r.status === 'confirmed' && !ended && can(role, 'equipment:write') && (
                  <button onClick={() => handleCancel(r)} style={pillBtn('rgba(239,68,68,0.08)', 'var(--red)')}>Cancelar</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function EquipmentSection({ token, role }: { token: string; role: string | undefined }) {
  const { data: equipment, mutate } = useSWR(['equipment', token], () => api.getEquipment(token))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', identifier: '', manufacturer: '', model: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      await api.createEquipment(token, {
        name: form.name.trim(),
        identifier: form.identifier.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        location: form.location.trim() || null,
      })
      await mutate()
      setForm({ name: '', identifier: '', manufacturer: '', model: '', location: '' })
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar equipamento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(eq: Equipment, status: EquipmentStatus) {
    try {
      await api.updateEquipmentStatus(token, eq.id, status)
      await mutate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao mudar status.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Equipamentos</span>
        {can(role, 'equipment:write') && (
          <button onClick={() => setShowCreate(v => !v)} style={pillBtn('var(--cyan-dim)', 'var(--cyan)')}>
            {showCreate ? '✕ Fechar' : '+ Novo Equipamento'}
          </button>
        )}
      </div>

      {showCreate && can(role, 'equipment:write') && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, flex: '1 1 180px' }} />
            <input placeholder="Identificador (patrimônio)" value={form.identifier} onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} style={{ ...inputStyle, flex: '1 1 140px' }} />
            <input placeholder="Fabricante" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
            <input placeholder="Modelo" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
            <input placeholder="Localização" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ ...inputStyle, flex: '1 1 120px' }} />
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleCreate} disabled={saving} style={pillBtn('var(--cyan)', '#050d1a')}>{saving ? 'Criando...' : 'Criar'}</button>
        </div>
      )}

      {!equipment && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {equipment && equipment.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum equipamento cadastrado.</span>
        </div>
      )}
      {equipment && equipment.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {equipment.map(eq => (
            <div key={eq.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  onClick={() => setExpanded(expanded === eq.id ? null : eq.id)}
                  style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, cursor: 'pointer' }}
                >
                  {eq.name}
                </span>
                {eq.location && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{eq.location}</span>}
                {can(role, 'equipment:write') ? (
                  <select
                    value={eq.status}
                    onChange={e => handleStatusChange(eq, e.target.value as EquipmentStatus)}
                    className={`badge ${statusBadgeClass(eq.status)}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    <option value="active">active</option>
                    <option value="maintenance">maintenance</option>
                    <option value="retired">retired</option>
                  </select>
                ) : (
                  <span className={`badge ${statusBadgeClass(eq.status)}`}>{eq.status}</span>
                )}
                <span onClick={() => setExpanded(expanded === eq.id ? null : eq.id)} style={{ color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
                  {expanded === eq.id ? '▲' : '▼'}
                </span>
              </div>
              {expanded === eq.id && (
                <>
                  <CalibrationsPanel token={token} role={role} equipmentId={eq.id} />
                  <ReservationsPanel token={token} role={role} equipmentId={eq.id} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
