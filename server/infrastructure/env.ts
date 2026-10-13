/**
 * Leitura das opções de ambiente que escolhem o modo do app (DATA_SOURCE, UAU_MODE...).
 * Tolerante a erros comuns ao colar no painel da Vercel: espaços, aspas e maiúsculas
 * (" Supabase ", "\"supabase\"" → "supabase").
 */
export function envOption(name: string, env: NodeJS.ProcessEnv = process.env): string {
  return (env[name] ?? '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim()
    .toLowerCase()
}

/** Valor de URL/chave sem espaços nem aspas em volta (null = ausente). Mantém maiúsculas. */
export function envValue(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const v = (env[name] ?? '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim()
  return v || null
}

/** Variáveis que o servidor usa, para o diagnóstico em /api/health (só presença, nunca valores). */
const DIAGNOSTIC_VARS = [
  'DATA_SOURCE',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UAU_MODE',
  'UAU_BASE_URL',
  'UAU_INTEGRATION_TOKEN',
  'UAU_LOGIN',
  'UAU_PASSWORD',
  'UAU_GRAVACAO',
  'EMAIL_PROVIDER',
  'APP_URL',
] as const

export function envPresence(env: NodeJS.ProcessEnv = process.env): Record<string, boolean> {
  return Object.fromEntries(DIAGNOSTIC_VARS.map((k) => [k, !!env[k]?.trim()]))
}
