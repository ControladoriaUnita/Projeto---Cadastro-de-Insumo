/**
 * Código do insumo no UAU: prefixo + 5 dígitos (ex.: IM10733).
 */

export type CodePrefix = 'IM' | 'IS' | 'IP' | 'TR'

export interface PrefixInfo {
  label: string
  /** Grupos (Tipo_ins) habituais para o prefixo; vazio = qualquer um */
  usualGroups: number[]
}

export const PREFIXES: Record<CodePrefix, PrefixInfo> = {
  IM: { label: 'Materiais', usualGroups: [3] },
  IS: { label: 'Serviços', usualGroups: [4, 5] },
  IP: { label: 'Despesas indiretas (ex.: aluguel, consultoria)', usualGroups: [] },
  TR: { label: 'Tributos', usualGroups: [] },
}

export const CODE_PREFIXES = Object.keys(PREFIXES) as CodePrefix[]

export const CODE_PATTERN = /^(IM|IS|IP|TR)\d{5}$/

export const isCodePrefix = (v: unknown): v is CodePrefix => typeof v === 'string' && v in PREFIXES

export function normalizeCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase()
}

export function prefixOf(code: string): CodePrefix | null {
  const p = normalizeCode(code).slice(0, 2)
  return isCodePrefix(p) ? p : null
}

const MAX_NUMBER = 99999

/**
 * Próximo código livre do prefixo: a partir do MENOR número já usado, devolve a primeira
 * lacuna da sequência; sem lacunas, o maior + 1. Assim a numeração vai sendo completada
 * e depois segue crescente (ex.: IM00001, IM00002, IM00004 → IM00003).
 * `used` deve conter os códigos do UAU e os reservados por outros cadastros em andamento.
 */
export function nextFreeCode(prefix: CodePrefix, used: Iterable<string>): string | null {
  const re = new RegExp(`^${prefix}(\\d{5})$`)
  const numbers = new Set<number>()
  for (const code of used) {
    const m = re.exec(normalizeCode(code))
    if (m) numbers.add(Number(m[1]))
  }
  const start = numbers.size ? Math.min(...numbers) : 1
  for (let n = start; n <= MAX_NUMBER; n++) {
    if (!numbers.has(n)) return prefix + String(n).padStart(5, '0')
  }
  return null
}
