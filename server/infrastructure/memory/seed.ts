/**
 * Semente do modo demonstração: um usuário por perfil e solicitações em cada etapa do fluxo.
 * Grava direto no armazenamento, sem chamar o UAU.
 */
import { EMPTY_DRAFT, type InsumoDraft } from '../../../shared/domain/insumo/draft'
import type { RequestEventType, RequestStatus } from '../../../shared/domain/request/workflow'
import { permissionsFor, type RoleKey } from '../../../shared/domain/roles'
import type { Actor } from '../../application/context'
import type { NewRequestRecord } from '../../application/ports'
import { createMemoryRepositories, type MemoryStore } from './memory-repositories'

const user = (id: string, fullName: string, email: string, role: RoleKey, workName: string | null = null): Actor => ({
  id,
  fullName,
  email,
  role,
  workName,
  permissions: permissionsFor(role),
})

export const DEMO_USERS: Actor[] = [
  user('00000000-0000-4000-8000-000000000001', 'Lucas · Controladoria', 'lucas@unitaengenharia.com.br', 'gestor'),
  user('00000000-0000-4000-8000-000000000002', 'Bruno Alves', 'cadastro@unita.example', 'analista'),
  user('00000000-0000-4000-8000-000000000003', 'Carla Mendes', 'obra.pazza@unita.example', 'obra', 'P212C - Pazza Ipanema 212'),
  user('00000000-0000-4000-8000-000000000004', 'Diego Rocha', 'obra.joy@unita.example', 'obra', 'J001C - Joy+ Evans'),
]

const [GESTOR, ANALISTA, OBRA_PAZZA, OBRA_JOY] = DEMO_USERS as [Actor, Actor, Actor, Actor]

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const draft = (d: Partial<InsumoDraft>): InsumoDraft => ({ ...EMPTY_DRAFT, ...d })

interface SeedStep {
  type: RequestEventType
  actor: Actor
  hoursAgo: number
  to?: RequestStatus
  comment?: string
}

interface SeedRequest {
  data: Omit<NewRequestRecord, 'analystId' | 'analystName' | 'approverId' | 'approverName' | 'insertedAt' | 'confirmedAt' | 'uauCode' | 'lastComment'> &
    Partial<NewRequestRecord>
  steps: SeedStep[]
}

const base = (requester: Actor) => ({ requesterId: requester.id, requesterName: requester.fullName, requesterEmail: requester.email, workName: requester.workName ?? '' })

const SEED: SeedRequest[] = [
  {
    data: {
      ...base(OBRA_PAZZA),
      status: 'solicitado',
      kind: 'material',
      urgency: 'urgente',
      description: 'Rejunte epóxi cinza platina 1kg',
      unit: 'kg',
      specification: 'Para porcelanato das áreas molhadas. Referência: Quartzolit ou similar.',
      justification: 'Revestimento dos banheiros das torres A e B; o branco cadastrado não atende ao projeto.',
      draft: null,
    },
    steps: [{ type: 'created', actor: OBRA_PAZZA, hoursAgo: 3 }],
  },
  {
    data: {
      ...base(OBRA_JOY),
      status: 'em_cadastro',
      kind: 'servico',
      urgency: 'normal',
      description: 'Locação de plataforma elevatória tipo tesoura 10m',
      unit: 'mês',
      specification: 'Elétrica, altura de trabalho 10 m.',
      justification: 'Instalações de forro e iluminação no hall de pé-direito duplo.',
      analystId: ANALISTA.id,
      analystName: ANALISTA.fullName,
      draft: draft({ codigo: 'IS00412', descricao: 'LOCACAO DE PLATAFORMA ELEVATORIA TESOURA 10M', unidade: 'mês', categoria: '068.003', grupo: 2 }),
    },
    steps: [
      { type: 'created', actor: OBRA_JOY, hoursAgo: 30 },
      { type: 'start_draft', actor: ANALISTA, hoursAgo: 26, to: 'em_cadastro' },
    ],
  },
  {
    data: {
      ...base(OBRA_PAZZA),
      status: 'aguardando_aprovacao',
      kind: 'material',
      urgency: 'normal',
      description: 'Manta líquida acrílica branca 18kg',
      unit: 'balde',
      specification: 'Impermeabilização de lajes expostas, com reforço em tela de poliéster.',
      justification: 'Cobertura do bloco de serviços.',
      analystId: ANALISTA.id,
      analystName: ANALISTA.fullName,
      draft: draft({
        modeloCodigo: 'IM10732',
        codigo: 'IM00014',
        descricao: 'MANTA LIQUIDA ACRILICA BRANCA 18KG',
        unidade: 'cx',
        categoria: '008.006',
        grupo: 3,
        controle: 1,
        tipoPagamento: 0,
        controlaEstoque: 1,
        cap: '1.1.3.01',
        capAplicacao: '4.1.1.01',
        preco: '389.90',
      }),
    },
    steps: [
      { type: 'created', actor: OBRA_PAZZA, hoursAgo: 52 },
      { type: 'start_draft', actor: ANALISTA, hoursAgo: 48, to: 'em_cadastro' },
      { type: 'submit', actor: ANALISTA, hoursAgo: 46, to: 'aguardando_aprovacao' },
    ],
  },
  {
    data: {
      ...base(OBRA_JOY),
      status: 'aprovado',
      kind: 'material',
      urgency: 'normal',
      description: 'Manta asfáltica 4mm tipo III',
      unit: 'm²',
      specification: '',
      justification: 'Impermeabilização dos reservatórios.',
      analystId: ANALISTA.id,
      analystName: ANALISTA.fullName,
      approverId: GESTOR.id,
      approverName: GESTOR.fullName,
      uauCode: 'IM10731',
      insertedAt: hoursAgo(96),
      confirmedAt: hoursAgo(96),
      draft: draft({ codigo: 'IM10731', descricao: 'MANTA ASFALTICA 4MM TIPO III', unidade: 'm²', categoria: '008.006', grupo: 3, controle: 1, tipoPagamento: 0 }),
    },
    steps: [
      { type: 'created', actor: OBRA_JOY, hoursAgo: 120 },
      { type: 'start_draft', actor: ANALISTA, hoursAgo: 110, to: 'em_cadastro' },
      { type: 'submit', actor: ANALISTA, hoursAgo: 104, to: 'aguardando_aprovacao' },
      { type: 'approve', actor: GESTOR, hoursAgo: 96, to: 'em_insercao' },
      { type: 'uau_inserted', actor: GESTOR, hoursAgo: 96, to: 'inserido_nao_confirmado' },
      { type: 'uau_confirmed', actor: GESTOR, hoursAgo: 96, to: 'aprovado' },
    ],
  },
  {
    data: {
      ...base(OBRA_PAZZA),
      status: 'recusado',
      kind: 'material',
      urgency: 'normal',
      description: 'Cimento CP II 50kg',
      unit: 'sc',
      specification: '',
      justification: 'Concretagem de calçadas.',
      lastComment: 'Já existe no UAU: IM00012 — CIMENTO PORTLAND CP II-E-32 SACO 50KG.',
      draft: null,
    },
    steps: [
      { type: 'created', actor: OBRA_PAZZA, hoursAgo: 75 },
      { type: 'reject', actor: ANALISTA, hoursAgo: 72, to: 'recusado', comment: 'Já existe no UAU: IM00012 — CIMENTO PORTLAND CP II-E-32 SACO 50KG.' },
    ],
  },
]

/**
 * Usuários de demonstração sempre; solicitações de exemplo só com o UAU simulado
 * (os códigos delas existem apenas no catálogo de exemplo).
 */
export async function seedMemoryStore(store: MemoryStore, { withSampleRequests = true } = {}): Promise<void> {
  if (store.seeded) return
  store.seeded = true
  for (const u of DEMO_USERS) store.users.set(u.id, u)
  if (!withSampleRequests) return

  for (const { data, steps } of SEED) {
    const createdAt = hoursAgo(steps[0]!.hoursAgo)
    const repos = createMemoryRepositories(store, () => new Date(createdAt))
    const r = await repos.requests.create({
      analystId: null,
      analystName: null,
      approverId: null,
      approverName: null,
      insertedAt: null,
      confirmedAt: null,
      uauCode: null,
      lastComment: null,
      ...data,
    })
    let from: RequestStatus = 'solicitado'
    for (const step of steps) {
      await repos.requests.addEvent({
        requestId: r.id,
        at: hoursAgo(step.hoursAgo),
        actorId: step.actor.id,
        actorName: step.actor.fullName,
        type: step.type,
        fromStatus: step.to ? from : null,
        toStatus: step.to ?? null,
        comment: step.comment ?? null,
        details: null,
      })
      if (step.to) from = step.to
    }
    // updatedAt = momento do último passo
    store.requests.set(r.id, { ...store.requests.get(r.id)!, updatedAt: hoursAgo(steps.at(-1)!.hoursAgo) })
  }
}
