/**
 * Avisos por e-mail. Nunca derrubam o fluxo: qualquer falha (configuração, rede, servidor de
 * e-mail) fica registrada no histórico da solicitação e a aprovação continua valendo.
 */
import { buildApprovalEmail } from '../notifications/approval-email'
import type { RequestRecord, UseCaseDeps } from '../ports'

const isEmail = (v: string | null | undefined): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** E-mail de quem abriu e de quem cadastrou, sem repetir. */
async function participantEmails({ repos }: UseCaseDeps, r: RequestRecord): Promise<string[]> {
  const ids = [r.requesterId, r.analystId].filter((id): id is string => !!id)
  const people = await Promise.all(ids.map((id) => repos.identity.loadActor(id)))
  return [...new Set(people.map((p) => p?.email?.toLowerCase()).filter(isEmail))]
}

/** Avisa solicitante e analista (com cópia para a lista fixa) que o insumo foi aprovado. */
export async function notifyApproved(deps: UseCaseDeps, r: RequestRecord): Promise<void> {
  let details: Record<string, unknown> = {}
  try {
    const { mailer } = deps
    if (!mailer.enabled) return
    const participants = await participantEmails(deps, r)
    const cc = mailer.approvalCc.filter((e) => !participants.includes(e))
    // Sem participantes com e-mail, a lista fixa vira destinatária
    const to = participants.length ? participants : cc
    if (!to.length) return

    const content = buildApprovalEmail(r, mailer.appUrl)
    details = { subject: content.subject, to, cc: participants.length ? cc : [] }
    await mailer.send({ to, cc: participants.length ? cc : [], ...content })
    await recordEmail(deps, r, 'email_sent', details)
  } catch (err) {
    await recordEmail(deps, r, 'email_failed', { ...details, error: err instanceof Error ? err.message : String(err) })
  }
}

function recordEmail(deps: UseCaseDeps, r: RequestRecord, type: 'email_sent' | 'email_failed', details: Record<string, unknown>) {
  return deps.repos.requests.addEvent({
    requestId: r.id,
    at: deps.ctx.now().toISOString(),
    actorId: deps.ctx.actor.id,
    actorName: deps.ctx.actor.fullName,
    type,
    fromStatus: null,
    toStatus: null,
    comment: null,
    details,
  })
}
