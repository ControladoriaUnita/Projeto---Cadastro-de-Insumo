/**
 * Sessão do usuário na tela.
 *
 *  1. Lê /api/auth-config (público): o servidor diz se usa Supabase ou o modo demonstração.
 *  2. Supabase: login por e-mail e senha; o token vai em toda chamada à API, e o servidor
 *     valida o token e lê o papel em `profiles` (/api/me).
 *  3. Demonstração: sem login; o usuário vem do seletor "entrar como".
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthError, Session } from '@supabase/supabase-js'
import type { AppConfigDTO, AuthConfigDTO, UserDTO } from '@shared/contracts'
import type { Permission } from '@shared/domain/roles'
import { ApiError, api, getDemoUser, setDemoUser } from './api'
import { getSupabase, initSupabase } from './supabase'

/** Situação do acesso depois do login */
export type AccessState = 'loading' | 'signed-out' | 'inactive' | 'ready' | 'error'

interface AuthState {
  access: AccessState
  user: UserDTO | null
  config: AppConfigDTO | null
  demo: boolean
  /** E-mail da sessão do Supabase (aparece mesmo sem perfil liberado) */
  sessionEmail: string | null
  /** Entrou pelo link de "esqueci minha senha" e precisa definir uma nova */
  recovering: boolean
  error: string | null
  can: (permission: Permission) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  switchDemoUser: (id: string) => void
}

const Ctx = createContext<AuthState | null>(null)

/** Mensagens do Supabase Auth em português. */
export function authErrorMessage(error: AuthError | Error): string {
  const msg = error.message
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Peça à gestão para confirmar seu usuário.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/fetch|network/i.test(msg)) return 'Sem conexão com o servidor de login. Verifique a internet.'
  return msg
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const authConfig = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfigDTO>('/auth-config'), staleTime: Infinity, retry: 2 })
  const demo = authConfig.data?.dataSource === 'memory'

  // Cria o cliente do Supabase assim que o servidor informar a configuração (idempotente)
  const cfg = authConfig.data
  const supabase = cfg?.dataSource === 'supabase' && cfg.supabaseUrl && cfg.supabaseAnonKey ? initSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey) : null

  // undefined = ainda verificando a sessão salva no navegador
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [demoUser, setDemoUserState] = useState<string | null>(() => getDemoUser())

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth-config' })
    })
    return () => data.subscription.unsubscribe()
  }, [supabase, qc])

  const hasSession = demo || !!session
  const me = useQuery({
    queryKey: ['me', demo ? demoUser : session?.user.id],
    queryFn: () => api<{ user: UserDTO }>('/me'),
    enabled: !!cfg && hasSession,
    retry: false,
  })
  const appConfig = useQuery({ queryKey: ['config'], queryFn: () => api<AppConfigDTO>('/config'), enabled: !!me.data, staleTime: Infinity })

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut()
    setRecovering(false)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth-config' })
  }, [qc])

  // Token recusado pelo servidor (expirado/revogado): encerra a sessão e volta ao login
  const meError = me.error instanceof ApiError ? me.error : null
  useEffect(() => {
    if (meError?.code === 'UNAUTHENTICATED' && !demo) void signOut()
  }, [meError, demo, signOut])

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabase()
    if (!client) throw new Error('Login indisponível: o servidor está em modo demonstração.')
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(authErrorMessage(error))
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = getSupabase()
    if (!client) throw new Error('Login indisponível: o servidor está em modo demonstração.')
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` })
    if (error) throw new Error(authErrorMessage(error))
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const client = getSupabase()
    if (!client) throw new Error('Login indisponível.')
    const { error } = await client.auth.updateUser({ password })
    if (error) throw new Error(authErrorMessage(error))
    setRecovering(false)
  }, [])

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
  } else if (!cfg || (!demo && session === undefined)) access = 'loading'
  else if (!hasSession) access = 'signed-out'
  else if (user) access = 'ready'
  else if (meError?.code === 'PROFILE_INACTIVE') access = 'inactive'
  else if (me.isError && meError?.code !== 'UNAUTHENTICATED') {
    access = 'error'
    error = meError?.message ?? 'Não foi possível carregar seu perfil.'
  } else access = 'loading'

  const value: AuthState = {
    access,
    user,
    config: appConfig.data ?? null,
    demo,
    sessionEmail: session?.user.email ?? null,
    recovering,
    error,
    can: (p) => !!user?.permissions.includes(p),
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    switchDemoUser,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
