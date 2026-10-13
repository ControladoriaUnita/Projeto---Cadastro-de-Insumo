// Verifica se alguma credencial está num arquivo que iria para o GitHub.
//
// Uso:  npm run check:secrets   (rode antes de cada commit)
//
// Olha os arquivos versionados + novos não ignorados pelo .gitignore e procura:
//  - os valores reais do .env.local (token de integração, senha, chaves do Supabase);
//  - variáveis sensíveis preenchidas fora do .env.local;
//  - tokens escritos direto no código.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const SECRET_KEYS = ['UAU_INTEGRATION_TOKEN', 'UAU_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'GRAPH_CLIENT_SECRET']
const secrets = []
for (const envFile of ['.env.local', '.env']) {
  const p = join(root, envFile)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m || !SECRET_KEYS.includes(m[1])) continue
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    if (value.length >= 8) secrets.push({ name: `${m[1]} (${envFile})`, value })
  }
}

const PATTERNS = [
  { name: 'variável sensível preenchida', re: /^[ \t]*(UAU_INTEGRATION_TOKEN|UAU_PASSWORD|SUPABASE_SERVICE_ROLE_KEY|GRAPH_CLIENT_SECRET)[ \t]*=[ \t]*['"]?[^'"\s]{6,}/m },
  { name: 'header X-INTEGRATION com valor fixo', re: /X-INTEGRATION-Authorization['"]?\s*[:=,]\s*['"]eyJ/i },
  { name: 'token JWE/JWT escrito no código', re: /['"`]eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_.-]{20,}/ },
]

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const hits = []
for (const rel of files) {
  const p = join(root, rel)
  if (!existsSync(p) || statSync(p).size > 5_000_000) continue
  const buf = readFileSync(p)
  if (buf.includes(0)) continue // binário (imagens)
  const text = buf.toString('utf8')
  for (const s of secrets) if (text.includes(s.value)) hits.push(`${rel}: contém o valor de ${s.name}`)
  for (const pt of PATTERNS) if (pt.re.test(text)) hits.push(`${rel}: ${pt.name}`)
}

if (hits.length) {
  console.error('BLOQUEADO — possíveis credenciais em arquivos que iriam para o GitHub:\n')
  for (const h of hits) console.error(`  ${h}`)
  console.error('\nRemova do arquivo e mantenha os valores só no .env.local.')
  process.exit(1)
}
console.log(`OK — ${files.length} arquivo(s) verificados, nenhuma credencial encontrada (${secrets.length} valor(es) do .env.local conferidos).`)
