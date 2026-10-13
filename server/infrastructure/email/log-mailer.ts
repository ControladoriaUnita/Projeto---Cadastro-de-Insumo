/**
 * Mailers sem envio real:
 *  - LogMailer: mostra o e-mail no terminal do servidor e guarda os últimos (desenvolvimento e testes);
 *  - DisabledMailer: avisos desligados.
 */
import type { EmailMessage, Mailer } from '../../application/ports'

const KEEP_LAST = 50

export class LogMailer implements Mailer {
  readonly enabled = true
  readonly sent: EmailMessage[] = []
  /** Para testes: o próximo envio falha */
  failNext = false

  constructor(
    readonly appUrl: string | null = null,
    readonly approvalCc: string[] = [],
  ) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('Falha simulada no envio de e-mail.')
    }
    this.sent.push(message)
    if (this.sent.length > KEEP_LAST) this.sent.shift()
    console.info(`[e-mail] para ${message.to.join(', ')}${message.cc.length ? ` (cc ${message.cc.join(', ')})` : ''} — ${message.subject}\n${message.text}`)
  }
}

export class DisabledMailer implements Mailer {
  readonly enabled = false
  readonly appUrl = null
  readonly approvalCc: string[] = []
  async send(): Promise<void> {}
}
