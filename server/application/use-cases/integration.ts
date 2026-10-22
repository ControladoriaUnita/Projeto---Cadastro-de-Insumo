/**
 * Diagnóstico das integrações, para a gestão (tela "Integração"):
 *  - UAU: só leitura; faz um login novo e uma consulta pequena e diz onde a conexão falha, se falhar;
 *  - e-mail: manda um e-mail de teste para quem está logado e devolve o erro do servidor de e-mail, se houver.
 */
import type { IntegrationStatusDTO, TestEmailResultDTO } from '../../../shared/contracts'
import { formatDateTime } from '../../../shared/format'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { renderEmail } from '../notifications/layout'
import { AppError, requirePermission } from '../context'
import type { UseCaseDeps } from '../ports'

export interface IntegrationSettings {
  emailProvider: IntegrationStatusDTO['emailProvider']
}

export async function checkIntegration({ uau, ctx }: UseCaseDeps, settings: IntegrationSettings): Promise<IntegrationStatusDTO> {
  requirePermission(ctx, PERMISSIONS.approvalDecide)
  return {
    checkedAt: ctx.now().toISOString(),
    uauMode: uau.mode,
    uauWriteEnabled: uau.writeEnabled,
    emailProvider: settings.emailProvider,
    uau: await uau.checkConnection(),
  }
}

/** Envia um e-mail de teste para o próprio usuário. Aqui a falha aparece na tela (nos avisos do fluxo, só no histórico). */
export async function sendTestEmail({ mailer, ctx }: UseCaseDeps, settings: IntegrationSettings): Promise<TestEmailResultDTO> {
  requirePermission(ctx, PERMISSIONS.approvalDecide)
  const to = ctx.actor.email
  if (!to) throw new AppError('EMAIL_MISSING', 'Seu usuário não tem e-mail cadastrado para receber o teste.', 422)
  if (!mailer.enabled) throw new AppError('EMAIL_DISABLED', 'O aviso por e-mail está desligado (EMAIL_PROVIDER=none).', 409)
  const content = renderEmail({
    subject: 'Teste de e-mail · Cadastro de Insumos',
    eyebrow: 'Teste de e-mail',
    title: 'O envio de e-mail está funcionando',
    intro: 'Se você recebeu esta mensagem, os avisos de aprovação e de ajuste vão chegar aos solicitantes.',
    rows: [
      ['Enviado por', ctx.actor.fullName],
      ['Em', formatDateTime(ctx.now().toISOString())],
    ],
    link: mailer.appUrl,
    linkLabel: 'Abrir o Cadastro de Insumos',
  })
  try {
    await mailer.send({ to: [to], cc: [], ...content })
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'TimeoutError' ? 'O Microsoft 365 demorou demais para responder.' : err instanceof Error ? err.message : String(err)
    throw err instanceof AppError ? err : new AppError('EMAIL_SEND_FAILED', `O e-mail de teste não foi enviado. ${message}`, 502)
  }
  return { to, provider: settings.emailProvider }
}
