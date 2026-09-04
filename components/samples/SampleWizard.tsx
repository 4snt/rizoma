'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import {
  api,
  type LimsSample,
  type LimsSampleMatrix,
  type OrganismType,
  type SampleUpdate,
  ORGANISM_TYPES,
  ORGANISM_TYPE_LABELS,
} from '@/lib/api'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { FileUploadField } from '@/components/files/FileUploadField'
import { MorphologyFields, morphologyToForm, morphologyToPatch, type MorphologyFormValue } from '@/components/samples/MorphologyFields'
import { CultureFields, cultureToForm, cultureToPatch, type CultureFormValue } from '@/components/samples/CultureFields'
import { OriginFields, originToForm, originToPatch, type OriginFormValue } from '@/components/samples/OriginFields'
import { TestsPanel } from '@/components/samples/TestsPanel'
import { GenesPanel } from '@/components/samples/GenesPanel'
import { AliquotsPanel } from '@/components/samples/AliquotsPanel'
import { inputStyle, selectStyle, labelStyle } from '@/components/samples/styles'

const MATRIX_OPTIONS: LimsSampleMatrix[] = [
  'solo', 'sedimento', 'agua', 'tecido_vegetal', 'raiz', 'folha',
  'biomassa', 'cultura_microbiana', 'dna', 'rna', 'extrato',
  'biochar', 'formulado', 'substrato',
]
const DEFAULT_MATRIX: LimsSampleMatrix = 'solo'

const STEPS = [
  { n: 1, label: 'Identificação' },
  { n: 2, label: 'Origem e coleta' },
  { n: 3, label: 'Cultivo e morfologia' },
  { n: 4, label: 'Testes bioquímicos' },
  { n: 5, label: 'Genes e sequências' },
  { n: 6, label: 'Armazenamento e anexos' },
] as const
const LAST_STEP = STEPS.length

interface IdentForm {
  code: string
  strain_name: string
  organism_type: OrganismType | ''
  matrix: LimsSampleMatrix
  treatment_group: string
  replicate: string
}

function identToForm(s: LimsSample): IdentForm {
  return {
    code: s.code,
    strain_name: s.strain_name ?? '',
    organism_type: s.organism_type ?? '',
    matrix: s.matrix,
    treatment_group: s.treatment_group ?? '',
    replicate: s.replicate != null ? String(s.replicate) : '',
  }
}

const EMPTY_IDENT: IdentForm = {
  code: '', strain_name: '', organism_type: '', matrix: DEFAULT_MATRIX, treatment_group: '', replicate: '',
}

/** Só os campos de identificação editáveis via PATCH (code/matrix são fixos após criação). */
function identToPatch(f: IdentForm, base: LimsSample): SampleUpdate {
  const patch: SampleUpdate = {}
  const strain = f.strain_name.trim() || null
  const group = f.treatment_group.trim() || null
  const rep = f.replicate ? Number(f.replicate) : null
  const org = f.organism_type || null
  if (strain !== base.strain_name) patch.strain_name = strain
  if (group !== base.treatment_group) patch.treatment_group = group
  if (rep !== base.replicate) patch.replicate = rep
  if (org !== base.organism_type) patch.organism_type = org
  return patch
}

function errorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  if (e.message.includes('409')) return 'Já existe uma amostra com este código neste projeto.'
  return e.message || fallback
}

function clampStep(n: number | undefined, hasSample: boolean): number {
  if (!hasSample) return 1
  if (!n || Number.isNaN(n)) return 1
  return Math.min(Math.max(Math.trunc(n), 1), LAST_STEP)
}

const footerBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-full)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--cyan)', border: 'none',
  borderRadius: 'var(--shape-full)', color: '#050d1a', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const disabledBtn: React.CSSProperties = {
  background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'not-allowed', border: '1px solid var(--border)',
}

export interface SampleWizardProps {
  projectId: string
  initialSampleId?: string | null
  initialStep?: number
}

export function SampleWizard({ projectId, initialSampleId, initialStep }: SampleWizardProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role

  const [sampleId, setSampleId] = useState<string | null>(initialSampleId ?? null)
  const [step, setStep] = useState<number>(() => clampStep(initialStep, !!initialSampleId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  const { data: sample, mutate } = useSWR(
    sampleId && token ? ['sample', sampleId, token] : null,
    () => api.getLimsSample(token!, sampleId!),
  )

  // Forms das etapas 1–3 + flag `dirty` por etapa (não sobrescrever o que o usuário já digitou).
  const [ident, setIdent] = useState<IdentForm>(EMPTY_IDENT)
  const [identDirty, setIdentDirty] = useState(false)
  const [origin, setOrigin] = useState<OriginFormValue | null>(null)
  const [originDirty, setOriginDirty] = useState(false)
  const [culture, setCulture] = useState<CultureFormValue | null>(null)
  const [morph, setMorph] = useState<MorphologyFormValue | null>(null)
  const [cultureDirty, setCultureDirty] = useState(false)

  const sampleKey = sample ? `${sample.id}:${sample.created_at}` : null
  useEffect(() => {
    if (!sample) return
    if (!identDirty) setIdent(identToForm(sample))
    if (!originDirty) setOrigin(originToForm(sample))
    if (!cultureDirty) { setCulture(cultureToForm(sample)); setMorph(morphologyToForm(sample)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey])

  function updateIdent(patch: Partial<IdentForm>) {
    setIdentDirty(true)
    setIdent(f => {
      const next = { ...f, ...patch }
      // Ao escolher organismo com a matriz ainda na default, sugere cultura microbiana.
      if (patch.organism_type && f.matrix === DEFAULT_MATRIX && !sampleId) next.matrix = 'cultura_microbiana'
      return next
    })
  }

  function goTo(n: number) {
    setError('')
    setStep(clampStep(n, !!sampleId))
  }

  async function afterSave(updated?: LimsSample) {
    if (updated) await mutate(updated, { revalidate: false })
    else await mutate()
    setIdentDirty(false); setOriginDirty(false); setCultureDirty(false)
  }

  async function saveStep1(): Promise<boolean> {
    if (!token) return false
    const code = ident.code.trim()
    if (!code) { setError('Código é obrigatório.'); return false }
    if (!sampleId) {
      const created = await api.createLimsSample(token, projectId, {
        code,
        matrix: ident.matrix,
        treatment_group: ident.treatment_group.trim() || null,
        replicate: ident.replicate ? Number(ident.replicate) : null,
        organism_type: ident.organism_type || null,
        strain_name: ident.strain_name.trim() || null,
      })
      setSampleId(created.id)
      setIdent(identToForm(created))
      setIdentDirty(false)
      // Atualiza a URL pra permitir retomar o cadastro (sem recarregar).
      router.replace(`/projects/${projectId}/samples/new?sample=${created.id}&step=2`)
      return true
    }
    if (!sample) return false
    const patch = identToPatch(ident, sample)
    if (Object.keys(patch).length > 0) {
      const updated = await api.updateSample(token, sampleId, patch)
      await afterSave(updated)
    }
    return true
  }

  async function saveStep2(): Promise<boolean> {
    if (!token || !sampleId || !sample || !origin) return true
    const patch = originToPatch(origin, sample)
    if (Object.keys(patch).length === 0) return true
    const updated = await api.updateSample(token, sampleId, patch)
    await afterSave(updated)
    return true
  }

  async function saveStep3(): Promise<boolean> {
    if (!token || !sampleId || !sample) return true
    const patch: SampleUpdate = {
      ...(culture ? cultureToPatch(culture, sample) : {}),
      ...(morph ? morphologyToPatch(morph, sample) : {}),
    }
    if (Object.keys(patch).length === 0) return true
    const updated = await api.updateSample(token, sampleId, patch)
    await afterSave(updated)
    return true
  }

  async function handleNext() {
    setError('')
    setSaving(true)
    try {
      let ok = true
      if (step === 1) ok = await saveStep1()
      else if (step === 2) ok = await saveStep2()
      else if (step === 3) ok = await saveStep3()
      if (!ok) return
      if (step === LAST_STEP) {
        if (sampleId) router.push(`/samples/${sampleId}`)
        return
      }
      setStep(step + 1)
    } catch (e) {
      setError(errorMessage(e, 'Erro ao salvar a etapa.'))
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    if (step === LAST_STEP) { if (sampleId) router.push(`/samples/${sampleId}`); return }
    goTo(step + 1)
  }

  const canNavigate = !!sampleId
  const organismType = sample?.organism_type ?? (ident.organism_type || null)
  const nextLabel = step === LAST_STEP ? 'Concluir' : step <= 3 ? 'Salvar e avançar' : 'Avançar'
  const waitingSample = !!sampleId && !sample

  return (
    <div>
      {/* Barra de etapas */}
      <div role="tablist" aria-label="Etapas do cadastro" style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto',
      }}>
        {STEPS.map(s => {
          const active = step === s.n
          const done = canNavigate && s.n < step
          const enabled = s.n === 1 || canNavigate
          return (
            <button
              key={s.n} role="tab" aria-selected={active} disabled={!enabled || saving}
              onClick={() => goTo(s.n)}
              title={enabled ? s.label : 'Salve a identificação primeiro'}
              style={{
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--cyan)' : 'transparent'}`,
                color: active ? 'var(--cyan)' : done ? 'var(--green)' : enabled ? 'var(--text-2)' : 'var(--text-3)',
                fontSize: 13, fontWeight: 600, cursor: enabled && !saving ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span className="mono" style={{
                fontSize: 10, width: 18, height: 18, borderRadius: 999, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: active ? 'var(--cyan)' : done ? 'rgba(16,212,138,0.15)' : 'var(--surface-2)',
                color: active ? '#050d1a' : done ? 'var(--green)' : 'var(--text-3)',
              }}>
                {done ? '✓' : s.n}
              </span>
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
            Etapa {step} de {LAST_STEP} — {STEPS[step - 1].label}
          </div>
          {sampleId && (
            <Link href={`/samples/${sampleId}`} style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
              Abrir ficha da amostra →
            </Link>
          )}
        </div>

        {/* Etapa 1 — Identificação */}
        {step === 1 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>Código *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text" value={ident.code} disabled={!!sampleId}
                  onChange={e => updateIdent({ code: e.target.value })}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: 'var(--mono)', opacity: sampleId ? 0.7 : 1 }}
                />
                {!sampleId && (
                  <button
                    type="button" onClick={() => setScanning(true)} title="Escanear código de barras"
                    style={{
                      flexShrink: 0, padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--shape-sm)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    📷 Escanear
                  </button>
                )}
              </div>
              {sampleId && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Código fixo após o registro.</div>}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>Nome da linhagem</label>
              <input
                type="text" value={ident.strain_name} placeholder="ex.: UFVJM-B12"
                onChange={e => updateIdent({ strain_name: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelStyle}>Tipo de organismo</label>
              <select
                value={ident.organism_type}
                onChange={e => updateIdent({ organism_type: e.target.value as OrganismType | '' })}
                style={selectStyle}
              >
                <option value="">—</option>
                {ORGANISM_TYPES.map(o => <option key={o} value={o}>{ORGANISM_TYPE_LABELS[o]}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={labelStyle}>Matriz</label>
              <select
                value={ident.matrix} disabled={!!sampleId}
                onChange={e => updateIdent({ matrix: e.target.value as LimsSampleMatrix })}
                style={{ ...selectStyle, opacity: sampleId ? 0.7 : 1 }}
              >
                {MATRIX_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle}>Grupo</label>
              <input
                type="text" value={ident.treatment_group}
                onChange={e => updateIdent({ treatment_group: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <label style={labelStyle}>Réplica</label>
              <input
                type="number" min={1} value={ident.replicate}
                onChange={e => updateIdent({ replicate: e.target.value })}
                style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
              />
            </div>
          </div>
        )}

        {/* Etapas 2–6 exigem amostra carregada */}
        {step > 1 && waitingSample && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        )}

        {step === 2 && sample && origin && (
          <OriginFields
            value={origin}
            onChange={v => { setOriginDirty(true); setOrigin(v) }}
            disabled={saving}
            showNotes
          />
        )}

        {step === 3 && sample && culture && morph && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Cultivo</div>
              <CultureFields value={culture} onChange={v => { setCultureDirty(true); setCulture(v) }} disabled={saving} />
            </div>
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Morfologia de colônia</div>
              <MorphologyFields value={morph} onChange={v => { setCultureDirty(true); setMorph(v) }} disabled={saving} />
            </div>
          </div>
        )}

        {step === 4 && token && sampleId && (
          <TestsPanel token={token} role={role} sampleId={sampleId} embedded />
        )}

        {step === 5 && token && sampleId && (
          <GenesPanel token={token} role={role} sampleId={sampleId} organismType={organismType} projectId={projectId} embedded />
        )}

        {step === 6 && token && sampleId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AliquotsPanel token={token} role={role} sampleId={sampleId} embedded suggestDefaults />
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Anexos</div>
              <FileUploadField
                projectId={projectId}
                sampleId={sampleId}
                categories={['colony_photo', 'gel_image']}
                defaultCategory="colony_photo"
                accept="image/*"
                label="Foto da placa / gel"
              />
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: 14, fontSize: 12, color: 'var(--red)' }}>{error}</div>}

        {/* Rodapé */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)',
        }}>
          {step > 1 && (
            <button type="button" onClick={() => goTo(step - 1)} disabled={saving} style={{ ...footerBtn, ...(saving ? disabledBtn : {}) }}>
              ← Voltar
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step >= 2 && step < LAST_STEP && (
            <button type="button" onClick={handleSkip} disabled={saving} style={{ ...footerBtn, ...(saving ? disabledBtn : {}) }}>
              Pular
            </button>
          )}
          <button
            type="button" onClick={handleNext}
            disabled={saving || (step === 1 && !ident.code.trim()) || (step > 1 && waitingSample)}
            style={{
              ...primaryBtn,
              ...((saving || (step === 1 && !ident.code.trim()) || (step > 1 && waitingSample)) ? disabledBtn : {}),
            }}
          >
            {saving ? 'Salvando...' : nextLabel}
          </button>
        </div>
      </div>

      {scanning && (
        <BarcodeScanner
          onScan={(code) => { updateIdent({ code }); setScanning(false) }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  )
}

export default SampleWizard
