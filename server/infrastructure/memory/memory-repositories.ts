/**
 * Repositórios em memória para desenvolvimento e demonstração (DATA_SOURCE=memory).
 * Mesmas garantias da versão Supabase: numeração sequencial e atualização condicionada à situação.
 */
import type { Actor } from '../../application/context'
import type { EventRecord, NewAccessRequest, NewRequestRecord, Repositories, RequestFilter, RequestPatch, RequestRecord } from '../../application/ports'

export interface MemoryStore {
  requests: Map<string, RequestRecord>
  events: EventRecord[]
  users: Map<string, Actor>
  /** Pedidos de acesso da tela de login (só e-mail e status importam aqui) */
  accessRequests: (NewAccessRequest & { status: 'pendente' })[]
  nextNumber: number
  seeded: boolean
}

export function createMemoryStore(): MemoryStore {
  return { requests: new Map(), events: [], users: new Map(), accessRequests: [], nextNumber: 1, seeded: false }
}

/** Uma instância por processo (sobrevive ao recarregamento de módulos do Vite). */
export function getMemoryStore(): MemoryStore {
  const g = globalThis as { __insumosMemoryStore?: MemoryStore }
  return (g.__insumosMemoryStore ??= createMemoryStore())
}

const clone = <T>(v: T): T => structuredClone(v)

export function createMemoryRepositories(store: MemoryStore, now: () => Date = () => new Date()): Repositories {
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
