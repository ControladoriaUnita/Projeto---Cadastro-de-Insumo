/**
 * Formatação pt-BR (padrão Unità — docs/DESIGN_SYSTEM.md §10), sem float para valores monetários.
 * Valores decimais trafegam como string canônica com ponto ("1234.56").
 */

export const EMPTY = '—'

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "1234.5" → "1.234,50" */
export function formatDecimal(value: string | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || value.trim() === '') return EMPTY
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!m) return EMPTY
  const frac = (m[3] ?? '').padEnd(fractionDigits, '0').slice(0, fractionDigits)
  return `${m[1]}${groupThousands(m[2]!.replace(/^0+(?=\d)/, ''))}${fractionDigits ? ',' + frac : ''}`
}

/** "1234.5" → "R$ 1.234,50" */
export function formatBRL(value: string | null | undefined): string {
  const s = formatDecimal(value)
  if (s === EMPTY) return s
  return s.startsWith('-') ? `-R$ ${s.slice(1)}` : `R$ ${s}`
}

/**
 * Entrada do usuário → string canônica, sem float.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 150.000" (= cento e cinquenta mil).
 * Devolve null quando o texto não é um número válido.
 */
export function parseDecimalBR(input: string): string | null {
  let s = input.replace(/R\$|\s/g, '')
  if (!s) return null
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const [int, frac] = s.split('.')
  const normalized = int!.replace(/^0+(?=\d)/, '') + (frac ? '.' + frac : '')
  return neg ? '-' + normalized : normalized
}

/** Inteiro com separador de milhar: 13090 → "13.090" */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return groupThousands(String(Math.trunc(value)))
}

/** "2026-09-01" → "01/09/2026" (sem Date → sem fuso). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : EMPTY
}

/** Data e hora curtas no fuso de São Paulo. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return EMPTY
  // "28/09/2026 10:32" (o Intl coloca vírgula entre data e hora)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace(', ', ' ')
}

/** Número da solicitação: 7 → "#0007" */
export function formatRequestNumber(n: number): string {
  return `#${String(n).padStart(4, '0')}`
}
