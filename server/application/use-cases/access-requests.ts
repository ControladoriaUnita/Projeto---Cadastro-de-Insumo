/**
 * Pedido de acesso feito na tela de login, sem estar logado. Não cria conta: só registra o
 * pedido para a gestão analisar no Supabase (tabela access_requests).
 */
import type { AccessRequestInput } from '../../../shared/contracts'
import { isCorporateEmail } from '../../../shared/domain/access'
import { AppError } from '../context'
import type { AccessRequestRepository } from '../ports'

export interface AccessRequestSettings {
  corporateDomains: readonly string[]
}

/**
 * A resposta é a mesma quando o pedido é novo, repetido ou veio de robô (campo-isca preenchido):
 * assim a tela não revela quem já pediu acesso.
 */
export async function submitAccessRequest(repo: AccessRequestRepository, input: AccessRequestInput, settings: AccessRequestSettings): Promise<{ ok: true }> {
  if (input.website) return { ok: true }
  if (!isCorporateEmail(input.email, settings.corporateDomains)) {
    throw new AppError('EMAIL_NOT_CORPORATE', `Use seu e-mail corporativo (${settings.corporateDomains.map((d) => '@' + d).join(' ou ')}).`, 422)
  }
  await repo.createPending({
    email: input.email,
    fullName: input.fullName,
    requestedRole: input.requestedRole,
    workName: input.workName || null,
    message: input.message || null,
  })
  return { ok: true }
}
