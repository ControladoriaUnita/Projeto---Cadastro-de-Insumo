/**
 * Escolhe o Mailer conforme EMAIL_PROVIDER:
 *   none  → avisos desligados
 *   log   → e-mail aparece no terminal do servidor (padrão em desenvolvimento)
 *   graph → envio real pelo Microsoft 365
 */
import { AppError } from '../../application/context'
import type { Mailer } from '../../application/ports'
import { GraphMailer } from './graph-mailer'
import { DisabledMailer, LogMailer } from './log-mailer'

let instance: Mailer | null = null

const list = (v: string | undefined) =>
  (v ?? '')
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export function emailProvider(env: NodeJS.ProcessEnv = process.env): 'none' | 'log' | 'graph' {
  const p = env.EMAIL_PROVIDER
  return p === 'graph' || p === 'none' ? p : 'log'
}

export function getMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  if (instance) return instance
  const appUrl = env.APP_URL?.trim() || null
  const approvalCc = list(env.EMAIL_APPROVAL_CC)

  switch (emailProvider(env)) {
    case 'none':
      return (instance = new DisabledMailer())
    case 'log':
      return (instance = new LogMailer(appUrl, approvalCc))
    case 'graph': {
      const required = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'EMAIL_SENDER'] as const
      const missing = required.filter((k) => !env[k])
      if (missing.length) throw new AppError('EMAIL_NOT_CONFIGURED', `E-mail sem configuração no servidor: ${missing.join(', ')}.`, 503)
      return (instance = new GraphMailer({
        tenantId: env.GRAPH_TENANT_ID!,
        clientId: env.GRAPH_CLIENT_ID!,
        clientSecret: env.GRAPH_CLIENT_SECRET!,
        sender: env.EMAIL_SENDER!,
        appUrl,
        approvalCc,
      }))
    }
  }
}

/** Só para testes. */
export function setMailerForTests(mailer: Mailer | null) {
  instance = mailer
}
