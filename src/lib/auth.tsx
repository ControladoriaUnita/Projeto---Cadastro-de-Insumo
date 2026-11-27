/**
 * Sessão do usuário na tela.
 *
 *  1. Lê /api/auth-config (público): o servidor diz se usa o login Microsoft ou a demonstração.
 *  2. Microsoft 365 (AUTH_MODE=entra): o login abre em POPUP, porque o app roda dentro de um
 *     iframe no portal e a Microsoft não deixa a página de login abrir em iframe. O popup
 *     devolve o token da sessão por postMessage; o token vai em toda chamada à API, e o
 *     servidor lê o papel em `profiles` (/api/me).
 *  3. Demonstração (AUTH_MODE=dev): sem login; o usuário vem do seletor "entrar como".
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppConfigDTO, AuthConfigDTO, UserDTO } from '@shared/contracts'
import type { Permission } from '@shared/domain/roles'
import { ApiError, api, getDemoUser, getSessionToken, setDemoUser, setSessionToken } from './api'

/** Situação do acesso */
export type AccessState = 'loading' | 'signed-out' | 'inactive' | 'ready' | 'error'

interface AuthState {
  access: AccessState
  user: UserDTO | null
  config: AppConfigDTO | null
  /** Modo demonstração (seletor de usuários, sem login) */
  demo: boolean
  /** false = servidor em AUTH_MODE=entra mas sem as variáveis ENTRA_* / SESSION_SECRET */
  entraConfigured: boolean
  error: string | null
  can: (permission: Permission) => boolean
  /** Abre o login da Microsoft em popup; resolve quando a sessão chega (ou o popup é fechado) */
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  switchDemoUser: (id: string) => void
}

const Ctx = createContext<AuthState | null>(null)

/** Mesmo valor de AUTH_MESSAGE_SOURCE em server/http/auth-routes.ts */
const AUTH_MESSAGE_SOURCE = 'insumos-auth'

type PopupMessage = { source: typeof AUTH_MESSAGE_SOURCE } & ({ ok: true; token: string; expiresAt: number } | { ok: false; error: string })

/** Popup centralizado na tela (vale também quando o app está num iframe). */
function openLoginPopup(): Window | null {
  const w = 520
  const h = 680
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
  return window.open('/api/auth/microsoft/login', 'insumos-login-microsoft', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
}

function waitForPopup(popup: Window): Promise<{ token: string; expiresAt: number } | null> {
  return new Promise((resolve, reject) => {
    let closedSince = 0
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
    }
    const onMessage = (e: MessageEvent) => {
      const data = e.data as PopupMessage | null
      if (e.origin !== window.location.origin || data?.source !== AUTH_MESSAGE_SOURCE) return
      cleanup()
      if (data.ok) resolve({ token: data.token, expiresAt: data.expiresAt })
      else reject(new Error(data.error))
    }
    // Fechou sem resposta = a pessoa desistiu. Espera um pouco: a mensagem pode chegar logo depois do fechamento.
    const timer = window.setInterval(() => {
      if (!popup.closed) return
      closedSince ||= Date.now()
      if (Date.now() - closedSince > 1500) {
        cleanup()
        resolve(null)
      }
    }, 300)
    window.addEventListener('message', onMessage)
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const authConfig = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfigDTO>('/auth-config'), staleTime: Infinity, retry: 2 })
  const cfg = authConfig.data
  const demo = cfg?.authMode === 'dev'

  // Muda quando entra/sai, para refazer o /me
  const [token, setToken] = useState<string | null>(() => getSessionToken())
  const [demoUser, setDemoUserState] = useState<string | null>(() => getDemoUser())
  // Sobe a cada login/saída: força um novo /me mesmo quando o token não muda (sessão por cookie)
  const [epoch, setEpoch] = useState(0)

  const me = useQuery({
    queryKey: ['me', demo ? demoUser : token, epoch],
    queryFn: () => api<{ user: UserDTO }>('/me'),
    // Sem token o servidor ainda aceita o cookie (login aberto fora do iframe)
    enabled: !!cfg,
    retry: false,
  })
  const appConfig = useQuery({ queryKey: ['config'], queryFn: () => api<AppConfigDTO>('/config'), enabled: !!me.data, staleTime: Infinity })

  const resetData = useCallback(() => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth-config' }), [qc])

  const signOut = useCallback(async () => {
    setSessionToken(null)
    setToken(null)
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    resetData()
    setEpoch((e) => e + 1)
  }, [resetData])

  // Sessão expirada ou recusada pelo servidor: apaga o token guardado
  const meError = me.error instanceof ApiError ? me.error : null
  useEffect(() => {
    if (meError?.code === 'UNAUTHENTICATED' && getSessionToken()) {
      setSessionToken(null)
      setToken(null)
    }
  }, [meError])

  const signIn = useCallback(async () => {
    const popup = openLoginPopup()
    if (!popup) throw new Error('O navegador bloqueou a janela de login. Permita pop-ups para este site e clique em "Entrar" de novo.')
    popup.focus()
    const session = await waitForPopup(popup)
    if (!session) return
    setSessionToken(session.token, session.expiresAt)
    resetData()
    setToken(session.token)
    setEpoch((e) => e + 1)
  }, [resetData])

  const switchDemoUser = useCallback(
    (id: string) => {
      setDemoUser(id)
      setDemoUserState(id)
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth-config' })
    },
    [qc],
  )

  const user = me.data?.user ?? null
  let access: AccessState
  let error: string | null = null
  if (authConfig.isError) {
    access = 'error'
    error = 'Não foi possível falar com o servidor. Tente recarregar a página.'
  } else if (!cfg) access = 'loading'
  else if (user) access = 'ready'
  else if (meError?.code === 'PROFILE_INACTIVE') access = 'inactive'
  else if (meError?.code === 'UNAUTHENTICATED') access = 'signed-out'
  else if (me.isError) {
    access = 'error'
    error = meError?.message ?? 'Não foi possível carregar seu perfil.'
  } else access = 'loading'

  const value: AuthState = {
    access,
    user,
    config: appConfig.data ?? null,
    demo,
    entraConfigured: cfg?.entraConfigured ?? false,
    error,
    can: (p) => !!user?.permissions.includes(p),
    signIn,
    signOut,
    switchDemoUser,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
