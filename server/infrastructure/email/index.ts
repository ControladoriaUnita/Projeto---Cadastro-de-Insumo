/**
 * Escolhe o Mailer conforme EMAIL_PROVIDER:
 *   none  → avisos desligados
 *   log   → e-mail aparece no terminal do servidor (padrão em desenvolvimento)
 *   graph → envio real pelo Microsoft 365
 */
import { AppError } from '../../application/context'
import { envOption, envValue } from '../env'
import type { Mailer } from '../../application/ports'
import { GraphMailer } from './graph-mailer'
import { DisabledMailer, LogMailer } from './log-mailer'

let instance: Mailer | null = null

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const list = (v: string | undefined) =>
  (v ?? '')
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export function emailProvider(env: NodeJS.ProcessEnv = process.env): 'none' | 'log' | 'graph' {
  const p = envOption('EMAIL_PROVIDER', env)
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
      // Sem espaços nem aspas em volta (erro comum ao colar no painel da Vercel)
      const config = {
        tenantId: envValue('GRAPH_TENANT_ID', env),
        clientId: envValue('GRAPH_CLIENT_ID', env),
        clientSecret: envValue('GRAPH_CLIENT_SECRET', env),
        sender: envValue('EMAIL_SENDER', env),
      }
      const names = { tenantId: 'GRAPH_TENANT_ID', clientId: 'GRAPH_CLIENT_ID', clientSecret: 'GRAPH_CLIENT_SECRET', sender: 'EMAIL_SENDER' } as const
      const missing = (Object.keys(names) as (keyof typeof names)[]).filter((k) => !config[k]).map((k) => names[k])
      if (missing.length) throw new AppError('EMAIL_NOT_CONFIGURED', `E-mail sem configuração no servidor: ${missing.join(', ')}.`, 503)
      // O "ID do segredo" do Entra ID é um GUID; o Valor do segredo não é
      if (GUID.test(config.clientSecret!)) {
        throw new AppError(
          'EMAIL_NOT_CONFIGURED',
          'GRAPH_CLIENT_SECRET está com o "ID do segredo" (formato xxxxxxxx-xxxx-…). Use a coluna "Valor", que só aparece ao criar o segredo no Entra ID.',
          503,
        )
      }
      return (instance = new GraphMailer({
        tenantId: config.tenantId!,
        clientId: config.clientId!,
        clientSecret: config.clientSecret!,
        sender: config.sender!,
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
