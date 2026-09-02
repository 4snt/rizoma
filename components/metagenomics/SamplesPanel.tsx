'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { api, type Sample } from '@/lib/api'
import { autoPair, type BatchPair } from '@/lib/metagenomics-utils'

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', padding: '6px 10px', boxSizing: 'border-box',
}
const sel: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
}

/** Painel ① Amostras — upload em lote (pasta/arquivos), importação SRA e tabela. */
export default function SamplesPanel({ projectId }: { projectId: string }) {
  const { data: samples, mutate: mutateSamples } = useSWR(
    `meta-samples-${projectId}`, () => api.getSamples(projectId), { refreshInterval: 15000 })
  const samplesWithFastq = (samples ?? []).filter((s: Sample) => s.fastq_r1_oid && s.fastq_r2_oid)

  const [showUpload, setShowUpload] = useState(false)
  const [batchPairs, setBatchPairs] = useState<BatchPair[]>([])
  const [batchUnmatched, setBatchUnmatched] = useState<string[]>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchError, setBatchError] = useState('')
  const [uploadMode, setUploadMode] = useState<'folder' | 'files'>('folder')
  const batchRef = useRef<HTMLInputElement>(null)

  const [showSra, setShowSra] = useState(false)
  const [sraAcc, setSraAcc] = useState('')
  const [sraMeta, setSraMeta] = useState<any>(null)
  const [sraTreatment, setSraTreatment] = useState('')
  const [sraRep, setSraRep] = useState(1)
  const [sraVerifying, setSraVerifying] = useState(false)
  const [sraImporting, setSraImporting] = useState(false)
  const [sraMsg, setSraMsg] = useState('')

  function handleBatchSelect(files: FileList | null) {
    if (!files) return
    const { pairs, unmatched } = autoPair(Array.from(files))
    setBatchPairs(pairs); setBatchUnmatched(unmatched); setBatchDone(0); setBatchError('')
  }

  async function handleBatchUpload() {
    if (!batchPairs.length) return
    setBatchUploading(true); setBatchDone(0); setBatchError('')
    let done = 0
    for (const pair of batchPairs) {
      try {
        await api.uploadFastqPair(pair.r1, pair.r2, projectId)
        done++; setBatchDone(done)
      } catch {
        setBatchError(`Falha em ${pair.name}. ${done}/${batchPairs.length} enviados.`)
        setBatchUploading(false); return
      }
    }
    await mutateSamples()
    setBatchUploading(false)
    setTimeout(() => { setBatchPairs([]); setBatchUnmatched([]); setBatchDone(0); setShowUpload(false) }, 1500)
  }

  async function handleSraVerify() {
    const acc = sraAcc.trim().toUpperCase()
    if (!acc) return
    setSraVerifying(true); setSraMeta(null); setSraMsg('')
    try {
      const m = await api.sraPreview(acc)
      setSraMeta(m)
      if (m.sample_name) setSraTreatment(m.sample_name)
    } catch (e) { setSraMsg((e as Error).message) } finally { setSraVerifying(false) }
  }

  async function handleSraImport() {
    if (!sraMeta) return
    setSraImporting(true); setSraMsg('Baixando FASTQs...')
    try {
      await api.importSra({ accession: sraMeta.accession, project_id: projectId, treatment_group: sraTreatment, replicate: sraRep })
      setSraMsg('Concluído')
      await mutateSamples()
      setTimeout(() => { setSraMeta(null); setSraAcc(''); setSraMsg(''); setShowSra(false) }, 1500)
    } catch (e) { setSraMsg((e as Error).message) } finally { setSraImporting(false) }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>① Amostras</span>
        <span className="badge badge-cyan">{samplesWithFastq.length} FASTQ</span>
        <button onClick={() => { setShowSra(false); setShowUpload(v => !v) }}
          style={{ ...sel, color: showUpload ? 'var(--cyan)' : 'var(--text-2)', background: showUpload ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)', border: `1px solid ${showUpload ? 'rgba(0,212,255,0.3)' : 'var(--border)'}` }}>
          {showUpload ? '✕ Fechar' : '↑ Upload FASTQ'}
        </button>
        <button onClick={() => { setShowUpload(false); setShowSra(v => !v) }}
          style={{ ...sel, color: showSra ? 'var(--amber)' : 'var(--text-2)', background: showSra ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)', border: `1px solid ${showSra ? 'rgba(245,158,11,0.3)' : 'var(--border)'}` }}>
          {showSra ? '✕ Fechar' : '⬇ Importar SRA'}
        </button>
      </div>

      {showUpload && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([['folder', '📁 Pasta'], ['files', '📄 Arquivos']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => { setUploadMode(mode); setBatchPairs([]); setBatchUnmatched([]) }}
                style={{ ...sel, color: uploadMode === mode ? 'var(--cyan)' : 'var(--text-2)', background: uploadMode === mode ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)', border: `1px solid ${uploadMode === mode ? 'rgba(0,212,255,0.3)' : 'var(--border)'}` }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
            {uploadMode === 'folder' ? 'Selecione a pasta inteira com os FASTQs.' : 'Selecione todos os arquivos R1 e R2 juntos.'}{' '}
            Os pares são detectados automaticamente pelo padrão <code style={{ color: 'var(--cyan)' }}>_R1_</code> / <code style={{ color: 'var(--cyan)' }}>_R2_</code>.
          </div>
          <input key={uploadMode} ref={batchRef} type="file" accept=".fastq,.fastq.gz,.fq,.fq.gz" multiple
            onChange={e => handleBatchSelect(e.target.files)}
            style={{ color: 'var(--text)', fontSize: 12, marginBottom: 10, display: 'block' }}
            {...(uploadMode === 'folder' ? ({ webkitdirectory: '', directory: '' } as any) : {})} />
          {batchPairs.length > 0 && <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 6 }}>✓ {batchPairs.length} par(es) R1+R2 detectado(s)</div>}
          {batchUnmatched.length > 0 && <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 6 }}>⚠ Sem par R2: {batchUnmatched.join(', ')}</div>}
          {batchUploading && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(batchDone / batchPairs.length * 100)}%`, background: 'var(--cyan)', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{batchDone}/{batchPairs.length} pares enviados…</div>
            </div>
          )}
          {batchError && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{batchError}</div>}
          <button onClick={handleBatchUpload} disabled={!batchPairs.length || batchUploading}
            style={{ padding: '6px 16px', background: batchPairs.length && !batchUploading ? 'var(--cyan)' : 'var(--surface-2)', color: batchPairs.length && !batchUploading ? '#050d1a' : 'var(--text-3)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: batchPairs.length && !batchUploading ? 'pointer' : 'not-allowed' }}>
            {batchUploading ? `${batchDone}/${batchPairs.length}…` : `Enviar ${batchPairs.length} par(es)`}
          </button>
        </div>
      )}

      {showSra && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={sraAcc} onChange={e => { setSraAcc(e.target.value.toUpperCase()); setSraMeta(null); setSraMsg('') }}
              placeholder="SRR9847653 · ERR123456 · GSM…" style={{ ...inp, flex: 1, minWidth: 160 }} />
            <button onClick={handleSraVerify} disabled={!sraAcc.trim() || sraVerifying}
              style={{ padding: '6px 16px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, color: 'var(--amber)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {sraVerifying ? '...' : 'Verificar'}
            </button>
          </div>
          {sraMeta && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                {sraMeta.accession} · {sraMeta.library_layout} · {sraMeta.organism}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Grupo tratamento</label>
                  <input value={sraTreatment} onChange={e => setSraTreatment(e.target.value)} placeholder="T1 / Control" style={{ ...inp, width: 120 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Réplica #</label>
                  <input type="number" min={1} value={sraRep} onChange={e => setSraRep(Number(e.target.value))} style={{ ...inp, width: 64 }} />
                </div>
                <button onClick={handleSraImport} disabled={sraImporting || !sraTreatment.trim()}
                  style={{ padding: '6px 14px', background: sraImporting || !sraTreatment.trim() ? 'var(--surface-2)' : 'var(--amber)', border: 'none', borderRadius: 6, color: sraImporting || !sraTreatment.trim() ? 'var(--text-3)' : '#050d1a', fontSize: 12, fontWeight: 700, cursor: sraImporting || !sraTreatment.trim() ? 'not-allowed' : 'pointer' }}>
                  {sraImporting ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </div>
          )}
          {sraMsg && (
            <div style={{ fontSize: 11, color: sraMsg === 'Concluído' ? 'var(--green)' : 'var(--red)' }}>
              {sraMsg === 'Concluído' ? '✓ ' : '✗ '}{sraMsg}
            </div>
          )}
        </div>
      )}

      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {(!samples || samples.length === 0) && (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            Nenhuma amostra. Faça upload de FASTQs ou importe do SRA.
          </div>
        )}
        {samples && samples.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Arquivo', 'Grupo', 'Réplica', 'R1 OID'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.map((s: Sample) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.filename}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{s.treatment_group}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{s.replicate}</td>
                  <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text-3)', fontSize: 10 }}>{s.fastq_r1_oid ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
