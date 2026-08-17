/**
 * Resolução de rótulo de papel — ponto único (ADR-013, rizoma-backend).
 *
 * O papel técnico (org_admin, coordinator, tech_responsible, field_tech,
 * lab_tech, bioinformatician, client, viewer) é fixo e decide permissão de
 * verdade no backend. O que aparece na tela pode ser customizado por
 * organização (ex.: "lab_tech" -> "Mestrando") — nunca hardcoded em mais de
 * um componente. Toda tela que mostra um papel deve chamar `roleLabel()`
 * daqui, nunca ter seu próprio dicionário de rótulos.
 */

export const ORG_ROLES = [
  "org_admin", "coordinator", "tech_responsible", "field_tech",
  "lab_tech", "bioinformatician", "client", "viewer",
] as const
export type OrgRole = typeof ORG_ROLES[number]

/** Rótulo padrão em português — usado quando a organização não
 * customizou aquele papel específico. */
export const DEFAULT_ROLE_LABEL: Record<OrgRole, string> = {
  org_admin: "Administrador da organização",
  coordinator: "Coordenador",
  tech_responsible: "Responsável técnico",
  field_tech: "Técnico de campo",
  lab_tech: "Técnico de laboratório",
  bioinformatician: "Bioinformata",
  client: "Acesso externo (só leitura de laudos)",
  viewer: "Leitor",
}

/** Resolve o rótulo de exibição de um papel: customizado pela org > padrão
 * em português > a própria string técnica (nunca quebra a tela por um
 * papel desconhecido). */
export function roleLabel(role: string, customLabels?: Record<string, string> | null): string {
  return customLabels?.[role] || DEFAULT_ROLE_LABEL[role as OrgRole] || role
}
