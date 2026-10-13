/**
 * Cliente Supabase do browser — usado SÓ para login (chave anon, pública).
 *
 * É criado em tempo de execução com a configuração que o servidor entrega em /api/auth-config,
 * para a tela seguir sempre o modo do servidor (DATA_SOURCE) e o build não depender de
 * variáveis VITE_*. No modo demonstração não existe cliente.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function initSupabase(url: string, anonKey: string): SupabaseClient {
  client ??= createClient(url, anonKey)
  return client
}

/** Cliente já iniciado, ou null (modo demonstração / configuração ainda não carregada). */
export function getSupabase(): SupabaseClient | null {
  return client
}
