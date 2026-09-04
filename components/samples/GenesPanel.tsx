'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  api,
  type GenePurpose,
  type OrganismType,
  GENE_PURPOSES,
  GENE_PURPOSE_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'

const COMMON_GENES = ['16S', 'ITS', 'nifH', 'gyrB', 'rpoB']

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
  color: 'var(--text)', fontSize: 13, padding: '7px 12px', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)', padding: '7px 10px', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-2)' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

export function GenesPanel({ token, role, sampleId, organismType }: {
  token: string
  role: string | undefined
  sampleId: string
  organismType?: OrganismType | null
}) {
  const { data: genes, mutate } = useSWR(['sample-genes', sampleId, token], () => api.getSampleGenes(token, sampleId))
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    gene: '', purpose: 'identificacao' as GenePurpose, result: '',
    ncbi_accession: '', method: '', tested_at: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const writable = can(role, 'sample:write')

  // Fungo: ITS é o marcador padrão de identificação — vai primeiro na sugestão.
  const geneSuggestions = organismType === 'fungo'
    ? ['ITS', ...COMMON_GENES.filter(g => g !== 'ITS')]
    : COMMON_GENES

  async function handleCreate() {
    if (!form.gene.trim()) { setErr('Gene é obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      await api.createSampleGene(token, sampleId, {
        gene: form.gene.trim(),
        purpose: form.purpose,
        result: form.result.trim() || null,
        ncbi_accession: form.ncbi_accession.trim() || null,
        method: form.method.trim() || null,
        tested_at: form.tested_at || null,
        notes: form.notes.trim() || null,
      })
      await mutate()
      setForm({ gene: '', purpose: 'identificacao', result: '', ncbi_accession: '', method: '', tested_at: '', notes: '' })
      setShowCreate(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao registrar gene.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Genes sequenciados</span>
        {writable && (
          <button onClick={() => setShowCreate(v => !v)} style={{
            padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {showCreate ? '✕ Fechar' : '+ Registrar Gene'}
          </button>
        )}
      </div>

      {showCreate && writable && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <datalist id="sample-gene-names">
            {geneSuggestions.map(g => <option key={g} value={g} />)}
          </datalist>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input list="sample-gene-names" placeholder="Gene *" value={form.gene}
              onChange={e => setForm(f => ({ ...f, gene: e.target.value }))}
              style={{ ...inputStyle, flex: '1 1 140px', fontFamily: 'var(--mono)' }} />
            <select value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value as GenePurpose }))}
              style={{ ...selectStyle, flex: '0 1 190px' }}>
              {GENE_PURPOSES.map(p => <option key={p} value={p}>{GENE_PURPOSE_LABELS[p]}</option>)}
            </select>
            <input placeholder="Espécie identificada ou resultado" value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
              style={{ ...inputStyle, flex: '2 1 220px' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input placeholder="NCBI accession" value={form.ncbi_accession}
              onChange={e => setForm(f => ({ ...f, ncbi_accession: e.target.value }))}
              style={{ ...inputStyle, flex: '1 1 150px', fontFamily: 'var(--mono)' }} />
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

      {!genes && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {genes && genes.length === 0 && (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum gene registrado.</span>
        </div>
      )}
      {genes && genes.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <th style={thStyle}>Gene</th>
                <th style={thStyle}>Finalidade</th>
                <th style={thStyle}>Resultado</th>
                <th style={thStyle}>NCBI</th>
                <th style={thStyle}>Método</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {genes.map(g => (
                <tr key={g.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{g.gene}</span></td>
                  <td style={tdStyle}><span className="badge badge-blue">{GENE_PURPOSE_LABELS[g.purpose] ?? g.purpose}</span></td>
                  <td style={tdStyle}>{g.result ?? '—'}</td>
                  <td style={tdStyle}><span className="mono" style={{ fontSize: 12 }}>{g.ncbi_accession ?? '—'}</span></td>
                  <td style={tdStyle}>{g.method ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(g.tested_at)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{g.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default GenesPanel
