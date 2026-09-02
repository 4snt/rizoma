'use client'

import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiV2Client,
  nextStatuses,
  SAMPLE_MATRICES,
  type CreateSampleInput,
  type CustodyChain,
  type SampleMatrix,
  type SampleStatus,
  type SampleV2,
} from '@/lib/api-v2'
import { uuidv7 } from '@/lib/offline-outbox'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/mvp/Primitives'

interface FormState {
  code: string
  matrix: SampleMatrix
  treatment_group: string
  replicate: string
  lat: string
  lon: string
  occurred_at: string
}

const EMPTY: FormState = {
  code: '',
  matrix: 'solo',
  treatment_group: '',
  replicate: '',
  lat: '',
  lon: '',
  occurred_at: '',
}

function CustodyPanel({ sampleId }: { sampleId: string }) {
  const { organizationId } = useOrg()
  const custody = useQuery<CustodyChain>({
    queryKey: qk.custody(organizationId, sampleId),
    queryFn: () => apiV2Client.getCustody(sampleId),
  })

  if (custody.isLoading) return <div className="skeleton" style={{ height: 60 }} />
  if (custody.error) return <ErrorBanner error={custody.error} />

  const chain = custody.data
  if (!chain) return null

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
          CADEIA DE CUSTÓDIA
        </span>
        <span className={`badge ${chain.chain_valid ? 'badge-green' : 'badge-red'}`}>
          {chain.chain_valid ? '✓ cadeia íntegra' : '✗ cadeia rompida'}
        </span>
      </div>

      {chain.events.length === 0 ? (
        <div className="text-sm text-muted">Nenhum evento registrado.</div>
      ) : (
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chain.events.map((ev) => (
            <li key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span className="dot dot-cyan" />
              <span style={{ color: 'var(--text-3)' }}>{ev.from_status ?? '∅'}</span>
              <span style={{ color: 'var(--text-3)' }}>→</span>
              <StatusBadge status={ev.to_status} />
              <span style={{ color: 'var(--text-2)' }}>{ev.actor_email ?? 'sistema'}</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {new Date(ev.occurred_at).toLocaleString('pt-BR')}
              </span>
              {ev.hash && (
                <span
                  title={ev.hash}
                  style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }}
                >
                  {ev.hash.slice(0, 8)}…
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function SamplesTab({ projectId }: { projectId: string }) {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [openCustody, setOpenCustody] = useState<string | null>(null)

  const samples = useQuery<SampleV2[]>({
    queryKey: qk.samples(organizationId, projectId),
    queryFn: () => apiV2Client.listSamples(projectId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.samples(organizationId, projectId) })

  const create = useMutation({
    mutationFn: (input: CreateSampleInput) =>
      // UUIDv7 do cliente + Idempotency-Key: o mesmo contrato do modo campo.
      apiV2Client.createSample(projectId, input, uuidv7()),
    onSuccess: () => {
      setForm(EMPTY)
      void invalidate()
    },
  })

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: SampleStatus }) =>
      apiV2Client.transitionSample(id, to, uuidv7()),
    onSuccess: (_data, vars) => {
      void invalidate()
      void queryClient.invalidateQueries({ queryKey: qk.custody(organizationId, vars.id) })
    },
  })

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.code.trim()) return
            create.mutate({
              id: uuidv7(),
              code: form.code.trim(),
              matrix: form.matrix,
              treatment_group: form.treatment_group.trim() || undefined,
              replicate: form.replicate ? Number(form.replicate) : undefined,
              lat: form.lat ? Number(form.lat) : undefined,
              lon: form.lon ? Number(form.lon) : undefined,
              occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : undefined,
            })
          }}
        >
          <ErrorBanner error={create.error} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Field label="Código">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="INO-S01"
                required
              />
            </Field>
            <Field label="Matriz">
              <Select
                value={form.matrix}
                onChange={(e) => setForm({ ...form, matrix: e.target.value as SampleMatrix })}
              >
                {SAMPLE_MATRICES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Grupo de tratamento">
              <Input
                value={form.treatment_group}
                onChange={(e) => setForm({ ...form, treatment_group: e.target.value })}
                placeholder="controle"
              />
            </Field>
            <Field label="Réplica">
              <Input
                type="number"
                min={1}
                value={form.replicate}
                onChange={(e) => setForm({ ...form, replicate: e.target.value })}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Latitude">
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="-18.2493"
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                value={form.lon}
                onChange={(e) => setForm({ ...form, lon: e.target.value })}
                placeholder="-43.6003"
              />
            </Field>
            <Field label="Data de coleta">
              <Input
                type="datetime-local"
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar amostra'}
            </Button>
          </div>
        </form>
      </Card>

      <ErrorBanner error={samples.error} />
      <ErrorBanner error={transition.error} />

      {samples.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (samples.data?.length ?? 0) === 0 ? (
        <EmptyState icon="⬢" title="Nenhuma amostra" desc="Cadastre a primeira amostra acima." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Matriz</Th>
                <Th>Grupo</Th>
                <Th>GPS</Th>
                <Th>Coleta</Th>
                <Th>Estado</Th>
                <Th>Transição</Th>
                <Th>Custódia</Th>
              </tr>
            </thead>
            <tbody>
              {samples.data?.map((s) => {
                const allowed = nextStatuses(s.status)
                return (
                  <Fragment key={s.id}>
                    <tr>
                      <Td style={{ fontFamily: 'var(--mono)' }}>{s.code}</Td>
                      <Td style={{ color: 'var(--text-2)' }}>{s.matrix}</Td>
                      <Td style={{ color: 'var(--text-2)' }}>
                        {s.treatment_group ?? '—'}
                        {s.replicate ? ` #${s.replicate}` : ''}
                      </Td>
                      <Td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
                        {s.lat != null && s.lon != null ? `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}` : '—'}
                      </Td>
                      <Td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                        {s.occurred_at ? new Date(s.occurred_at).toLocaleString('pt-BR') : '—'}
                      </Td>
                      <Td>
                        <StatusBadge status={s.status} />
                      </Td>
                      <Td>
                        {allowed.length === 0 ? (
                          <span className="text-3 text-xs">estado final</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {allowed.map((to) => (
                              <Button
                                key={to}
                                variant={to === 'rejected' ? 'danger' : 'primary'}
                                disabled={transition.isPending}
                                onClick={() => transition.mutate({ id: s.id, to })}
                                style={{ padding: '4px 8px', fontSize: 11 }}
                              >
                                → {to}
                              </Button>
                            ))}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setOpenCustody(openCustody === s.id ? null : s.id)}
                        >
                          {openCustody === s.id ? 'ocultar' : 'ver'}
                        </Button>
                      </Td>
                    </tr>
                    {openCustody === s.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0 10px 12px' }}>
                          <CustodyPanel sampleId={s.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
