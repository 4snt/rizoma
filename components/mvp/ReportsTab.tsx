'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiV2Client, type Report } from '@/lib/api-v2'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/mvp/Primitives'

export function ReportsTab({ projectId }: { projectId: string }) {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')

  const reports = useQuery<Report[]>({
    queryKey: qk.reports(organizationId, projectId),
    queryFn: () => apiV2Client.listReports(projectId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.reports(organizationId, projectId) })

  const create = useMutation({
    mutationFn: () =>
      apiV2Client.createReport(projectId, {
        title: title.trim(),
        code: code.trim() || undefined,
      }),
    onSuccess: () => {
      setTitle('')
      setCode('')
      void invalidate()
    },
  })

  const sign = useMutation({
    mutationFn: (reportId: string) => apiV2Client.signReport(reportId),
    onSuccess: () => invalidate(),
  })

  const download = useMutation({
    mutationFn: async (reportId: string) => apiV2Client.getReport(reportId),
    onSuccess: (report) => {
      if (report.download_url) window.open(report.download_url, '_blank', 'noopener')
    },
  })

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            create.mutate()
          }}
        >
          <ErrorBanner error={create.error} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Título do laudo">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Laudo de micobioma — INOVAHERB"
                required
              />
            </Field>
            <Field label="Código (opcional)">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LAU-2026-001" />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Gerando…' : 'Gerar laudo'}
            </Button>
          </div>
        </form>
      </Card>

      <ErrorBanner error={reports.error} />
      <ErrorBanner error={sign.error} />
      <ErrorBanner error={download.error} />

      {reports.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (reports.data?.length ?? 0) === 0 ? (
        <EmptyState icon="◫" title="Nenhum laudo" desc="Gere o laudo do projeto acima." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Título</Th>
                <Th>Código</Th>
                <Th>Status</Th>
                <Th>Hash</Th>
                <Th>Assinatura</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {reports.data?.map((r) => {
                const signed = r.status === 'signed' || Boolean(r.signed_at)
                return (
                  <tr key={r.id}>
                    <Td>{r.title}</Td>
                    <Td style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{r.code ?? '—'}</Td>
                    <Td>
                      <StatusBadge status={r.status ?? 'draft'} />
                    </Td>
                    <Td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
                      {r.hash ? `${r.hash.slice(0, 12)}…` : '—'}
                    </Td>
                    <Td style={{ color: 'var(--text-2)', fontSize: 11 }}>
                      {r.signed_at
                        ? `${r.signed_by ?? '—'} · ${new Date(r.signed_at).toLocaleString('pt-BR')}`
                        : '—'}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!signed && (
                          <Button
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            disabled={sign.isPending}
                            onClick={() => sign.mutate(r.id)}
                          >
                            assinar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          disabled={download.isPending}
                          onClick={() => download.mutate(r.id)}
                        >
                          baixar PDF
                        </Button>
                        {signed && r.hash && (
                          <a
                            href={`/verify/${r.id}?hash=${encodeURIComponent(r.hash)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge badge-green"
                            style={{ textDecoration: 'none' }}
                          >
                            verificar
                          </a>
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
