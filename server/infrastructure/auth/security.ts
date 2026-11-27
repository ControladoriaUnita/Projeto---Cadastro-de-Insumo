/**
 * Sessão própria do app: token assinado com HMAC-SHA256 (SESSION_SECRET).
 * Formato: base64url(payload JSON).base64url(assinatura). Sem estado no servidor.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { envValue } from '../env'

export interface SessionPayload {
  kind: 'user'
  /** id do perfil (ou "state:<nonce>" no state do login Microsoft) */
  sub: string
  /** expiração em segundos (epoch) */
  exp: number
}

/** Segredo mínimo de 32 caracteres; sem ele nenhuma sessão é emitida nem aceita. */
export function sessionSecret(): string | null {
  const s = envValue('SESSION_SECRET')
  return s && s.length >= 32 ? s : null
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url')

export function signSession(payload: SessionPayload): string {
  const secret = sessionSecret()
  if (!secret) throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres).')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body, secret)}`
}

/** Payload do token, ou null se a assinatura não confere, o formato é inválido ou já expirou. */
export function verifySession(token: string | null | undefined): SessionPayload | null {
  const secret = sessionSecret()
  if (!secret || !token) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>
    if (p.kind !== 'user' || typeof p.sub !== 'string' || typeof p.exp !== 'number') return null
    if (p.exp <= Math.floor(Date.now() / 1000)) return null
    return { kind: 'user', sub: p.sub, exp: p.exp }
  } catch {
    return null
  }
}
