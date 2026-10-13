/**
 * Composição por requisição: escolhe os repositórios conforme DATA_SOURCE e identifica o usuário.
 */
import type { Actor } from '../application/context'
import type { Repositories } from '../application/ports'
import { createMemoryRepositories, getMemoryStore } from './memory/memory-repositories'
import { DEMO_USERS, seedMemoryStore } from './memory/seed'
import { getServiceClient, verifyAccessToken } from './supabase/client'
import { createSupabaseRepositories } from './supabase/supabase-repositories'
import { uauMode } from './uau'

export type DataSource = 'memory' | 'supabase'

export function dataSource(): DataSource {
  return process.env.DATA_SOURCE === 'supabase' ? 'supabase' : 'memory'
}

export interface Session {
  repos: Repositories
  actor: Actor
}

/**
 * - supabase: exige Bearer JWT válido do Supabase Auth e um perfil ativo.
 * - memory: modo demonstração; o usuário vem do cabeçalho x-demo-user (padrão: gestor).
 */
export async function openSession(headers: { authorization: string | null; demoUser: string | null }): Promise<Session | null> {
  if (dataSource() === 'supabase') {
    const token = headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    const userId = await verifyAccessToken(token)
    if (!userId) return null
    const repos = createSupabaseRepositories(getServiceClient())
    const actor = await repos.identity.loadActor(userId)
    return actor ? { repos, actor } : null
  }

  const store = getMemoryStore()
  await seedMemoryStore(store, { withSampleRequests: uauMode() === 'mock' })
  const repos = createMemoryRepositories(store)
  const userId = DEMO_USERS.some((u) => u.id === headers.demoUser) ? headers.demoUser! : DEMO_USERS[0]!.id
  const actor = await repos.identity.loadActor(userId)
  return actor ? { repos, actor } : null
}

export function demoUsers() {
  return DEMO_USERS.map(({ id, fullName, role }) => ({ id, fullName, role }))
}
