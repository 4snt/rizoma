/**
 * Espelha app/shared/context.py::PERMISSIONS do backend — a fonte de
 * verdade de permissão continua lá (RLS + `ctx.require()`); isto é só
 * pra UI não mostrar um botão que o clique vai 403. Se um papel novo ou
 * uma ação nova mudar no backend e este arquivo não acompanhar, o pior
 * caso é a UI mostrar um botão a mais — o backend sempre corta de
 * verdade, então nunca é um buraco de segurança, só de acabamento.
 */

export type Action =
  | 'project:read' | 'project:write'
  | 'sample:read' | 'sample:write'
  | 'file:read' | 'file:write'
  | 'job:read' | 'job:write'
  | 'result:read' | 'result:write' | 'result:review'
  | 'report:read' | 'report:write' | 'report:sign'
  | 'member:read' | 'member:write'
  | 'reagent:read' | 'reagent:write'
  | 'equipment:read' | 'equipment:write'

const PERMISSIONS: Record<string, Set<Action>> = {
  org_admin: new Set<Action>([
    'project:read', 'project:write',
    'sample:read', 'sample:write', 'file:read', 'file:write',
    'job:read', 'job:write', 'result:read', 'result:write', 'result:review',
    'report:read', 'report:write', 'report:sign', 'member:read', 'member:write',
    'reagent:read', 'reagent:write', 'equipment:read', 'equipment:write',
  ]),
  coordinator: new Set<Action>([
    'project:read', 'project:write',
    'sample:read', 'sample:write', 'file:read', 'file:write',
    'job:read', 'job:write', 'result:read', 'report:read', 'report:write',
    'member:read',
    'reagent:read', 'reagent:write', 'equipment:read', 'equipment:write',
  ]),
  tech_responsible: new Set<Action>([
    'project:read', 'sample:read', 'file:read', 'job:read',
    'result:read', 'result:write', 'result:review',
    'report:read', 'report:write', 'report:sign',
    'reagent:read', 'equipment:read', 'equipment:write',
  ]),
  field_tech: new Set<Action>([
    'project:read', 'sample:read', 'sample:write', 'file:write', 'file:read',
  ]),
  lab_tech: new Set<Action>([
    'project:read', 'sample:read', 'sample:write',
    'result:read', 'result:write', 'file:read', 'file:write',
    'reagent:read', 'reagent:write', 'equipment:read',
  ]),
  bioinformatician: new Set<Action>([
    'project:read', 'sample:read', 'file:read', 'file:write',
    'job:read', 'job:write', 'result:read',
  ]),
  client: new Set<Action>(['project:read', 'report:read']),
  viewer: new Set<Action>(['project:read', 'sample:read', 'result:read', 'report:read']),
}

/** `role` indefinido (sessão ainda carregando) nunca libera nada — falha
 * fechado, não aberto. */
export function can(role: string | undefined | null, action: Action): boolean {
  if (!role) return false
  return PERMISSIONS[role]?.has(action) ?? false
}
