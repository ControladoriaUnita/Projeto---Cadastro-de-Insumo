/**
 * Repositórios em memória para desenvolvimento e demonstração (DATA_SOURCE=memory).
 * Mesmas garantias da versão Supabase: numeração sequencial e atualização condicionada à situação.
 */
import { permissionsFor } from '../../../shared/domain/roles'
import type { Actor } from '../../application/context'
import type {
  AccessRequestRecord,
  EventRecord,
  ManagedProfile,
  NewRequestRecord,
  Repositories,
  RequestFilter,
  RequestPatch,
  RequestRecord,
} from '../../application/ports'

export interface MemoryStore {
  requests: Map<string, RequestRecord>
  events: EventRecord[]
  users: Map<string, Actor>
  /** id do usuário → object id da conta Microsoft (login Entra no modo memória) */
  entraOids: Map<string, string>
  /** Perfis desativados pela gestão */
  inactive: Set<string>
  /** id do usuário → último login */
  lastLogins: Map<string, string>
  /** Pedidos de acesso da tela de login */
  accessRequests: (AccessRequestRecord & { status: 'pendente' | 'atendido' | 'recusado' })[]
  nextNumber: number
  seeded: boolean
}

export function createMemoryStore(): MemoryStore {
  return {
    requests: new Map(),
    events: [],
    users: new Map(),
    entraOids: new Map(),
    inactive: new Set(),
    lastLogins: new Map(),
    accessRequests: [],
    nextNumber: 1,
    seeded: false,
  }
}

/** Uma instância por processo (sobrevive ao recarregamento de módulos do Vite). */
export function getMemoryStore(): MemoryStore {
  const g = globalThis as { __insumosMemoryStore?: MemoryStore }
  const store = (g.__insumosMemoryStore ??= createMemoryStore())
  // Armazenamento criado por uma versão anterior do código (recarga do Vite)
  store.entraOids ??= new Map()
  store.inactive ??= new Set()
  store.lastLogins ??= new Map()
  return store
}

const clone = <T>(v: T): T => structuredClone(v)

export function createMemoryRepositories(store: MemoryStore, now: () => Date = () => new Date()): Repositories {
  const toProfile = (id: string): ManagedProfile | null => {
    const u = store.users.get(id)
    if (!u) return null
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      active: !store.inactive.has(id),
      entraOid: store.entraOids.get(id) ?? null,
      role: u.role,
      workName: u.workName,
      lastLoginAt: store.lastLogins.get(id) ?? null,
      createdAt: null,
    }
  }
  return {
    accessRequests: {
      async createPending(input) {
        if (store.accessRequests.some((r) => r.email === input.email && r.status === 'pendente')) return 'duplicate'
        store.accessRequests.push({ ...clone(input), id: globalThis.crypto.randomUUID(), createdAt: now().toISOString(), status: 'pendente' })
        return 'created'
      },
      async listPending() {
        return store.accessRequests.filter((r) => r.status === 'pendente').map(({ status: _s, ...r }) => clone(r))
      },
      async resolve(id, outcome) {
        const r = store.accessRequests.find((x) => x.id === id && x.status === 'pendente')
        if (!r) return false
        r.status = outcome.status
        return true
      },
    },
    identity: {
      async loadActor(userId) {
        const user = store.users.get(userId)
        return user && !store.inactive.has(userId) ? clone(user) : null
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
        const workName = input.workName ?? null
        store.users.set(id, { id, fullName: input.fullName, email: input.email.toLowerCase(), role: input.role, workName, permissions: permissionsFor(input.role) })
        if (input.entraOid) store.entraOids.set(id, input.entraOid)
        return toProfile(id)!
      },
      async recordLogin(id, data) {
        if (data.entraOid) store.entraOids.set(id, data.entraOid)
        store.lastLogins.set(id, data.at.toISOString())
      },
      async listProfiles() {
        return [...store.users.keys()].map((id) => toProfile(id)!)
      },
      async getProfile(id) {
        return toProfile(id)
      },
      async updateProfile(id, patch) {
        const current = store.users.get(id)
        if (!current) return null
        // Objeto novo: os usuários de demonstração (DEMO_USERS) não podem ser alterados
        const u = { ...current }
        if (patch.fullName !== undefined) u.fullName = patch.fullName
        if (patch.workName !== undefined) u.workName = patch.workName
        if (patch.role !== undefined) {
          u.role = patch.role
          u.permissions = permissionsFor(patch.role)
        }
        store.users.set(id, u)
        if (patch.active === true) store.inactive.delete(id)
        if (patch.active === false) store.inactive.add(id)
        return toProfile(id)
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
