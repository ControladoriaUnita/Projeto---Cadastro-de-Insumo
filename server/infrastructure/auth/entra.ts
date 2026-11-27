/**
 * Login com a conta Microsoft 365 da empresa (Microsoft Entra ID, fluxo authorization code).
 *
 *   AUTH_MODE=entra -> login Microsoft (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, SESSION_SECRET)
 *   AUTH_MODE=dev   -> seletor "entrar como" com os usuários de demonstração (nunca em produção)
 *
 * Como o app roda dentro de um iframe no portal, a tela abre o login da Microsoft em popup
 * (/api/auth/microsoft/login). O callback devolve o token da sessão para a janela do app por
 * postMessage, e o app manda o token no cabeçalho Authorization (cookies de terceiros num
 * iframe são bloqueados por vários navegadores).
 */
import type { IdentityRepository } from '../../application/ports'
import { randomToken, sessionSecret, signSession, verifySession } from './security'

const env = (k: string) => process.env[k]?.trim().replace(/^(['"])(.*)\1$/, '$2') || null
export const SESSION_HOURS = 12

export const authMode = () => (env('AUTH_MODE')?.toLowerCase() === 'entra' ? 'entra' : 'dev')
export const entraConfigured = () => !!(env('ENTRA_TENANT_ID') && env('ENTRA_CLIENT_ID') && env('ENTRA_CLIENT_SECRET') && sessionSecret())
/** Seletor de usuários de demonstração: só fora de produção (ou com ALLOW_DEMO_MODE=true). */
export const devLoginAllowed = () => authMode() === 'dev' && (process.env.VERCEL_ENV !== 'production' || env('ALLOW_DEMO_MODE') === 'true')

export const appUrl = () => (env('APP_URL') ?? 'http://localhost:5174').replace(/\/+$/, '')
const redirectUri = () => `${appUrl()}/api/auth/microsoft/callback`
const tenant = () => encodeURIComponent(env('ENTRA_TENANT_ID')!)

export function issueSession(userId: string) {
  const maxAge = SESSION_HOURS * 3600
  return { value: signSession({ kind: 'user', sub: userId, exp: Math.floor(Date.now() / 1000) + maxAge }), maxAge }
}

/** id do usuário de um token de sessão válido (o state do login não vale como sessão). */
export function sessionUserId(token: string | null | undefined): string | null {
  const s = verifySession(token)
  return s && !s.sub.startsWith('state:') ? s.sub : null
}

/** 1ª etapa: URL de login da Microsoft + state assinado (vai também no cookie). */
export function entraAuthorizeUrl() {
  if (!entraConfigured()) throw new Error('Login Microsoft ainda não configurado (ENTRA_* e SESSION_SECRET).')
  const nonce = randomToken(16)
  const state = signSession({ kind: 'user', sub: `state:${nonce}`, exp: Math.floor(Date.now() / 1000) + 600 })
  const q = new URLSearchParams({
    client_id: env('ENTRA_CLIENT_ID')!,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    prompt: 'select_account', // sempre mostra a escolha de conta (PC compartilhado / várias contas)
  })
  return { url: `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${q}`, state }
}

/** 2ª etapa: valida o retorno, troca o code e devolve o id do usuário do app. */
export async function entraCallback(identity: IdentityRepository, code: string, state: string, cookieState: string | null): Promise<string> {
  const st = verifySession(state)
  if (!st || !st.sub.startsWith('state:') || state !== cookieState) throw new Error('Login expirado. Tente entrar de novo.')

  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('ENTRA_CLIENT_ID')!,
      client_secret: env('ENTRA_CLIENT_SECRET')!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      scope: 'openid profile email',
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error_description?: string }
  if (!res.ok || !data.id_token) throw new Error(`A Microsoft recusou o login. ${data.error_description?.split('\r\n')[0] ?? ''}`.trim())

  // id_token veio direto do endpoint de token (TLS + client secret): basta ler as claims
  const claims = JSON.parse(Buffer.from(data.id_token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
    oid?: string
    tid?: string
    email?: string
    preferred_username?: string
    name?: string
    nonce?: string
  }
  if (claims.tid && claims.tid !== env('ENTRA_TENANT_ID')) throw new Error('Conta de outra organização.')
  if (claims.nonce !== st.sub.slice('state:'.length)) throw new Error('Login inválido. Tente de novo.')

  const email = (claims.email ?? claims.preferred_username ?? '').trim().toLowerCase()
  // Busca por oid; se não achar, por e-mail (perfis cadastrados antes do login Microsoft)
  let user = (claims.oid && (await identity.findProfileByEntraOid(claims.oid))) || (email && (await identity.findProfileByEmail(email))) || null

  // Conta nova da organização: entra como obra (só solicita e acompanha). A gestão muda o papel depois.
  if (!user) {
    if (!email.includes('@')) throw new Error('Sua conta Microsoft não tem e-mail. Peça a liberação a quem administra o app.')
    const fullName = claims.name?.trim() || email.split('@')[0]!
    user = await identity.createProfile({ fullName, email, entraOid: claims.oid ?? null, role: 'obra' })
  }
  if (!user.active) throw new Error('Seu usuário está sem acesso. Peça a liberação a quem administra o app.')

  await identity.recordLogin(user.id, { entraOid: claims.oid ?? user.entraOid, at: new Date() })
  return user.id
}
