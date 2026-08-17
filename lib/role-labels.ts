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

/** Um rótulo customizado apontando pra um papel técnico. Vários rótulos
 * podem apontar pro mesmo papel (ex.: "Mestrando" e "Doutorando" os dois
 * em lab_tech) — por isso o catálogo da org é uma lista, não um mapa 1:1
 * (espelha app/modules/identity/schemas.py::RoleLabelEntry no backend). */
export interface RoleLabelEntry {
  label: string
  role: OrgRole
}

/** Rótulo padrão em português — usado quando a organização não cadastrou
 * nenhum rótulo customizado pra aquele papel. */
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

/** Resolve o(s) rótulo(s) de exibição de um papel: todos os rótulos
 * customizados que a org cadastrou pra esse papel (junta com " / " quando
 * há mais de um) > padrão em português > a própria string técnica (nunca
 * quebra a tela por um papel desconhecido). */
export function roleLabel(role: string, catalog?: RoleLabelEntry[] | null): string {
  const custom = (catalog ?? []).filter(e => e.role === role).map(e => e.label)
  if (custom.length > 0) return custom.join(" / ")
  return DEFAULT_ROLE_LABEL[role as OrgRole] || role
}
