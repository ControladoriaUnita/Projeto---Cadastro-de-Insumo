/**
 * Clientes Supabase — SOMENTE server-side.
 *
 * O navegador não fala com o Supabase. Todo acesso a dados passa pela API, que valida a
 * sessão do login Microsoft, carrega o perfil (papel) e aplica as permissões nos casos de uso. As tabelas
 * têm RLS ligado e nenhuma política para anon/authenticated: só a service role (servidor) lê e grava.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { envValue } from '../env'

function env(name: string): string {
  const v = envValue(name)
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`)
  return v
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

let service: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  service ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: authOptions })
  return service
}
