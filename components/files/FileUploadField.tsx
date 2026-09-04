'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { apiV2Client, uploadFile, type FileCategory, type FileRef } from '@/lib/api-v2'

/**
 * Anexos de uma amostra (ou de um gene específico da amostra).
 *
 * Usa a stack v2 (`lib/api-v2.ts`): o token/org vêm do contexto global setado
 * pelo `OrgProvider`, que já envolve toda a app em `app/layout.tsx` — logo
 * funciona dentro das páginas next-auth/`lib/api.ts` sem provider extra
 * (mesma situação do `FilesTab` em /projects/[id]).
 */

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  fastq_r1: 'FASTQ R1',
  fastq_r2: 'FASTQ R2',
  phyloseq: 'Phyloseq',
  result: 'Resultado',
  report: 'Laudo',
  field_photo: 'Foto de campo',
  document: 'Documento',
  other: 'Outro',
  fasta: 'FASTA',
  chromatogram: 'Cromatograma (.ab1)',
  gel_image: 'Imagem de gel',
  colony_photo: 'Foto de colônia',
}

export function categoryLabel(c: string): string {
  return (FILE_CATEGORY_LABELS as Record<string, string>)[c] ?? c
}

export function humanFileSize(bytes?: number | null): string {
  if (bytes == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export interface FileUploadFieldProps {
  projectId: string
  sampleId: string
  sampleGeneId?: string
  categories: FileCategory[]
  defaultCategory?: FileCategory
  accept?: string
  label?: string
  compact?: boolean
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)', padding: '7px 10px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4,
}
const ghostButtonStyle: React.CSSProperties = {
  padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 11, cursor: 'pointer',
}
const trackStyle: React.CSSProperties = {
  height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden',
}
const fillStyle: React.CSSProperties = {
  height: '100%', background: 'var(--cyan)', transition: 'width 120ms linear',
}

type Stage = 'idle' | 'uploading' | 'confirming'

export function FileUploadField({
  projectId,
  sampleId,
  sampleGeneId,
  categories,
  defaultCategory,
  accept,
  label,
  compact,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<FileCategory>(defaultCategory ?? categories[0] ?? 'other')
  const [progress, setProgress] = useState<number | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const { data: files, error: listError, mutate } = useSWR<FileRef[]>(
    ['files', sampleId, sampleGeneId ?? null],
    () => apiV2Client.listFiles({ sample_id: sampleId, sample_gene_id: sampleGeneId }),
  )

  async function handleFile(file: File) {
    setError(null)
    setStage('uploading')
    setProgress(0)
    try {
      // presign → POST multipart direto ao storage → confirm (SHA-256).
      await uploadFile(file, {
        project_id: projectId,
        sample_id: sampleId,
        sample_gene_id: sampleGeneId,
        category,
        onProgress: (pct) => {
          setProgress(pct)
          if (pct >= 100) setStage('confirming')
        },
      })
      await mutate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setStage('idle')
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDownload(fileId: string) {
    setError(null)
    setDownloading(fileId)
    try {
      const res = await apiV2Client.downloadFile(fileId)
      window.open(res.url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar link de download.')
    } finally {
      setDownloading(null)
    }
  }

  const busy = stage !== 'idle'
  const stageText =
    stage === 'confirming'
      ? 'Confirmando integridade (SHA-256)…'
      : `Enviando ao storage… ${progress ?? 0}%`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.03em' }}>
          {label}
        </span>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {categories.length > 1 && (
          <div>
            <label style={labelStyle}>Categoria</label>
            <select
              value={category}
              disabled={busy}
              onChange={(e) => setCategory(e.target.value as FileCategory)}
              style={selectStyle}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          {!compact && <label style={labelStyle}>Arquivo</label>}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
            style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: '100%' }}
          />
        </div>
      </div>

      {progress !== null && (
        <div>
          <div className="worker-progress-bar-track" style={trackStyle}>
            <div className="worker-progress-bar-fill" style={{ ...fillStyle, width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{stageText}</div>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
      {listError && (
        <div style={{ fontSize: 12, color: 'var(--red)' }}>
          {listError instanceof Error ? listError.message : 'Erro ao listar anexos.'}
        </div>
      )}

      {!files && !listError && (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>carregando anexos…</div>
      )}
      {files && files.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum anexo.</div>
      )}
      {files && files.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f) => (
            <li
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: compact ? '6px 10px' : '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
                fontSize: 12,
              }}
            >
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', flex: '1 1 160px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.original_name}>
                {f.original_name}
              </span>
              <span className="badge badge-blue">{categoryLabel(f.category)}</span>
              <span style={{ color: 'var(--text-2)' }}>{humanFileSize(f.size_bytes)}</span>
              <span style={{ color: f.upload_status === 'confirmed' ? 'var(--green)' : 'var(--text-3)', fontSize: 11 }}>
                {f.upload_status ?? '—'}
              </span>
              <button
                type="button"
                onClick={() => void handleDownload(f.id)}
                disabled={downloading === f.id}
                style={{ ...ghostButtonStyle, cursor: downloading === f.id ? 'wait' : 'pointer' }}
              >
                {downloading === f.id ? '…' : 'baixar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FileUploadField
