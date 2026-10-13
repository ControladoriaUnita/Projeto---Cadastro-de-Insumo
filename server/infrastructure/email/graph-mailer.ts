/**
 * Envio pelo Microsoft 365 (Microsoft Graph), com um aplicativo registrado no Entra ID
 * (antigo Azure AD) que tem a permissão de aplicativo Mail.Send.
 *
 *  1. Token: client credentials em login.microsoftonline.com (cache até perto de expirar).
 *  2. Envio: POST /users/{remetente}/sendMail — o remetente é uma caixa da Unità.
 */
import { IntegrationError } from '../../application/context'
import type { EmailMessage, Mailer } from '../../application/ports'

export interface GraphMailerConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  /** Caixa que envia (ex.: cadastro@unitaengenharia.com.br) */
  sender: string
  appUrl: string | null
  approvalCc: string[]
}

const TIMEOUT_MS = 20_000
const EXPIRY_MARGIN_MS = 60_000

const recipients = (list: string[]) => list.map((address) => ({ emailAddress: { address } }))

export class GraphMailer implements Mailer {
  readonly enabled = true
  readonly appUrl: string | null
  readonly approvalCc: string[]
  private token: string | null = null
  private tokenExpiresAt = 0

  constructor(private readonly config: GraphMailerConfig) {
    this.appUrl = config.appUrl
    this.approvalCc = config.approvalCc
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.config.sender)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: 'HTML', content: message.html },
          toRecipients: recipients(message.to),
          ccRecipients: recipients(message.cc),
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Sucesso = 202 Accepted, sem corpo
    if (res.status !== 202) throw new IntegrationError(`Microsoft 365 recusou o e-mail (HTTP ${res.status}): ${await errorText(res)}`)
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token
    const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(this.config.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
    if (!res.ok || !data.access_token) {
      // Não repassa a resposta inteira: pode conter dados do aplicativo
      throw new IntegrationError(`Falha ao autenticar no Microsoft 365 (HTTP ${res.status}). ${data.error_description?.split('\r\n')[0] ?? ''}`.trim())
    }
    this.token = data.access_token
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS
    return this.token
  }
}

async function errorText(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return data?.error?.message ?? res.statusText
}
