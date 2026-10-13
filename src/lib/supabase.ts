/**
 * Cliente Supabase do browser — usado SÓ para login (ANON KEY).
 * Ausente no modo demonstração (DATA_SOURCE=memory no servidor).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
export const isDemoMode = !supabase
