/**
 * Composição por requisição: escolhe os repositórios conforme DATA_SOURCE e identifica o usuário.
 */
import type { AuthConfigDTO } from '../../shared/contracts'
import { DEFAULT_CORPORATE_DOMAINS, GUEST_OBRA_ID } from '../../shared/domain/access'
import { permissionsFor } from '../../shared/domain/roles'
import type { Actor } from '../application/context'
import type { Repositories } from '../application/ports'
import { createMemoryRepositories, getMemoryStore } from './memory/memory-repositories'
import { DEMO_USERS, seedMemoryStore } from './memory/seed'
import { getServiceClient, verifyAccessToken } from './supabase/client'
import { createSupabaseRepositories } from './supabase/supabase-repositories'
import { envOption, envValue } from './env'
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
 *  - unauthenticated: sem login ou token inválido/expirado (a tela volta para o login);
 *  - inactive: login válido, mas o perfil não existe ou ainda não foi liberado pela gestão.
 */
export type SessionResult = { status: 'ok'; session: Session } | { status: 'unauthenticated' } | { status: 'inactive' }

/** Obra sem login: só solicita e acompanha as solicitações abertas sem login. */
const GUEST_OBRA: Actor = { id: GUEST_OBRA_ID, fullName: 'Obra (sem login)', email: null, role: 'obra', workName: null, permissions: permissionsFor('obra') }

/**
 * - supabase: sem token, entra como obra (sem login); com token, exige JWT válido do
 *   Supabase Auth e um perfil ativo em `profiles`.
 * - memory: modo demonstração; o usuário vem do cabeçalho x-demo-user (padrão: gestor).
 */
export async function openSession(headers: { authorization: string | null; demoUser: string | null }): Promise<SessionResult> {
  if (dataSource() === 'supabase') {
    const token = headers.authorization?.replace(/^Bearer\s+/i, '')
    const repos = createSupabaseRepositories(getServiceClient())
    if (!token) return { status: 'ok', session: { repos, actor: GUEST_OBRA } }
    const userId = await verifyAccessToken(token)
    if (!userId) return { status: 'unauthenticated' }
    const actor = await repos.identity.loadActor(userId)
    return actor ? { status: 'ok', session: { repos, actor } } : { status: 'inactive' }
  }

  const store = getMemoryStore()
  await seedMemoryStore(store, { withSampleRequests: uauMode() === 'mock' })
  const repos = createMemoryRepositories(store)
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

/**
 * Configuração pública para a tela de login (sem sessão). A chave anon do Supabase é pública
 * por natureza (só permite login; as tabelas não aceitam acesso por ela).
 */
export function authConfig(): AuthConfigDTO {
  const supabase = dataSource() === 'supabase'
  return {
    dataSource: dataSource(),
    supabaseUrl: supabase ? envValue('SUPABASE_URL') : null,
    supabaseAnonKey: supabase ? envValue('SUPABASE_ANON_KEY') : null,
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
