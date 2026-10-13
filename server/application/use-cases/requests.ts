/**
 * Casos de uso da solicitação de insumo: obra solicita → analista cadastra e envia →
 * gestor revisa, insere no UAU e confirma (muda a situação do insumo).
 *
 * Regra de ouro: nada é gravado no UAU antes de `approve`.
 */
import type { ApproveResultDTO, CreateRequestInput, RequestDTO, RequestDetailDTO, RequestScope } from '../../../shared/contracts'
import { normalizeCode, nextFreeCode } from '../../../shared/domain/insumo/code'
import { EMPTY_DRAFT, normalizeDraft, type DraftField, type InsumoDraft } from '../../../shared/domain/insumo/draft'
import { buildConfirmBody, buildInsertBody } from '../../../shared/domain/insumo/uau-payload'
import { REQUEST_KINDS } from '../../../shared/domain/request/kinds'
import {
  APPROVAL_QUEUE,
  DRAFTING_QUEUE,
  assertCanPerform,
  availableActions,
  canRead,
  type RequestAction,
  type RequestEventType,
  type RequestStatus,
} from '../../../shared/domain/request/workflow'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { AppError, can, notFound, requirePermission, type Actor } from '../context'
import type { EventRecord, RequestPatch, RequestRecord, UseCaseDeps } from '../ports'
import { reservedCodes, validateAgainstCatalog } from './catalog'
import { notifyApproved } from './notifications'

const P = PERMISSIONS

// ----------------------------------------------------------------------------- leitura

function toDTO(r: RequestRecord, actor: Actor): RequestDTO {
  const person = (id: string | null, name: string | null) => (id ? { id, name: name ?? '' } : null)
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    kind: r.kind,
    urgency: r.urgency,
    workName: r.workName,
    description: r.description,
    unit: r.unit,
    specification: r.specification,
    justification: r.justification,
    requester: { id: r.requesterId, name: r.requesterName },
    analyst: person(r.analystId, r.analystName),
    approver: person(r.approverId, r.approverName),
    draft: r.draft,
    uauCode: r.uauCode,
    insertedAt: r.insertedAt,
    confirmedAt: r.confirmedAt,
    lastComment: r.lastComment,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    actions: availableActions(r, actor),
  }
}

const eventDTO = (e: EventRecord) => ({
  id: e.id,
  at: e.at,
  actorName: e.actorName,
  type: e.type,
  fromStatus: e.fromStatus,
  toStatus: e.toStatus,
  comment: e.comment,
  details: e.details,
})

/** Urgentes primeiro; depois as mais antigas (fila) ou as mais recentes (acompanhamento). */
function sortRequests(list: RequestRecord[], queue: boolean): RequestRecord[] {
  return [...list].sort((a, b) => {
    if (queue && a.urgency !== b.urgency) return a.urgency === 'urgente' ? -1 : 1
    return queue ? a.createdAt.localeCompare(b.createdAt) : b.updatedAt.localeCompare(a.updatedAt)
  })
}

export async function listRequests({ repos, ctx }: UseCaseDeps, scope: RequestScope): Promise<RequestDTO[]> {
  const { actor } = ctx
  // Sem acesso a todas, "all" mostra só as próprias
  const effective = scope === 'all' && !can(actor, P.requestReadAll) ? 'mine' : scope
  let records: RequestRecord[]
  switch (effective) {
    case 'drafting':
      requirePermission(ctx, P.draftEdit)
      records = sortRequests(await repos.requests.list({ statuses: DRAFTING_QUEUE }), true)
      break
    case 'approval':
      requirePermission(ctx, P.approvalDecide)
      records = sortRequests(await repos.requests.list({ statuses: APPROVAL_QUEUE }), true)
      break
    case 'all':
      records = sortRequests(await repos.requests.list(), false)
      break
    case 'mine':
      requirePermission(ctx, P.requestReadOwn, P.requestReadAll)
      records = sortRequests(await repos.requests.list({ requesterId: actor.id }), false)
      break
  }
  return records.map((r) => toDTO(r, actor))
}

async function load({ repos, ctx }: UseCaseDeps, id: string): Promise<RequestRecord> {
  const r = await repos.requests.get(id)
  // Quem não pode ver recebe "não encontrada" (não revela que existe)
  if (!r || !canRead(r, ctx.actor)) throw notFound('Solicitação')
  return r
}

export async function getRequest(deps: UseCaseDeps, id: string): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  const events = await deps.repos.requests.listEvents(r.id)
  return { ...toDTO(r, deps.ctx.actor), events: events.map(eventDTO) }
}

// ----------------------------------------------------------------------------- escrita (base)

async function record(deps: UseCaseDeps, r: RequestRecord, type: RequestEventType, to: RequestStatus | null, comment: string | null = null, details: unknown = null) {
  await deps.repos.requests.addEvent({
    requestId: r.id,
    at: deps.ctx.now().toISOString(),
    actorId: deps.ctx.actor.id,
    actorName: deps.ctx.actor.fullName,
    type,
    fromStatus: to ? r.status : null,
    toStatus: to,
    comment,
    details,
  })
}

/** Atualiza garantindo que ninguém mudou a situação nesse meio-tempo. */
async function save(deps: UseCaseDeps, r: RequestRecord, patch: RequestPatch): Promise<RequestRecord> {
  const updated = await deps.repos.requests.update(r.id, r.status, patch)
  if (!updated) {
    throw new AppError('CONFLICT', 'A solicitação foi alterada por outra pessoa. Atualize a tela e tente de novo.', 409)
  }
  return updated
}

/** Aplica a ação do fluxo: valida, muda a situação e registra no histórico. */
async function transition(
  deps: UseCaseDeps,
  r: RequestRecord,
  action: RequestAction,
  to: RequestStatus,
  opts: { patch?: RequestPatch; comment?: string | null; details?: unknown } = {},
): Promise<RequestRecord> {
  assertCanPerform(action, r, deps.ctx.actor, opts.comment)
  const updated = await save(deps, r, { ...opts.patch, status: to })
  await record(deps, r, action, to, opts.comment ?? null, opts.details ?? null)
  return updated
}

const detail = (deps: UseCaseDeps, r: RequestRecord) => getRequest(deps, r.id)

// ----------------------------------------------------------------------------- obra

export async function createRequest(deps: UseCaseDeps, input: CreateRequestInput): Promise<RequestDetailDTO> {
  requirePermission(deps.ctx, P.requestCreate)
  const { actor } = deps.ctx
  const r = await deps.repos.requests.create({
    status: 'solicitado',
    kind: input.kind,
    urgency: input.urgency,
    workName: input.workName,
    description: input.description,
    unit: input.unit,
    specification: input.specification,
    justification: input.justification,
    requesterId: actor.id,
    requesterName: actor.fullName,
    analystId: null,
    analystName: null,
    approverId: null,
    approverName: null,
    draft: null,
    uauCode: null,
    insertedAt: null,
    confirmedAt: null,
    lastComment: null,
  })
  await record(deps, r, 'created', null)
  return detail(deps, r)
}

export async function cancelRequest(deps: UseCaseDeps, id: string, comment: string | null): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  return detail(deps, await transition(deps, r, 'cancel', 'cancelado', { comment, patch: { lastComment: comment } }))
}

// ----------------------------------------------------------------------------- analista

/** Assume a solicitação e abre o rascunho já com descrição, unidade e próximo código livre. */
export async function startDraft(deps: UseCaseDeps, id: string): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  assertCanPerform('start_draft', r, deps.ctx.actor)
  const draft: InsumoDraft = { ...EMPTY_DRAFT, descricao: r.description.toUpperCase(), unidade: r.unit }
  try {
    const [snapshot, reserved] = await Promise.all([deps.uau.loadCatalog(), reservedCodes(deps.repos, r.id)])
    draft.codigo = nextFreeCode(REQUEST_KINDS[r.kind].prefix, [...snapshot.items.map((i) => i.codigo), ...reserved.keys()]) ?? ''
  } catch {
    // Sem acesso ao cadastro agora: o analista escolhe o código no formulário
  }
  const { actor } = deps.ctx
  return detail(deps, await transition(deps, r, 'start_draft', 'em_cadastro', { patch: { draft, analystId: actor.id, analystName: actor.fullName } }))
}

/** Campos alterados entre dois rascunhos (para o histórico). */
function changedFields(before: InsumoDraft | null, after: InsumoDraft): { field: DraftField; from: unknown; to: unknown }[] {
  const base = before ?? EMPTY_DRAFT
  return (Object.keys(after) as DraftField[])
    .filter((k) => (base[k] ?? null) !== (after[k] ?? null))
    .map((k) => ({ field: k, from: base[k], to: after[k] }))
}

export async function saveDraft(deps: UseCaseDeps, id: string, input: InsumoDraft): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  assertCanPerform('save_draft', r, deps.ctx.actor)
  const draft = normalizeDraft(input)
  const changes = changedFields(r.draft, draft)
  if (!changes.length) return detail(deps, r)
  const updated = await save(deps, r, { draft })
  // Ajustes do gestor ficam registrados campo a campo; salvamentos do analista não poluem o histórico
  if (r.status === 'aguardando_aprovacao') await record(deps, r, 'save_draft', null, null, { changes })
  return detail(deps, updated)
}

async function assertDraftValid(deps: UseCaseDeps, r: RequestRecord, draft: InsumoDraft | null): Promise<InsumoDraft> {
  if (!draft) throw new AppError('DRAFT_MISSING', 'Preencha o cadastro do insumo antes de continuar.', 422)
  const validation = await validateAgainstCatalog(deps.repos, deps.uau, draft, r.id)
  if (!validation.ok) {
    throw new AppError('DRAFT_INVALID', 'O cadastro tem erros. Corrija antes de continuar.', 422, validation)
  }
  return normalizeDraft(draft)
}

export async function submitForApproval(deps: UseCaseDeps, id: string): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  assertCanPerform('submit', r, deps.ctx.actor)
  await assertDraftValid(deps, r, r.draft)
  return detail(deps, await transition(deps, r, 'submit', 'aguardando_aprovacao', { patch: { lastComment: null } }))
}

export async function rejectRequest(deps: UseCaseDeps, id: string, comment: string): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  return detail(deps, await transition(deps, r, 'reject', 'recusado', { comment, patch: { lastComment: comment } }))
}

// ----------------------------------------------------------------------------- gestor

export async function returnToAnalyst(deps: UseCaseDeps, id: string, comment: string): Promise<RequestDetailDTO> {
  const r = await load(deps, id)
  return detail(deps, await transition(deps, r, 'return', 'em_cadastro', { comment, patch: { lastComment: comment } }))
}

function assertWriteEnabled(deps: UseCaseDeps) {
  if (!deps.uau.writeEnabled) {
    throw new AppError(
      'UAU_WRITE_DISABLED',
      'A gravação no UAU está desligada (modo simulação). Confira o JSON na prévia; para gravar, defina UAU_GRAVACAO=real no servidor.',
      409,
    )
  }
}

/**
 * Aprova: (1) salva os ajustes do gestor, (2) revalida contra o UAU, (3) trava a solicitação
 * em "em_insercao", (4) insere o insumo como não confirmado e (5) muda a situação para confirmado.
 */
export async function approveRequest(deps: UseCaseDeps, id: string, adjustments?: InsumoDraft): Promise<ApproveResultDTO> {
  let r = await load(deps, id)
  assertCanPerform('approve', r, deps.ctx.actor)
  assertWriteEnabled(deps)

  if (adjustments) {
    await saveDraft(deps, id, adjustments)
    r = await load(deps, id)
  }

  // O cadastro em cache pode ter alguns minutos: relê o UAU antes de validar e gravar
  const code = normalizeCode(r.draft?.codigo)
  const existing = await deps.uau.findByCode(code)
  if (existing) {
    throw new AppError('CODE_TAKEN', `O código ${code} acabou de ser usado no UAU (${existing.descricao}). Escolha outro.`, 409)
  }
  const draft = await assertDraftValid(deps, r, r.draft)

  const { actor } = deps.ctx
  const locked = await transition(deps, r, 'approve', 'em_insercao', { patch: { approverId: actor.id, approverName: actor.fullName } })
  return runInsertion(deps, locked, draft)
}

/** Retoma uma aprovação interrompida sem inserir o insumo duas vezes. */
export async function resumeApproval(deps: UseCaseDeps, id: string): Promise<ApproveResultDTO> {
  const r = await load(deps, id)
  assertCanPerform('resume', r, deps.ctx.actor)
  assertWriteEnabled(deps)
  const draft = normalizeDraft(r.draft ?? {})

  if (r.status === 'inserido_nao_confirmado') return runConfirmation(deps, r)

  // em_insercao: a inserção pode ter chegado ao UAU antes da falha
  const existing = await deps.uau.findByCode(draft.codigo)
  if (!existing) return runInsertion(deps, r, draft)
  const now = deps.ctx.now().toISOString()
  const inserted = await save(deps, r, { status: 'inserido_nao_confirmado', uauCode: existing.codigo, insertedAt: now })
  await record(deps, r, 'uau_already_present', 'inserido_nao_confirmado', null, { codigo: existing.codigo })
  return runConfirmation(deps, inserted)
}

async function runInsertion(deps: UseCaseDeps, r: RequestRecord, draft: InsumoDraft): Promise<ApproveResultDTO> {
  const today = deps.ctx.now().toISOString().slice(0, 10)
  const body = buildInsertBody(draft, { uauUser: deps.uau.user, today })
  const result = await deps.uau.insert(body).catch((err: unknown) => ({ ok: false, status: 0, response: err instanceof Error ? err.message : String(err) }))

  if (!result.ok) {
    // Volta para a fila de aprovação; o gestor pode corrigir e tentar de novo
    await save(deps, r, { status: 'aguardando_aprovacao' })
    await record(deps, r, 'uau_insert_failed', 'aguardando_aprovacao', null, { body, status: result.status, response: result.response })
    throw new AppError('UAU_INSERT_FAILED', `O UAU recusou a inserção (HTTP ${result.status || 'sem resposta'}). Nada foi gravado.`, 502, result.response)
  }

  const inserted = await save(deps, r, { status: 'inserido_nao_confirmado', uauCode: body.codigo as string, insertedAt: deps.ctx.now().toISOString() })
  await record(deps, r, 'uau_inserted', 'inserido_nao_confirmado', null, { body, status: result.status, response: result.response })
  deps.uau.invalidateCatalog()
  return runConfirmation(deps, inserted)
}

async function runConfirmation(deps: UseCaseDeps, r: RequestRecord): Promise<ApproveResultDTO> {
  const codigo = normalizeCode(r.uauCode ?? r.draft?.codigo)
  const body = buildConfirmBody(codigo)
  const result = await deps.uau.confirm(body).catch((err: unknown) => ({ ok: false, status: 0, response: err instanceof Error ? err.message : String(err) }))

  if (!result.ok) {
    await record(deps, r, 'uau_confirm_failed', null, null, { body, status: result.status, response: result.response })
    return {
      request: await detail(deps, r),
      warning: `O insumo ${codigo} foi criado no UAU, mas a mudança de situação para "confirmado" falhou (HTTP ${result.status || 'sem resposta'}). Use "Retomar inserção no UAU" para tentar de novo.`,
    }
  }

  const approved = await save(deps, r, { status: 'aprovado', confirmedAt: deps.ctx.now().toISOString(), lastComment: null })
  await record(deps, r, 'uau_confirmed', 'aprovado', null, { body, status: result.status, response: result.response })
  await notifyApproved(deps, approved)
  return { request: await detail(deps, approved), warning: null }
}
