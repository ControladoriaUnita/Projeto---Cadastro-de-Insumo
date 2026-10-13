/**
 * Portas da aplicação: o que os casos de uso esperam do banco e do UAU.
 * Implementações em server/infrastructure (memória, Supabase, UAU real e simulado).
 */
import type { CatalogItem } from '../../shared/domain/insumo/catalog'
import type { InsumoDraft } from '../../shared/domain/insumo/draft'
import type { UauConfirmBody, UauInsertBody } from '../../shared/domain/insumo/uau-payload'
import type { RequestKind, Urgency } from '../../shared/domain/request/kinds'
import type { RequestEventType, RequestStatus } from '../../shared/domain/request/workflow'
import type { RoleKey } from '../../shared/domain/roles'
import type { Actor, RequestContext } from './context'

// ----------------------------------------------------------------------------- solicitações

export interface RequestRecord {
  id: string
  number: number
  status: RequestStatus
  kind: RequestKind
  urgency: Urgency
  workName: string
  description: string
  unit: string
  specification: string
  justification: string
  requesterId: string
  requesterName: string
  analystId: string | null
  analystName: string | null
  approverId: string | null
  approverName: string | null
  draft: InsumoDraft | null
  uauCode: string | null
  insertedAt: string | null
  confirmedAt: string | null
  lastComment: string | null
  createdAt: string
  updatedAt: string
}

export type NewRequestRecord = Omit<RequestRecord, 'id' | 'number' | 'createdAt' | 'updatedAt'>
export type RequestPatch = Partial<Omit<RequestRecord, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'requesterId' | 'requesterName'>>

export interface EventRecord {
  id: string
  requestId: string
  at: string
  actorId: string | null
  actorName: string
  type: RequestEventType
  fromStatus: RequestStatus | null
  toStatus: RequestStatus | null
  comment: string | null
  details: unknown
}

export interface RequestFilter {
  requesterId?: string
  statuses?: readonly RequestStatus[]
}

export interface RequestRepository {
  list(filter?: RequestFilter): Promise<RequestRecord[]>
  get(id: string): Promise<RequestRecord | null>
  create(input: NewRequestRecord): Promise<RequestRecord>
  /**
   * Atualiza só se a situação ainda for `expectedStatus` (duas pessoas agindo ao mesmo tempo
   * não passam as duas). Devolve null quando a situação mudou nesse meio-tempo.
   */
  update(id: string, expectedStatus: RequestStatus, patch: RequestPatch): Promise<RequestRecord | null>
  addEvent(event: Omit<EventRecord, 'id'>): Promise<void>
  listEvents(requestId: string): Promise<EventRecord[]>
}

export interface IdentityRepository {
  loadActor(userId: string): Promise<Actor | null>
}

export interface NewAccessRequest {
  email: string
  fullName: string
  requestedRole: RoleKey
  workName: string | null
  message: string | null
}

export interface AccessRequestRepository {
  /** Grava o pedido; 'duplicate' quando já existe pedido em aberto para o e-mail. */
  createPending(input: NewAccessRequest): Promise<'created' | 'duplicate'>
}

export interface Repositories {
  requests: RequestRepository
  identity: IdentityRepository
  accessRequests: AccessRequestRepository
}

// ----------------------------------------------------------------------------- UAU

export interface CatalogSnapshot {
  items: CatalogItem[]
  loadedAt: string
}

export interface UauWriteResult {
  ok: boolean
  /** HTTP do UAU (0 = não houve resposta) */
  status: number
  response: unknown
}

export interface UauGateway {
  readonly mode: 'mock' | 'real'
  /** false = simulação: inserção e confirmação ficam bloqueadas */
  readonly writeEnabled: boolean
  /** Usuário do UAU gravado no campo "usuario" do cadastro */
  readonly user: string
  /** Cadastro geral inteiro (em cache; refresh força nova leitura) */
  loadCatalog(opts?: { refresh?: boolean }): Promise<CatalogSnapshot>
  /** Todos os campos crus de um insumo do cadastro carregado */
  getRawItem(codigo: string): Promise<Record<string, unknown> | null>
  /** Consulta o UAU sem cache (confere se o código ainda está livre logo antes de gravar) */
  findByCode(codigo: string): Promise<CatalogItem | null>
  insert(body: UauInsertBody): Promise<UauWriteResult>
  confirm(body: UauConfirmBody): Promise<UauWriteResult>
  /** Descarta o cache do cadastro (ex.: depois de inserir) */
  invalidateCatalog(): void
}

// ----------------------------------------------------------------------------- e-mail

export interface EmailMessage {
  to: string[]
  cc: string[]
  subject: string
  html: string
  text: string
}

export interface Mailer {
  /** false = envio desligado (EMAIL_PROVIDER=none) */
  readonly enabled: boolean
  /** Endereço público do app, para links nos e-mails (null = sem link) */
  readonly appUrl: string | null
  /** Destinatários fixos em cópia nos avisos de aprovação */
  readonly approvalCc: string[]
  send(message: EmailMessage): Promise<void>
}

export interface UseCaseDeps {
  repos: Repositories
  uau: UauGateway
  mailer: Mailer
  ctx: RequestContext
}
