const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  // 204 (DELETE/PUT sem corpo) não tem JSON — `res.json()` nesse caso
  // sempre estoura "Unexpected end of JSON input".
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // Só /api/v2 existe no backend (v1 e o módulo jobs foram removidos). O
  // contrato de projeto é POST/GET /lims/projects, GET /lims/projects/{id} e
  // PATCH /lims/projects/{id}/status — não há PUT/DELETE de projeto.
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
  // Edição parcial da amostra (identificação do isolado, cultivo, morfologia,
  // notas, GPS). Substitui o antigo PATCH .../morphology.
  updateSample:      (token: string, sampleId: string, body: SampleUpdate) =>
                       apiFetchWithToken<LimsSample>(`/api/v2/lims/samples/${sampleId}`, token, {
                         method: 'PATCH',
                         body: JSON.stringify(body),
                       }),
  // Dados biológicos do isolado: testes bioquímicos, genes e alíquotas.
  getSampleTests:    (token: string, sampleId: string) =>
                       apiFetchWithToken<SampleTest[]>(`/api/v2/lims/samples/${sampleId}/tests`, token),
  createSampleTest:  (token: string, sampleId: string, body: CreateSampleTestBody) =>
                       apiFetchWithToken<SampleTest>(`/api/v2/lims/samples/${sampleId}/tests`, token, {
                         method: 'POST',
                         body: JSON.stringify(body),
                       }),
  deleteSampleTest:  (token: string, sampleId: string, testId: string) =>
                       apiFetchWithToken<void>(`/api/v2/lims/samples/${sampleId}/tests/${testId}`, token, {
                         method: 'DELETE',
                       }),
  getSampleGenes:    (token: string, sampleId: string) =>
                       apiFetchWithToken<SampleGene[]>(`/api/v2/lims/samples/${sampleId}/genes`, token),
  createSampleGene:  (token: string, sampleId: string, body: CreateSampleGeneBody) =>
                       apiFetchWithToken<SampleGene>(`/api/v2/lims/samples/${sampleId}/genes`, token, {
                         method: 'POST',
                         body: JSON.stringify(body),
                       }),
  updateSampleGene:  (token: string, sampleId: string, geneId: string, body: UpdateSampleGeneBody) =>
                       apiFetchWithToken<SampleGene>(`/api/v2/lims/samples/${sampleId}/genes/${geneId}`, token, {
                         method: 'PATCH',
                         body: JSON.stringify(body),
                       }),
  deleteSampleGene:  (token: string, sampleId: string, geneId: string) =>
                       apiFetchWithToken<void>(`/api/v2/lims/samples/${sampleId}/genes/${geneId}`, token, {
                         method: 'DELETE',
                       }),
  getSampleAliquots: (token: string, sampleId: string) =>
                       apiFetchWithToken<SampleAliquot[]>(`/api/v2/lims/samples/${sampleId}/aliquots`, token),
  createSampleAliquot: (token: string, sampleId: string, body: CreateSampleAliquotBody) =>
                       apiFetchWithToken<SampleAliquot>(`/api/v2/lims/samples/${sampleId}/aliquots`, token, {
                         method: 'POST',
                         body: JSON.stringify(body),
                       }),
  updateSampleAliquot: (token: string, sampleId: string, aliquotId: string, body: UpdateSampleAliquotBody) =>
                       apiFetchWithToken<SampleAliquot>(`/api/v2/lims/samples/${sampleId}/aliquots/${aliquotId}`, token, {
                         method: 'PATCH',
                         body: JSON.stringify(body),
                       }),
  deleteSampleAliquot: (token: string, sampleId: string, aliquotId: string) =>
                       apiFetchWithToken<void>(`/api/v2/lims/samples/${sampleId}/aliquots/${aliquotId}`, token, {
                         method: 'DELETE',
                       }),
  // Cross-project: projeto é filtro opcional, não pré-requisito — 1 query
  // no backend, substitui a agregação client-side projeto-por-projeto que
  // as telas /samples, /reports e /results faziam antes.
  getAllSamples:     (token: string, projectId?: string) =>
                       apiFetchWithToken<LimsSampleListItem[]>(
                         `/api/v2/lims/samples${projectId ? `?project_id=${projectId}` : ''}`, token,
                       ),

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
  // Cross-project/amostra: mesma decisão de getAllSamples — 1 query, sem
  // trazer histórico completo (só a versão corrente, suficiente pra lista).
  getAllResults:     (token: string, filters?: { projectId?: string; sampleId?: string }) => {
                       const params = new URLSearchParams()
                       if (filters?.projectId) params.set('project_id', filters.projectId)
                       if (filters?.sampleId) params.set('sample_id', filters.sampleId)
                       const qs = params.toString()
                       return apiFetchWithToken<ResultListItem[]>(`/api/v2/lab/results${qs ? `?${qs}` : ''}`, token)
                     },
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
  // Cross-project: mesma decisão de getAllSamples — 1 query.
  getAllReports:     (token: string, projectId?: string) =>
                       apiFetchWithToken<ReportListItemAgg[]>(
                         `/api/v2/reports${projectId ? `?project_id=${projectId}` : ''}`, token,
                       ),
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
  // ADR-013 — substitui o catálogo inteiro (não é PATCH incremental).
  // Vários rótulos podem apontar pro mesmo papel técnico.
  updateRoleLabels:  (token: string, roleLabels: RoleLabelEntry[]) =>
                       apiFetchWithToken<void>('/api/v2/identity/organizations/role-labels', token, {
                         method: 'PUT',
                         body: JSON.stringify({ role_labels: roleLabels }),
                       }),
  createProject: (token: string, body: CreateProjectBody) =>
                   apiFetchWithToken<Project>('/api/v2/lims/projects', token, {
                     method: 'POST',
                     body: JSON.stringify(body),
                   })
}

export interface ProjectAuthor {
  name: string
  avatar_url: string | null
}

// Não existe mais Customer/CreateCustomerBody (ADR-011). Pesquisador de
// projeto é sempre AdminUser (organization_member) — ver lib/api.ts,
// seção "Admin".

export interface Project {
  id: string
  code: string
  name: string
  description: string
  status: string
  created_by: string | null
  customer_user_id?: string | null
  author?: ProjectAuthor | null
}

export interface CreateProjectBody {
  code: string
  name: string
  description: string
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
  // Dados biológicos (isolados bacterianos/fúngicos) — morfologia de colônia
  // segundo Bergey. Todos opcionais; null quando a amostra não é um isolado.
  organism_type: OrganismType | null
  colonia_forma: ColoniaForma | null
  colonia_elevacao: ColoniaElevacao | null
  colonia_margem: ColoniaMargem | null
  colonia_cor: string | null
  colonia_textura: ColoniaTextura | null
  colonia_tamanho_mm: number | null
  colonia_opacidade: ColoniaOpacidade | null
  // Identificação do isolado (linhagem, origem, hospedeiro, local).
  isolation_source: string | null
  host_species: string | null
  host_cultivar: string | null
  collection_site: string | null
  // Cultivo.
  isolated_at: string | null          // YYYY-MM-DD
  culture_medium: string | null
  incubation_temp_c: number | null
  incubation_hours: number | null
  // Caracterização celular.
  gram_stain: GramStain | null
  cell_shape: CellShape | null
  motility: Motility | null
}

// ── LIMS: dados biológicos da amostra (morfologia, testes, genes) ───────────

export type OrganismType = 'bacteria' | 'fungo' | 'outro'
export type ColoniaForma =
  | 'circular' | 'irregular' | 'filamentosa' | 'rizoide' | 'fusiforme' | 'puntiforme'
export type ColoniaElevacao =
  | 'plana' | 'elevada' | 'convexa' | 'pulvinada' | 'umbonada' | 'crateriforme'
export type ColoniaMargem = 'inteira' | 'ondulada' | 'lobada' | 'filiforme' | 'crespa'
export type ColoniaTextura = 'lisa' | 'rugosa' | 'mucoide' | 'seca' | 'granular' | 'viscosa'
export type ColoniaOpacidade = 'opaca' | 'translucida' | 'transparente'
export type GenePurpose = 'identificacao' | 'resistencia' | 'producao_enzima' | 'outro'
export type GramStain = 'positiva' | 'negativa' | 'variavel' | 'nao_aplicavel'
export type CellShape =
  | 'bacilo' | 'coco' | 'cocobacilo' | 'espirilo' | 'vibriao'
  | 'filamentoso' | 'leveduriforme' | 'hifa' | 'outro'
export type Motility = 'movel' | 'imovel' | 'nao_testado'
export type StorageMethod =
  | 'glicerol_-80' | 'glicerol_-20' | 'liofilizado' | 'placa_4c'
  | 'oleo_mineral' | 'agua_esteril' | 'outro'
export type AliquotStatus = 'disponivel' | 'consumida' | 'descartada' | 'contaminada'

export const ORGANISM_TYPES = ['bacteria', 'fungo', 'outro'] as const satisfies readonly OrganismType[]
export const COLONIA_FORMAS = ['circular', 'irregular', 'filamentosa', 'rizoide', 'fusiforme', 'puntiforme'] as const satisfies readonly ColoniaForma[]
export const COLONIA_ELEVACOES = ['plana', 'elevada', 'convexa', 'pulvinada', 'umbonada', 'crateriforme'] as const satisfies readonly ColoniaElevacao[]
export const COLONIA_MARGENS = ['inteira', 'ondulada', 'lobada', 'filiforme', 'crespa'] as const satisfies readonly ColoniaMargem[]
export const COLONIA_TEXTURAS = ['lisa', 'rugosa', 'mucoide', 'seca', 'granular', 'viscosa'] as const satisfies readonly ColoniaTextura[]
export const COLONIA_OPACIDADES = ['opaca', 'translucida', 'transparente'] as const satisfies readonly ColoniaOpacidade[]
export const GENE_PURPOSES = ['identificacao', 'resistencia', 'producao_enzima', 'outro'] as const satisfies readonly GenePurpose[]
export const GRAM_STAINS = ['positiva', 'negativa', 'variavel', 'nao_aplicavel'] as const satisfies readonly GramStain[]
export const CELL_SHAPES = ['bacilo', 'coco', 'cocobacilo', 'espirilo', 'vibriao', 'filamentoso', 'leveduriforme', 'hifa', 'outro'] as const satisfies readonly CellShape[]
export const MOTILITIES = ['movel', 'imovel', 'nao_testado'] as const satisfies readonly Motility[]
export const STORAGE_METHODS = ['glicerol_-80', 'glicerol_-20', 'liofilizado', 'placa_4c', 'oleo_mineral', 'agua_esteril', 'outro'] as const satisfies readonly StorageMethod[]
export const ALIQUOT_STATUSES = ['disponivel', 'consumida', 'descartada', 'contaminada'] as const satisfies readonly AliquotStatus[]

// Sugestões (datalist) — vocabulário aberto, o backend aceita texto livre.
export const ISOLATION_SOURCE_SUGGESTIONS = [
  'rizosfera', 'endofítico de raiz', 'endofítico de folha', 'nódulo radicular', 'filosfera',
  'solo bulk', 'sedimento', 'água', 'compostagem', 'serrapilheira',
] as const
export const CULTURE_MEDIUM_SUGGESTIONS = [
  'TSA', 'NA', 'LB', 'King B', 'YMA', 'PDA', 'BDA', 'Sabouraud', 'MRS', 'R2A',
] as const

export const ORGANISM_TYPE_LABELS: Record<OrganismType, string> = {
  bacteria: 'Bactéria', fungo: 'Fungo', outro: 'Outro',
}
export const COLONIA_FORMA_LABELS: Record<ColoniaForma, string> = {
  circular: 'Circular', irregular: 'Irregular', filamentosa: 'Filamentosa',
  rizoide: 'Rizoide', fusiforme: 'Fusiforme', puntiforme: 'Puntiforme',
}
export const COLONIA_ELEVACAO_LABELS: Record<ColoniaElevacao, string> = {
  plana: 'Plana', elevada: 'Elevada', convexa: 'Convexa',
  pulvinada: 'Pulvinada', umbonada: 'Umbonada', crateriforme: 'Crateriforme',
}
export const COLONIA_MARGEM_LABELS: Record<ColoniaMargem, string> = {
  inteira: 'Inteira', ondulada: 'Ondulada', lobada: 'Lobada', filiforme: 'Filiforme', crespa: 'Crespa',
}
export const COLONIA_TEXTURA_LABELS: Record<ColoniaTextura, string> = {
  lisa: 'Lisa', rugosa: 'Rugosa', mucoide: 'Mucoide', seca: 'Seca', granular: 'Granular', viscosa: 'Viscosa',
}
export const COLONIA_OPACIDADE_LABELS: Record<ColoniaOpacidade, string> = {
  opaca: 'Opaca', translucida: 'Translúcida', transparente: 'Transparente',
}
export const GENE_PURPOSE_LABELS: Record<GenePurpose, string> = {
  identificacao: 'Identificação', resistencia: 'Resistência',
  producao_enzima: 'Produção de enzima', outro: 'Outro',
}
export const GRAM_STAIN_LABELS: Record<GramStain, string> = {
  positiva: 'Gram-positiva', negativa: 'Gram-negativa',
  variavel: 'Gram-variável', nao_aplicavel: 'Não se aplica',
}
export const CELL_SHAPE_LABELS: Record<CellShape, string> = {
  bacilo: 'Bacilo', coco: 'Coco', cocobacilo: 'Cocobacilo', espirilo: 'Espirilo',
  vibriao: 'Vibrião', filamentoso: 'Filamentoso', leveduriforme: 'Leveduriforme',
  hifa: 'Hifa', outro: 'Outro',
}
export const MOTILITY_LABELS: Record<Motility, string> = {
  movel: 'Móvel', imovel: 'Imóvel', nao_testado: 'Não testado',
}
export const STORAGE_METHOD_LABELS: Record<StorageMethod, string> = {
  'glicerol_-80': 'Glicerol −80 °C', 'glicerol_-20': 'Glicerol −20 °C',
  liofilizado: 'Liofilizado', placa_4c: 'Placa 4 °C', oleo_mineral: 'Óleo mineral',
  agua_esteril: 'Água estéril', outro: 'Outro',
}
export const ALIQUOT_STATUS_LABELS: Record<AliquotStatus, string> = {
  disponivel: 'Disponível', consumida: 'Consumida',
  descartada: 'Descartada', contaminada: 'Contaminada',
}

// PATCH /samples/{id} — subconjunto qualquer dos campos editáveis.
// `lat`/`lon` devem ir juntos (ou nenhum) — o backend rejeita só um dos dois.
export interface SampleUpdate {
  // identificação do isolado
  isolation_source?: string | null
  host_species?: string | null
  host_cultivar?: string | null
  collection_site?: string | null
  // cultivo
  isolated_at?: string | null
  culture_medium?: string | null
  incubation_temp_c?: number | null
  incubation_hours?: number | null
  // caracterização celular
  gram_stain?: GramStain | null
  cell_shape?: CellShape | null
  motility?: Motility | null
  // morfologia de colônia
  organism_type?: OrganismType | null
  colonia_forma?: ColoniaForma | null
  colonia_elevacao?: ColoniaElevacao | null
  colonia_margem?: ColoniaMargem | null
  colonia_cor?: string | null
  colonia_textura?: ColoniaTextura | null
  colonia_tamanho_mm?: number | null
  colonia_opacidade?: ColoniaOpacidade | null
  // metadados gerais
  treatment_group?: string | null
  replicate?: number | null
  notes?: string | null
  lat?: number | null
  lon?: number | null
  occurred_at?: string | null
}

// Alíquotas / estoque do isolado (criopreservação, placa, liofilizado…).
export interface SampleAliquot {
  id: string
  sample_id: string
  label: string
  storage_method: StorageMethod
  freezer: string | null
  box: string | null
  position: string | null
  stored_at: string | null
  status: AliquotStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateSampleAliquotBody {
  label: string
  storage_method: StorageMethod
  freezer?: string | null
  box?: string | null
  position?: string | null
  stored_at?: string | null
  status?: AliquotStatus
  notes?: string | null
}

export type UpdateSampleAliquotBody = Partial<CreateSampleAliquotBody>


// Testes bioquímicos/enzimáticos — catálogo aberto (test_name é texto livre).
export type SampleTestResultType = 'qualitativo' | 'quantitativo'

export interface SampleTest {
  id: string
  sample_id: string
  test_name: string
  result: string | null
  result_type: SampleTestResultType | null
  result_value: number | null
  result_unit: string | null
  method: string | null
  tested_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreateSampleTestBody {
  test_name: string
  result?: string | null
  result_type?: SampleTestResultType | null
  result_value?: number | null
  result_unit?: string | null
  method?: string | null
  tested_at?: string | null
  notes?: string | null
}

export interface SampleGene {
  id: string
  sample_id: string
  gene: string
  purpose: GenePurpose
  result: string | null
  ncbi_accession: string | null
  method: string | null
  tested_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  // Sequência (já normalizada pelo backend: sem header, uppercase) + primers + BLAST.
  sequence: string | null
  sequence_header: string | null
  sequence_length: number | null
  primer_forward: string | null
  primer_reverse: string | null
  blast_top_hit: string | null
  blast_hit_accession: string | null
  blast_identity_pct: number | null
  blast_coverage_pct: number | null
}

export interface CreateSampleGeneBody {
  gene: string
  purpose: GenePurpose
  result?: string | null
  ncbi_accession?: string | null
  method?: string | null
  tested_at?: string | null
  notes?: string | null
  /** Pode ser FASTA colado (com `>header`) — o backend normaliza. */
  sequence?: string | null
  sequence_header?: string | null
  primer_forward?: string | null
  primer_reverse?: string | null
  blast_top_hit?: string | null
  blast_hit_accession?: string | null
  blast_identity_pct?: number | null
  blast_coverage_pct?: number | null
}

// PATCH /samples/{id}/genes/{geneId} — subconjunto qualquer.
export type UpdateSampleGeneBody = Partial<CreateSampleGeneBody>

// `SampleOut` + código/nome do projeto — espelha
// app/modules/lims/schemas.py::SampleListItemOut. Só existe pra alimentar
// GET /api/v2/lims/samples (listagem cross-project).
export interface LimsSampleListItem extends LimsSample {
  project_code: string
  project_name: string
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
  organism_type?: OrganismType | null
  colonia_forma?: ColoniaForma | null
  colonia_elevacao?: ColoniaElevacao | null
  colonia_margem?: ColoniaMargem | null
  colonia_cor?: string | null
  colonia_textura?: ColoniaTextura | null
  colonia_tamanho_mm?: number | null
  colonia_opacidade?: ColoniaOpacidade | null
  // Registro do isolado — o backend aceita tudo já no POST (SampleCreate).
  isolation_source?: string | null
  host_species?: string | null
  host_cultivar?: string | null
  collection_site?: string | null
  isolated_at?: string | null
  culture_medium?: string | null
  incubation_temp_c?: number | null
  incubation_hours?: number | null
  gram_stain?: GramStain | null
  cell_shape?: CellShape | null
  motility?: Motility | null
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

// Só a versão corrente (sem `history`) + código de amostra/projeto —
// espelha app/modules/laboratory/schemas.py::ResultListItemOut. Só existe
// pra alimentar GET /api/v2/lab/results (listagem cross-project/amostra).
export interface ResultListItem {
  id: string
  sample_id: string
  sample_code: string
  project_id: string
  project_code: string
  analyte: string
  method: string | null
  created_at: string
  current: ResultVersion
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

// `ReportListItem` + código/nome do projeto — espelha
// app/modules/reports/schemas.py::ReportListItemAgg. Só existe pra
// alimentar GET /api/v2/reports (listagem cross-project).
export interface ReportListItemAgg extends ReportListItem {
  project_code: string
  project_name: string
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

// ORG_ROLES/OrgRole vivem em lib/role-labels.ts (fonte única, junto do
// resolver de rótulo — ADR-013). Re-exportado aqui só pra não quebrar
// import existente de quem já fazia `import { ORG_ROLES } from '@/lib/api'`.
import { ORG_ROLES, type OrgRole, type RoleLabelEntry } from './role-labels'
export { ORG_ROLES }
export type { OrgRole }

// PROJECT_WRITE_ROLES foi substituído por `can(role, 'project:write')` de
// lib/permissions.ts — mesma fonte de verdade do resto do gating (samples,
// inventory, interop), em vez de uma lista de papéis duplicada só pra
// projeto. Ver lib/permissions.ts.

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

// AdminUser/Invite removidos — duplicavam Member/Invitation (mais abaixo
// neste arquivo), que já é o que /admin/members usa de verdade.
