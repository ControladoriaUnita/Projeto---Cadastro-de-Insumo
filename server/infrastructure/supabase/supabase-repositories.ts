/**
 * Repositórios Supabase (tabelas em supabase/migrations/001_initial_schema.sql).
 * Colunas em snake_case no banco ↔ camelCase no domínio.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { GUEST_OBRA_ID } from '../../../shared/domain/access'
import { isRoleKey, permissionsFor } from '../../../shared/domain/roles'
import type { Actor } from '../../application/context'
import type { AccessRequestRecord, EventRecord, ManagedProfile, NewRequestRecord, ProfilePatch, ProfileRecord, Repositories, RequestPatch, RequestRecord } from '../../application/ports'

const REQUEST_COLUMNS: Record<keyof RequestRecord, string> = {
  id: 'id',
  number: 'number',
  status: 'status',
  kind: 'kind',
  urgency: 'urgency',
  workName: 'work_name',
  description: 'description',
  unit: 'unit',
  specification: 'specification',
  justification: 'justification',
  requesterId: 'requester_id',
  requesterName: 'requester_name',
  requesterEmail: 'requester_email',
  analystId: 'analyst_id',
  analystName: 'analyst_name',
  approverId: 'approver_id',
  approverName: 'approver_name',
  draft: 'draft',
  uauCode: 'uau_code',
  insertedAt: 'inserted_at',
  confirmedAt: 'confirmed_at',
  lastComment: 'last_comment',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

type DbRow = Record<string, unknown>

/** Quantas solicitações por consulta ao buscar eventos em lote */
const EVENT_BATCH = 100

// Solicitações antigas da obra sem login não têm perfil: no banco o solicitante (e o autor do evento) fica vazio
const toDbPerson = (id: string | null) => (id === GUEST_OBRA_ID ? null : id)

function toDb(input: Partial<RequestRecord>): DbRow {
  const out: DbRow = {}
  for (const [k, v] of Object.entries(input)) {
    const column = REQUEST_COLUMNS[k as keyof RequestRecord]
    if (column && v !== undefined) out[column] = k === 'requesterId' ? toDbPerson(v as string | null) : v
  }
  return out
}

function fromDb(row: DbRow): RequestRecord {
  const out: Record<string, unknown> = {}
  for (const [k, column] of Object.entries(REQUEST_COLUMNS)) out[k] = row[column] ?? null
  out.requesterId ??= GUEST_OBRA_ID
  return out as unknown as RequestRecord
}

function eventFromDb(row: DbRow): EventRecord {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    at: String(row.at),
    actorId: (row.actor_id as string | null) ?? null,
    actorName: String(row.actor_name ?? ''),
    type: row.type as EventRecord['type'],
    fromStatus: (row.from_status as EventRecord['fromStatus']) ?? null,
    toStatus: (row.to_status as EventRecord['toStatus']) ?? null,
    comment: (row.comment as string | null) ?? null,
    details: row.details ?? null,
  }
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`)
  return result.data
}

/** Código de erro do Postgres para violação de índice único */
const UNIQUE_VIOLATION = '23505'

const PROFILE_COLUMNS = 'id, full_name, email, active, entra_oid'
const MANAGED_PROFILE_COLUMNS = 'id, full_name, email, active, entra_oid, role, work_name, last_login_at, created_at'

function profileFromDb(row: { id: string; full_name: string; email: string | null; active: boolean; entra_oid: string | null }): ProfileRecord {
  return { id: row.id, fullName: row.full_name, email: row.email, active: row.active, entraOid: row.entra_oid }
}

function managedFromDb(row: DbRow): ManagedProfile {
  const role = isRoleKey(row.role) ? row.role : 'obra'
  return {
    ...profileFromDb(row as Parameters<typeof profileFromDb>[0]),
    role,
    workName: (row.work_name as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }
}

function accessRequestFromDb(row: DbRow): AccessRequestRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    requestedRole: isRoleKey(row.requested_role) ? row.requested_role : 'obra',
    workName: (row.work_name as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export function createSupabaseRepositories(db: SupabaseClient): Repositories {
  async function findProfileByEmail(email: string): Promise<ProfileRecord | null> {
    // ilike sem curingas = igualdade sem diferenciar maiúsculas
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`)
    const rows = check(await db.from('profiles').select(PROFILE_COLUMNS).ilike('email', pattern).limit(1))
    return rows?.[0] ? profileFromDb(rows[0]) : null
  }

  return {
    accessRequests: {
      async createPending(input) {
        const { error } = await db.from('access_requests').insert({
          email: input.email,
          full_name: input.fullName,
          requested_role: input.requestedRole,
          work_name: input.workName,
          message: input.message,
        })
        if (error?.code === UNIQUE_VIOLATION) return 'duplicate'
        if (error) throw new Error(`Supabase: ${error.message}`)
        return 'created'
      },
      async listPending() {
        const rows = check(await db.from('access_requests').select('*').eq('status', 'pendente').order('created_at', { ascending: true }))
        return ((rows ?? []) as DbRow[]).map(accessRequestFromDb)
      },
      async resolve(id, { status, approvedRole, notes }) {
        const at = new Date().toISOString()
        const patch: DbRow = { status, approved_role: approvedRole, reviewed_at: at }
        if (notes !== null) patch.notes = notes
        if (status === 'atendido') patch.fulfilled_at = at
        const rows = check(await db.from('access_requests').update(patch).eq('id', id).eq('status', 'pendente').select('id'))
        return (rows ?? []).length > 0
      },
    },
    identity: {
      async loadActor(userId): Promise<Actor | null> {
        const row = check(await db.from('profiles').select('id, full_name, email, role, work_name, active').eq('id', userId).maybeSingle())
        if (!row || !row.active || !isRoleKey(row.role)) return null
        return {
          id: row.id,
          fullName: row.full_name,
          email: row.email,
          role: row.role,
          workName: row.work_name,
          permissions: permissionsFor(row.role),
        }
      },
      async findProfileByEntraOid(oid) {
        const row = check(await db.from('profiles').select(PROFILE_COLUMNS).eq('entra_oid', oid).maybeSingle())
        return row ? profileFromDb(row) : null
      },
      findProfileByEmail,
      async createProfile(input) {
        const { data, error } = await db
          .from('profiles')
          .insert({ full_name: input.fullName, email: input.email.toLowerCase(), role: input.role, work_name: input.workName ?? null, entra_oid: input.entraOid, active: true })
          .select(PROFILE_COLUMNS)
          .single()
        if (error?.code === UNIQUE_VIOLATION) {
          // Dois logins simultâneos da mesma pessoa: usa o perfil que o outro criou
          const existing = await findProfileByEmail(input.email)
          if (existing) return existing
        }
        if (error || !data) throw new Error(`Supabase: ${error?.message ?? 'perfil não criado'}`)
        return profileFromDb(data)
      },
      async recordLogin(id, { entraOid, at }) {
        check(await db.from('profiles').update({ entra_oid: entraOid, last_login_at: at.toISOString() }).eq('id', id))
      },
      async listProfiles() {
        const rows = check(await db.from('profiles').select(MANAGED_PROFILE_COLUMNS).order('full_name'))
        return ((rows ?? []) as DbRow[]).map(managedFromDb)
      },
      async getProfile(id) {
        const row = check(await db.from('profiles').select(MANAGED_PROFILE_COLUMNS).eq('id', id).maybeSingle())
        return row ? managedFromDb(row as DbRow) : null
      },
      async updateProfile(id, patch: ProfilePatch) {
        const columns: DbRow = { updated_at: new Date().toISOString() }
        if (patch.fullName !== undefined) columns.full_name = patch.fullName
        if (patch.role !== undefined) columns.role = patch.role
        if (patch.workName !== undefined) columns.work_name = patch.workName
        if (patch.active !== undefined) columns.active = patch.active
        const row = check(await db.from('profiles').update(columns).eq('id', id).select(MANAGED_PROFILE_COLUMNS).maybeSingle())
        return row ? managedFromDb(row as DbRow) : null
      },
    },
    requests: {
      async list(filter = {}) {
        let q = db.from('insumo_requests').select('*').order('created_at', { ascending: false })
        if (filter.requesterId) q = filter.requesterId === GUEST_OBRA_ID ? q.is('requester_id', null) : q.eq('requester_id', filter.requesterId)
        if (filter.statuses) q = q.in('status', [...filter.statuses])
        return (check(await q) as DbRow[]).map(fromDb)
      },
      async get(id) {
        const row = check(await db.from('insumo_requests').select('*').eq('id', id).maybeSingle())
        return row ? fromDb(row as DbRow) : null
      },
      async create(input: NewRequestRecord) {
        const row = check(await db.from('insumo_requests').insert(toDb(input)).select('*').single())
        return fromDb(row as DbRow)
      },
      async update(id, expectedStatus, patch: RequestPatch) {
        // Condição na situação: se outra pessoa mudou antes, nenhuma linha é afetada
        const rows = check(
          await db
            .from('insumo_requests')
            .update({ ...toDb(patch), updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', expectedStatus)
            .select('*'),
        ) as DbRow[]
        return rows[0] ? fromDb(rows[0]) : null
      },
      async addEvent(e) {
        check(
          await db.from('insumo_request_events').insert({
            request_id: e.requestId,
            at: e.at,
            actor_id: toDbPerson(e.actorId),
            actor_name: e.actorName,
            type: e.type,
            from_status: e.fromStatus,
            to_status: e.toStatus,
            comment: e.comment,
            details: e.details,
          }),
        )
      },
      async listEvents(requestId) {
        const rows = check(await db.from('insumo_request_events').select('*').eq('request_id', requestId).order('at')) as DbRow[]
        return rows.map(eventFromDb)
      },
      async listEventsOf(requestIds, types) {
        // Em lotes: a lista de ids vai na URL da consulta
        const rows: DbRow[] = []
        for (let i = 0; i < requestIds.length; i += EVENT_BATCH) {
          const ids = requestIds.slice(i, i + EVENT_BATCH)
          rows.push(...(check(await db.from('insumo_request_events').select('*').in('request_id', ids).in('type', [...types]).order('at')) as DbRow[]))
        }
        return rows.map(eventFromDb).sort((a, b) => a.at.localeCompare(b.at))
      },
    },
  }
}
