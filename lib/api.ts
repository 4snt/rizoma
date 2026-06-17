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
  getProjects:       () => apiFetch<Project[]>('/api/v1/projects/'),
  getProject:        (id: string) => apiFetch<Project>(`/api/v1/projects/${id}`),
  getJobs:           (projectId: string) => apiFetch<Job[]>(`/api/v1/jobs/${projectId}`),
  getWorkerStatus:   () => apiFetch<WorkerStatus>('/api/v1/worker/status'),
  getAnalysisResults:(jobId: string) => apiFetch<AnalysisResult[]>(`/api/v1/analysis/${jobId}/results`),
  searchDegs: (q: string, project?: string) => {
    const params = new URLSearchParams({ q, ...(project ? { project } : {}) })
    return apiFetch<DegResult[]>(`/api/v1/analysis/search/degs?${params}`)
  },
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
  enqueueJob:       (projectId: string, jobType: string, phyloseqOid?: number, payload?: Record<string, unknown>) =>
                      apiFetch<{ job_id: string }>('/api/v1/jobs/enqueue', {
                        method: 'POST',
                        body: JSON.stringify({
                          project_id: projectId,
                          job_type: jobType,
                          payload: payload ?? {},
                          phyloseq_oid: phyloseqOid ?? null,
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
  getAdminUsers:   (token: string) =>
                     apiFetchWithToken<AdminUser[]>('/api/v1/admin/users', token),
  getAdminInvites: (token: string) =>
                     apiFetchWithToken<Invite[]>('/api/v1/admin/invites', token),
  createInvite:    (token: string, email: string, role: string) =>
                     apiFetchWithToken<Invite>('/api/v1/admin/invites', token, {
                       method: 'POST',
                       body: JSON.stringify({ email, role }),
                     }),
  deleteInvite:    (token: string, id: string) =>
                     apiFetchWithToken<void>(`/api/v1/admin/invites/${id}`, token, { method: 'DELETE' }),
  updateUserRole:  (token: string, userId: string, role: string) =>
                     apiFetchWithToken<void>(`/api/v1/admin/users/${userId}/role`, token, {
                       method: 'PATCH',
                       body: JSON.stringify({ role }),
                     }),
  deactivateUser:  (token: string, userId: string) =>
                     apiFetchWithToken<void>(`/api/v1/admin/users/${userId}/deactivate`, token, { method: 'PATCH' }),

  createProject: (token: string, body: CreateProjectBody) =>
                   apiFetchWithToken<{ id: string }>('/api/v1/projects/', token, {
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

export interface Project {
  id: string
  code: string
  name: string
  description: string
  marker_type: '16S' | 'ITS'
  status: string
  bioproject_accession: string | null
  created_by: string | null
  dada2_params: Dada2Params
  author: ProjectAuthor | null
  analyses: AnalysisConfig[]
}

export interface CreateProjectBody {
  code: string
  name: string
  description: string
  marker_type: '16S' | 'ITS'
  analyses: AnalysisConfig[]
  dada2_params?: Dada2Params
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

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  is_active: boolean
  avatar_url: string | null
  last_login: string | null
}

export interface Invite {
  id: string
  email: string
  role: string
  invited_at: string
  used_at: string | null
}

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
