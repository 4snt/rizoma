'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiV2Client,
  type CreateProjectInput,
  type Customer,
  type MarkerType,
  type ProjectV2,
} from '@/lib/api-v2'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/mvp/Primitives'

const MARKERS: MarkerType[] = ['16S', 'ITS', 'RNA']

export default function ProjectsV2Page() {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateProjectInput>({ code: '', name: '' })

  const projects = useQuery<ProjectV2[]>({
    queryKey: qk.projects(organizationId),
    queryFn: () => apiV2Client.listProjects(),
    enabled: Boolean(organizationId),
  })

  const customers = useQuery<Customer[]>({
    queryKey: qk.customers(organizationId),
    queryFn: () => apiV2Client.listCustomers(),
    enabled: Boolean(organizationId),
  })

  const create = useMutation({
    mutationFn: (input: CreateProjectInput) => apiV2Client.createProject(input),
    onSuccess: () => {
      setForm({ code: '', name: '' })
      void queryClient.invalidateQueries({ queryKey: qk.projects(organizationId) })
    },
  })

  const customerName = (id?: string | null) =>
    customers.data?.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="fade-in">
      <PageHeader title="Projetos" subtitle="Cliente → Projeto → Amostra → Job → Resultado → Laudo." />

      <Card style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.code.trim() || !form.name.trim()) return
            create.mutate({
              code: form.code.trim(),
              name: form.name.trim(),
              customer_id: form.customer_id || undefined,
              description: form.description?.trim() || undefined,
              marker_type: form.marker_type,
            })
          }}
        >
          <ErrorBanner error={create.error} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Field label="Código">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="INOVAHERB"
                required
              />
            </Field>
            <Field label="Nome">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Micobioma de plantas medicinais"
                required
              />
            </Field>
            <Field label="Cliente">
              <Select
                value={form.customer_id ?? ''}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value || undefined })}
              >
                <option value="">— sem cliente —</option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Marcador">
              <Select
                value={form.marker_type ?? ''}
                onChange={(e) =>
                  setForm({ ...form, marker_type: (e.target.value || undefined) as MarkerType | undefined })
                }
              >
                <option value="">—</option>
                {MARKERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Descrição">
              <Textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ minHeight: 56 }}
              />
            </Field>
            <Button type="submit" disabled={create.isPending || !organizationId}>
              {create.isPending ? 'Criando…' : 'Criar projeto'}
            </Button>
          </div>
        </form>
      </Card>

      <ErrorBanner error={projects.error} />

      {projects.isLoading ? (
        <div className="skeleton" style={{ height: 140 }} />
      ) : (projects.data?.length ?? 0) === 0 ? (
        <EmptyState icon="◆" title="Nenhum projeto" desc="Crie o primeiro projeto acima." />
      ) : (
        <div className="project-grid">
          {projects.data?.map((p) => (
            <Link key={p.id} href={`/projects-v2/${p.id}`} className="project-card">
              <div className="project-card-header">
                <span className="project-code">{p.code}</span>
                {p.marker_type && <span className="badge badge-purple">{p.marker_type}</span>}
              </div>
              <div className="project-name">{p.name}</div>
              <div className="project-meta">{customerName(p.customer_id)}</div>
              <div className="project-footer">
                <span className="text-3 text-xs">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
