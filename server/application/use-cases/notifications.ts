/**
 * Avisos por e-mail. Nunca derrubam o fluxo: qualquer falha (configuração, rede, servidor de
 * e-mail) fica registrada no histórico da solicitação e a ação (aprovação, devolução) continua valendo.
 */
import { buildAdjustmentEmail } from '../notifications/adjustment-email'
import { buildApprovalEmail } from '../notifications/approval-email'
import type { EmailContent } from '../notifications/layout'
import type { RequestRecord, UseCaseDeps } from '../ports'

const isEmail = (v: string | null | undefined): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** E-mail informado no formulário, de quem abriu (com login) e de quem cadastrou, sem repetir. */
async function participantEmails({ repos }: UseCaseDeps, r: RequestRecord): Promise<string[]> {
  const ids = [r.requesterId, r.analystId].filter((id): id is string => !!id)
  const people = await Promise.all(ids.map((id) => repos.identity.loadActor(id)))
  return [...new Set([r.requesterEmail, ...people.map((p) => p?.email)].map((e) => e?.toLowerCase()).filter(isEmail))]
}

/** Avisa solicitante e analista (com cópia para a lista fixa) que o insumo foi aprovado. */
export async function notifyApproved(deps: UseCaseDeps, r: RequestRecord): Promise<void> {
  await sendAndRecord(deps, r, async () => {
    const { mailer } = deps
    const participants = await participantEmails(deps, r)
    const cc = mailer.approvalCc.filter((e) => !participants.includes(e))
    const content = buildApprovalEmail(r, mailer.appUrl)
    // Sem participantes com e-mail, a lista fixa vira destinatária
    return participants.length ? { to: participants, cc, content } : { to: cc, cc: [], content }
  })
}

/** Avisa o solicitante (e-mail do formulário) que o analista devolveu a solicitação, com o motivo. */
export async function notifyAdjustmentRequested(deps: UseCaseDeps, r: RequestRecord, reason: string): Promise<void> {
  await sendAndRecord(deps, r, async () => ({
    // Solicitações antigas, sem e-mail no formulário: avisa quem abriu, se tiver login
    to: isEmail(r.requesterEmail) ? [r.requesterEmail.toLowerCase()] : await participantEmails(deps, { ...r, analystId: null }),
    cc: [],
    content: buildAdjustmentEmail(r, reason, deps.ctx.actor.fullName, deps.mailer.appUrl),
  }))
}

/** Monta, envia e registra no histórico; nunca lança erro. Sem destinatário, não envia nem registra. */
async function sendAndRecord(deps: UseCaseDeps, r: RequestRecord, build: () => Promise<{ to: string[]; cc: string[]; content: EmailContent }>) {
  let details: Record<string, unknown> = {}
  try {
    if (!deps.mailer.enabled) return
    const { to, cc, content } = await build()
    if (!to.length) return
    details = { subject: content.subject, to, cc }
    await deps.mailer.send({ to, cc, ...content })
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
