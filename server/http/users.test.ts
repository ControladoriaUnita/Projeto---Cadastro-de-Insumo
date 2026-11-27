/**
 * Tela "Usuários e permissões" pela API (modo memória, usuários de demonstração).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { AccessRequestDTO, ManagedUserDTO } from '../../shared/contracts'
import { getMemoryStore } from '../infrastructure/memory/memory-repositories'
import { DEMO_USERS } from '../infrastructure/memory/seed'
import { handle } from './router'

const [GESTOR, ANALISTA, OBRA] = DEMO_USERS.map((u) => u.id) as [string, string, string, string]

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
const code = (r: { data: unknown }) => (r.data as { error?: { code: string } }).error?.code

beforeEach(() => {
  // Usuários e pedidos limpos: a semente recria os usuários de demonstração
  const store = getMemoryStore()
  store.users.clear()
  store.inactive.clear()
  store.entraOids.clear()
  store.accessRequests.length = 0
  store.requests.clear()
  store.events.length = 0
  store.seeded = false
})

describe('usuários e permissões', () => {
  it('só a gestão vê e altera', async () => {
    expect((await call(ANALISTA, 'GET', '/admin/users')).status).toBe(403)
    expect((await call(OBRA, 'PATCH', `/admin/users/${OBRA}`, { role: 'gestor' })).status).toBe(403)
    const r = await call<ManagedUserDTO[]>(GESTOR, 'GET', '/admin/users')
    expect(r.status).toBe(200)
    expect(r.data.map((u) => u.role).sort()).toEqual(['analista', 'gestor', 'obra', 'obra'])
  })

  it('muda papel e obra padrão, e a permissão vale na próxima chamada', async () => {
    expect((await call(OBRA, 'GET', '/catalog')).status).toBe(403)
    const r = await call<ManagedUserDTO>(GESTOR, 'PATCH', `/admin/users/${OBRA}`, { role: 'analista', workName: 'J001C - Joy+ Evans' })
    expect(r.data).toMatchObject({ role: 'analista', roleLabel: 'Analista de cadastro', workName: 'J001C - Joy+ Evans' })
    expect((await call(OBRA, 'GET', '/requests?scope=drafting')).status).toBe(200)
  })

  it('desativado não entra mais; reativado volta', async () => {
    await call(GESTOR, 'PATCH', `/admin/users/${ANALISTA}`, { active: false })
    expect(code(await call(ANALISTA, 'GET', '/me'))).toBe('PROFILE_INACTIVE')
    await call(GESTOR, 'PATCH', `/admin/users/${ANALISTA}`, { active: true })
    expect((await call(ANALISTA, 'GET', '/me')).status).toBe(200)
  })

  it('a gestão não se tranca fora: nem a si mesma, nem o último gestor', async () => {
    expect(code(await call(GESTOR, 'PATCH', `/admin/users/${GESTOR}`, { active: false }))).toBe('SELF_LOCKOUT')
    expect(code(await call(GESTOR, 'PATCH', `/admin/users/${GESTOR}`, { role: 'obra' }))).toBe('SELF_LOCKOUT')
    // Com outro gestor, o primeiro pode ser rebaixado por ele; o último, não
    await call(GESTOR, 'PATCH', `/admin/users/${ANALISTA}`, { role: 'gestor' })
    expect((await call(ANALISTA, 'PATCH', `/admin/users/${GESTOR}`, { role: 'analista' })).status).toBe(200)
    await call(ANALISTA, 'PATCH', `/admin/users/${OBRA}`, { role: 'gestor' })
    await call(ANALISTA, 'PATCH', `/admin/users/${OBRA}`, { active: false })
    expect(code(await call(OBRA, 'GET', '/me'))).toBe('PROFILE_INACTIVE')
    // ANALISTA (agora gestor) é o único gestor ativo
    expect((await call(ANALISTA, 'PATCH', `/admin/users/${OBRA}`, { active: true })).status).toBe(200)
  })

  it('o último gestor ativo não pode ser desativado nem rebaixado por outro gestor', async () => {
    await call(GESTOR, 'PATCH', `/admin/users/${ANALISTA}`, { role: 'gestor' })
    await call(ANALISTA, 'PATCH', `/admin/users/${GESTOR}`, { active: false })
    // Agora só ANALISTA é gestor ativo; GESTOR está desativado e não pode agir
    expect((await call(GESTOR, 'GET', '/admin/users')).status).toBe(403)
    const store = getMemoryStore()
    expect([...store.users.values()].filter((u) => u.role === 'gestor' && !store.inactive.has(u.id))).toHaveLength(1)
  })

  it('cadastro antecipado: só e-mail corporativo, sem duplicar', async () => {
    expect(code(await call(GESTOR, 'POST', '/admin/users', { fullName: 'Fulano', email: 'f@gmail.com', role: 'analista' }))).toBe('EMAIL_NOT_CORPORATE')
    const ok = await call<ManagedUserDTO>(GESTOR, 'POST', '/admin/users', { fullName: 'Maria Souza', email: 'Maria@UnitaEngenharia.com.br', role: 'analista' })
    expect(ok.status).toBe(201)
    expect(ok.data).toMatchObject({ email: 'maria@unitaengenharia.com.br', role: 'analista', active: true, linkedMicrosoft: false, workName: null })
    expect(code(await call(GESTOR, 'POST', '/admin/users', { fullName: 'Maria S', email: 'maria@unitaengenharia.com.br', role: 'obra' }))).toBe('USER_EXISTS')
  })
})

describe('pedidos de acesso', () => {
  const ask = (email: string, requestedRole = 'analista') =>
    handle(
      new Request('http://localhost/api/access-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'Pessoa Nova', email, requestedRole }),
      }),
    )

  it('aprovar dá o papel escolhido (cria ou atualiza o perfil) e tira o pedido da lista', async () => {
    // Já entrou no app como obra (perfil existente com o mesmo e-mail)
    const carlos = (await call<ManagedUserDTO>(GESTOR, 'POST', '/admin/users', { fullName: 'Carlos Lima', email: 'carlos@unitaengenharia.com.br', role: 'obra' })).data
    await ask('nova@unitaengenharia.com.br')
    await ask('carlos@unitaengenharia.com.br', 'gestor')
    const list = await call<AccessRequestDTO[]>(GESTOR, 'GET', '/admin/access-requests')
    expect(list.data).toHaveLength(2)
    const [nova, existente] = list.data as [AccessRequestDTO, AccessRequestDTO]
    expect(nova.existingUser).toBeNull()
    expect(existente.existingUser).toMatchObject({ id: carlos.id, role: 'obra' })

    expect((await call(GESTOR, 'POST', `/admin/access-requests/${nova.id}/resolve`, { decision: 'approve', role: 'analista' })).status).toBe(200)
    expect((await call(GESTOR, 'POST', `/admin/access-requests/${existente.id}/resolve`, { decision: 'approve', role: 'gestor' })).status).toBe(200)
    const users = (await call<ManagedUserDTO[]>(GESTOR, 'GET', '/admin/users')).data
    expect(users.find((u) => u.email === 'nova@unitaengenharia.com.br')).toMatchObject({ role: 'analista', active: true })
    expect(users.find((u) => u.id === carlos.id)).toMatchObject({ role: 'gestor' })
    expect((await call(GESTOR, 'GET', '/admin/access-requests')).data).toEqual([])
    expect((await call(GESTOR, 'POST', `/admin/access-requests/${nova.id}/resolve`, { decision: 'reject' })).status).toBe(404)
  })

  it('recusar só fecha o pedido', async () => {
    await ask('outra@unitaengenharia.com.br')
    const [r] = (await call<AccessRequestDTO[]>(GESTOR, 'GET', '/admin/access-requests')).data
    expect((await call(ANALISTA, 'POST', `/admin/access-requests/${r!.id}/resolve`, { decision: 'reject' })).status).toBe(403)
    expect((await call(GESTOR, 'POST', `/admin/access-requests/${r!.id}/resolve`, { decision: 'reject' })).status).toBe(200)
    expect((await call(GESTOR, 'GET', '/admin/access-requests')).data).toEqual([])
    expect((await call<ManagedUserDTO[]>(GESTOR, 'GET', '/admin/users')).data.some((u) => u.email === 'outra@unitaengenharia.com.br')).toBe(false)
  })
})
