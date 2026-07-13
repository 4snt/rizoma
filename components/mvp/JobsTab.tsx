'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiV2Client, type JobV2 } from '@/lib/api-v2'
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

/** Tipos de job do MVP — o mesmo vocabulário do dispatcher do R Worker. */
const JOB_TYPES = [
  'ampliseq',
  'alpha_diversity',
  'beta_diversity',
  'ancombc2',
  'maaslin2',
  'deseq2',
  'spieceasi',
] as const

export function JobsTab({ projectId }: { projectId: string }) {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [jobType, setJobType] = useState<string>(JOB_TYPES[0])

  const jobs = useQuery<JobV2[]>({
    queryKey: qk.jobs(organizationId, projectId),
    queryFn: () => apiV2Client.listJobs({ project_id: projectId }),
    // Enquanto houver job vivo, revalida sozinho.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j) => j.status === 'queued' || j.status === 'running')
        ? 5000
        : false,
  })

  const enqueue = useMutation({
    mutationFn: () => apiV2Client.enqueueJob({ project_id: projectId, job_type: jobType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.jobs(organizationId, projectId) }),
  })

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <ErrorBanner error={enqueue.error} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Análise">
            <Select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={() => enqueue.mutate()} disabled={enqueue.isPending}>
            {enqueue.isPending ? 'Enfileirando…' : 'Enfileirar job'}
          </Button>
        </div>
      </Card>

      <ErrorBanner error={jobs.error} />

      {jobs.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (jobs.data?.length ?? 0) === 0 ? (
        <EmptyState icon="◈" title="Nenhum job" desc="Enfileire uma análise acima." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Progresso</Th>
                <Th>Criado</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.data?.map((j) => (
                <tr key={j.id}>
                  <Td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                    {j.id.slice(0, 8)}
                  </Td>
                  <Td>{j.job_type}</Td>
                  <Td>
                    <StatusBadge status={j.status} />
                    {j.error && (
                      <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{j.error}</div>
                    )}
                  </Td>
                  <Td style={{ minWidth: 140 }}>
                    <div className="worker-progress-bar-track">
                      <div
                        className="worker-progress-bar-fill"
                        style={{ width: `${j.progress_pct ?? (j.status === 'done' ? 100 : 0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-3">
                      {j.progress_pct ?? (j.status === 'done' ? 100 : 0)}%
                    </span>
                  </Td>
                  <Td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                    {j.created_at ? new Date(j.created_at).toLocaleString('pt-BR') : '—'}
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
