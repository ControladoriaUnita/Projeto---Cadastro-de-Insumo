/**
 * Fluxo da solicitação de insumo (máquina de estados).
 *
 *   solicitado ──start_draft──▶ em_cadastro ──submit──▶ aguardando_aprovacao ──approve──▶ em_insercao
 *       │                          ▲   │                      │   │                            │
 *     cancel                       └─return──────────────────┘   reject                  insere no UAU
 *       ▼                              reject                        ▼                            ▼
 *   cancelado                            ▼                       recusado            inserido_nao_confirmado
 *                                     recusado                                                │ confirma
 *                                                                                             ▼
 *                                                                                          aprovado
 *
 * Nada é gravado no UAU antes de `approve`. Se a aprovação parar no meio (queda de rede, erro
 * do UAU), `resume` retoma de onde parou sem inserir duas vezes.
 */
import { PERMISSIONS, type Permission } from '../roles'

export const REQUEST_STATUSES = [
  'solicitado',
  'em_cadastro',
  'aguardando_aprovacao',
  'em_insercao',
  'inserido_nao_confirmado',
  'aprovado',
  'recusado',
  'cancelado',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export type RequestAction = 'cancel' | 'start_draft' | 'save_draft' | 'submit' | 'return' | 'reject' | 'approve' | 'resume'

/** Mínimo que o fluxo precisa saber da solicitação e de quem age. */
export interface WorkflowSubject {
  status: RequestStatus
  requesterId: string
}
export interface WorkflowActor {
  id: string
  permissions: readonly string[]
}

interface Rule {
  /** Situação → permissão exigida nela */
  from: Partial<Record<RequestStatus, Permission>>
  requiresComment?: boolean
  /** Só quem abriu a solicitação (ou quem tem `approval.decide`) */
  ownerOnly?: boolean
}

const P = PERMISSIONS

const RULES: Record<RequestAction, Rule> = {
  cancel: { from: { solicitado: P.requestCreate }, ownerOnly: true },
  start_draft: { from: { solicitado: P.draftEdit } },
  save_draft: { from: { em_cadastro: P.draftEdit, aguardando_aprovacao: P.approvalDecide } },
  submit: { from: { em_cadastro: P.draftEdit } },
  return: { from: { aguardando_aprovacao: P.approvalDecide }, requiresComment: true },
  reject: {
    from: { solicitado: P.requestReject, em_cadastro: P.requestReject, aguardando_aprovacao: P.approvalDecide },
    requiresComment: true,
  },
  approve: { from: { aguardando_aprovacao: P.approvalDecide } },
  resume: { from: { em_insercao: P.approvalDecide, inserido_nao_confirmado: P.approvalDecide } },
}

export const ACTION_LABELS: Record<RequestAction, string> = {
  cancel: 'Cancelar solicitação',
  start_draft: 'Iniciar cadastro',
  save_draft: 'Salvar',
  submit: 'Enviar para aprovação',
  return: 'Devolver ao analista',
  reject: 'Recusar',
  approve: 'Aprovar e inserir no UAU',
  resume: 'Retomar inserção no UAU',
}

export class WorkflowError extends Error {
  constructor(
    readonly code: 'ACTION_NOT_ALLOWED' | 'FORBIDDEN' | 'COMMENT_REQUIRED',
    message: string,
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export function requiresComment(action: RequestAction): boolean {
  return !!RULES[action].requiresComment
}

export function canPerform(action: RequestAction, subject: WorkflowSubject, actor: WorkflowActor): boolean {
  const rule = RULES[action]
  const permission = rule.from[subject.status]
  if (!permission || !actor.permissions.includes(permission)) return false
  if (rule.ownerOnly && subject.requesterId !== actor.id && !actor.permissions.includes(P.approvalDecide)) return false
  return true
}

export function availableActions(subject: WorkflowSubject, actor: WorkflowActor): RequestAction[] {
  return (Object.keys(RULES) as RequestAction[]).filter((a) => canPerform(a, subject, actor))
}

/** Lança WorkflowError explicando por que a ação não pode ser feita. */
export function assertCanPerform(action: RequestAction, subject: WorkflowSubject, actor: WorkflowActor, comment?: string | null): void {
  const rule = RULES[action]
  if (!rule.from[subject.status]) {
    throw new WorkflowError('ACTION_NOT_ALLOWED', `"${ACTION_LABELS[action]}" não é possível com a solicitação na situação atual.`)
  }
  if (!canPerform(action, subject, actor)) {
    throw new WorkflowError('FORBIDDEN', `Seu perfil não pode "${ACTION_LABELS[action].toLowerCase()}" nesta etapa.`)
  }
  if (rule.requiresComment && !comment?.trim()) {
    throw new WorkflowError('COMMENT_REQUIRED', 'Escreva o motivo para continuar.')
  }
}

/** Quem pode ver a solicitação. */
export function canRead(subject: WorkflowSubject, actor: WorkflowActor): boolean {
  if (actor.permissions.includes(P.requestReadAll)) return true
  return actor.permissions.includes(P.requestReadOwn) && subject.requesterId === actor.id
}

/** Situações em que o código do rascunho fica reservado (ninguém mais pode usá-lo). */
export const CODE_RESERVING_STATUSES: readonly RequestStatus[] = ['em_cadastro', 'aguardando_aprovacao', 'em_insercao', 'inserido_nao_confirmado']

/** Filas de trabalho */
export const DRAFTING_QUEUE: readonly RequestStatus[] = ['solicitado', 'em_cadastro']
export const APPROVAL_QUEUE: readonly RequestStatus[] = ['aguardando_aprovacao', 'em_insercao', 'inserido_nao_confirmado']
export const FINAL_STATUSES: readonly RequestStatus[] = ['aprovado', 'recusado', 'cancelado']

/** Tipos de evento do histórico (ações + resultados da integração). */
export type RequestEventType =
  | 'created'
  | RequestAction
  | 'uau_inserted'
  | 'uau_insert_failed'
  | 'uau_confirmed'
  | 'uau_confirm_failed'
  | 'uau_already_present'
  | 'email_sent'
  | 'email_failed'
