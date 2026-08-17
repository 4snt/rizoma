'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import {
  api,
  type Reagent, type ReagentLot,
  type Equipment, type EquipmentStatus,
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

function AlertsPanel({ token }: { token: string }) {
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

function ReagentsSection({ token, role }: { token: string; role: string | undefined }) {
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

function EquipmentSection({ token, role }: { token: string; role: string | undefined }) {
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
              {expanded === eq.id && <CalibrationsPanel token={token} role={role} equipmentId={eq.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Inventário</h1>
        <p className="page-subtitle">Reagentes, lotes, equipamentos e calibração</p>
      </div>

      {token && <AlertsPanel token={token} />}
      {token && <ReagentsSection token={token} role={role} />}
      {token && <EquipmentSection token={token} role={role} />}
    </>
  )
}
