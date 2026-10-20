// Gera public/manual-cadastro-de-insumos.pdf a partir da rota /manual (os mesmos slides da aba Instruções).
// Uso: com o app rodando (npm run dev), `npm run manual:pdf` ou `node scripts/build-manual-pdf.mjs <url>`.
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.argv[2] ?? 'http://localhost:5174/manual'
const out = resolve('public/manual-cadastro-de-insumos.pdf')

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const browser = browsers.find((p) => existsSync(p))
if (!browser) {
  console.error('Nenhum Chrome/Edge encontrado. Informe o caminho em CHROME_PATH.')
  process.exit(1)
}

execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  // Tempo para o React montar e as imagens carregarem antes de imprimir
  '--virtual-time-budget=15000',
  `--print-to-pdf=${out}`,
  url,
], { stdio: 'inherit' })

console.log(`Manual gerado: ${out} (${Math.round(statSync(out).size / 1024)} KB)`)
