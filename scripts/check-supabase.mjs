// Confere a conexão com o Supabase: chaves, tabelas e perfis. Nunca mostra valores de chave.
//
// Uso:  npm run check:supabase   (lê .env.local)
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Faltando no .env.local: ${missing.join(', ')}`)
  process.exit(1)
}
for (const k of ['SUPABASE_URL']) {
  // Erros comuns: colar uma chave ou o endereço do painel (supabase.com/dashboard/...) no lugar
  // do "Project URL". A mensagem nunca repete o valor (poderia ser uma chave).
  const host = URL.canParse(process.env[k]) ? new URL(process.env[k]).host : null
  if (!host || host === 'supabase.com') {
    console.error(`${k} não é o "Project URL". Use o formato https://<id-do-projeto>.supabase.co`)
    process.exit(1)
  }
}
if (process.env.SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY estão iguais: a service role deve ser a chave secreta.')
  process.exit(1)
}

const auth = { persistSession: false, autoRefreshToken: false }
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth })
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth })
let failed = false
const fail = (msg) => {
  failed = true
  console.error(`✗ ${msg}`)
}

console.log(`Projeto: ${new URL(process.env.SUPABASE_URL).host} · DATA_SOURCE=${process.env.DATA_SOURCE ?? '(vazio)'}`)

for (const table of ['profiles', 'insumo_requests', 'insumo_request_events']) {
  const { count, error } = await service.from(table).select('*', { count: 'exact', head: true })
  if (error || typeof count !== 'number') fail(`${table}: ${error?.message || 'sem resposta da API'} — a migration 001 foi aplicada?`)
  else console.log(`✓ ${table}: ${count} registro(s)`)
}

// O navegador (chave anon) NÃO pode ler as tabelas
const leak = await anon.from('insumo_requests').select('id').limit(1)
if (!leak.error && leak.data?.length) fail('a chave anon consegue ler insumo_requests — confira o RLS e as permissões')
else console.log('✓ chave anon sem acesso às tabelas (correto)')

const { data: profiles, error } = await service.from('profiles').select('email, role, active').order('role')
if (error || !Array.isArray(profiles)) fail(`perfis: ${error?.message || 'sem resposta da API'}`)
else {
  const active = profiles.filter((p) => p.active)
  console.log(`✓ perfis ativos: ${active.length} de ${profiles.length}`)
  for (const p of profiles) console.log(`   ${p.active ? 'ativo  ' : 'inativo'} ${p.role.padEnd(8)} ${p.email}`)
  if (!active.some((p) => p.role === 'gestor')) console.log('  ! nenhum gestor ativo — veja supabase/README.md, passo 3')
}

if (process.env.DATA_SOURCE !== 'supabase') console.log('  ! DATA_SOURCE não é "supabase": o app ainda usa a memória')
process.exit(failed ? 1 : 0)
