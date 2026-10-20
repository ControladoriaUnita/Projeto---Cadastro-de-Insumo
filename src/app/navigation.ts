/**
 * Menus e tela inicial por papel. Para criar uma tela nova: rota em App.tsx + item aqui.
 */
import { PERMISSIONS, type Permission, type RoleKey } from '@shared/domain/roles'

export const PATHS = {
  newRequest: '/solicitacoes/nova',
  requests: '/solicitacoes',
  instructions: '/instrucoes',
  /** Manual em slides, um por página, para gerar o PDF */
  manualPrint: '/manual',
  request: (id: string) => `/solicitacoes/${id}`,
  drafting: '/cadastro',
  draft: (id: string) => `/cadastro/${id}`,
  approval: '/aprovacao',
  approve: (id: string) => `/aprovacao/${id}`,
  catalog: '/catalogo',
  integration: '/integracao',
} as const

export interface NavItem {
  to: string
  label: string
  permission: Permission
  /** Só marca ativo na rota exata */
  end?: boolean
}

export const NAV: NavItem[] = [
  { to: PATHS.newRequest, label: 'Solicitar insumo', permission: PERMISSIONS.requestCreate },
  { to: PATHS.instructions, label: 'Instruções', permission: PERMISSIONS.requestCreate },
  { to: PATHS.requests, label: 'Acompanhamento', permission: PERMISSIONS.requestReadOwn, end: true },
  { to: PATHS.drafting, label: 'Cadastro', permission: PERMISSIONS.draftEdit },
  { to: PATHS.approval, label: 'Aprovação', permission: PERMISSIONS.approvalDecide },
  { to: PATHS.catalog, label: 'Insumos UAU', permission: PERMISSIONS.catalogRead },
  { to: PATHS.integration, label: 'Integração', permission: PERMISSIONS.approvalDecide },
]

export const HOME_BY_ROLE: Record<RoleKey, string> = {
  obra: PATHS.requests,
  analista: PATHS.drafting,
  gestor: PATHS.approval,
}
