/**
 * Composição por requisição: escolhe os repositórios conforme DATA_SOURCE e identifica o usuário
 * conforme AUTH_MODE (login Microsoft ou usuários de demonstração).
 */
import type { AuthConfigDTO } from '../../shared/contracts'
import { DEFAULT_CORPORATE_DOMAINS } from '../../shared/domain/access'
import { AppError, type Actor } from '../application/context'
import type { Repositories } from '../application/ports'
import { createMemoryRepositories, getMemoryStore } from './memory/memory-repositories'
import { DEMO_USERS, seedMemoryStore } from './memory/seed'
import { getServiceClient } from './supabase/client'
import { createSupabaseRepositories } from './supabase/supabase-repositories'
import { authMode, devLoginAllowed, entraConfigured, sessionUserId } from './auth/entra'
import { envOption } from './env'
import { uauMode } from './uau'

export type DataSource = 'memory' | 'supabase'

export function dataSource(): DataSource {
  return envOption('DATA_SOURCE') === 'supabase' ? 'supabase' : 'memory'
}

export interface Session {
  repos: Repositories
  actor: Actor
}

/**
 * Resultado da identificação:
 *  - ok: usuário autenticado e com perfil ativo;
 *  - unauthenticated: sem login ou sessão inválida/expirada (a tela volta para o login);
 *  - inactive: sessão válida, mas o perfil foi desativado pela gestão.
 */
export type SessionResult = { status: 'ok'; session: Session } | { status: 'unauthenticated' } | { status: 'inactive' }

/** Cookie da sessão (só para quem abre o app fora do iframe; no portal vale o cabeçalho Authorization). */
export const SESSION_COOKIE = 'insumos_session'

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

/**
 * - AUTH_MODE=entra: sessão emitida pelo login Microsoft (Authorization: Bearer ou cookie)
 *   e perfil ativo em `profiles`.
 * - AUTH_MODE=dev: usuários de demonstração (modo memória); o usuário vem do cabeçalho
 *   x-demo-user (padrão: gestor). Nunca em produção.
 */
export async function openSession(headers: { authorization: string | null; cookie: string | null; demoUser: string | null }): Promise<SessionResult> {
  const repos = await publicRepositories()

  if (authMode() === 'entra') {
    if (!entraConfigured()) throw new AppError('AUTH_NOT_CONFIGURED', 'Login Microsoft ainda não configurado no servidor (ENTRA_* e SESSION_SECRET).', 503)
    const bearer = headers.authorization?.replace(/^Bearer\s+/i, '') || null
    const userId = sessionUserId(bearer ?? readCookie(headers.cookie, SESSION_COOKIE))
    if (!userId) return { status: 'unauthenticated' }
    const actor = await repos.identity.loadActor(userId)
    return actor ? { status: 'ok', session: { repos, actor } } : { status: 'inactive' }
  }

  if (!devLoginAllowed()) throw new AppError('AUTH_NOT_CONFIGURED', 'Login de demonstração desligado em produção. Configure AUTH_MODE=entra.', 503)
  if (dataSource() !== 'memory') {
    throw new AppError('AUTH_NOT_CONFIGURED', 'AUTH_MODE=dev só funciona com DATA_SOURCE=memory. Para o Supabase, use AUTH_MODE=entra.', 503)
  }
  const userId = DEMO_USERS.some((u) => u.id === headers.demoUser) ? headers.demoUser! : DEMO_USERS[0]!.id
  const actor = await repos.identity.loadActor(userId)
  return actor ? { status: 'ok', session: { repos, actor } } : { status: 'unauthenticated' }
}

/** Domínios de e-mail aceitos no pedido de acesso (ACCESS_REQUEST_DOMAINS, separados por vírgula). */
export function corporateDomains(): string[] {
  const fromEnv = (process.env.ACCESS_REQUEST_DOMAINS ?? '')
    .split(/[;,]/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  return fromEnv.length ? fromEnv : DEFAULT_CORPORATE_DOMAINS
}

/** Configuração pública para a tela de login (sem sessão). */
export function authConfig(): AuthConfigDTO {
  return {
    authMode: authMode(),
    entraConfigured: entraConfigured(),
    dataSource: dataSource(),
    corporateDomains: corporateDomains(),
  }
}

/** Repositórios para rotas públicas (sem usuário logado), como o pedido de acesso. */
export async function publicRepositories(): Promise<Repositories> {
  if (dataSource() === 'supabase') return createSupabaseRepositories(getServiceClient())
  const store = getMemoryStore()
  await seedMemoryStore(store, { withSampleRequests: uauMode() === 'mock' })
  return createMemoryRepositories(store)
}

export function demoUsers() {
  return DEMO_USERS.map(({ id, fullName, role }) => ({ id, fullName, role }))
}
