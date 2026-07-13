'use client'

import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiV2Client,
  formatResultValue,
  type CreateResultInput,
  type ResultWithHistory,
  type SampleV2,
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
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/mvp/Primitives'

interface FormState {
  analyte: string
  unit: string
  value_numeric: string
  lod: string
  loq: string
  uncertainty: string
  method: string
}

const EMPTY: FormState = {
  analyte: '',
  unit: '',
  value_numeric: '',
  lod: '',
  loq: '',
  uncertainty: '',
  method: '',
}

function CorrectionForm({
  resultId,
  unit,
  onDone,
}: {
  resultId: string
  unit: string
  onDone: () => void
}) {
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const correct = useMutation({
    mutationFn: () =>
      apiV2Client.correctResult(resultId, {
        value_numeric: Number(value),
        unit,
        change_reason: reason,
      }),
    onSuccess: onDone,
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!value || !reason.trim()) return
        correct.mutate()
      }}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <Field label="Novo valor" hint={`unidade: ${unit}`}>
        <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
      </Field>
      <Field label="Motivo da correção" hint="obrigatório — vai para a trilha de auditoria">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
      </Field>
      <Button type="submit" disabled={correct.isPending}>
        {correct.isPending ? 'Corrigindo…' : 'Criar nova versão'}
      </Button>
      <ErrorBanner error={correct.error} />
    </form>
  )
}

export function ResultsTab({ projectId }: { projectId: string }) {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const [sampleId, setSampleId] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState<string | null>(null)

  const samples = useQuery<SampleV2[]>({
    queryKey: qk.samples(organizationId, projectId),
    queryFn: () => apiV2Client.listSamples(projectId),
  })

  const results = useQuery<ResultWithHistory[]>({
    queryKey: qk.results(organizationId, sampleId),
    queryFn: () => apiV2Client.listResults(sampleId),
    enabled: Boolean(sampleId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.results(organizationId, sampleId) })

  const create = useMutation({
    mutationFn: (input: CreateResultInput) => apiV2Client.createResult(sampleId, input),
    onSuccess: () => {
      setForm(EMPTY)
      void invalidate()
    },
  })

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'retracted' }) =>
      apiV2Client.reviewResult(id, status),
    onSuccess: () => invalidate(),
  })

  return (
    <div>
      <div
        style={{
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 8,
          color: 'var(--text-2)',
          fontSize: 12,
          padding: '8px 12px',
          marginBottom: 16,
        }}
      >
        Resultados são <strong>append-only</strong> (ISO/IEC 17025): corrigir um resultado cria uma
        <strong> nova versão</strong> — nunca sobrescreve a anterior. O histórico permanece auditável.
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: sampleId ? 16 : 0 }}>
          <Field label="Amostra">
            <Select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              <option value="">— selecione —</option>
              {samples.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} ({s.matrix})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {sampleId && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.analyte.trim() || !form.unit.trim()) return
              create.mutate({
                analyte: form.analyte.trim(),
                unit: form.unit.trim(),
                value_numeric: form.value_numeric ? Number(form.value_numeric) : undefined,
                lod: form.lod ? Number(form.lod) : undefined,
                loq: form.loq ? Number(form.loq) : undefined,
                uncertainty: form.uncertainty ? Number(form.uncertainty) : undefined,
                method: form.method.trim() || undefined,
              })
            }}
          >
            <ErrorBanner error={create.error} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label="Analito">
                <Input
                  value={form.analyte}
                  onChange={(e) => setForm({ ...form, analyte: e.target.value })}
                  placeholder="Glifosato"
                  required
                />
              </Field>
              <Field label="Unidade">
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="mg/kg"
                  required
                />
              </Field>
              <Field label="Valor">
                <Input
                  type="number"
                  step="any"
                  value={form.value_numeric}
                  onChange={(e) => setForm({ ...form, value_numeric: e.target.value })}
                />
              </Field>
              <Field label="LOD">
                <Input
                  type="number"
                  step="any"
                  value={form.lod}
                  onChange={(e) => setForm({ ...form, lod: e.target.value })}
                />
              </Field>
              <Field label="LOQ">
                <Input
                  type="number"
                  step="any"
                  value={form.loq}
                  onChange={(e) => setForm({ ...form, loq: e.target.value })}
                />
              </Field>
              <Field label="Incerteza (±)">
                <Input
                  type="number"
                  step="any"
                  value={form.uncertainty}
                  onChange={(e) => setForm({ ...form, uncertainty: e.target.value })}
                />
              </Field>
              <Field label="Método">
                <Input
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  placeholder="LC-MS/MS"
                />
              </Field>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Registrando…' : 'Registrar resultado'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {!sampleId ? (
        <EmptyState icon="⚗" title="Selecione uma amostra" desc="Os resultados são por amostra." />
      ) : results.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (results.data?.length ?? 0) === 0 ? (
        <EmptyState icon="⚗" title="Nenhum resultado" desc="Registre o primeiro resultado acima." />
      ) : (
        <Card>
          <ErrorBanner error={results.error} />
          <ErrorBanner error={review.error} />
          <Table>
            <thead>
              <tr>
                <Th>Analito</Th>
                <Th>Valor</Th>
                <Th>LOD / LOQ</Th>
                <Th>Incerteza</Th>
                <Th>Método</Th>
                <Th>Revisão</Th>
                <Th>Versões</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {results.data?.map((row) => {
                const current = row.current
                const versions = row.history.length
                const open = openHistory === current.id
                return (
                  <Fragment key={current.id}>
                    <tr>
                      <Td>{current.analyte}</Td>
                      <Td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                        {formatResultValue(current)}
                      </Td>
                      <Td style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {current.lod ?? '—'} / {current.loq ?? '—'}
                      </Td>
                      <Td style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {current.uncertainty != null ? `± ${current.uncertainty} ${current.unit}` : '—'}
                      </Td>
                      <Td style={{ color: 'var(--text-2)' }}>{current.method ?? '—'}</Td>
                      <Td>
                        <StatusBadge status={current.review_status ?? 'pending'} />
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setOpenHistory(open ? null : current.id)}
                        >
                          v{current.version ?? 1} · {versions} no histórico
                        </Button>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            variant="ghost"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setCorrecting(correcting === current.id ? null : current.id)}
                          >
                            corrigir
                          </Button>
                          <Button
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: current.id, status: 'approved' })}
                          >
                            aprovar
                          </Button>
                          <Button
                            variant="danger"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: current.id, status: 'retracted' })}
                          >
                            retratar
                          </Button>
                        </div>
                      </Td>
                    </tr>

                    {correcting === current.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0 10px 14px' }}>
                          <CorrectionForm
                            resultId={current.id}
                            unit={current.unit}
                            onDone={() => {
                              setCorrecting(null)
                              void invalidate()
                            }}
                          />
                        </td>
                      </tr>
                    )}

                    {open && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0 10px 14px' }}>
                          <div
                            style={{
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                              HISTÓRICO DE VERSÕES (append-only)
                            </div>
                            {row.history.length === 0 ? (
                              <div className="text-sm text-muted">Versão original, sem correções.</div>
                            ) : (
                              <Table>
                                <thead>
                                  <tr>
                                    <Th>Versão</Th>
                                    <Th>Valor</Th>
                                    <Th>Motivo da alteração</Th>
                                    <Th>Autor</Th>
                                    <Th>Data</Th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.history.map((v) => (
                                    <tr key={v.id}>
                                      <Td style={{ fontFamily: 'var(--mono)' }}>v{v.version ?? 1}</Td>
                                      <Td style={{ fontFamily: 'var(--mono)' }}>{formatResultValue(v)}</Td>
                                      <Td style={{ color: 'var(--text-2)' }}>{v.change_reason ?? '—'}</Td>
                                      <Td style={{ color: 'var(--text-2)' }}>{v.created_by ?? '—'}</Td>
                                      <Td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                                        {v.created_at ? new Date(v.created_at).toLocaleString('pt-BR') : '—'}
                                      </Td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            )}
                          </div>
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
