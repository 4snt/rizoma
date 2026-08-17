const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function apiFetchWithToken<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  // v1/projects.py e v1/jobs.py nunca são montados pelo backend (404 real) —
  // v2/lims e v2/jobs cobrem list/get/enqueue com contrato equivalente.
  // Ver 4snt/rizoma-backend#9 (comment) pro mapeamento completo v1→v2.
  getProjects:       (token: string) => apiFetchWithToken<Project[]>('/api/v2/lims/projects', token),
  getProject:        (token: string, id: string) => apiFetchWithToken<Project>(`/api/v2/lims/projects/${id}`, token),

  // "Pesquisador" de um projeto não tem mais CRUD próprio (ADR-011,
  // rizoma-backend). É sempre um organization_member — usar getAdminUsers
  // (membros existentes) pra escolher, ou createInvite pra trazer gente nova.

  // ── LIMS: Amostras + cadeia de custódia (4snt/rizoma#8) ─────────────────
  getLimsSamples:    (token: string, projectId: string) =>
                       apiFetchWithToken<LimsSample[]>(`/api/v2/lims/projects/${projectId}/samples`, token),
  getLimsSample:      (token: string, sampleId: string) =>
                       apiFetchWithToken<LimsSample>(`/api/v2/lims/samples/${sampleId}`, token),
  createLimsSample:  (token: string, projectId: string, body: CreateLimsSampleBody) =>
                       apiFetchWithToken<LimsSample>(`/api/v2/lims/projects/${projectId}/samples`, token, {
                         method: 'POST',
                         headers: { 'Idempotency-Key': crypto.randomUUID() },
                         body: JSON.stringify(body),
                       }),
  transitionLimsSample: (token: string, sampleId: string, body: SampleTransitionBody) =>
                       apiFetchWithToken<LimsSample>(`/api/v2/lims/samples/${sampleId}/transition`, token, {
                         method: 'POST',
                         body: JSON.stringify(body),
                       }),
  getCustodyChain:   (token: string, sampleId: string) =>
                       apiFetchWithToken<CustodyChain>(`/api/v2/lims/samples/${sampleId}/custody`, token),

  // ── Inventário: reagentes + equipamentos (4snt/rizoma#9) ────────────────
  getReagents:       (token: string) => apiFetchWithToken<Reagent[]>('/api/v2/inventory/reagents', token),
  createReagent:     (token: string, body: CreateReagentBody) =>
                       apiFetchWithToken<Reagent>('/api/v2/inventory/reagents', token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  getReagentLots:    (token: string, reagentId: string) =>
                       apiFetchWithToken<ReagentLot[]>(`/api/v2/inventory/reagents/${reagentId}/lots`, token),
  createReagentLot:  (token: string, reagentId: string, body: CreateReagentLotBody) =>
                       apiFetchWithToken<ReagentLot>(`/api/v2/inventory/reagents/${reagentId}/lots`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  consumeReagentLot: (token: string, lotId: string, body: ReagentConsumptionBody) =>
                       apiFetchWithToken<ReagentConsumption>(`/api/v2/inventory/reagent-lots/${lotId}/consumptions`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  getEquipment:      (token: string) => apiFetchWithToken<Equipment[]>('/api/v2/inventory/equipment', token),
  createEquipment:   (token: string, body: CreateEquipmentBody) =>
                       apiFetchWithToken<Equipment>('/api/v2/inventory/equipment', token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  updateEquipmentStatus: (token: string, equipmentId: string, status: EquipmentStatus) =>
                       apiFetchWithToken<Equipment>(`/api/v2/inventory/equipment/${equipmentId}/status`, token, {
                         method: 'PATCH', body: JSON.stringify({ status }),
                       }),
  getCalibrations:   (token: string, equipmentId: string) =>
                       apiFetchWithToken<EquipmentCalibration[]>(`/api/v2/inventory/equipment/${equipmentId}/calibrations`, token),
  recordCalibration: (token: string, equipmentId: string, body: CreateCalibrationBody) =>
                       apiFetchWithToken<EquipmentCalibration>(`/api/v2/inventory/equipment/${equipmentId}/calibrations`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  getInventoryAlerts: (token: string, withinDays = 30) =>
                       apiFetchWithToken<InventoryAlerts>(`/api/v2/inventory/alerts?within_days=${withinDays}`, token),

  // ── Interop: webhooks + import/export de amostras (4snt/rizoma#10) ──────
  getWebhooks:       (token: string) => apiFetchWithToken<WebhookSubscription[]>('/api/v2/interop/webhooks', token),
  createWebhook:     (token: string, body: CreateWebhookBody) =>
                       apiFetchWithToken<WebhookSubscriptionCreated>('/api/v2/interop/webhooks', token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  deleteWebhook:     (token: string, id: string) =>
                       apiFetchWithToken<void>(`/api/v2/interop/webhooks/${id}`, token, { method: 'DELETE' }),
  exportSamplesCsv:  async (token: string, projectId: string): Promise<Blob> => {
                       const res = await fetch(`${API_URL}/api/v2/interop/projects/${projectId}/samples/export`, {
                         headers: { Authorization: `Bearer ${token}` },
                       })
                       if (!res.ok) throw new Error(`API error ${res.status}: export CSV`)
                       return res.blob()
                     },
  importSamplesCsv:  async (token: string, projectId: string, file: File): Promise<SampleImportResult> => {
                       const form = new FormData()
                       form.append('file', file)
                       const res = await fetch(`${API_URL}/api/v2/interop/projects/${projectId}/samples/import`, {
                         method: 'POST',
                         headers: { Authorization: `Bearer ${token}` },
                         body: form,
                       })
                       if (!res.ok) throw new Error(`API error ${res.status}: import CSV`)
                       return res.json()
                     },

  // ── Laboratório: resultados (4snt/rizoma#11) ────────────────────────────
  // Prefixo próprio (/api/v2/lab), diferente dos outros módulos v2/<nome>.
  createResult:      (token: string, sampleId: string, body: CreateResultBody) =>
                       apiFetchWithToken<LabResult>(`/api/v2/lab/samples/${sampleId}/results`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  getResults:        (token: string, sampleId: string) =>
                       apiFetchWithToken<LabResult[]>(`/api/v2/lab/samples/${sampleId}/results`, token),
  getResult:         (token: string, resultId: string) =>
                       apiFetchWithToken<LabResult>(`/api/v2/lab/results/${resultId}`, token),
  correctResult:     (token: string, resultId: string, body: CorrectResultBody) =>
                       apiFetchWithToken<LabResult>(`/api/v2/lab/results/${resultId}/correct`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  reviewResult:      (token: string, resultId: string, body: ReviewResultBody) =>
                       apiFetchWithToken<LabResult>(`/api/v2/lab/results/${resultId}/review`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),

  // ── Laudos (reports) (4snt/rizoma#12) ───────────────────────────────────
  getReports:        (token: string, projectId: string) =>
                       apiFetchWithToken<ReportListItem[]>(`/api/v2/projects/${projectId}/reports`, token),
  createReport:      (token: string, projectId: string, body: CreateReportBody) =>
                       apiFetchWithToken<Report>(`/api/v2/projects/${projectId}/reports`, token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  getReport:         (token: string, reportId: string) =>
                       apiFetchWithToken<Report>(`/api/v2/reports/${reportId}`, token),
  signReport:        (token: string, reportId: string) =>
                       apiFetchWithToken<Report>(`/api/v2/reports/${reportId}/sign`, token, { method: 'POST' }),
  // Público de propósito — sem token, é o destino do QR Code impresso.
  verifyReport:      (reportId: string, hash?: string) =>
                       apiFetch<VerifyResult>(`/api/v2/reports/${reportId}/verify${hash ? `?hash=${encodeURIComponent(hash)}` : ''}`),

  // ── Identity: membros + convites ─────────────────────────────────────────
  // rizoma-backend#11 fechado: revogar convite, trocar papel e remover
  // membro (não existe mais "desativar" — a org é multi-tenant de verdade,
  // a ação correta é tirar a filiação com ESTA organização, não a conta).
  getMembers:        (token: string) => apiFetchWithToken<Member[]>('/api/v2/identity/members', token),
  getInvitations:    (token: string) => apiFetchWithToken<Invitation[]>('/api/v2/identity/invitations', token),
  createInvitation:  (token: string, body: CreateInvitationBody) =>
                       apiFetchWithToken<Invitation>('/api/v2/identity/invitations', token, {
                         method: 'POST', body: JSON.stringify(body),
                       }),
  revokeInvitation:  (token: string, invitationId: string) =>
                       apiFetchWithToken<void>(`/api/v2/identity/invitations/${invitationId}`, token, {
                         method: 'DELETE',
                       }),
  updateMemberRole:  (token: string, userId: string, role: OrgRole) =>
                       apiFetchWithToken<void>(`/api/v2/identity/members/${userId}/role`, token, {
                         method: 'PATCH', body: JSON.stringify({ role }),
                       }),
  removeMember:      (token: string, userId: string) =>
                       apiFetchWithToken<void>(`/api/v2/identity/members/${userId}`, token, {
                         method: 'DELETE',
                       }),
  getJobs:           (token: string, projectId: string) =>
                       apiFetchWithToken<Job[]>(`/api/v2/jobs/?project_id=${projectId}`, token),
  getWorkerStatus:   () => apiFetch<WorkerStatus>('/api/v1/worker/status'),
  getAnalysisResults:(jobId: string) => apiFetch<AnalysisResult[]>(`/api/v1/analysis/${jobId}/results`),
  searchDegs: (q: string, project?: string) => {
    const params = new URLSearchParams({ q, ...(project ? { project } : {}) })
    return apiFetch<DegResult[]>(`/api/v1/analysis/search/degs?${params}`)
  },
  // Segue em /api/v1 de propósito: v2/lims.Sample não tem noção de par FASTQ
  // (fastq_r1_oid/r2_oid) — é outro domínio (custody chain genérico), não dá
  // pra religar sem perder o dado. Fica preso ao epic #3 (rizoma-backend#9).
  getSamples:       (projectId: string) => apiFetch<Sample[]>(`/api/v1/samples/${projectId}`),
  uploadFastqPair:  (r1: File, r2: File, projectId: string) => {
                      const form = new FormData()
                      form.append('r1', r1)
                      form.append('r2', r2)
                      form.append('project_id', projectId)
                      return fetch(`${API_URL}/api/v1/samples/upload-pair`, { method: 'POST', body: form })
                        .then(res => { if (!res.ok) throw new Error(`API error ${res.status}`); return res.json() }) as Promise<UploadPairResult>
                    },
  uploadArtifact:   (file: File, projectId: string) => {
                      const form = new FormData()
                      form.append('file', file)
                      form.append('project_id', projectId)
                      return fetch(`${API_URL}/api/v1/samples/artifact-upload`, { method: 'POST', body: form })
                        .then(res => { if (!res.ok) throw new Error(`API error ${res.status}`); return res.json() }) as Promise<ArtifactUploadResult>
                    },
  enqueueJob:       (token: string, projectId: string, jobType: string, phyloseqOid?: number, payload?: Record<string, unknown>) =>
                      apiFetchWithToken<{ id: string }>('/api/v2/jobs/enqueue', token, {
                        method: 'POST',
                        body: JSON.stringify({
                          project_id: projectId,
                          job_type: jobType,
                          // v2/jobs não tem campo phyloseq_oid dedicado — vai dentro do payload livre.
                          payload: { ...(payload ?? {}), ...(phyloseqOid != null ? { phyloseq_oid: phyloseqOid } : {}) },
                        }),
                      }),
  getArtifacts:     (projectId: string) =>
                      apiFetch<ProjectArtifacts>(`/api/v1/samples/${projectId}/artifacts`),
  getFastqSources:  () =>
                      apiFetch<{ sources: FastqSourceInfo[] }>('/api/v1/samples/fastq-sources'),
  sraPreview:       (accession: string, source = 'sra') =>
                      apiFetch<SraMetadata>(`/api/v1/samples/sra-preview?accession=${encodeURIComponent(accession)}&source=${source}`),
  importSra:        (body: SraImportBody) =>
                      apiFetch<SraImportResult>('/api/v1/samples/import-sra', {
                        method: 'POST',
                        body: JSON.stringify(body),
                      }),
  getSraRuns:       (projectId: string) =>
                      apiFetch<SraRunsResult>(`/api/v1/projects/${projectId}/sra-runs`),
  enrichTaxonomy:   (names: string[]) =>
                      apiFetch<TaxonomyEnrichResult>('/api/v1/analysis/taxonomy/enrich', {
                        method: 'POST',
                        body: JSON.stringify({ names }),
                      }),

  // Auth-required endpoints
  getMe:           (token: string) =>
                     apiFetchWithToken<UserProfile>('/api/v1/auth/me', token),
  // Religado pra v2 — gap do body.analyses fechado com a migration
  // 0006_project_analyses (coluna analyses em projects, v2/lims.ProjectCreate
  // já aceita e persiste). Ver rizoma-backend#10 (comment).
  createProject: (token: string, body: CreateProjectBody) =>
                   apiFetchWithToken<Project>('/api/v2/lims/projects', token, {
                     method: 'POST',
                     body: JSON.stringify(body),
                   }),

  updateProject: (token: string, id: string, body: UpdateProjectBody) =>
                   apiFetchWithToken<Project>(`/api/v1/projects/${id}`, token, {
                     method: 'PUT',
                     body: JSON.stringify(body),
                   }),

  deleteProject: (token: string, id: string) =>
                   apiFetchWithToken<void>(`/api/v1/projects/${id}`, token, { method: 'DELETE' }),

  getDada2Status: (projectId: string) =>
    apiFetch<Dada2Status>(`/api/v1/metagenomics/${projectId}/dada2-status`),

  // Metagenomics module
  getMetagenomicsStatus: (projectId: string) =>
    apiFetch<MetagenomicsStatus>(`/api/v1/metagenomics/${projectId}/status`),

  runMetagenomicsPipeline: (projectId: string, phyloseqOid: number) =>
    apiFetch<{ job_id: string }>(`/api/v1/metagenomics/${projectId}/run`, {
      method: 'POST',
      body: JSON.stringify({ phyloseq_oid: phyloseqOid }),
    }),

  getAsvTable: (projectId: string, level = 'genus') =>
    apiFetch<AsvTableResult>(`/api/v1/metagenomics/${projectId}/asv-table?level=${level}`),

  getAsvTableFull: (projectId: string) =>
    apiFetch<AsvFullTableResult>(`/api/v1/metagenomics/${projectId}/asv-table/full`),

  getDiversity: (projectId: string, level = 'genus') =>
    apiFetch<DiversityResult>(`/api/v1/metagenomics/${projectId}/diversity?level=${level}`),

  getOrdination: (projectId: string, type = 'pcoa', betaMetric = 'bray', level = 'genus') =>
    apiFetch<OrdinationResult>(
      `/api/v1/metagenomics/${projectId}/ordination?type=${type}&beta_metric=${betaMetric}&level=${level}`
    ),

  getBiomarkers: (projectId: string, level = 'genus') =>
    apiFetch<BiomarkersResult>(`/api/v1/metagenomics/${projectId}/biomarkers?level=${level}`),
}

export interface AnalysisConfig {
  analysis_type: string
  charts: string[]
}

export interface ProjectAuthor {
  name: string
  avatar_url: string | null
}

export interface Dada2Params {
  trunc_len_f?: number
  trunc_len_r?: number
  max_ee_f?: number
  max_ee_r?: number
  trunc_q?: number
  max_n?: number
  min_len?: number
  chimera_method?: string
}

// Não existe mais Customer/CreateCustomerBody (ADR-011). Pesquisador de
// projeto é sempre AdminUser (organization_member) — ver lib/api.ts,
// seção "Admin".

export interface Project {
  id: string
  code: string
  name: string
  description: string
  marker_type: '16S' | 'ITS'
  status: string
  created_by: string | null
  dada2_params: Dada2Params
  // v2/lims.ProjectOut only:
  customer_user_id?: string | null
  // v2/lims.ProjectOut não devolve isso (domínio v1/metagenomics only) —
  // opcionais pra UI continuar tolerando ausência.
  bioproject_accession?: string | null
  author?: ProjectAuthor | null
  analyses?: AnalysisConfig[]
}

export interface CreateProjectBody {
  code: string
  name: string
  description: string
  marker_type: '16S' | 'ITS'
  analyses: AnalysisConfig[]
  dada2_params?: Dada2Params
  // v2/lims aceita vincular na criação — nenhum form ainda expõe essa opção
  // (ver 4snt/rizoma#18/nomenclatura), campo só disponível no tipo por ora.
  customer_user_id?: string | null
}

// ── LIMS: Amostras + cadeia de custódia ─────────────────────────────────────
// Domínio genérico (v2/lims.Sample) — não confundir com o Sample de
// bio-frontend metagenômico (par FASTQ), ver comentário em getSamples acima.

export type LimsSampleMatrix =
  | 'solo' | 'sedimento' | 'agua' | 'tecido_vegetal' | 'raiz' | 'folha'
  | 'biomassa' | 'cultura_microbiana' | 'dna' | 'rna' | 'extrato'
  | 'biochar' | 'formulado' | 'substrato'

export type LimsSampleStatus =
  | 'planned' | 'collected' | 'in_transit' | 'received' | 'accepted'
  | 'rejected' | 'processing' | 'analyzed' | 'stored' | 'consumed' | 'disposed'

export type CustodyEventType =
  | 'coleta' | 'transporte' | 'recebimento' | 'transferencia'
  | 'processamento' | 'armazenamento' | 'retirada' | 'devolucao' | 'descarte'

export interface LimsSample {
  id: string
  organization_id: string
  project_id: string
  code: string
  matrix: LimsSampleMatrix
  treatment_group: string | null
  replicate: number | null
  status: LimsSampleStatus
  lat: number | null
  lon: number | null
  collected_by: string | null
  occurred_at: string | null
  recorded_at: string
  notes: string | null
  created_at: string
}

export interface CreateLimsSampleBody {
  id?: string
  code: string
  matrix: LimsSampleMatrix
  treatment_group?: string | null
  replicate?: number | null
  status?: LimsSampleStatus
  lat?: number | null
  lon?: number | null
  occurred_at?: string | null
  notes?: string | null
}

export interface SampleTransitionBody {
  to_status: LimsSampleStatus
  to_custodian?: string | null
  occurred_at?: string | null
  lat?: number | null
  lon?: number | null
  temperature_c?: number | null
  condition?: string | null
  notes?: string | null
}

export interface CustodyEvent {
  id: string
  sample_id: string
  seq: number
  event_type: CustodyEventType
  from_custodian: string | null
  to_custodian: string | null
  occurred_at: string
  recorded_at: string
  temperature_c: number | null
  condition: string | null
  notes: string | null
  prev_hash: string | null
  hash: string
}

export interface CustodyChain {
  sample_id: string
  events: CustodyEvent[]
  chain_valid: boolean
}

// ── Inventário: reagentes + equipamentos ────────────────────────────────────

export interface Reagent {
  id: string
  organization_id: string
  name: string
  manufacturer: string | null
  catalog_number: string | null
  unit: string
  created_by: string | null
  created_at: string
}

export interface CreateReagentBody {
  name: string
  manufacturer?: string | null
  catalog_number?: string | null
  unit: string
}

export interface ReagentLot {
  id: string
  organization_id: string
  reagent_id: string
  lot_number: string
  supplier: string | null
  quantity_received: number
  quantity_remaining: number
  unit: string
  received_at: string
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface CreateReagentLotBody {
  lot_number: string
  supplier?: string | null
  quantity_received: number
  unit: string
  received_at?: string | null
  expires_at?: string | null
}

export interface ReagentConsumptionBody {
  sample_id?: string | null
  job_id?: string | null
  quantity: number
  notes?: string | null
}

export interface ReagentConsumption {
  id: string
  organization_id: string
  reagent_lot_id: string
  sample_id: string | null
  job_id: string | null
  quantity: number
  consumed_by: string | null
  consumed_at: string
  notes: string | null
}

export type EquipmentStatus = 'active' | 'maintenance' | 'retired'

export interface Equipment {
  id: string
  organization_id: string
  name: string
  identifier: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  location: string | null
  status: EquipmentStatus
  created_by: string | null
  created_at: string
}

export interface CreateEquipmentBody {
  name: string
  identifier?: string | null
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  location?: string | null
}

export interface EquipmentCalibration {
  id: string
  organization_id: string
  equipment_id: string
  calibrated_at: string
  next_calibration_due: string
  certificate_number: string | null
  performed_by: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreateCalibrationBody {
  calibrated_at: string
  next_calibration_due: string
  certificate_number?: string | null
  performed_by?: string | null
  notes?: string | null
}

export interface ExpiringLotAlert {
  reagent_lot_id: string
  reagent_id: string
  reagent_name: string
  lot_number: string
  expires_at: string
  days_remaining: number
}

export interface CalibrationDueAlert {
  equipment_id: string
  equipment_name: string
  last_calibration_id: string
  next_calibration_due: string
  days_remaining: number
}

export interface InventoryAlerts {
  expiring_lots: ExpiringLotAlert[]
  calibrations_due: CalibrationDueAlert[]
}

// ── Interop: webhooks + import/export ───────────────────────────────────────

export const WEBHOOK_EVENT_TYPES = ['job.completed', 'job.failed', 'sample.created'] as const
export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

export interface WebhookSubscription {
  id: string
  organization_id: string
  url: string
  event_types: string[]
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface WebhookSubscriptionCreated extends WebhookSubscription {
  secret: string // só vem uma vez, na criação — backend nunca devolve de novo
}

export interface CreateWebhookBody {
  url: string
  event_types: string[]
}

export interface SampleImportRowError {
  row: number
  code: string | null
  error: string
}

export interface SampleImportResult {
  created: number
  errors: SampleImportRowError[]
}

// ── Laboratório: resultados ──────────────────────────────────────────────

export interface CreateResultBody {
  analyte: string
  method?: string | null
  value_numeric?: number | null
  value_text?: string | null
  unit: string
  lod?: number | null
  loq?: number | null
  uncertainty?: number | null
}

export interface CorrectResultBody {
  value_numeric?: number | null
  value_text?: string | null
  unit?: string | null
  lod?: number | null
  loq?: number | null
  uncertainty?: number | null
  change_reason?: string | null
}

export interface ReviewResultBody {
  status?: 'approved' | 'retracted'
  note?: string | null
}

export interface ResultVersion {
  id: string
  version: number
  value_numeric: number | null
  value_text: string | null
  unit: string
  lod: number | null
  loq: number | null
  uncertainty: number | null
  below_lod: boolean
  status: string
  supersedes: string | null
  change_reason: string | null
  created_by: string
  reviewed_by: string | null
  created_at: string
  display_value: string
}

export interface LabResult {
  id: string
  sample_id: string
  analyte: string
  method: string | null
  created_at: string
  current: ResultVersion
  history: ResultVersion[]
}

// ── Laudos (reports) ─────────────────────────────────────────────────────

export interface CreateReportBody {
  title: string
  code?: string | null
}

export interface ReportListItem {
  id: string
  project_id: string
  code: string
  version: number
  title: string
  status: string
  sha256: string | null
  signed_at: string | null
  created_at: string
}

export interface Report extends ReportListItem {
  storage_key: string | null
  signed_by: string | null
  content: Record<string, unknown> | null
  download_url: string | null
}

export interface VerifyResult {
  valid: boolean
  code: string | null
  version: number | null
  project: string | null
  signed_at: string | null
  organization: string | null
  detail: string | null
}

// ── Identity: membros + convites ────────────────────────────────────────

// Papéis reais definidos em bio-platform/api/app/shared/context.py PERMISSIONS.
export const ORG_ROLES = [
  'org_admin', 'coordinator', 'tech_responsible', 'field_tech',
  'lab_tech', 'bioinformatician', 'client', 'viewer',
] as const
export type OrgRole = typeof ORG_ROLES[number]

// Espelha PERMISSIONS["project:write"] em app/shared/context.py — quem pode
// criar projeto de verdade no backend. Centralizado aqui pra não repetir o
// erro de comparar com um role literal errado (era "admin", nunca batia).
export const PROJECT_WRITE_ROLES: OrgRole[] = ['org_admin', 'coordinator']

export interface Member {
  id: string
  user_id: string
  email: string
  name: string
  role: string
  created_at: string
}

export interface Invitation {
  id: string
  organization_id: string
  email: string
  role: string
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
}

export interface CreateInvitationBody {
  email: string
  role: OrgRole
}

export interface UpdateProjectBody {
  name?: string
  description?: string
  analyses?: AnalysisConfig[]
  dada2_params?: Dada2Params
}

export interface SraMetadata {
  accession: string
  sample_name: string
  library_strategy: string
  library_layout: string
  spots: string
  bases: string
  bioproject: string
  biosample: string
  organism: string
}

export interface FastqSourceInfo {
  key: string
  label: string
}

export interface SraImportBody {
  accession: string
  project_id: string
  treatment_group: string
  replicate: number
  source?: string
}

export interface SraImportResult {
  sample_id: string
  accession: string
  treatment_group: string
  replicate: number
  sra_metadata: SraMetadata
}

export interface SraRun {
  accession: string
  sample_name: string
  library_layout: string
  library_strategy: string
  spots: string
  bases: string
  biosample: string
}

export interface SraRunsResult {
  bioproject: string | null
  runs: SraRun[]
}

export interface TaxonomyResult {
  query: string
  taxid: number | null
  name: string | null
  rank: string | null
  lineage: string | null
}

export interface TaxonomyEnrichResult {
  results: TaxonomyResult[]
  total: number
}

export interface Job {
  id: string
  project_id: string
  job_type: string
  status: 'queued' | 'running' | 'done' | 'failed'
  created_at: string
  completed_at: string | null
  error_msg: string | null
}

export interface AnalysisResult {
  id: string
  job_id: string
  analysis_type: string
  result_data: Record<string, unknown>
}

export interface DegResult {
  gene_id: string
  log2_fold_change: number
  p_adjusted: number
  base_mean: number
}

export interface RunningJob {
  id: string
  job_type: string
  project_code: string
  project_name: string
  elapsed_s: number
  estimated_s: number
  progress_pct: number
  progress_stage?: string | null
  remaining_s: number
}

export interface RecentJob {
  id: string
  job_type: string
  status: 'done' | 'failed'
  project_code: string
  seconds_ago: number
  error_msg: string | null
}

export interface WorkerStatus {
  running: RunningJob[]
  queued_count: number
  recent: RecentJob[]
}

export interface Sample {
  id: string
  project_id: string
  filename: string
  treatment_group: string
  replicate: number
  fastq_r1_oid: number
  fastq_r2_oid: number
  created_at: string
}

export interface UploadPairResult {
  sample_id: string
  treatment_group: string
  replicate: number
  parsed: {
    marker_type: string
    sample_number: string
    treatment_group: string
    replicate: number
    read_pair: string
  }
}

export interface ArtifactUploadResult {
  oid: number
  project_id: string
}

export interface ProjectArtifacts {
  available: Array<{ job_id: string; phyloseq_oid: number; created_at: string | null }>
  project_code: string
}

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  avatar_url: string | null
  last_login: string | null
}

// AdminUser/Invite removidos — duplicavam Member/Invitation (mais abaixo
// neste arquivo), que já é o que /admin/members usa de verdade.

// ── Metagenomics ────────────────────────────────────────────────────────────

export type TaxLevel = 'domain' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species'
export type BetaMetricKey = 'bray' | 'jaccard'

export interface MetagenomicsStatus {
  has_results: boolean
  job_status: 'queued' | 'running' | 'done' | 'failed' | null
  last_job_id: string | null
  completed_at?: string | null
  error_msg?: string | null
  progress_pct?: number
  progress_stage?: string | null
}

export interface Dada2Status {
  job_status: 'queued' | 'running' | 'done' | 'failed' | null
  last_job_id: string | null
  completed_at?: string | null
  error_msg?: string | null
  progress_pct?: number
  progress_stage?: string | null
  has_phyloseq?: boolean
}

export interface AsvRow {
  taxon: string
  taxonomy: Partial<Record<TaxLevel, string>>
  samples: Record<string, number>
  rel_abundance?: Record<string, number>
  total: number
}

export interface AsvTableResult {
  level: TaxLevel
  sample_names: string[]
  rows: AsvRow[]
  available_levels: string[]
  total_asvs: number
}

export interface AsvFullRow {
  domain: string
  phylum: string
  class: string
  order: string
  family: string
  genus: string
  species: string
  samples: Record<string, number>
  rel_abundance: Record<string, number>
  total: number
}

export interface AsvFullTableResult {
  tax_levels: string[]
  sample_names: string[]
  rows: AsvFullRow[]
  total_asvs: number
}

export interface AlphaPoint {
  sample_id: string
  treatment_group: string
  shannon: number
  simpson: number
  invsimpson: number
  richness: number
  margalef: number
  pielou: number
}

export interface KruskalResult {
  metric: string
  statistic: number
  p_value: number
  df: number
}

export interface BetaMatrix {
  metric: string
  matrix: number[][]
  sample_names: string[]
}

export interface PermanovaResult {
  metric: string
  r2: number
  p_value: number
  df: number
}

export interface DiversityResult {
  alpha: AlphaPoint[]
  kruskal: KruskalResult | null
  beta: Record<string, BetaMatrix>
  permanova: Record<string, PermanovaResult>
  available_metrics: string[]
  level_computed: string
}

export interface PcoaPoint {
  sample_id: string
  treatment_group: string
  axis1: number
  axis2: number
  axis3: number
}

export interface OrdinationResult {
  type: 'pcoa' | 'pca'
  beta_metric: string
  variance_explained: number[]
  points: PcoaPoint[]
  permanova: PermanovaResult | null
}

export interface BiomarkerEntry {
  taxon: string
  taxonomy: Partial<Record<TaxLevel, string>>
  effect_size: number
  p_value: number
  direction: 'enriched' | 'depleted'
}

export interface BiomarkersResult {
  method: string
  level: string
  markers: BiomarkerEntry[]
  comparison?: string
  note?: string
}

// ── Contratos das análises do catálogo (saída do R Worker) ───────────────────

export interface DeseqDeg {
  gene_id: string
  log2_fold_change: number
  p_adjusted: number
  base_mean: number
}
export interface DeseqResult {
  degs: DeseqDeg[]
  n_significant: number
}

export interface AncombcTaxon {
  taxon: string
  lfc: number
  q_val: number
  diff_abn: boolean
}
export interface AncombcResult {
  taxa: AncombcTaxon[]
}

export interface Maaslin2Association {
  feature: string
  metadata: string
  coef: number
  qval: number
}
export interface Maaslin2Result {
  associations: Maaslin2Association[]
}

export interface GseaPathway {
  go_id: string
  description: string
  p_adjust: number
  gene_ratio: string | number
}
export interface GseaResult {
  organism: string
  method: string
  pathways: GseaPathway[]
}

export interface FunguildAnnotation {
  taxon: string
  guild: string | null
  trophic_mode: string | null
  confidence_ranking: string | null
}
export interface FunguildResult {
  annotations: FunguildAnnotation[]
}

export interface Picrust2Pathway {
  pathway_id: string
  mean_abundance: number
}
export interface Picrust2Result {
  pathways: Picrust2Pathway[]
}

export interface NetworkNode {
  id: string
  keystone_score?: number
}
export interface NetworkEdge {
  source: string
  target: string
  weight?: number
}
export interface SpiecEasiResult {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}
