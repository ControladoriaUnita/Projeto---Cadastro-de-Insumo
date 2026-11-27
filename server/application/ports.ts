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
import type { UauConnectionCheck, WorkDTO } from '../../shared/contracts'
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
  /** Para onde vão os avisos (aprovação e devolução); null em solicitações antigas */
  requesterEmail: string | null
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
export type RequestPatch = Partial<Omit<RequestRecord, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'requesterId'>>

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
  /** Eventos de várias solicitações de uma vez (só dos tipos pedidos), em ordem de data. */
  listEventsOf(requestIds: readonly string[], types: readonly RequestEventType[]): Promise<EventRecord[]>
}

/** Perfil do usuário, visto pelo login Microsoft (mesmo inativo). */
export interface ProfileRecord {
  id: string
  fullName: string
  email: string | null
  active: boolean
  /** Object id da conta no Microsoft Entra ID (preenchido no 1º login) */
  entraOid: string | null
}

export interface NewProfile {
  fullName: string
  email: string
  entraOid: string | null
  role: RoleKey
  workName?: string | null
}

/** Perfil completo, para a tela de usuários da gestão */
export interface ManagedProfile extends ProfileRecord {
  role: RoleKey
  workName: string | null
  lastLoginAt: string | null
  createdAt: string | null
}

export type ProfilePatch = Partial<Pick<ManagedProfile, 'fullName' | 'role' | 'workName' | 'active'>>

export interface IdentityRepository {
  /** Perfil ativo com papel e permissões; null se não existe ou está inativo */
  loadActor(userId: string): Promise<Actor | null>
  findProfileByEntraOid(oid: string): Promise<ProfileRecord | null>
  /** Busca pelo e-mail sem diferenciar maiúsculas */
  findProfileByEmail(email: string): Promise<ProfileRecord | null>
  /** Cria um perfil já ativo (conta nova da organização entra como obra) */
  createProfile(input: NewProfile): Promise<ProfileRecord>
  /** Guarda o object id da Microsoft e a hora do último login */
  recordLogin(id: string, data: { entraOid: string | null; at: Date }): Promise<void>
  listProfiles(): Promise<ManagedProfile[]>
  getProfile(id: string): Promise<ManagedProfile | null>
  /** null = perfil não existe */
  updateProfile(id: string, patch: ProfilePatch): Promise<ManagedProfile | null>
}

export interface NewAccessRequest {
  email: string
  fullName: string
  requestedRole: RoleKey
  workName: string | null
  message: string | null
}

export interface AccessRequestRecord extends NewAccessRequest {
  id: string
  createdAt: string
}

export interface AccessRequestRepository {
  /** Grava o pedido; 'duplicate' quando já existe pedido em aberto para o e-mail. */
  createPending(input: NewAccessRequest): Promise<'created' | 'duplicate'>
  /** Pedidos pendentes, mais antigos primeiro */
  listPending(): Promise<AccessRequestRecord[]>
  /** Fecha um pedido pendente; false = não existe ou já foi decidido */
  resolve(id: string, outcome: { status: 'atendido' | 'recusado'; approvedRole: RoleKey | null; notes: string | null }): Promise<boolean>
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

export type { UauCheckStep, UauConnectionCheck } from '../../shared/contracts'

export interface UauGateway {
  readonly mode: 'mock' | 'real'
  /** Testa login e uma consulta pequena; nunca lança erro (falhas viram passos com ok=false) */
  checkConnection(): Promise<UauConnectionCheck>
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
  /** Obras ativas no UAU (em cache) */
  listWorks(): Promise<WorkDTO[]>
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
