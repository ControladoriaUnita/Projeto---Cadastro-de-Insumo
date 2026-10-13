/**
 * Fluxo completo pela API em modo memória + UAU simulado (mesmo router das Vercel Functions).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { ApproveResultDTO, CatalogPageDTO, InsumoDraft, RequestDTO, RequestDetailDTO } from '../../shared/contracts'
import { getMemoryStore } from '../infrastructure/memory/memory-repositories'
import { DEMO_USERS } from '../infrastructure/memory/seed'
import { setUauGatewayForTests } from '../infrastructure/uau'
import { MockUauGateway } from '../infrastructure/uau/mock-uau-gateway'
import { setMailerForTests } from '../infrastructure/email'
import { LogMailer } from '../infrastructure/email/log-mailer'
import { handle } from './router'

const [GESTOR, ANALISTA, OBRA, OUTRA_OBRA] = DEMO_USERS.map((u) => u.id) as [string, string, string, string]

async function call<T = unknown>(user: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-demo-user': user },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: res.status, data: (await res.json()) as T }
}

let uau: MockUauGateway
let mailer: LogMailer

beforeEach(() => {
  // Banco e UAU limpos a cada teste
  const store = getMemoryStore()
  store.requests.clear()
  store.events.length = 0
  store.nextNumber = 1
  store.accessRequests.length = 0
  store.seeded = false
  uau = new MockUauGateway()
  setUauGatewayForTests(uau)
  mailer = new LogMailer('https://insumos.example', ['suprimentos@unita.example'])
  setMailerForTests(mailer)
})

const newRequest = {
  kind: 'material',
  urgency: 'normal',
  workName: 'Pazza Ipanema 212',
  description: 'Rejunte epóxi cinza platina 1kg',
  unit: 'kg',
  specification: '',
  justification: 'Banheiros das torres A e B.',
}

async function createAndDraft(): Promise<RequestDetailDTO> {
  const created = await call<RequestDetailDTO>(OBRA, 'POST', '/requests', newRequest)
  expect(created.status).toBe(201)
  const started = await call<RequestDetailDTO>(ANALISTA, 'POST', `/requests/${created.data.id}/start-draft`)
  expect(started.status).toBe(200)
  return started.data
}

const completeDraft = (d: InsumoDraft): InsumoDraft => ({ ...d, categoria: '007.003', grupo: 3, controle: 1, tipoPagamento: 0 })

describe('configuração de login', () => {
  it('é pública e nunca expõe a chave service_role', async () => {
    const res = await handle(new Request('http://localhost/api/auth-config'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({ dataSource: 'memory', supabaseUrl: null, supabaseAnonKey: null, corporateDomains: ['unitaengenharia.com.br'] })
    expect(JSON.stringify(body)).not.toMatch(/service/i)
  })
})

describe('pedido de acesso (sem login)', () => {
  const post = async (body: unknown) => {
    const res = await handle(new Request('http://localhost/api/access-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    return { status: res.status, data: (await res.json()) as { error?: { code: string } } }
  }
  const valid = { fullName: 'Maria Souza', email: 'Maria.Souza@UnitaEngenharia.com.br', requestedRole: 'obra', workName: 'Joy+ Evans' }

  it('grava o pedido com o e-mail em minúsculas e não cria usuário', async () => {
    expect((await post(valid)).status).toBe(201)
    const store = getMemoryStore()
    expect(store.accessRequests).toEqual([expect.objectContaining({ email: 'maria.souza@unitaengenharia.com.br', requestedRole: 'obra', status: 'pendente' })])
    expect([...store.users.values()].some((u) => u.email === 'maria.souza@unitaengenharia.com.br')).toBe(false)
  })

  it('só aceita e-mail corporativo e exige a obra para o perfil obra', async () => {
    expect((await post({ ...valid, email: 'maria@gmail.com' })).data.error?.code).toBe('EMAIL_NOT_CORPORATE')
    expect((await post({ ...valid, workName: '' })).status).toBe(422)
  })

  it('repetido ou de robô responde igual, sem gravar de novo', async () => {
    await post(valid)
    expect((await post(valid)).status).toBe(201)
    expect((await post({ ...valid, email: 'robo@unitaengenharia.com.br', website: 'http://spam' })).status).toBe(201)
    expect(getMemoryStore().accessRequests).toHaveLength(1)
  })
})

describe('diagnóstico da integração', () => {
  it('só a gestão vê; com o UAU simulado responde sem falhas', async () => {
    expect((await call(ANALISTA, 'GET', '/integration/uau')).status).toBe(403)
    const r = await call<{ uauMode: string; uau: { steps: { ok: boolean }[] } }>(GESTOR, 'GET', '/integration/uau')
    expect(r.status).toBe(200)
    expect(r.data.uauMode).toBe('mock')
    expect(r.data.uau.steps.every((s) => s.ok)).toBe(true)
  })
})

describe('permissões por papel', () => {
  it('obra vê só as próprias solicitações; a semente tem 5 no total', async () => {
    const all = await call<RequestDTO[]>(GESTOR, 'GET', '/requests?scope=all')
    expect(all.data).toHaveLength(5)
    const mine = await call<RequestDTO[]>(OBRA, 'GET', '/requests?scope=all')
    expect(mine.data.every((r) => r.requester.id === OBRA)).toBe(true)
    const other = mine.data[0]!
    expect((await call(OUTRA_OBRA, 'GET', `/requests/${other.id}`)).status).toBe(404)
  })

  it('obra não acessa catálogo completo nem filas', async () => {
    expect((await call(OBRA, 'GET', '/catalog')).status).toBe(403)
    expect((await call(OBRA, 'GET', '/requests?scope=approval')).status).toBe(403)
    expect((await call(ANALISTA, 'GET', '/requests?scope=approval')).status).toBe(403)
    expect((await call(OBRA, 'GET', '/catalog/similar?q=rejunte')).status).toBe(200)
  })

  it('valida a entrada com Zod', async () => {
    const r = await call(OBRA, 'POST', '/requests', { ...newRequest, description: 'x' })
    expect(r.status).toBe(422)
  })
})

describe('fluxo obra → analista → gestor → UAU', () => {
  it('analista abre o rascunho com o próximo código livre', async () => {
    const d = await createAndDraft()
    expect(d.status).toBe('em_cadastro')
    // Catálogo simulado começa em IM00012 (12 e 13 usados) e a semente reserva IM00014
    expect(d.draft?.codigo).toBe('IM00015')
    expect(d.draft?.descricao).toBe('REJUNTE EPÓXI CINZA PLATINA 1KG')
  })

  it('não envia para aprovação com erros e nada chega ao UAU antes da aprovação', async () => {
    const d = await createAndDraft()
    const r = await call<{ error: { code: string } }>(ANALISTA, 'POST', `/requests/${d.id}/submit`)
    expect(r.status).toBe(422)
    expect(r.data.error.code).toBe('DRAFT_INVALID')

    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    const submitted = await call<RequestDetailDTO>(ANALISTA, 'POST', `/requests/${d.id}/submit`)
    expect(submitted.data.status).toBe('aguardando_aprovacao')
    expect(await uau.findByCode('IM00015')).toBeNull()
  })

  it('gestor ajusta, insere e confirma (muda a situação) no UAU', async () => {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)

    const adjusted = { ...completeDraft(d.draft!), descricao: 'REJUNTE EPOXI CINZA PLATINA 1KG', preco: '54.90' }
    const r = await call<ApproveResultDTO>(GESTOR, 'POST', `/requests/${d.id}/approve`, { draft: adjusted })
    expect(r.status).toBe(200)
    expect(r.data.warning).toBeNull()
    expect(r.data.request.status).toBe('aprovado')
    expect(r.data.request.uauCode).toBe('IM00015')

    const inUau = await uau.findByCode('IM00015')
    expect(inUau).toMatchObject({ descricao: 'REJUNTE EPOXI CINZA PLATINA 1KG', ativo: true, confirmado: true })

    const types = r.data.request.events.map((e) => e.type)
    expect(types).toEqual(['created', 'start_draft', 'submit', 'save_draft', 'approve', 'uau_inserted', 'uau_confirmed', 'email_sent'])
  })

  it('confirmação que falha fica pendente e "retomar" conclui sem inserir de novo', async () => {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)

    uau.failNext.confirm = true
    const first = await call<ApproveResultDTO>(GESTOR, 'POST', `/requests/${d.id}/approve`, {})
    expect(first.data.request.status).toBe('inserido_nao_confirmado')
    expect(first.data.warning).toContain('IM00015')
    expect((await uau.findByCode('IM00015'))?.confirmado).toBe(false)

    const resumed = await call<ApproveResultDTO>(GESTOR, 'POST', `/requests/${d.id}/resume`)
    expect(resumed.data.request.status).toBe('aprovado')
    expect((await uau.findByCode('IM00015'))?.confirmado).toBe(true)
  })

  it('inserção recusada volta para a fila de aprovação', async () => {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)

    uau.failNext.insert = true
    const r = await call<{ error: { code: string } }>(GESTOR, 'POST', `/requests/${d.id}/approve`, {})
    expect(r.status).toBe(502)
    expect(r.data.error.code).toBe('UAU_INSERT_FAILED')
    const after = await call<RequestDetailDTO>(GESTOR, 'GET', `/requests/${d.id}`)
    expect(after.data.status).toBe('aguardando_aprovacao')
  })

  it('devolução exige motivo e volta ao analista', async () => {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)
    expect((await call(GESTOR, 'POST', `/requests/${d.id}/return`, { comment: '' })).status).toBe(422)
    const r = await call<RequestDetailDTO>(GESTOR, 'POST', `/requests/${d.id}/return`, { comment: 'Use a unidade "un".' })
    expect(r.data).toMatchObject({ status: 'em_cadastro', lastComment: 'Use a unidade "un".' })
  })

  it('analista não aprova', async () => {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)
    expect((await call(ANALISTA, 'POST', `/requests/${d.id}/approve`, {})).status).toBe(403)
  })
})

describe('aviso por e-mail', () => {
  async function approveNew() {
    const d = await createAndDraft()
    await call(ANALISTA, 'PUT', `/requests/${d.id}/draft`, { draft: completeDraft(d.draft!) })
    await call(ANALISTA, 'POST', `/requests/${d.id}/submit`)
    return call<ApproveResultDTO>(GESTOR, 'POST', `/requests/${d.id}/approve`, {})
  }

  it('avisa solicitante e analista, com cópia fixa e link para a solicitação', async () => {
    const r = await approveNew()
    expect(mailer.sent).toHaveLength(1)
    const mail = mailer.sent[0]!
    expect(mail.to).toEqual(['obra.pazza@unita.example', 'cadastro@unita.example'])
    expect(mail.cc).toEqual(['suprimentos@unita.example'])
    expect(mail.subject).toContain('IM00015')
    expect(mail.html).toContain(`https://insumos.example/solicitacoes/${r.data.request.id}`)
  })

  it('falha no e-mail não desfaz a aprovação e fica no histórico', async () => {
    mailer.failNext = true
    const r = await approveNew()
    expect(r.status).toBe(200)
    expect(r.data.request.status).toBe('aprovado')
    expect(r.data.request.events.at(-1)?.type).toBe('email_failed')
  })
})

describe('catálogo', () => {
  it('busca sem acento, filtra e pagina', async () => {
    const r = await call<CatalogPageDTO>(ANALISTA, 'GET', '/catalog?q=rejunte%20epoxi&pageSize=10')
    expect(r.data.items.map((i) => i.codigo)).toEqual(['IM00246'])
    const inactive = await call<CatalogPageDTO>(ANALISTA, 'GET', '/catalog?status=inativo')
    expect(inactive.data.total).toBe(1)
  })
})
