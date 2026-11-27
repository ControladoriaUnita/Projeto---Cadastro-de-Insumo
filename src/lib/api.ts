/**
 * Cliente HTTP da API (/api/*). O navegador nunca fala com o UAU: só com o nosso servidor.
 */
import type { ApiErrorBody } from '@shared/contracts'

const DEMO_USER_KEY = 'insumos.demoUser'
const SESSION_KEY = 'insumos.session'

/**
 * Token da sessão do login Microsoft. Fica no localStorage do iframe (o navegador separa por
 * portal); se o armazenamento estiver bloqueado, vale só enquanto a página estiver aberta.
 */
let memoryToken: { token: string; expiresAt: number } | null = null

export function getSessionToken(): string | null {
  let s = memoryToken
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) s = JSON.parse(raw) as { token: string; expiresAt: number }
  } catch {
    /* armazenamento indisponível: usa a cópia em memória */
  }
  return s && s.expiresAt > Date.now() ? s.token : null
}

export function setSessionToken(token: string | null, expiresAt = 0) {
  memoryToken = token ? { token, expiresAt } : null
  try {
    if (token) localStorage.setItem(SESSION_KEY, JSON.stringify(memoryToken))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* armazenamento indisponível */
  }
}

export function getDemoUser(): string | null {
  try {
    return localStorage.getItem(DEMO_USER_KEY)
  } catch {
    return null
  }
}

export function setDemoUser(id: string) {
  try {
    localStorage.setItem(DEMO_USER_KEY, id)
  } catch {
    /* armazenamento indisponível: segue com o usuário padrão */
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly correlationId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // Login Microsoft: o servidor valida o token e lê o papel em profiles
  const token = getSessionToken()
  if (token) headers.authorization = `Bearer ${token}`
  // Modo demonstração: o servidor ignora este cabeçalho com AUTH_MODE=entra
  const demo = getDemoUser()
  if (demo) headers['x-demo-user'] = demo
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const e = (data as ApiErrorBody | null)?.error
    throw new ApiError(res.status, e?.code ?? 'HTTP', e?.message ?? `Erro ${res.status}`, e?.details, e?.correlationId)
  }
  return data as T
}

/** Monta a query string ignorando valores vazios. */
export function toQuery(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Erro inesperado.')
