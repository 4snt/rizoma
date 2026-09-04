'use client'

import { Fragment, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  api,
  type GenePurpose,
  type OrganismType,
  type SampleGene,
  type CreateSampleGeneBody,
  GENE_PURPOSES,
  GENE_PURPOSE_LABELS,
} from '@/lib/api'
import { can } from '@/lib/permissions'
import { parseFasta, toFasta, downloadFasta } from '@/lib/fasta'
import { FileUploadField } from '@/components/files/FileUploadField'
import { fmtDate, inputStyle, labelStyle, primaryButtonStyle, selectStyle, smallButtonStyle, tdStyle, textareaStyle, thStyle } from './styles'
import { InlineDeleteButton, SectionHeader, ToggleButton } from './ui'

const COMMON_GENES = ['16S', 'ITS', 'nifH', 'gyrB', 'rpoB']

type GeneForm = {
  gene: string
  purpose: GenePurpose
  result: string
  ncbi_accession: string
  method: string
  tested_at: string
  notes: string
  sequence: string
  primer_forward: string
  primer_reverse: string
  blast_top_hit: string
  blast_identity_pct: string
  blast_coverage_pct: string
  blast_hit_accession: string
}

const EMPTY_FORM: GeneForm = {
  gene: '', purpose: 'identificacao', result: '', ncbi_accession: '', method: '', tested_at: '', notes: '',
  sequence: '', primer_forward: '', primer_reverse: '',
  blast_top_hit: '', blast_identity_pct: '', blast_coverage_pct: '', blast_hit_accession: '',
}

function geneToForm(g: SampleGene): GeneForm {
  return {
    gene: g.gene,
    purpose: g.purpose,
    result: g.result ?? '',
    ncbi_accession: g.ncbi_accession ?? '',
    method: g.method ?? '',
    tested_at: g.tested_at ?? '',
    notes: g.notes ?? '',
    // Re-hidrata como FASTA pra que o header volte junto ao editar.
    sequence: g.sequence ? toFasta(g.sequence_header, g.sequence).trimEnd() : '',
    primer_forward: g.primer_forward ?? '',
    primer_reverse: g.primer_reverse ?? '',
    blast_top_hit: g.blast_top_hit ?? '',
    blast_identity_pct: g.blast_identity_pct != null ? String(g.blast_identity_pct) : '',
    blast_coverage_pct: g.blast_coverage_pct != null ? String(g.blast_coverage_pct) : '',
    blast_hit_accession: g.blast_hit_accession ?? '',
  }
}

function pctOrNull(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formToBody(f: GeneForm): CreateSampleGeneBody {
  const parsed = parseFasta(f.sequence)
  const hasSeq = parsed.length > 0
  return {
    gene: f.gene.trim(),
    purpose: f.purpose,
    result: f.result.trim() || null,
    ncbi_accession: f.ncbi_accession.trim() || null,
    method: f.method.trim() || null,
    tested_at: f.tested_at || null,
    notes: f.notes.trim() || null,
    // Manda o texto colado — o backend normaliza e extrai o header; se o
    // parse local já achou header, envia explícito também.
    sequence: hasSeq ? f.sequence : null,
    sequence_header: hasSeq ? parsed.header : null,
    primer_forward: f.primer_forward.trim() || null,
    primer_reverse: f.primer_reverse.trim() || null,
    blast_top_hit: f.blast_top_hit.trim() || null,
    blast_hit_accession: f.blast_hit_accession.trim() || null,
    blast_identity_pct: pctOrNull(f.blast_identity_pct),
    blast_coverage_pct: pctOrNull(f.blast_coverage_pct),
  }
}

const rowInput = (extra?: React.CSSProperties): React.CSSProperties => ({ ...inputStyle, width: undefined, ...extra })

export function GenesPanel({ token, role, sampleId, organismType, projectId, embedded }: {
  token: string
  role: string | undefined
  sampleId: string
  organismType?: OrganismType | null
  projectId: string
  embedded?: boolean
}) {
  const { data: genes, mutate } = useSWR(['sample-genes', sampleId, token], () => api.getSampleGenes(token, sampleId))
  const { data: sample } = useSWR(['lims-sample', sampleId, token], () => api.getLimsSample(token, sampleId))
  const [showForm, setShowForm] = useState(!!embedded)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GeneForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const writable = can(role, 'sample:write')
  const sampleCode = sample?.code ?? 'amostra'

  // Fungo: ITS é o marcador padrão de identificação — vai primeiro na sugestão.
  const geneSuggestions = organismType === 'fungo'
    ? ['ITS', ...COMMON_GENES.filter(g => g !== 'ITS')]
    : COMMON_GENES

  const parsed = useMemo(() => parseFasta(form.sequence), [form.sequence])
  const seqInvalid = parsed.invalidChars.length > 0

  function openCreate() {
    setEditingId(null); setForm(EMPTY_FORM); setErr(''); setShowForm(true)
  }
  function openEdit(g: SampleGene) {
    setEditingId(g.id); setForm(geneToForm(g)); setErr(''); setShowForm(true)
  }
  function closeForm() {
    setEditingId(null); setForm(EMPTY_FORM); setErr('')
    if (!embedded) setShowForm(false)
  }

  async function handleSave() {
    if (!form.gene.trim()) { setErr('Gene é obrigatório.'); return }
    if (seqInvalid) { setErr(`Sequência contém caracteres inválidos: ${parsed.invalidChars.join(', ')}`); return }
    for (const [k, label] of [['blast_identity_pct', 'Identidade'], ['blast_coverage_pct', 'Cobertura']] as const) {
      const n = pctOrNull(form[k])
      if (form[k].trim() !== '' && (n == null || n < 0 || n > 100)) { setErr(`${label} BLAST deve ser um número entre 0 e 100.`); return }
    }
    setSaving(true); setErr('')
    try {
      const body = formToBody(form)
      if (editingId) await api.updateSampleGene(token, sampleId, editingId, body)
      else await api.createSampleGene(token, sampleId, body)
      await mutate()
      closeForm()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar gene.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(geneId: string) {
    setErr('')
    try {
      await api.deleteSampleGene(token, sampleId, geneId)
      if (editingId === geneId) closeForm()
      await mutate()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao excluir gene.')
    }
  }

  const upd = (k: keyof GeneForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const geneForm = (
    <div className={embedded ? undefined : 'card'} style={{ padding: embedded ? 0 : 16, marginBottom: 14 }}>
      {editingId && (
        <div style={{ fontSize: 12, color: 'var(--cyan)', marginBottom: 10, fontWeight: 600 }}>
          Editando gene <span className="mono">{form.gene}</span>
        </div>
      )}
      <datalist id="sample-gene-names">
        {geneSuggestions.map(g => <option key={g} value={g} />)}
      </datalist>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <input list="sample-gene-names" placeholder="Gene *" value={form.gene} onChange={upd('gene')}
          style={rowInput({ flex: '1 1 140px', fontFamily: 'var(--mono)' })} />
        <select value={form.purpose} onChange={upd('purpose')} style={{ ...selectStyle, width: undefined, flex: '0 1 190px' }}>
          {GENE_PURPOSES.map(p => <option key={p} value={p}>{GENE_PURPOSE_LABELS[p]}</option>)}
        </select>
        <input placeholder="Espécie identificada ou resultado" value={form.result} onChange={upd('result')}
          style={rowInput({ flex: '2 1 220px' })} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <input placeholder="NCBI accession" value={form.ncbi_accession} onChange={upd('ncbi_accession')}
          style={rowInput({ flex: '1 1 150px', fontFamily: 'var(--mono)' })} />
        <input placeholder="Método" value={form.method} onChange={upd('method')}
          style={rowInput({ flex: '1 1 140px' })} />
        <input type="date" value={form.tested_at} onChange={upd('tested_at')}
          style={rowInput({ flex: '0 1 160px', fontFamily: 'var(--mono)' })} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Sequência (FASTA ou bases)</label>
        <textarea rows={6} value={form.sequence} onChange={upd('sequence')} spellCheck={false}
          placeholder={'>Isolado_16S\nAGAGTTTGATCCTGGCTCAG…'}
          style={{ ...textareaStyle, fontSize: 12 }} />
        {parsed.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, fontFamily: 'var(--mono)' }}>
            {parsed.header ? `${parsed.header} · ` : ''}{parsed.length} pb{parsed.gcPercent != null ? ` · GC ${parsed.gcPercent}%` : ''}
          </div>
        )}
        {seqInvalid && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
            Caracteres inválidos: {parsed.invalidChars.join(', ')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Primer forward</label>
          <input placeholder="27F" value={form.primer_forward} onChange={upd('primer_forward')}
            style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Primer reverse</label>
          <input placeholder="1492R" value={form.primer_reverse} onChange={upd('primer_reverse')}
            style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>BLAST</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={labelStyle}>Top hit</label>
            <input placeholder="Bacillus subtilis" value={form.blast_top_hit} onChange={upd('blast_top_hit')}
              style={{ ...inputStyle, fontStyle: form.blast_top_hit ? 'italic' : undefined }} />
          </div>
          <div style={{ flex: '1 1 110px' }}>
            <label style={labelStyle}>Identidade (%)</label>
            <input type="number" min={0} max={100} step={0.1} placeholder="99.2" value={form.blast_identity_pct}
              onChange={upd('blast_identity_pct')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
          </div>
          <div style={{ flex: '1 1 110px' }}>
            <label style={labelStyle}>Cobertura (%)</label>
            <input type="number" min={0} max={100} step={0.1} placeholder="100" value={form.blast_coverage_pct}
              onChange={upd('blast_coverage_pct')} style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={labelStyle}>Accession do hit</label>
            <input placeholder="NR_112116.2" value={form.blast_hit_accession} onChange={upd('blast_hit_accession')}
              style={{ ...inputStyle, fontFamily: 'var(--mono)' }} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <input placeholder="Notas" value={form.notes} onChange={upd('notes')} style={inputStyle} />
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving || seqInvalid}
          style={{ ...primaryButtonStyle, cursor: saving || seqInvalid ? 'not-allowed' : 'pointer', opacity: seqInvalid ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Registrar'}
        </button>
        {editingId && (
          <button type="button" onClick={closeForm} style={smallButtonStyle}>Cancelar edição</button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: embedded ? 0 : 32 }}>
      {!embedded && (
        <SectionHeader
          title="Genes sequenciados"
          action={writable && (
            <ToggleButton open={showForm} openLabel="✕ Fechar" closedLabel="+ Registrar Gene"
              onClick={() => (showForm ? closeForm() : openCreate())} />
          )}
        />
      )}

      {showForm && writable && geneForm}
      {!showForm && err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}

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
                <th style={{ ...thStyle, width: 28 }} />
                <th style={thStyle}>Gene</th>
                <th style={thStyle}>Finalidade</th>
                <th style={thStyle}>Hit BLAST</th>
                <th style={thStyle}>pb</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {genes.map(g => {
                const open = !!expanded[g.id]
                const hasSeq = !!g.sequence
                return (
                  <Fragment key={g.id}>
                    <tr style={{ background: 'var(--surface)', borderBottom: open ? 'none' : '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, padding: '10px 6px 10px 12px' }}>
                        <button type="button" aria-label={open ? 'Recolher' : 'Expandir'} aria-expanded={open}
                          onClick={() => setExpanded(m => ({ ...m, [g.id]: !open }))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                          {open ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{g.gene}</span>
                        {g.result && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{g.result}</div>}
                      </td>
                      <td style={tdStyle}><span className="badge badge-blue">{GENE_PURPOSE_LABELS[g.purpose] ?? g.purpose}</span></td>
                      <td style={tdStyle}>
                        {g.blast_top_hit ? (
                          <>
                            <span style={{ fontStyle: 'italic', color: 'var(--text)' }}>{g.blast_top_hit}</span>
                            {(g.blast_identity_pct != null || g.blast_coverage_pct != null) && (
                              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                                {g.blast_identity_pct != null ? `${g.blast_identity_pct}% id` : ''}
                                {g.blast_identity_pct != null && g.blast_coverage_pct != null ? ' · ' : ''}
                                {g.blast_coverage_pct != null ? `${g.blast_coverage_pct}% cov` : ''}
                              </div>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}><span className="mono">{g.sequence_length ?? '—'}</span></td>
                      <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(g.tested_at)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {writable && (
                            <button type="button" onClick={() => openEdit(g)} style={{ ...smallButtonStyle, color: 'var(--cyan)' }}>Editar</button>
                          )}
                          {hasSeq && (
                            <button type="button" style={smallButtonStyle}
                              onClick={() => downloadFasta(`${sampleCode}_${g.gene}.fasta`, g.sequence_header ?? `${sampleCode}_${g.gene}`, g.sequence!)}>
                              FASTA
                            </button>
                          )}
                          {writable && <InlineDeleteButton onConfirm={() => handleDelete(g.id)} />}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={7} style={{ padding: '4px 12px 14px 40px' }}>
                          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                                Sequência{g.sequence_length != null ? ` · ${g.sequence_length} pb` : ''}
                              </div>
                              {hasSeq ? (
                                <pre style={{
                                  margin: 0, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5, color: 'var(--text-2)',
                                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
                                  padding: 10, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre',
                                }}>
                                  {toFasta(g.sequence_header ?? `${sampleCode}_${g.gene}`, g.sequence!)}
                                </pre>
                              ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sem sequência registrada.</div>
                              )}
                              {(g.primer_forward || g.primer_reverse || g.ncbi_accession || g.method || g.notes) && (
                                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {g.primer_forward && <span>F: <span className="mono">{g.primer_forward}</span></span>}
                                  {g.primer_reverse && <span>R: <span className="mono">{g.primer_reverse}</span></span>}
                                  {g.ncbi_accession && <span>NCBI: <span className="mono">{g.ncbi_accession}</span></span>}
                                  {g.blast_hit_accession && <span>hit: <span className="mono">{g.blast_hit_accession}</span></span>}
                                  {g.method && <span>{g.method}</span>}
                                  {g.notes && <span>{g.notes}</span>}
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                                Anexos do gene
                              </div>
                              <FileUploadField
                                projectId={projectId}
                                sampleId={sampleId}
                                sampleGeneId={g.id}
                                categories={['fasta', 'chromatogram']}
                                defaultCategory="fasta"
                                accept=".fasta,.fa,.fna,.txt,.ab1,.scf"
                                compact
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default GenesPanel
