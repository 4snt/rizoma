'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiV2Client, uploadFile, type FileRef, type SampleV2 } from '@/lib/api-v2'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/mvp/Primitives'

const CATEGORIES = ['fastq', 'document', 'photo', 'other'] as const

function humanSize(bytes?: number | null): string {
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

export function FilesTab({ projectId }: { projectId: string }) {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>('fastq')
  const [sampleId, setSampleId] = useState<string>('')
  const [progress, setProgress] = useState<number | null>(null)

  const files = useQuery<FileRef[]>({
    queryKey: qk.files(organizationId, projectId),
    queryFn: () => apiV2Client.listFiles({ project_id: projectId }),
  })

  const samples = useQuery<SampleV2[]>({
    queryKey: qk.samples(organizationId, projectId),
    queryFn: () => apiV2Client.listSamples(projectId),
  })

  const upload = useMutation({
    mutationFn: (file: File) =>
      // 3 passos: presign → POST multipart direto ao storage → confirm. A API nunca vê o byte.
      uploadFile(file, {
        project_id: projectId,
        sample_id: sampleId || undefined,
        category,
        onProgress: setProgress,
      }),
    onSettled: () => {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
      void queryClient.invalidateQueries({ queryKey: qk.files(organizationId, projectId) })
    },
  })

  const download = useMutation({
    mutationFn: (fileId: string) => apiV2Client.downloadFile(fileId),
    onSuccess: (res) => {
      window.open(res.url, '_blank', 'noopener')
    },
  })

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <ErrorBanner error={upload.error} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Categoria">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amostra (opcional)">
            <Select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              <option value="">— projeto —</option>
              {samples.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Arquivo (FASTQ, PDF…)">
            <input
              ref={inputRef}
              type="file"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate(file)
              }}
              style={{ fontSize: 12, color: 'var(--text-2)' }}
            />
          </Field>
        </div>

        {progress !== null && (
          <div style={{ marginTop: 14 }}>
            <div className="worker-progress-bar-track">
              <div className="worker-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-muted mt-1">
              {progress < 100 ? `Enviando ao storage… ${progress}%` : 'Confirmando integridade (SHA-256)…'}
            </div>
          </div>
        )}
      </Card>

      <ErrorBanner error={files.error} />
      <ErrorBanner error={download.error} />

      {files.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (files.data?.length ?? 0) === 0 ? (
        <EmptyState icon="◫" title="Nenhum arquivo" desc="Envie um FASTQ para começar." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Arquivo</Th>
                <Th>Categoria</Th>
                <Th>Tamanho</Th>
                <Th>SHA-256</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {files.data?.map((f) => (
                <tr key={f.id}>
                  <Td style={{ fontFamily: 'var(--mono)' }}>{f.original_name}</Td>
                  <Td style={{ color: 'var(--text-2)' }}>{f.category}</Td>
                  <Td style={{ color: 'var(--text-2)' }}>{humanSize(f.size_bytes)}</Td>
                  <Td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
                    {f.sha256 ? `${f.sha256.slice(0, 12)}…` : '—'}
                  </Td>
                  <Td>{f.status ? <StatusBadge status={f.status} /> : '—'}</Td>
                  <Td>
                    <Button
                      variant="ghost"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      disabled={download.isPending}
                      onClick={() => download.mutate(f.id)}
                    >
                      baixar
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
