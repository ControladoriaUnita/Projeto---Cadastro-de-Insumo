/**
 * Rascunho do cadastro do insumo: montado pelo analista, revisado pelo gestor e só então
 * enviado ao UAU. Aqui ficam o formato do rascunho e todas as validações (erros bloqueiam,
 * avisos só alertam). A mesma regra roda na tela e no servidor.
 */
import { CONTROLS, GROUPS, PAYMENT_BASIS, PAYMENT_TYPES, type CatalogItem } from './catalog'
import { categoryCode } from './categories'
import { CODE_PATTERN, CODE_PREFIXES, PREFIXES, nextFreeCode, normalizeCode, prefixOf } from './code'
import { IDENTICAL_SCORE, findSimilar, type SimilarItem } from './similarity'
import { squish } from './text'

/** Campos de um insumo do catálogo que não fazem parte do cadastro (vêm do UAU). */
type CatalogOnly = 'codigo' | 'ativo' | 'confirmado'

/**
 * O rascunho é um insumo do catálogo em criação: mesmos campos, mais o código novo e o modelo.
 * Por isso copiar de um insumo existente traz tudo de uma vez (ver draftFromModel).
 */
export interface InsumoDraft extends Omit<CatalogItem, CatalogOnly> {
  /** Insumo existente usado como base (só referência; não vai para o UAU) */
  modeloCodigo: string
  codigo: string
}

export type DraftField = keyof InsumoDraft

export const EMPTY_DRAFT: InsumoDraft = {
  modeloCodigo: '',
  codigo: '',
  descricao: '',
  unidade: '',
  categoria: '',
  grupo: null,
  controle: null,
  tipoPagamento: null,
  controlaEstoque: null,
  preco: '',
  cap: '',
  capAplicacao: '',
  capEstorno: '',
  capTransacaoFinanceira: '',
  categoriaMovFin: '',
  ncm: '',
  cest: '',
  diasDeCompra: null,
  diasUtilizacao: null,
  diasEntrega: null,
  numeroDeCompras: null,
  numeroPagamentos: null,
  pagamentoSobre: null,
  frequenciaCompra: '',
  comoPagar: '',
  calcEncargo: null,
  patrimonio: null,
  controlarPrecoMeta: false,
  itemManutencao: false,
}

/**
 * Copia TODAS as informações de um insumo existente (inclusive descrição e preço, que
 * normalmente são o que muda). Só o código continua o do rascunho.
 */
export function draftFromModel(model: CatalogItem): Omit<InsumoDraft, 'codigo'> {
  const { codigo, ativo: _ativo, confirmado: _confirmado, ...fields } = model
  return { ...fields, modeloCodigo: codigo }
}

/** Completa campos ausentes (rascunhos antigos), limpa espaços e padroniza códigos. */
export function normalizeDraft(draft: Partial<InsumoDraft>): InsumoDraft {
  const merged = { ...EMPTY_DRAFT, ...draft }
  const trimmed = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, typeof v === 'string' ? squish(v) : v])) as unknown as InsumoDraft
  return { ...trimmed, codigo: normalizeCode(trimmed.codigo), modeloCodigo: normalizeCode(trimmed.modeloCodigo) }
}

// ----------------------------------------------------------------------------- índice do catálogo

export interface CatalogIndex {
  items: CatalogItem[]
  byCode: Map<string, CatalogItem>
  units: Set<string>
  categories: Set<string>
  caps: Set<string>
  maxDescriptionLength: number
}

export function buildCatalogIndex(items: CatalogItem[]): CatalogIndex {
  return {
    items,
    byCode: new Map(items.map((i) => [i.codigo, i])),
    units: new Set(items.map((i) => i.unidade).filter(Boolean)),
    categories: new Set(items.map((i) => i.categoria).filter(Boolean)),
    caps: new Set(items.map((i) => i.cap).filter(Boolean)),
    maxDescriptionLength: items.reduce((max, i) => Math.max(max, i.descricao.length), 0),
  }
}

/** Próximo código livre de cada prefixo, considerando o UAU e os códigos reservados. */
export function suggestCodes(index: CatalogIndex, reserved: Iterable<string>): Record<string, string | null> {
  const used = [...index.byCode.keys(), ...reserved]
  return Object.fromEntries(CODE_PREFIXES.map((p) => [p, nextFreeCode(p, used)]))
}

// ----------------------------------------------------------------------------- validação

export interface DraftIssue {
  field?: DraftField
  message: string
}

export interface DraftValidation {
  ok: boolean
  errors: DraftIssue[]
  warnings: DraftIssue[]
  similar: SimilarItem[]
  /** Próximo código livre do prefixo informado */
  suggestedCode: string | null
}

export interface ValidationContext {
  index: CatalogIndex
  /** Códigos já usados por outros cadastros em andamento → rótulo da solicitação (ex.: "#0012") */
  reserved: Map<string, string>
}

const MIN_DESCRIPTION = 5
const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === ''

export function validateDraft(raw: InsumoDraft, { index, reserved }: ValidationContext): DraftValidation {
  const d = normalizeDraft(raw)
  const errors: DraftIssue[] = []
  const warnings: DraftIssue[] = []
  const error = (field: DraftField | undefined, message: string) => errors.push({ field, message })
  const warn = (field: DraftField | undefined, message: string) => warnings.push({ field, message })

  // Código
  const prefix = prefixOf(d.codigo)
  const suggestedCode = prefix ? nextFreeCode(prefix, [...index.byCode.keys(), ...reserved.keys()]) : null
  if (!d.codigo) error('codigo', 'Informe o código.')
  else if (!CODE_PATTERN.test(d.codigo)) {
    error('codigo', `Código fora do padrão: prefixo (${CODE_PREFIXES.join(', ')}) + 5 dígitos, ex.: IM10733.`)
  } else if (index.byCode.has(d.codigo)) {
    error('codigo', `O código ${d.codigo} já existe no UAU: ${index.byCode.get(d.codigo)!.descricao}.`)
  } else if (reserved.has(d.codigo)) {
    error('codigo', `O código ${d.codigo} está reservado pela solicitação ${reserved.get(d.codigo)}.`)
  } else if (suggestedCode && d.codigo !== suggestedCode) {
    warn('codigo', `O próximo código livre de ${prefix} é ${suggestedCode}; você está usando ${d.codigo}.`)
  }

  // Descrição
  if (!d.descricao) error('descricao', 'Informe a descrição.')
  else if (d.descricao.length < MIN_DESCRIPTION) error('descricao', 'Descrição muito curta.')
  else if (index.maxDescriptionLength && d.descricao.length > index.maxDescriptionLength) {
    warn('descricao', `Descrição com ${d.descricao.length} caracteres; a maior do UAU tem ${index.maxDescriptionLength}. O UAU pode cortar ou recusar.`)
  }

  // Classificação
  if (!d.unidade) error('unidade', 'Informe a unidade.')
  else if (!index.units.has(d.unidade)) {
    warn('unidade', `Nenhum insumo usa a unidade "${d.unidade}". Confira se ela existe no UAU (maiúsculas e minúsculas contam).`)
  }
  if (!d.categoria) error('categoria', 'Informe a categoria.')
  else if (!index.categories.has(categoryCode(d.categoria))) warn('categoria', `Nenhum insumo usa a categoria "${d.categoria}". Confira se ela existe no UAU.`)

  if (d.grupo === null) error('grupo', 'Informe o grupo.')
  else if (!(d.grupo in GROUPS)) error('grupo', 'Grupo inválido.')
  if (d.controle !== null && !(d.controle in CONTROLS)) error('controle', 'Controle inválido.')
  if (d.tipoPagamento !== null && !(d.tipoPagamento in PAYMENT_TYPES)) error('tipoPagamento', 'Tipo de pagamento inválido.')
  // Regra do UAU: "Insumo com o tipo 1 - Medição não pode ter o tipo de controle 1 - Qtde."
  if (d.tipoPagamento === 1 && d.controle === 1) {
    error('controle', 'Com tipo de pagamento Medição, o UAU não aceita controle por quantidade. Use "Por verba" ou troque o tipo de pagamento.')
  }
  if (d.controlaEstoque !== null && d.controlaEstoque !== 0 && d.controlaEstoque !== 1) error('controlaEstoque', 'Valor inválido.')

  const usual = prefix ? PREFIXES[prefix].usualGroups : []
  if (usual.length && d.grupo !== null && !usual.includes(d.grupo)) {
    warn('grupo', `Código ${prefix} costuma ser do grupo ${usual.map((g) => GROUPS[g]).join(' ou ')}; o escolhido foi ${GROUPS[d.grupo] ?? d.grupo}.`)
  }

  // Prazos e pagamento
  const counts: DraftField[] = ['diasDeCompra', 'diasUtilizacao', 'diasEntrega', 'numeroDeCompras', 'numeroPagamentos']
  for (const f of counts) {
    const v = d[f]
    if (typeof v === 'number' && (!Number.isInteger(v) || v < 0)) error(f, 'Use um número inteiro, zero ou maior.')
  }
  if (d.pagamentoSobre !== null && !(d.pagamentoSobre in PAYMENT_BASIS)) error('pagamentoSobre', 'Valor inválido.')

  // Contábil e fiscal
  if (d.cap && !index.caps.has(d.cap)) warn('cap', `Nenhum insumo usa o CAP "${d.cap}".`)
  if (d.ncm && !/^\d{8}$/.test(d.ncm.replace(/\./g, ''))) warn('ncm', 'NCM normalmente tem 8 dígitos.')
  if (!isBlank(d.preco) && !/^\d{1,12}(\.\d{1,4})?$/.test(d.preco)) error('preco', 'Preço inválido.')

  // Duplicidade
  const similar = d.descricao ? findSimilar(d.descricao, index.items) : []
  const identical = similar.find((s) => s.score === IDENTICAL_SCORE)
  if (identical) error('descricao', `Já existe insumo com a mesma descrição: ${identical.codigo}.`)
  else if (similar.length) warn('descricao', `${similar.length} insumo(s) com descrição parecida. Confira se não é duplicado.`)

  return { ok: errors.length === 0, errors, warnings, similar, suggestedCode }
}
