/**
 * Usuários e permissões (tela exclusiva da gestão): papel, obra padrão, ativar/desativar,
 * cadastro antecipado e decisão dos pedidos de acesso.
 *
 * Travas para ninguém ficar sem gestão: quem está logado não tira o próprio papel de gestão
 * nem se desativa, e o app nunca fica sem pelo menos um gestor ativo.
 */
import type { z } from 'zod'
import type { AccessRequestDTO, ManagedUserDTO, createUserSchema, resolveAccessRequestSchema, updateUserSchema } from '../../../shared/contracts'
import { isCorporateEmail } from '../../../shared/domain/access'
import { PERMISSIONS, ROLE_LABELS } from '../../../shared/domain/roles'
import { AppError, notFound, requirePermission } from '../context'
import type { ManagedProfile, ProfilePatch, UseCaseDeps } from '../ports'

type CreateUser = z.output<typeof createUserSchema>
type UpdateUser = z.output<typeof updateUserSchema>
type ResolveAccessRequest = z.output<typeof resolveAccessRequestSchema>

const toDTO = (p: ManagedProfile): ManagedUserDTO => ({
  id: p.id,
  fullName: p.fullName,
  email: p.email,
  role: p.role,
  roleLabel: ROLE_LABELS[p.role],
  workName: p.workName,
  active: p.active,
  linkedMicrosoft: !!p.entraOid,
  lastLoginAt: p.lastLoginAt,
  createdAt: p.createdAt,
})

const byName = (a: ManagedProfile, b: ManagedProfile) => a.fullName.localeCompare(b.fullName, 'pt-BR')

export async function listUsers(deps: UseCaseDeps): Promise<ManagedUserDTO[]> {
  requirePermission(deps.ctx, PERMISSIONS.usersManage)
  return (await deps.repos.identity.listProfiles()).sort(byName).map(toDTO)
}

export async function createUser(deps: UseCaseDeps, input: CreateUser, opts: { corporateDomains: readonly string[] }): Promise<ManagedUserDTO> {
  requirePermission(deps.ctx, PERMISSIONS.usersManage)
  if (opts.corporateDomains.length && !isCorporateEmail(input.email, opts.corporateDomains)) {
    throw new AppError('EMAIL_NOT_CORPORATE', `Use o e-mail corporativo (${opts.corporateDomains.map((d) => '@' + d).join(' ou ')}).`, 422)
  }
  if (await deps.repos.identity.findProfileByEmail(input.email)) {
    throw new AppError('USER_EXISTS', 'Já existe um usuário com este e-mail. Edite o papel dele na lista.', 409)
  }
  const created = await deps.repos.identity.createProfile({ fullName: input.fullName, email: input.email, entraOid: null, role: input.role, workName: input.workName })
  return toDTO((await deps.repos.identity.getProfile(created.id))!)
}

/** O app nunca pode ficar sem um gestor ativo. */
async function assertKeepsAGestor(deps: UseCaseDeps, target: ManagedProfile, patch: ProfilePatch) {
  const losesGestor = target.role === 'gestor' && target.active && ((patch.role !== undefined && patch.role !== 'gestor') || patch.active === false)
  if (!losesGestor) return
  const others = (await deps.repos.identity.listProfiles()).filter((p) => p.id !== target.id && p.role === 'gestor' && p.active)
  if (!others.length) throw new AppError('LAST_GESTOR', 'Este é o único gestor ativo. Dê o papel de gestão a outra pessoa antes.', 409)
}

export async function updateUser(deps: UseCaseDeps, id: string, input: UpdateUser): Promise<ManagedUserDTO> {
  requirePermission(deps.ctx, PERMISSIONS.usersManage)
  const target = await deps.repos.identity.getProfile(id)
  if (!target) throw notFound('Usuário')
  const patch: ProfilePatch = { fullName: input.fullName, role: input.role, workName: input.workName, active: input.active }

  if (id === deps.ctx.actor.id) {
    if (patch.active === false) throw new AppError('SELF_LOCKOUT', 'Você não pode desativar o próprio acesso.', 409)
    if (patch.role !== undefined && patch.role !== 'gestor') throw new AppError('SELF_LOCKOUT', 'Você não pode tirar o próprio papel de gestão.', 409)
  }
  await assertKeepsAGestor(deps, target, patch)

  const updated = await deps.repos.identity.updateProfile(id, patch)
  if (!updated) throw notFound('Usuário')
  return toDTO(updated)
}

export async function listAccessRequests(deps: UseCaseDeps): Promise<AccessRequestDTO[]> {
  requirePermission(deps.ctx, PERMISSIONS.usersManage)
  const pending = await deps.repos.accessRequests.listPending()
  const profiles = await deps.repos.identity.listProfiles()
  const byEmail = new Map(profiles.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]))
  return pending.map((r) => {
    const existing = byEmail.get(r.email.toLowerCase())
    return { ...r, existingUser: existing ? { id: existing.id, role: existing.role, active: existing.active } : null }
  })
}

/**
 * Aprovar: dá o papel escolhido ao perfil com o mesmo e-mail (ou cria o perfil, que é ligado
 * à conta Microsoft no primeiro login) e marca o pedido como atendido. Recusar: só fecha o pedido.
 */
export async function resolveAccessRequest(deps: UseCaseDeps, id: string, input: ResolveAccessRequest): Promise<{ ok: true; user: ManagedUserDTO | null }> {
  requirePermission(deps.ctx, PERMISSIONS.usersManage)
  const request = (await deps.repos.accessRequests.listPending()).find((r) => r.id === id)
  if (!request) throw new AppError('NOT_FOUND', 'Pedido não encontrado ou já decidido.', 404)

  if (input.decision === 'reject') {
    await deps.repos.accessRequests.resolve(id, { status: 'recusado', approvedRole: null, notes: input.notes ?? null })
    return { ok: true, user: null }
  }

  const workName = input.workName !== undefined ? input.workName : request.workName
  const existing = await deps.repos.identity.findProfileByEmail(request.email)
  let user: ManagedUserDTO
  if (existing) {
    user = await updateUser(deps, existing.id, { role: input.role, active: true, workName })
  } else {
    const created = await deps.repos.identity.createProfile({ fullName: request.fullName, email: request.email, entraOid: null, role: input.role, workName })
    user = toDTO((await deps.repos.identity.getProfile(created.id))!)
  }
  await deps.repos.accessRequests.resolve(id, { status: 'atendido', approvedRole: input.role, notes: null })
  return { ok: true, user }
}
