/**
 * Planilha de importação de solicitações: colunas do modelo e leitura das linhas.
 * Puro (sem Excel): a tela lê o arquivo e entrega as células como texto.
 */
import { REQUEST_KINDS, REQUESTABLE_KINDS, URGENCIES, type RequestKind, type Urgency } from './kinds'

/** Máximo de insumos enviados de uma vez (tela e API). */
export const MAX_BATCH_ITEMS = 100

export type SheetField = 'kind' | 'description' | 'unit' | 'urgency' | 'justification' | 'specification'

export interface SheetColumn {
  field: SheetField
  header: string
  required: boolean
  hint: string
  width: number
  /** Outros nomes aceitos no cabeçalho */
  aliases: string[]
}

export const SHEET_COLUMNS: SheetColumn[] = [
  { field: 'kind', header: 'Tipo', required: true, hint: 'Material ou Serviço', width: 20, aliases: ['tipo de insumo', 'categoria'] },
  { field: 'description', header: 'Insumo', required: true, hint: 'Nome completo, ex.: Rejunte epóxi cinza platina 1kg', width: 48, aliases: ['descricao', 'descricao do insumo', 'nome', 'item'] },
  { field: 'unit', header: 'Unidade', required: true, hint: 'kg, m², un, sc, mês…', width: 12, aliases: ['un', 'und', 'unid'] },
  { field: 'urgency', header: 'Urgência', required: false, hint: 'Normal ou Urgente (vazio = Normal)', width: 12, aliases: ['prioridade'] },
  { field: 'justification', header: 'Onde será usado', required: true, hint: 'Local ou serviço em que o insumo entra', width: 40, aliases: ['justificativa', 'aplicacao', 'uso', 'local'] },
  { field: 'specification', header: 'Especificação ou marca de referência', required: false, hint: 'Opcional, ajuda o analista a classificar', width: 40, aliases: ['especificacao', 'especificacao tecnica', 'marca', 'observacao', 'observacoes'] },
]

export const SHEET_NAME = 'Insumos'
export const KIND_OPTIONS = REQUESTABLE_KINDS.map((k) => shortKindLabel(k))
export const URGENCY_OPTIONS = Object.values(URGENCIES) as string[]

/** "Despesa indireta (aluguel, consultoria…)" → "Despesa indireta" (cabe na lista do Excel). */
function shortKindLabel(k: RequestKind): string {
  return REQUEST_KINDS[k].label.replace(/\s*\(.*\)$/, '')
}

/** Sem acento, minúsculo, sem asterisco/pontuação: "Urgência *" → "urgencia". */
export function normalizeHeader(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9²³]+/g, ' ')
    .trim()
}

type SheetKind = (typeof REQUESTABLE_KINDS)[number]

function parseKind(v: string): SheetKind | null {
  const n = normalizeHeader(v)
  if (!n) return 'material'
  for (const k of REQUESTABLE_KINDS) {
    const label = normalizeHeader(shortKindLabel(k))
    if (n === label || n === normalizeHeader(k) || n === normalizeHeader(REQUEST_KINDS[k].label)) return k
  }
  if (n.startsWith('mat')) return 'material'
  if (n.startsWith('serv')) return 'servico'
  return null
}

function parseUrgency(v: string): Urgency | null {
  const n = normalizeHeader(v)
  if (!n || n === 'normal' || n === 'nao' || n === 'n') return 'normal'
  if (n === 'urgente' || n === 'sim' || n === 's' || n === 'alta') return 'urgente'
  return null
}

export interface SheetItem {
  kind: SheetKind
  urgency: Urgency
  description: string
  unit: string
  justification: string
  specification: string
}

export interface SheetRow {
  /** Número da linha na planilha (1 = cabeçalho) */
  line: number
  item: SheetItem
  /** Problemas de leitura por campo (ex.: tipo não reconhecido) */
  issues: Partial<Record<SheetField, string>>
}

export type SheetParseResult =
  | { ok: true; rows: SheetRow[]; truncated: boolean }
  | { ok: false; error: string }

/**
 * Lê as linhas da planilha (células já convertidas em texto). O cabeçalho é procurado nas
 * primeiras linhas e as colunas são achadas pelo nome, em qualquer ordem.
 */
export function parseSheetRows(cells: string[][]): SheetParseResult {
  const headerIndex = cells.slice(0, 10).findIndex((row) => row.some((c) => matchColumn(c)?.field === 'description'))
  if (headerIndex < 0) {
    return { ok: false, error: 'Não encontramos a coluna "Insumo". Use a planilha modelo e mantenha a linha de cabeçalho.' }
  }
  const positions = new Map<SheetField, number>()
  cells[headerIndex]!.forEach((c, i) => {
    const col = matchColumn(c)
    if (col && !positions.has(col.field)) positions.set(col.field, i)
  })
  const missing = SHEET_COLUMNS.filter((c) => c.required && !positions.has(c.field)).map((c) => `"${c.header}"`)
  if (missing.length) {
    return { ok: false, error: `Faltam colunas obrigatórias: ${missing.join(', ')}. Use a planilha modelo.` }
  }

  const get = (row: string[], f: SheetField) => {
    const i = positions.get(f)
    return i === undefined ? '' : (row[i] ?? '').replace(/\s+/g, ' ').trim()
  }

  const rows: SheetRow[] = []
  let truncated = false
  cells.slice(headerIndex + 1).forEach((row, offset) => {
    if (SHEET_COLUMNS.every((c) => !get(row, c.field))) return
    if (rows.length >= MAX_BATCH_ITEMS) {
      truncated = true
      return
    }
    const issues: SheetRow['issues'] = {}
    const kind = parseKind(get(row, 'kind'))
    if (!kind) issues.kind = `Tipo "${get(row, 'kind')}" não reconhecido. Use ${KIND_OPTIONS.join(', ')}.`
    const urgency = parseUrgency(get(row, 'urgency'))
    if (!urgency) issues.urgency = `Urgência "${get(row, 'urgency')}" não reconhecida. Use Normal ou Urgente.`
    rows.push({
      line: headerIndex + offset + 2,
      item: {
        kind: kind ?? 'material',
        urgency: urgency ?? 'normal',
        description: get(row, 'description'),
        unit: get(row, 'unit'),
        justification: get(row, 'justification'),
        specification: get(row, 'specification'),
      },
      issues,
    })
  })
  if (!rows.length) return { ok: false, error: 'A planilha não tem nenhum insumo preenchido abaixo do cabeçalho.' }
  return { ok: true, rows, truncated }
}

function matchColumn(cell: string): SheetColumn | undefined {
  const n = normalizeHeader(cell)
  if (!n) return undefined
  return SHEET_COLUMNS.find((c) => normalizeHeader(c.header) === n || c.aliases.includes(n))
}
