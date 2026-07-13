'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiV2Client, type Customer, type CreateCustomerInput } from '@/lib/api-v2'
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
  Table,
  Td,
  Th,
} from '@/components/mvp/Primitives'

export default function CustomersPage() {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateCustomerInput>({ name: '' })

  const customers = useQuery<Customer[]>({
    queryKey: qk.customers(organizationId),
    queryFn: () => apiV2Client.listCustomers(),
    enabled: Boolean(organizationId),
  })

  const create = useMutation({
    mutationFn: (input: CreateCustomerInput) => apiV2Client.createCustomer(input),
    onSuccess: () => {
      setForm({ name: '' })
      void queryClient.invalidateQueries({ queryKey: qk.customers(organizationId) })
    },
  })

  return (
    <div className="fade-in">
      <PageHeader title="Clientes" subtitle="Quem contrata a análise. Um projeto pertence a um cliente." />

      <Card style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim()) return
            create.mutate({
              name: form.name.trim(),
              document: form.document?.trim() || undefined,
              contact_email: form.contact_email?.trim() || undefined,
            })
          }}
        >
          <ErrorBanner error={create.error} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Nome">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fazenda São João"
                required
              />
            </Field>
            <Field label="Documento (CNPJ/CPF)">
              <Input
                value={form.document ?? ''}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                placeholder="00.000.000/0001-00"
              />
            </Field>
            <Field label="E-mail de contato">
              <Input
                type="email"
                value={form.contact_email ?? ''}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="contato@cliente.com"
              />
            </Field>
            <Button type="submit" disabled={create.isPending || !organizationId}>
              {create.isPending ? 'Criando…' : 'Criar cliente'}
            </Button>
          </div>
        </form>
      </Card>

      <ErrorBanner error={customers.error} />

      {customers.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (customers.data?.length ?? 0) === 0 ? (
        <EmptyState icon="◇" title="Nenhum cliente" desc="Cadastre o primeiro cliente acima." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Documento</Th>
                <Th>Contato</Th>
                <Th>Criado em</Th>
              </tr>
            </thead>
            <tbody>
              {customers.data?.map((c) => (
                <tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                    {c.document ?? '—'}
                  </Td>
                  <Td style={{ color: 'var(--text-2)' }}>{c.contact_email ?? '—'}</Td>
                  <Td style={{ color: 'var(--text-3)' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}
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
