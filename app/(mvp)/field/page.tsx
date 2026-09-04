'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiV2Client,
  ORGANISM_TYPES,
  SAMPLE_MATRICES,
  type OrganismType,
  type ProjectV2,
  type SampleMatrix,
} from '@/lib/api-v2'
import { ISOLATION_SOURCE_SUGGESTIONS } from '@/lib/api'
import { enqueueAndFlush, uuidv7, type OutboxOperation } from '@/lib/offline-outbox'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import { useOutbox } from '@/components/mvp/OutboxBadge'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { GpsField, type GpsValue } from '@/components/ui/GpsField'
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/mvp/Primitives'

const NO_GPS: GpsValue = { lat: null, lon: null }

export default function FieldPage() {
  const { organizationId } = useOrg()
  const queryClient = useQueryClient()
  const { entries, online, flush } = useOutbox()

  const [projectId, setProjectId] = useState('')
  const [code, setCode] = useState('')
  const [matrix, setMatrix] = useState<SampleMatrix>('solo')
  const [organismType, setOrganismType] = useState<OrganismType | ''>('')
  const [notes, setNotes] = useState('')
  const [isolationSource, setIsolationSource] = useState('')
  const [hostSpecies, setHostSpecies] = useState('')
  const [collectionSite, setCollectionSite] = useState('')
  const [scanning, setScanning] = useState(false)
  const [coords, setCoords] = useState<GpsValue>(NO_GPS)
  const [saved, setSaved] = useState(0)

  // Vem do cache persistido em IndexedDB quando não há rede (networkMode: offlineFirst).
  const projects = useQuery<ProjectV2[]>({
    queryKey: qk.projects(organizationId),
    queryFn: () => apiV2Client.listProjects(),
    enabled: Boolean(organizationId),
  })

  // A coleta NUNCA falha por falta de rede: vai para a outbox e sai de lá quando houver sinal.
  const collect = useMutation({
    mutationFn: (op: OutboxOperation) => enqueueAndFlush(op, organizationId),
    onSuccess: () => {
      setCode('')
      setNotes('')
      setOrganismType('')
      setIsolationSource('')
      setHostSpecies('')
      setCollectionSite('')
      setCoords(NO_GPS)
      setSaved((n) => n + 1)
      void queryClient.invalidateQueries({ queryKey: qk.samples(organizationId, projectId) })
    },
  })

  return (
    <div className="fade-in">
      {scanning && (
        <BarcodeScanner
          onScan={(value) => {
            setCode(value)
            setScanning(false)
          }}
          onClose={() => setScanning(false)}
        />
      )}
      <PageHeader
        title="Modo Campo"
        subtitle="Funciona sem sinal. A coleta é gravada no dispositivo e sincroniza ao voltar a rede."
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className={`badge ${online ? 'badge-green' : 'badge-red'}`}>
          <span className={`dot ${online ? 'dot-green' : 'dot-red'}`} style={{ marginRight: 6 }} />
          {online ? 'Online' : 'Offline'}
        </span>
        <span className={`badge ${entries.length > 0 ? 'badge-amber' : 'badge-cyan'}`}>
          {entries.length} pendente{entries.length === 1 ? '' : 's'} de sincronização
        </span>
        {entries.length > 0 && online && (
          <Button variant="ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={flush}>
            sincronizar agora
          </Button>
        )}
        {saved > 0 && (
          <span className="text-xs text-muted">{saved} coleta(s) registrada(s) nesta sessão</span>
        )}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!projectId || !code.trim()) return
            // lat/lon só vão juntos — a API rejeita um sem o outro.
            const hasGps = coords.lat != null && coords.lon != null
            collect.mutate({
              type: 'sample.create',
              projectId,
              // UUIDv7 do cliente: a criação offline não conflita com ninguém.
              input: {
                id: uuidv7(),
                code: code.trim(),
                matrix,
                lat: hasGps ? coords.lat ?? undefined : undefined,
                lon: hasGps ? coords.lon ?? undefined : undefined,
                occurred_at: new Date().toISOString(),
                notes: notes.trim() || undefined,
                organism_type: organismType || undefined,
                isolation_source: isolationSource.trim() || undefined,
                host_species: hostSpecies.trim() || undefined,
                collection_site: collectionSite.trim() || undefined,
              },
            })
          }}
        >
          <ErrorBanner error={collect.error} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Field label="Projeto">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="">— selecione —</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Código da amostra">
              <div style={{ display: 'flex', gap: 6 }}>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="NEBIM0001"
                  required
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setScanning(true)}
                  title="Ler etiqueta com a câmera"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  📷 Escanear
                </Button>
              </div>
            </Field>
            <Field label="Matriz">
              <Select value={matrix} onChange={(e) => setMatrix(e.target.value as SampleMatrix)}>
                {SAMPLE_MATRICES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de organismo" hint="Opcional">
              <Select
                value={organismType}
                onChange={(e) => setOrganismType(e.target.value as OrganismType | '')}
              >
                <option value="">—</option>
                {ORGANISM_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Field label="Fonte de isolamento" hint="Opcional">
              <Input
                list="field-isolation-sources"
                value={isolationSource}
                onChange={(e) => setIsolationSource(e.target.value)}
                placeholder="rizosfera, nódulo radicular…"
              />
              <datalist id="field-isolation-sources">
                {ISOLATION_SOURCE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Hospedeiro (espécie)" hint="Opcional">
              <Input
                value={hostSpecies}
                onChange={(e) => setHostSpecies(e.target.value)}
                placeholder="ex.: Glycine max"
              />
            </Field>
            <Field label="Local" hint="Opcional">
              <Input
                value={collectionSite}
                onChange={(e) => setCollectionSite(e.target.value)}
                placeholder="fazenda, talhão, município"
              />
            </Field>
          </div>

          <div style={{ marginBottom: 12 }}>
            <GpsField value={coords} onChange={setCoords} disabled={collect.isPending} />
          </div>

          <Field label="Observações" hint="Opcional">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div style={{ marginTop: 12 }}>
            <Button type="submit" disabled={collect.isPending}>
              {collect.isPending ? 'Registrando…' : online ? 'Registrar coleta' : 'Registrar (offline)'}
            </Button>
          </div>
        </form>
      </Card>

      {entries.length > 0 && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
            FILA DE SINCRONIZAÇÃO
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Amostra</Th>
                <Th>Matriz</Th>
                <Th>GPS</Th>
                <Th>Registrada</Th>
                <Th>Tentativas</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <Td style={{ fontFamily: 'var(--mono)' }}>{e.operation.input.code}</Td>
                  <Td style={{ color: 'var(--text-2)' }}>{e.operation.input.matrix}</Td>
                  <Td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
                    {e.operation.input.lat != null && e.operation.input.lon != null
                      ? `${e.operation.input.lat.toFixed(4)}, ${e.operation.input.lon.toFixed(4)}`
                      : '—'}
                  </Td>
                  <Td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </Td>
                  <Td>
                    {e.attempts === 0 ? (
                      <span className="badge badge-amber">na fila</span>
                    ) : (
                      <span className="badge badge-red" title={e.lastError}>
                        {e.attempts} tentativa(s)
                      </span>
                    )}
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
