/**
 * Papéis e permissões. Fonte única usada pela API (autorização) e pela UI (menus e botões).
 *
 *   obra      → solicita insumos e acompanha as próprias solicitações
 *   analista  → monta o cadastro do insumo e envia para aprovação (nada vai para o UAU)
 *   gestor    → tudo: revisa, ajusta, insere no UAU e confirma (muda a situação)
 */

export type RoleKey = 'obra' | 'analista' | 'gestor'

export const ROLE_LABELS: Record<RoleKey, string> = {
  obra: 'Obra',
  analista: 'Analista de cadastro',
  gestor: 'Gestão',
}

export const PERMISSIONS = {
  /** Abrir uma solicitação de insumo novo */
  requestCreate: 'request.create',
  /** Ver as solicitações que abriu */
  requestReadOwn: 'request.read.own',
  /** Ver todas as solicitações */
  requestReadAll: 'request.read.all',
  /** Recusar solicitação antes de ela chegar à aprovação */
  requestReject: 'request.reject',
  /** Procurar insumos parecidos (evita pedir algo que já existe) */
  catalogSearch: 'catalog.search',
  /** Tela completa do cadastro de insumos do UAU */
  catalogRead: 'catalog.read',
  /** Montar/editar o cadastro do insumo e enviar para aprovação */
  draftEdit: 'draft.edit',
  /** Aprovar: inserir no UAU e confirmar a situação do insumo */
  approvalDecide: 'approval.decide',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const P = PERMISSIONS

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  obra: [P.requestCreate, P.requestReadOwn, P.catalogSearch],
  analista: [P.requestCreate, P.requestReadOwn, P.requestReadAll, P.requestReject, P.catalogSearch, P.catalogRead, P.draftEdit],
  gestor: Object.values(P),
}

export function permissionsFor(role: RoleKey): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}

export const isRoleKey = (v: unknown): v is RoleKey => v === 'obra' || v === 'analista' || v === 'gestor'
