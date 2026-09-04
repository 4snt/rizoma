/**
 * Cliente tipado da API v2 do Rizoma (multi-tenant / LIMS).
 *
 * Regra do projeto (CLAUDE.md): nenhuma página faz `fetch` direto — tudo passa por aqui.
 * O `lib/api.ts` (v1) continua existindo e não é tocado por este arquivo.
 *
 * Auth: `Authorization: Bearer <jwt>` + `X-Organization: <org_uuid>`.
 * O contexto (token + org ativa) é injetado por `setApiV2Auth`, chamado pelo OrgProvider.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

/* ── Contexto de autenticação ───────────────────────────────────────── */

export interface ApiV2Auth {
  token?: string | null
  organizationId?: string | null
}

let authContext: ApiV2Auth = {}

export function setApiV2Auth(next: ApiV2Auth): void {
  authContext = next
}

export function getApiV2Auth(): ApiV2Auth {
  return authContext
}

/* ── Erros ──────────────────────────────────────────────────────────── */

export class ApiV2Error extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiV2Error'
    this.status = status
    this.detail = detail
  }
}

interface ErrorBody {
  detail?: unknown
}

async function extractDetail(res: Response): Promise<string> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return `API error ${res.status}`
  }
  const detail = (body as ErrorBody | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc, msg, type}]
    const msgs = detail
      .map((d) => (typeof d === 'object' && d !== null && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => m !== null)
    if (msgs.length > 0) return msgs.join('; ')
  }
  if (detail !== undefined) return JSON.stringify(detail)
  return `API error ${res.status}`
}

/* ── Fetch base ─────────────────────────────────────────────────────── */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Header Idempotency-Key — usado pelas mutações da outbox offline. */
  idempotencyKey?: string
  /** Endpoint público (verificação de laudo): não envia auth. */
  anonymous?: boolean
  /** Sobrescreve o contexto global (útil em server components/testes). */
  auth?: ApiV2Auth
  signal?: AbortSignal
}

export function buildHeaders(opts: RequestOptions = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.anonymous) return headers

  const ctx = opts.auth ?? authContext
  if (ctx.token) headers['Authorization'] = `Bearer ${ctx.token}`
  if (ctx.organizationId) headers['X-Organization'] = ctx.organizationId
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  return headers
}

export async function apiV2<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: buildHeaders(opts),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  })
  if (!res.ok) throw new ApiV2Error(res.status, await extractDetail(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/* ── Vocabulário do domínio ─────────────────────────────────────────── */

export const SAMPLE_MATRICES = [
  'solo',
  'sedimento',
  'agua',
  'tecido_vegetal',
  'raiz',
  'folha',
  'biomassa',
  'cultura_microbiana',
  'dna',
  'rna',
  'extrato',
  'biochar',
  'formulado',
  'substrato',
] as const
export type SampleMatrix = (typeof SAMPLE_MATRICES)[number]

export const SAMPLE_STATUSES = [
  'planned',
  'collected',
  'in_transit',
  'received',
  'accepted',
  'rejected',
  'processing',
  'analyzed',
  'stored',
  'consumed',
  'disposed',
] as const
export type SampleStatus = (typeof SAMPLE_STATUSES)[number]

/**
 * Transições válidas — espelho 1:1 de `TRANSICOES` em
 * `rizoma-backend/api/app/modules/lims/custody.py`. Mude lá primeiro.
 */
export const SAMPLE_TRANSITIONS: Record<SampleStatus, readonly SampleStatus[]> = {
  planned: ['collected'],
  collected: ['in_transit'],
  in_transit: ['received'],
  received: ['accepted', 'rejected'],
  accepted: ['processing', 'stored'],
  rejected: ['disposed'],
  processing: ['analyzed', 'consumed'],
  analyzed: ['stored', 'disposed'],
  stored: ['processing', 'disposed'],
  consumed: [],
  disposed: [],
}

/* Vocabulário biológico (espelho dos Literals em `lims/schemas.py`). */
export const ORGANISM_TYPES = ['bacteria', 'fungo', 'outro'] as const
export type OrganismType = (typeof ORGANISM_TYPES)[number]

export const COLONIA_FORMAS = ['circular', 'irregular', 'filamentosa', 'rizoide', 'fusiforme', 'puntiforme'] as const
export type ColoniaForma = (typeof COLONIA_FORMAS)[number]

export const COLONIA_ELEVACOES = ['plana', 'elevada', 'convexa', 'pulvinada', 'umbonada', 'crateriforme'] as const
export type ColoniaElevacao = (typeof COLONIA_ELEVACOES)[number]

export const COLONIA_MARGENS = ['inteira', 'ondulada', 'lobada', 'filiforme', 'crespa'] as const
export type ColoniaMargem = (typeof COLONIA_MARGENS)[number]

export const COLONIA_TEXTURAS = ['lisa', 'rugosa', 'mucoide', 'seca', 'granular', 'viscosa'] as const
export type ColoniaTextura = (typeof COLONIA_TEXTURAS)[number]

export const COLONIA_OPACIDADES = ['opaca', 'translucida', 'transparente'] as const
export type ColoniaOpacidade = (typeof COLONIA_OPACIDADES)[number]

export const GENE_PURPOSES = ['identificacao', 'resistencia', 'producao_enzima', 'outro'] as const
export type GenePurpose = (typeof GENE_PURPOSES)[number]

export function nextStatuses(current: SampleStatus): readonly SampleStatus[] {
  return SAMPLE_TRANSITIONS[current] ?? []
}

export const ORG_ROLES = [
  'org_admin',
  'coordinator',
  'tech_responsible',
  'field_tech',
  'lab_tech',
  'bioinformatician',
  'client',
  'viewer',
] as const
export type OrgRole = (typeof ORG_ROLES)[number]

/** Espelha modules/files/schemas.py::FileCategory. */
export type FileCategory =
  | 'fastq_r1'
  | 'fastq_r2'
  | 'phyloseq'
  | 'result'
  | 'report'
  | 'field_photo'
  | 'document'
  | 'other'
  | 'fasta'
  | 'chromatogram'
  | 'gel_image'
  | 'colony_photo'

/* ── Entidades ──────────────────────────────────────────────────────── */

export interface Organization {
  id: string
  slug: string
  name: string
  role?: OrgRole
}

export interface User {
  id: string
  email: string
  name?: string | null
  picture?: string | null
}

export interface Member {
  id: string
  user_id: string
  email: string
  name?: string | null
  role: OrgRole
  created_at?: string
}

export interface Invitation {
  id: string
  email: string
  role: OrgRole
  created_at?: string
}

export interface Identity {
  user: User
  organization: Organization | null
  role: OrgRole | null
  organizations: Organization[]
}

export interface AuthResponse {
  access_token: string
  user: User
  organizations: Organization[]
}

/** Espelha modules/lims/schemas.py::ProjectOut. */
export interface ProjectV2 {
  id: string
  organization_id?: string
  customer_user_id?: string | null
  code: string
  name: string
  description?: string | null
  status?: string
  created_by?: string | null
  created_at?: string
}

export interface SampleV2 {
  id: string
  project_id: string
  code: string
  matrix: SampleMatrix
  status: SampleStatus
  treatment_group?: string | null
  replicate?: number | null
  lat?: number | null
  lon?: number | null
  occurred_at?: string | null
  created_at?: string
  notes?: string | null
  /* Campos biológicos (amostras de cultura microbiana) */
  organism_type?: OrganismType | null
  colonia_forma?: ColoniaForma | null
  colonia_elevacao?: ColoniaElevacao | null
  colonia_margem?: ColoniaMargem | null
  colonia_cor?: string | null
  colonia_textura?: ColoniaTextura | null
  colonia_tamanho_mm?: number | null
  colonia_opacidade?: ColoniaOpacidade | null
  /* Identificação do isolado */
  strain_name?: string | null
  isolation_source?: string | null
  host_species?: string | null
  host_cultivar?: string | null
  collection_site?: string | null
}

export interface CustodyEvent {
  id: string
  sample_id: string
  from_status?: SampleStatus | null
  to_status: SampleStatus
  actor_email?: string | null
  occurred_at: string
  hash?: string | null
  prev_hash?: string | null
}

export interface CustodyChain {
  events: CustodyEvent[]
  chain_valid: boolean
}

export interface FileRef {
  id: string
  project_id: string
  sample_id?: string | null
  sample_gene_id?: string | null
  category: FileCategory | string
  original_name: string
  mime_type?: string | null
  storage_key?: string | null
  size_bytes?: number | null
  sha256?: string | null
  upload_status?: string | null
  created_at?: string
}

export interface PresignResponse {
  file_id: string
  upload_url: string
  fields: Record<string, string>
  storage_key: string
}

export interface LabResult {
  id: string
  sample_id: string
  analyte: string
  unit: string
  value_numeric?: number | null
  lod?: number | null
  loq?: number | null
  uncertainty?: number | null
  method?: string | null
  below_lod?: boolean | null
  review_status?: 'pending' | 'approved' | 'retracted' | null
  version?: number | null
  change_reason?: string | null
  created_at?: string
  created_by?: string | null
}

/** Uma versão histórica de um resultado (resultados são append-only). */
export type ResultVersion = LabResult

export interface ResultWithHistory {
  result: LabResult
  current: LabResult
  history: ResultVersion[]
}

export interface ReportVerification {
  valid: boolean
  report_id?: string
  title?: string | null
  code?: string | null
  signed_at?: string | null
  signed_by?: string | null
  hash?: string | null
  organization?: string | null
  project_code?: string | null
  reason?: string | null
}

/* ── Payloads ───────────────────────────────────────────────────────── */

export interface CreateSampleInput {
  /** UUIDv7 gerado no cliente (necessário para o modo offline). */
  id?: string
  code: string
  matrix: SampleMatrix
  treatment_group?: string
  replicate?: number
  lat?: number
  lon?: number
  occurred_at?: string
  notes?: string
  organism_type?: OrganismType
  strain_name?: string | null
  isolation_source?: string | null
  host_species?: string | null
  host_cultivar?: string | null
  collection_site?: string | null
}

export interface CreateResultInput {
  analyte: string
  unit: string
  value_numeric?: number
  lod?: number
  loq?: number
  uncertainty?: number
  method?: string
}

export interface CorrectResultInput {
  value_numeric: number
  unit: string
  change_reason: string
}

/* ── Endpoints ──────────────────────────────────────────────────────── */

export const apiV2Client = {
  /* identity */
  authGoogle: (accessToken: string) =>
    apiV2<AuthResponse>('/api/v2/identity/auth/google', {
      method: 'POST',
      body: { access_token: accessToken },
      anonymous: true,
    }),
  me: (auth?: ApiV2Auth) => apiV2<Identity>('/api/v2/identity/me', { auth }),
  listOrganizations: () => apiV2<Organization[]>('/api/v2/identity/organizations'),
  createOrganization: (input: { slug: string; name: string }) =>
    apiV2<Organization>('/api/v2/identity/organizations', { method: 'POST', body: input }),
  listMembers: () => apiV2<Member[]>('/api/v2/identity/members'),
  createInvitation: (input: { email: string; role: OrgRole }) =>
    apiV2<Invitation>('/api/v2/identity/invitations', { method: 'POST', body: input }),

  /* lims — projects (criação vive em lib/api.ts::createProject, usada por /projects/new) */
  listProjects: () => apiV2<ProjectV2[]>('/api/v2/lims/projects'),
  getProject: (id: string) => apiV2<ProjectV2>(`/api/v2/lims/projects/${id}`),

  /* lims — samples */
  listSamples: (projectId: string) =>
    apiV2<SampleV2[]>(`/api/v2/lims/projects/${projectId}/samples`),
  createSample: (projectId: string, input: CreateSampleInput, idempotencyKey?: string) =>
    apiV2<SampleV2>(`/api/v2/lims/projects/${projectId}/samples`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),
  transitionSample: (sampleId: string, toStatus: SampleStatus, idempotencyKey?: string) =>
    apiV2<SampleV2>(`/api/v2/lims/samples/${sampleId}/transition`, {
      method: 'POST',
      body: { to_status: toStatus },
      idempotencyKey,
    }),
  getCustody: (sampleId: string) =>
    apiV2<CustodyChain>(`/api/v2/lims/samples/${sampleId}/custody`),

  /* files */
  presignFile: (input: {
    project_id: string
    sample_id?: string
    sample_gene_id?: string
    category: string
    original_name: string
    mime_type?: string
  }) => apiV2<PresignResponse>('/api/v2/files/presign', { method: 'POST', body: input }),
  confirmFile: (fileId: string, sha256?: string) =>
    apiV2<FileRef>(`/api/v2/files/${fileId}/confirm`, {
      method: 'POST',
      body: sha256 ? { sha256 } : {},
    }),
  downloadFile: (fileId: string) => apiV2<{ url: string }>(`/api/v2/files/${fileId}/download`),
  listFiles: (params: { project_id?: string; sample_id?: string; sample_gene_id?: string }) => {
    const qs = new URLSearchParams()
    if (params.project_id) qs.set('project_id', params.project_id)
    if (params.sample_id) qs.set('sample_id', params.sample_id)
    if (params.sample_gene_id) qs.set('sample_gene_id', params.sample_gene_id)
    return apiV2<FileRef[]>(`/api/v2/files?${qs.toString()}`)
  },

  /* lab */
  createResult: (sampleId: string, input: CreateResultInput, idempotencyKey?: string) =>
    apiV2<LabResult>(`/api/v2/lab/samples/${sampleId}/results`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),
  listResults: (sampleId: string) =>
    apiV2<ResultWithHistory[]>(`/api/v2/lab/samples/${sampleId}/results`),
  correctResult: (resultId: string, input: CorrectResultInput) =>
    apiV2<LabResult>(`/api/v2/lab/results/${resultId}/correct`, { method: 'POST', body: input }),
  reviewResult: (resultId: string, status: 'approved' | 'retracted') =>
    apiV2<LabResult>(`/api/v2/lab/results/${resultId}/review`, {
      method: 'POST',
      body: { status },
    }),

  /* reports — o CRUD autenticado de laudo vive em lib/api.ts (getReports,
     createReport, getReport), usado por /projects/[id]/reports e /reports. */
  /** PÚBLICO — destino do QR Code impresso no PDF. Não envia auth.
   *  O router de laudos monta em /api/v2 (sem sub-prefixo "reports/"). */
  verifyReport: (reportId: string, hash: string) =>
    apiV2<ReportVerification>(
      `/api/v2/reports/${reportId}/verify?hash=${encodeURIComponent(hash)}`,
      { anonymous: true }
    ),
}

/* ── Upload em 3 passos (a API nunca recebe o byte) ─────────────────── */

export interface UploadOptions {
  project_id: string
  sample_id?: string
  sample_gene_id?: string
  category: string
  /** 0–100 */
  onProgress?: (pct: number) => void
  signal?: AbortSignal
}

/**
 * 1. POST /files/presign
 * 2. POST multipart direto para `upload_url` (fields + o arquivo no campo `file`)
 * 3. POST /files/{id}/confirm
 */
export async function uploadFile(file: File, opts: UploadOptions): Promise<FileRef> {
  const presign = await apiV2Client.presignFile({
    project_id: opts.project_id,
    sample_id: opts.sample_id,
    sample_gene_id: opts.sample_gene_id,
    category: opts.category,
    original_name: file.name,
    mime_type: file.type || 'application/octet-stream',
  })

  const form = new FormData()
  for (const [key, value] of Object.entries(presign.fields)) form.append(key, value)
  form.append('file', file)

  await putToStorage(presign.upload_url, form, opts.onProgress, opts.signal)

  const sha256 = await sha256Hex(file)
  return apiV2Client.confirmFile(presign.file_id, sha256)
}

/** XHR (e não fetch) porque só o XHR expõe progresso de upload. */
function putToStorage(
  url: string,
  form: FormData,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new ApiV2Error(xhr.status, `Falha no upload para o storage (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new ApiV2Error(0, 'Falha de rede no upload para o storage'))
    xhr.onabort = () => reject(new ApiV2Error(0, 'Upload cancelado'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(form)
  })
}

/** SHA-256 do arquivo, para o passo de confirm (integridade / cadeia de custódia). */
export async function sha256Hex(file: File): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return undefined
  }
}

/* ── Formatação de resultado (LOD/LOQ) ──────────────────────────────── */

/**
 * Nunca mostra 0 nem vazio para um valor abaixo do limite de detecção:
 * um resultado `< LOD` é uma informação, não a ausência dela.
 */
export function formatResultValue(r: Pick<LabResult, 'value_numeric' | 'lod' | 'below_lod' | 'unit'>): string {
  const belowLod = r.below_lod ?? (r.lod != null && r.value_numeric != null && r.value_numeric < r.lod)
  if (belowLod) return r.lod != null ? `< LOD (${r.lod} ${r.unit})` : '< LOD'
  if (r.value_numeric == null) return '—'
  return `${r.value_numeric} ${r.unit}`
}
