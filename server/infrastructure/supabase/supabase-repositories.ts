/**
 * Repositórios Supabase (tabelas em supabase/migrations/001_initial_schema.sql).
 * Colunas em snake_case no banco ↔ camelCase no domínio.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRoleKey, permissionsFor } from '../../../shared/domain/roles'
import type { Actor } from '../../application/context'
import type { EventRecord, NewRequestRecord, Repositories, RequestPatch, RequestRecord } from '../../application/ports'

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

function toDb(input: Partial<RequestRecord>): DbRow {
  const out: DbRow = {}
  for (const [k, v] of Object.entries(input)) {
    const column = REQUEST_COLUMNS[k as keyof RequestRecord]
    if (column && v !== undefined) out[column] = v
  }
  return out
}

function fromDb(row: DbRow): RequestRecord {
  const out: Record<string, unknown> = {}
  for (const [k, column] of Object.entries(REQUEST_COLUMNS)) out[k] = row[column] ?? null
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

export function createSupabaseRepositories(db: SupabaseClient): Repositories {
  return {
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
    },
    requests: {
      async list(filter = {}) {
        let q = db.from('insumo_requests').select('*').order('created_at', { ascending: false })
        if (filter.requesterId) q = q.eq('requester_id', filter.requesterId)
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
            actor_id: e.actorId,
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
    },
  }
}
