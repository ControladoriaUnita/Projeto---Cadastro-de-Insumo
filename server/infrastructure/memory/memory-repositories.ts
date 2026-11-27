/**
 * Repositórios em memória para desenvolvimento e demonstração (DATA_SOURCE=memory).
 * Mesmas garantias da versão Supabase: numeração sequencial e atualização condicionada à situação.
 */
import { permissionsFor } from '../../../shared/domain/roles'
import type { Actor } from '../../application/context'
import type { EventRecord, NewAccessRequest, NewRequestRecord, ProfileRecord, Repositories, RequestFilter, RequestPatch, RequestRecord } from '../../application/ports'

export interface MemoryStore {
  requests: Map<string, RequestRecord>
  events: EventRecord[]
  users: Map<string, Actor>
  /** id do usuário → object id da conta Microsoft (login Entra no modo memória) */
  entraOids: Map<string, string>
  /** Pedidos de acesso da tela de login (só e-mail e status importam aqui) */
  accessRequests: (NewAccessRequest & { status: 'pendente' })[]
  nextNumber: number
  seeded: boolean
}

export function createMemoryStore(): MemoryStore {
  return { requests: new Map(), events: [], users: new Map(), entraOids: new Map(), accessRequests: [], nextNumber: 1, seeded: false }
}

/** Uma instância por processo (sobrevive ao recarregamento de módulos do Vite). */
export function getMemoryStore(): MemoryStore {
  const g = globalThis as { __insumosMemoryStore?: MemoryStore }
  return (g.__insumosMemoryStore ??= createMemoryStore())
}

const clone = <T>(v: T): T => structuredClone(v)

export function createMemoryRepositories(store: MemoryStore, now: () => Date = () => new Date()): Repositories {
  // No modo memória todo usuário cadastrado está ativo
  const toProfile = (id: string): ProfileRecord | null => {
    const u = store.users.get(id)
    return u ? { id: u.id, fullName: u.fullName, email: u.email, active: true, entraOid: store.entraOids.get(id) ?? null } : null
  }
  return {
    accessRequests: {
      async createPending(input) {
        if (store.accessRequests.some((r) => r.email === input.email)) return 'duplicate'
        store.accessRequests.push({ ...clone(input), status: 'pendente' })
        return 'created'
      },
    },
    identity: {
      async loadActor(userId) {
        const user = store.users.get(userId)
        return user ? clone(user) : null
      },
      async findProfileByEntraOid(oid) {
        const id = [...store.entraOids].find(([, o]) => o === oid)?.[0]
        return id ? toProfile(id) : null
      },
      async findProfileByEmail(email) {
        const user = [...store.users.values()].find((u) => u.email?.toLowerCase() === email.toLowerCase())
        return user ? toProfile(user.id) : null
      },
      async createProfile(input) {
        const id = globalThis.crypto.randomUUID()
        store.users.set(id, { id, fullName: input.fullName, email: input.email, role: input.role, workName: null, permissions: permissionsFor(input.role) })
        if (input.entraOid) store.entraOids.set(id, input.entraOid)
        return toProfile(id)!
      },
      async recordLogin(id, data) {
        if (data.entraOid) store.entraOids.set(id, data.entraOid)
      },
    },
    requests: {
      async list(filter: RequestFilter = {}) {
        return [...store.requests.values()]
          .filter((r) => !filter.requesterId || r.requesterId === filter.requesterId)
          .filter((r) => !filter.statuses || filter.statuses.includes(r.status))
          .map(clone)
      },
      async get(id) {
        const r = store.requests.get(id)
        return r ? clone(r) : null
      },
      async create(input: NewRequestRecord) {
        const at = now().toISOString()
        const r: RequestRecord = { ...clone(input), id: globalThis.crypto.randomUUID(), number: store.nextNumber++, createdAt: at, updatedAt: at }
        store.requests.set(r.id, r)
        return clone(r)
      },
      async update(id, expectedStatus, patch: RequestPatch) {
        const current = store.requests.get(id)
        if (!current || current.status !== expectedStatus) return null
        const next: RequestRecord = { ...current, ...clone(patch), updatedAt: now().toISOString() }
        store.requests.set(id, next)
        return clone(next)
      },
      async addEvent(event) {
        store.events.push({ ...clone(event), id: globalThis.crypto.randomUUID() })
      },
      async listEvents(requestId) {
        return store.events.filter((e) => e.requestId === requestId).sort((a, b) => a.at.localeCompare(b.at)).map(clone)
      },
      async listEventsOf(requestIds, types) {
        const ids = new Set(requestIds)
        return store.events
          .filter((e) => ids.has(e.requestId) && types.includes(e.type))
          .sort((a, b) => a.at.localeCompare(b.at))
          .map(clone)
      },
    },
  }
}
