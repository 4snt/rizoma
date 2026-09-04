'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { can } from '@/lib/permissions'

// Catálogo aberto: são só sugestões (datalist), qualquer texto é aceito.
const COMMON_TESTS = [
  'Catalase', 'Esterase', 'Urease', 'Hipersensibilidade', 'Fosfatase Ácida',
  'Fosfatase Alcalina', 'Oxidase', 'Sideróforos', 'Produção AIA', 'Desoxigenase', 'Desalogenase',
]
const COMMON_RESULTS = ['+', '-', '++', '-+', 'N']

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
  color: 'var(--text)', fontSize: 13, padding: '7px 12px', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-2)' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  // tested_at é 'YYYY-MM-DD'; evita deslocamento de fuso ao construir Date.
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

export function TestsPanel({ token, role, sampleId }: { token: string; role: string | undefined; sampleId: string }) {
  const { data: tests, mutate } = useSWR(['sample-tests', sampleId, token], () => api.getSampleTests(token, sampleId))
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ test_name: '', result: '', method: '', tested_at: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const writable = can(role, 'sample:write')

  async function handleCreate() {
    if (!form.test_name.trim()) { setErr('Nome do teste é obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      await api.createSampleTest(token, sampleId, {
        test_name: form.test_name.trim(),
        result: form.result.trim() || null,
        method: form.method.trim() || null,
        tested_at: form.tested_at || null,
        notes: form.notes.trim() || null,
      })
      await mutate()
      setForm({ test_name: '', result: '', method: '', tested_at: '', notes: '' })
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao registrar teste.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Testes bioquímicos / enzimáticos</span>
        {writable && (
          <button onClick={() => setShowCreate(v => !v)} style={{
            padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {showCreate ? '✕ Fechar' : '+ Registrar Teste'}
          </button>
        )}
      </div>

      {showCreate && writable && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <datalist id="sample-test-names">
            {COMMON_TESTS.map(t => <option key={t} value={t} />)}
          </datalist>
          <datalist id="sample-test-results">
            {COMMON_RESULTS.map(r => <option key={r} value={r} />)}
          </datalist>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input list="sample-test-names" placeholder="Teste *" value={form.test_name}
              onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))}
              style={{ ...inputStyle, flex: '1 1 180px' }} />
            <input list="sample-test-results" placeholder="Resultado (+, -, ++…)" value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
              style={{ ...inputStyle, flex: '0 1 150px', fontFamily: 'var(--mono)' }} />
            <input placeholder="Método" value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              style={{ ...inputStyle, flex: '1 1 140px' }} />
            <input type="date" value={form.tested_at}
              onChange={e => setForm(f => ({ ...f, tested_at: e.target.value }))}
              style={{ ...inputStyle, flex: '0 1 160px', fontFamily: 'var(--mono)' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <input placeholder="Notas" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }} />
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <button onClick={handleCreate} disabled={saving} style={{
            padding: '7px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--shape-full)',
            color: '#050d1a', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      )}

      {!tests && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {tests && tests.length === 0 && (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum teste registrado.</span>
        </div>
      )}
      {tests && tests.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={thStyle}>Teste</th>
                <th style={thStyle}>Resultado</th>
                <th style={thStyle}>Método</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text)', fontWeight: 600 }}>{t.test_name}</td>
                  <td style={tdStyle}><span className="mono" style={{ color: 'var(--cyan)' }}>{t.result ?? '—'}</span></td>
                  <td style={tdStyle}>{t.method ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(t.tested_at)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{t.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TestsPanel
