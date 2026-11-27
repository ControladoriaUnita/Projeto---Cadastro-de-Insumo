/**
 * Login Microsoft (AUTH_MODE=entra) em modo memória, com o endpoint de token da Microsoft simulado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle } from '../../http/router'
import { createMemoryRepositories, getMemoryStore } from '../memory/memory-repositories'
import { DEMO_USERS } from '../memory/seed'
import { entraAuthorizeUrl, entraCallback, issueSession } from './entra'
import { signSession, verifySession } from './security'

const TENANT = '11111111-2222-3333-4444-555555555555'
const ENV = {
  AUTH_MODE: 'entra',
  ENTRA_TENANT_ID: TENANT,
  ENTRA_CLIENT_ID: 'client-id',
  ENTRA_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'x'.repeat(40),
  APP_URL: 'https://insumos.example',
}

const idToken = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`

function mockMicrosoft(claims: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Faz a 1ª etapa e devolve state + nonce, como a Microsoft devolveria no callback */
function startLogin() {
  const { url, state } = entraAuthorizeUrl()
  const nonce = new URL(url).searchParams.get('nonce')!
  return { state, nonce, url: new URL(url) }
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
  const store = getMemoryStore()
  store.seeded = false
  store.users.clear()
  store.entraOids.clear()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const repos = () => createMemoryRepositories(getMemoryStore())

describe('token de sessão', () => {
  it('assina, confere e recusa alterado ou vencido', () => {
    const t = signSession({ kind: 'user', sub: 'abc', exp: Math.floor(Date.now() / 1000) + 60 })
    expect(verifySession(t)?.sub).toBe('abc')
    expect(verifySession(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).toBeNull()
    expect(verifySession(signSession({ kind: 'user', sub: 'abc', exp: 1 }))).toBeNull()
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(40))
    expect(verifySession(t)).toBeNull()
  })
})

describe('login Microsoft', () => {
  it('monta a URL de login do tenant com select_account e o callback do APP_URL', () => {
    const { url } = startLogin()
    expect(url.origin + url.pathname).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`)
    expect(url.searchParams.get('redirect_uri')).toBe('https://insumos.example/api/auth/microsoft/callback')
    expect(url.searchParams.get('prompt')).toBe('select_account')
  })

  it('perfil já cadastrado é achado pelo e-mail e ganha o oid', async () => {
    const r = repos()
    const gestor = await r.identity.createProfile({ fullName: 'Lucas', email: 'lucas@unitaengenharia.com.br', entraOid: null, role: 'gestor' })
    const { state, nonce } = startLogin()
    mockMicrosoft({ oid: 'oid-lucas', tid: TENANT, preferred_username: 'Lucas@UnitaEngenharia.com.br', nonce })
    expect(await entraCallback(r.identity, 'code', state, state)).toBe(gestor.id)
    expect((await r.identity.findProfileByEntraOid('oid-lucas'))?.id).toBe(gestor.id)
  })

  it('conta nova da organização entra como obra, com nome e e-mail da Microsoft', async () => {
    const r = repos()
    const { state, nonce } = startLogin()
    mockMicrosoft({ oid: 'oid-novo', tid: TENANT, email: 'Joao.Silva@unitaengenharia.com.br', name: 'João Silva', nonce })
    const id = await entraCallback(r.identity, 'code', state, state)
    expect(await r.identity.loadActor(id)).toMatchObject({ fullName: 'João Silva', email: 'joao.silva@unitaengenharia.com.br', role: 'obra' })
  })

  it('recusa state diferente do cookie, outro tenant e nonce trocado', async () => {
    const r = repos()
    const a = startLogin()
    mockMicrosoft({ oid: 'o', tid: TENANT, email: 'a@unitaengenharia.com.br', nonce: a.nonce })
    await expect(entraCallback(r.identity, 'code', a.state, null)).rejects.toThrow('Login expirado')
    mockMicrosoft({ oid: 'o', tid: 'outro-tenant', email: 'a@unitaengenharia.com.br', nonce: a.nonce })
    await expect(entraCallback(r.identity, 'code', a.state, a.state)).rejects.toThrow('outra organização')
    mockMicrosoft({ oid: 'o', tid: TENANT, email: 'a@unitaengenharia.com.br', nonce: 'outro' })
    await expect(entraCallback(r.identity, 'code', a.state, a.state)).rejects.toThrow('Login inválido')
  })
})

describe('rotas do popup e sessão na API', () => {
  it('login grava o state em cookie e redireciona para a Microsoft', async () => {
    const res = await handle(new Request('http://localhost/api/auth/microsoft/login'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/^https:\/\/login\.microsoftonline\.com\//)
    expect(res.headers.getSetCookie()[0]).toMatch(/^insumos_oauth_state=.+HttpOnly; SameSite=Lax; Secure$/)
  })

  it('callback devolve o token à janela do app (postMessage) e grava o cookie de sessão', async () => {
    const { state, nonce } = startLogin()
    mockMicrosoft({ oid: 'oid-x', tid: TENANT, email: 'x@unitaengenharia.com.br', name: 'X da Obra', nonce })
    const res = await handle(
      new Request(`http://localhost/api/auth/microsoft/callback?code=c&state=${encodeURIComponent(state)}`, {
        headers: { cookie: `insumos_oauth_state=${encodeURIComponent(state)}` },
      }),
    )
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('window.opener.postMessage(msg, window.location.origin)')
    const token = /"token":"([^"]+)"/.exec(html)![1]!
    expect(res.headers.getSetCookie().some((c) => c.startsWith('insumos_session='))).toBe(true)

    // A API aceita o token no cabeçalho e devolve o usuário recém-criado
    const me = await handle(new Request('http://localhost/api/me', { headers: { authorization: `Bearer ${token}` } }))
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { fullName: string; role: string } }).user).toMatchObject({ fullName: 'X da Obra', role: 'obra' })
  })

  it('callback com erro mostra a mensagem e não cria sessão', async () => {
    const res = await handle(new Request('http://localhost/api/auth/microsoft/callback?error=access_denied'))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Login cancelado.')
    expect(res.headers.getSetCookie().some((c) => c.startsWith('insumos_session='))).toBe(false)
  })

  it('sem sessão a API responde 401; o x-demo-user é ignorado; o state não vale como sessão', async () => {
    const r1 = await handle(new Request('http://localhost/api/me', { headers: { 'x-demo-user': DEMO_USERS[0]!.id } }))
    expect(r1.status).toBe(401)
    const { state } = startLogin()
    expect((await handle(new Request('http://localhost/api/me', { headers: { authorization: `Bearer ${state}` } }))).status).toBe(401)
  })

  it('aceita a sessão pelo cookie (app aberto fora do iframe)', async () => {
    const r = repos()
    const p = await r.identity.createProfile({ fullName: 'Ana', email: 'ana@unitaengenharia.com.br', entraOid: null, role: 'analista' })
    const { value } = issueSession(p.id)
    const res = await handle(new Request('http://localhost/api/me', { headers: { cookie: `a=1; insumos_session=${value}` } }))
    expect(res.status).toBe(200)
  })

  it('logout apaga o cookie de sessão', async () => {
    const res = await handle(new Request('http://localhost/api/auth/logout', { method: 'POST' }))
    expect(res.headers.getSetCookie()[0]).toMatch(/^insumos_session=; .*Max-Age=0/)
  })
})
