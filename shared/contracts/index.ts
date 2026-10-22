/**
 * Contratos da API (DTOs + schemas Zod) compartilhados entre UI e servidor.
 * Valores decimais trafegam SEMPRE como string ("1234.56").
 */
import { z } from 'zod'
import type { CatalogItem } from '../domain/insumo/catalog'
import type { DraftValidation, InsumoDraft } from '../domain/insumo/draft'
import type { SimilarItem } from '../domain/insumo/similarity'
import type { UauConfirmBody, UauInsertBody } from '../domain/insumo/uau-payload'
import { REQUESTABLE_KINDS, type RequestKind, type Urgency } from '../domain/request/kinds'
import { MAX_BATCH_ITEMS } from '../domain/request/spreadsheet'
import type { RequestDeadlines } from '../domain/request/deadline'
import type { RequestAction, RequestEventType, RequestStatus } from '../domain/request/workflow'
import type { RoleKey } from '../domain/roles'

export type { CatalogItem, DraftValidation, InsumoDraft, SimilarItem, UauConfirmBody, UauInsertBody }

// ----------------------------------------------------------------------------- erros

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; correlationId?: string }
}

// ----------------------------------------------------------------------------- sessão e ambiente

export interface UserDTO {
  id: string
  fullName: string
  email: string | null
  role: RoleKey
  roleLabel: string
  /** Obra padrão de quem é do perfil "obra" */
  workName: string | null
  permissions: string[]
  /** Obra sem login (não tem cadastro) */
  guest: boolean
}

/** Configuração pública (sem login): como a tela deve autenticar. */
export interface AuthConfigDTO {
  /** memory = modo demonstração (sem login); supabase = login pelo Supabase Auth */
  dataSource: 'memory' | 'supabase'
  supabaseUrl: string | null
  /** Chave anon/publishable: pública por natureza, só serve para login */
  supabaseAnonKey: string | null
  /** Domínios aceitos no pedido de acesso (ex.: unitaengenharia.com.br) */
  corporateDomains: string[]
}

export const accessRequestSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe seu nome completo.').max(120),
    email: z.string().trim().toLowerCase().email('E-mail inválido.').max(160),
    // Obra não precisa de cadastro: solicita sem login
    requestedRole: z.enum(['analista', 'gestor']),
    workName: z.string().trim().max(120).default(''),
    message: z.string().trim().max(1000).default(''),
    /** Campo-isca invisível: robôs preenchem, pessoas não */
    website: z.string().max(200).default(''),
  })
export type AccessRequestInput = z.infer<typeof accessRequestSchema>

// ----------------------------------------------------------------------------- integração (tela da gestão)

/** Um passo do teste de conexão com o UAU. */
export interface UauCheckStep {
  name: string
  ok: boolean
  ms: number | null
  detail: string
}

export interface UauConnectionCheck {
  /** Host do servidor do UAU (sem credenciais) */
  host: string | null
  steps: UauCheckStep[]
  /** Cadastro guardado em memória nesta instância do servidor */
  catalog: { cached: boolean; items: number | null; loadedAt: string | null }
}

export interface IntegrationStatusDTO {
  checkedAt: string
  uauMode: 'mock' | 'real'
  uauWriteEnabled: boolean
  emailProvider: 'none' | 'log' | 'graph'
  uau: UauConnectionCheck
}

export interface TestEmailResultDTO {
  /** Para onde o teste foi enviado (e-mail de quem está logado) */
  to: string
  provider: 'none' | 'log' | 'graph'
}

export interface AppConfigDTO {
  dataSource: 'memory' | 'supabase'
  /** mock = catálogo de exemplo; real = API UAU */
  uauMode: 'mock' | 'real'
  /** false = aprovação em simulação (nada é gravado no UAU) */
  uauWriteEnabled: boolean
  /** Avisos por e-mail: none (desligado) · log (só no terminal) · graph (Microsoft 365) */
  emailProvider: 'none' | 'log' | 'graph'
}

// ----------------------------------------------------------------------------- obras (UAU)

/** Obra ativa no UAU (Obras/ObterObrasAtivas). */
export interface WorkDTO {
  codigo: string
  empresa: number | null
  descricao: string
  /** Texto gravado na solicitação e usado no filtro: "código - descrição" */
  label: string
}

// ----------------------------------------------------------------------------- solicitações

export interface PersonRef {
  id: string
  name: string
}

export interface RequestEventDTO {
  id: string
  at: string
  actorName: string
  type: RequestEventType
  fromStatus: RequestStatus | null
  toStatus: RequestStatus | null
  comment: string | null
  /** Dados técnicos (ex.: corpo enviado e resposta do UAU) */
  details: unknown
}

export interface RequestDTO {
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
  requester: PersonRef
  /** E-mail informado pela obra; recebe os avisos (null em solicitações antigas) */
  requesterEmail: string | null
  analyst: PersonRef | null
  approver: PersonRef | null
  draft: InsumoDraft | null
  uauCode: string | null
  insertedAt: string | null
  confirmedAt: string | null
  /** Último motivo de devolução/recusa */
  lastComment: string | null
  createdAt: string
  updatedAt: string
  /** Ações que o usuário atual pode fazer agora */
  actions: RequestAction[]
  /** Prazo de cada etapa (cadastro e aprovação), deduzido do histórico */
  deadlines: RequestDeadlines
}

export interface RequestDetailDTO extends RequestDTO {
  events: RequestEventDTO[]
}

const text = (max: number) => z.string().trim().max(max)

export const createRequestSchema = z.object({
  requesterName: text(120).min(3, 'Informe o nome do solicitante.'),
  requesterEmail: z
    .string({ required_error: 'Informe o e-mail do solicitante.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail do solicitante.')
    .max(160, 'E-mail muito longo.')
    .email('E-mail inválido. Ex.: nome@unitaengenharia.com.br'),
  kind: z.enum(REQUESTABLE_KINDS),
  urgency: z.enum(['normal', 'urgente']).default('normal'),
  workName: text(160).min(2, 'Informe a obra.'),
  description: text(200).min(5, 'Descreva o insumo (mínimo 5 caracteres).'),
  unit: text(20).min(1, 'Informe a unidade.'),
  specification: text(2000).default(''),
  justification: text(2000).min(5, 'Explique onde o insumo será usado.'),
})
export type CreateRequestInput = z.infer<typeof createRequestSchema>

/** Vários insumos de uma vez (manual ou planilha): cada um vira uma solicitação. */
export const createRequestBatchSchema = z.object({
  items: z
    .array(createRequestSchema)
    .min(1, 'Adicione pelo menos um insumo.')
    .max(MAX_BATCH_ITEMS, `Envie no máximo ${MAX_BATCH_ITEMS} insumos de uma vez.`),
})
export type CreateRequestBatchInput = z.infer<typeof createRequestBatchSchema>

export interface CreateRequestBatchResultDTO {
  requests: RequestDTO[]
}

const optionalInt = (values: number[]) =>
  z
    .number()
    .int()
    .nullable()
    .refine((v) => v === null || values.includes(v), 'Valor inválido')

/** Quantidade de dias/compras/pagamentos: inteiro ≥ 0 ou vazio */
const count = z.number().int().min(0).max(9999).nullable().default(null)

export const draftSchema = z.object({
  modeloCodigo: text(20).default(''),
  codigo: text(20),
  descricao: text(250),
  unidade: text(20),
  // Código do UAU; enquanto o analista digita a descrição, guarda o texto digitado
  categoria: text(120),
  grupo: optionalInt([1, 2, 3, 4, 5]),
  controle: optionalInt([1, 2]),
  tipoPagamento: optionalInt([0, 1, 2]),
  controlaEstoque: optionalInt([0, 1]),
  preco: z
    .string()
    .trim()
    .regex(/^(\d{1,12}(\.\d{1,4})?)?$/, 'Preço inválido (use ponto como separador decimal)'),
  cap: text(40),
  capAplicacao: text(40),
  capEstorno: text(40),
  capTransacaoFinanceira: text(40),
  categoriaMovFin: text(40),
  ncm: text(20),
  cest: text(20),
  // Prazos, pagamento e controles (com padrão: rascunhos antigos não têm esses campos)
  diasDeCompra: count,
  diasUtilizacao: count,
  diasEntrega: count,
  numeroDeCompras: count,
  numeroPagamentos: count,
  pagamentoSobre: optionalInt([1, 2]).default(null),
  frequenciaCompra: text(20).default(''),
  comoPagar: text(20).default(''),
  calcEncargo: optionalInt([0, 1]).default(null),
  patrimonio: optionalInt([0, 1]).default(null),
  controlarPrecoMeta: z.boolean().default(false),
  itemManutencao: z.boolean().default(false),
}) satisfies z.ZodType<InsumoDraft, z.ZodTypeDef, unknown>

export const saveDraftSchema = z.object({ draft: draftSchema })
export const commentSchema = z.object({ comment: text(2000).min(1, 'Escreva o motivo.') })
export const approveSchema = z.object({
  /** Ajustes do gestor feitos na tela de aprovação (opcional) */
  draft: draftSchema.optional(),
})

export const listRequestsQuerySchema = z.object({
  scope: z.enum(['mine', 'drafting', 'approval', 'all']).default('all'),
})
export type RequestScope = z.infer<typeof listRequestsQuerySchema>['scope']

// ----------------------------------------------------------------------------- catálogo UAU

export interface CatalogFacetDTO {
  value: string
  count: number
}

export interface CatalogPageDTO {
  items: CatalogItem[]
  total: number
  /** Total do catálogo, sem filtros */
  catalogTotal: number
  page: number
  pageSize: number
  loadedAt: string
  facets: { unidades: CatalogFacetDTO[]; categorias: CatalogFacetDTO[]; grupos: CatalogFacetDTO[] }
}

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  status: z.enum(['', 'ativo', 'inativo']).default(''),
  categoria: z.string().trim().max(40).default(''),
  unidade: z.string().trim().max(20).default(''),
  grupo: z.string().trim().max(2).default(''),
  sort: z.enum(['codigo', 'descricao', 'unidade', 'categoria']).default('codigo'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  refresh: z.enum(['0', '1']).default('0'),
})
export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export interface CatalogItemDetailDTO {
  item: CatalogItem
  /** Todos os campos que o UAU devolveu (vazios omitidos) */
  raw: Record<string, unknown>
}

/** Listas e sugestões para o formulário de cadastro. */
export interface DraftContextDTO {
  prefixes: { prefix: string; label: string; nextCode: string | null }[]
  unidades: CatalogFacetDTO[]
  categorias: CatalogFacetDTO[]
  caps: CatalogFacetDTO[]
  maxDescriptionLength: number
}

/** Validação + JSON exato que seria enviado ao UAU. */
export interface DraftPreviewDTO {
  validation: DraftValidation
  insertBody: UauInsertBody
  confirmBody: UauConfirmBody
}

export interface ApproveResultDTO {
  request: RequestDetailDTO
  /** Mensagem para o gestor quando a confirmação ficou pendente */
  warning: string | null
}
