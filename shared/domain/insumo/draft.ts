/**
 * Rascunho do cadastro do insumo: montado pelo analista, revisado pelo gestor e só então
 * enviado ao UAU. Aqui ficam o formato do rascunho e todas as validações (erros bloqueiam —
 * só quando o insumo já existe no UAU ou o UAU não teria como gravá-lo —, avisos só alertam).
 * A mesma regra roda na tela e no servidor.
 */
import { CONTROLS, GROUPS, PAYMENT_BASIS, PAYMENT_TYPES, type CatalogItem } from './catalog'
import { categoryCode } from './categories'
import { CODE_PATTERN, CODE_PREFIXES, PREFIXES, nextFreeCode, normalizeCode, prefixOf } from './code'
import { IDENTICAL_SCORE, findSimilar, type SimilarItem } from './similarity'
import { searchText, squish } from './text'

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
  /** Descrição comparável (ver descriptionKey) → insumos do UAU com ela */
  byDescription: Map<string, CatalogItem[]>
  units: Set<string>
  categories: Set<string>
  caps: Set<string>
  maxDescriptionLength: number
}

/**
 * Chave de "mesma descrição": sem acento, maiúsculas ou espaços repetidos, com "1,60" = "1.60"
 * e "×" = "x". Pontuação, ordem das palavras e medidas continuam contando: outro insumo.
 */
export const descriptionKey = (descricao: string) => searchText(descricao)

export function buildCatalogIndex(items: CatalogItem[]): CatalogIndex {
  const byDescription = new Map<string, CatalogItem[]>()
  for (const i of items) {
    const key = descriptionKey(i.descricao)
    if (key) byDescription.set(key, [...(byDescription.get(key) ?? []), i])
  }
  return {
    items,
    byCode: new Map(items.map((i) => [normalizeCode(i.codigo), i])),
    byDescription,
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
  /** true = pode enviar e aprovar. Só fica false se o insumo já existe no UAU (ou o UAU não teria como gravá-lo). */
  ok: boolean
  /** O insumo já existe no UAU (mesmo código ou mesma descrição): o único impedimento de negócio */
  existsInUau: boolean
  /** Bloqueiam: o insumo já existe no UAU, ou falta algo sem o qual a gravação no UAU não acontece */
  errors: DraftIssue[]
  /** Só alertam: nada aqui impede o cadastro */
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
const situation = (i: CatalogItem) => (i.ativo ? '' : ' (inativo)')

/**
 * Regra do cadastro: o ÚNICO impedimento de negócio é o insumo já existir no UAU —
 * mesmo código, ou mesma descrição (ver descriptionKey), ativo ou inativo.
 * Além disso só bloqueia o que faria a gravação no UAU falhar ou sair errada:
 * código, descrição e unidade em branco (o UAU exige), código em uso por outro cadastro
 * em andamento (dois insumos não podem ter o mesmo código; o banco também recusa),
 * valores fora das listas do UAU e a combinação Medição + controle por quantidade (o UAU recusa).
 * Todo o resto é aviso.
 */
export function validateDraft(raw: InsumoDraft, { index, reserved }: ValidationContext): DraftValidation {
  const d = normalizeDraft(raw)
  const errors: DraftIssue[] = []
  const warnings: DraftIssue[] = []
  const error = (field: DraftField | undefined, message: string) => errors.push({ field, message })
  const warn = (field: DraftField | undefined, message: string) => warnings.push({ field, message })

  // Já existe no UAU (o que de fato impede o cadastro)
  const sameCode = d.codigo ? index.byCode.get(d.codigo) : undefined
  if (sameCode) error('codigo', `O código ${d.codigo} já existe no UAU${situation(sameCode)}: ${sameCode.descricao}.`)
  const sameDescription = d.descricao ? (index.byDescription.get(descriptionKey(d.descricao)) ?? []) : []
  if (sameDescription.length) {
    const list = sameDescription.map((i) => `${i.codigo}${situation(i)}`).join(', ')
    error('descricao', `Este insumo já existe no UAU com a mesma descrição: ${list}.`)
  }

  // Código
  const prefix = prefixOf(d.codigo)
  const suggestedCode = prefix ? nextFreeCode(prefix, [...index.byCode.keys(), ...reserved.keys()]) : null
  if (!d.codigo) error('codigo', 'Informe o código (o UAU exige).')
  else if (sameCode) {
    // já informado acima
  } else if (reserved.has(d.codigo)) {
    error('codigo', `O código ${d.codigo} já está no cadastro da solicitação ${reserved.get(d.codigo)}. Use outro${suggestedCode ? ` (próximo livre: ${suggestedCode})` : ''}.`)
  } else if (!CODE_PATTERN.test(d.codigo)) {
    warn('codigo', `Código fora do padrão: prefixo (${CODE_PREFIXES.join(', ')}) + 5 dígitos, ex.: IM10733.`)
  } else if (suggestedCode && d.codigo !== suggestedCode) {
    warn('codigo', `O próximo código livre de ${prefix} é ${suggestedCode}; você está usando ${d.codigo}.`)
  }

  // Descrição
  if (!d.descricao) error('descricao', 'Informe a descrição (o UAU exige).')
  else if (d.descricao.length < MIN_DESCRIPTION) warn('descricao', 'Descrição muito curta.')
  else if (index.maxDescriptionLength && d.descricao.length > index.maxDescriptionLength) {
    warn('descricao', `Descrição com ${d.descricao.length} caracteres; a maior do UAU tem ${index.maxDescriptionLength}. O UAU pode cortar ou recusar.`)
  }

  // Classificação
  if (!d.unidade) error('unidade', 'Informe a unidade (o UAU exige).')
  else if (!index.units.has(d.unidade)) {
    warn('unidade', `Nenhum insumo usa a unidade "${d.unidade}". Confira se ela existe no UAU (maiúsculas e minúsculas contam).`)
  }
  if (!d.categoria) warn('categoria', 'Sem categoria: o UAU usará o padrão dele.')
  else if (!index.categories.has(categoryCode(d.categoria))) warn('categoria', `Nenhum insumo usa a categoria "${d.categoria}". Confira se ela existe no UAU.`)

  if (d.grupo === null) warn('grupo', 'Sem grupo: o UAU usará o padrão dele.')
  else if (!(d.grupo in GROUPS)) error('grupo', 'Grupo inválido para o UAU.')
  if (d.controle !== null && !(d.controle in CONTROLS)) error('controle', 'Controle inválido para o UAU.')
  if (d.tipoPagamento !== null && !(d.tipoPagamento in PAYMENT_TYPES)) error('tipoPagamento', 'Tipo de pagamento inválido para o UAU.')
  // Regra do UAU: "Insumo com o tipo 1 - Medição não pode ter o tipo de controle 1 - Qtde."
  if (d.tipoPagamento === 1 && d.controle === 1) {
    error('controle', 'Com tipo de pagamento Medição, o UAU não aceita controle por quantidade. Use "Por verba" ou troque o tipo de pagamento.')
  }
  if (d.controlaEstoque !== null && d.controlaEstoque !== 0 && d.controlaEstoque !== 1) error('controlaEstoque', 'Valor inválido para o UAU.')

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
  if (d.pagamentoSobre !== null && !(d.pagamentoSobre in PAYMENT_BASIS)) error('pagamentoSobre', 'Valor inválido para o UAU.')

  // Contábil e fiscal
  if (d.cap && !index.caps.has(d.cap)) warn('cap', `Nenhum insumo usa o CAP "${d.cap}".`)
  if (d.ncm && !/^\d{8}$/.test(d.ncm.replace(/\./g, ''))) warn('ncm', 'NCM normalmente tem 8 dígitos.')
  if (!isBlank(d.preco) && !/^\d{1,12}(\.\d{1,4})?$/.test(d.preco)) error('preco', 'Preço inválido para o UAU.')

  // Parecidos: só alerta (a mesma descrição já foi tratada acima)
  const similar = d.descricao ? findSimilar(d.descricao, index.items) : []
  const parecidos = similar.filter((s) => s.score < IDENTICAL_SCORE)
  if (parecidos.length) warn('descricao', `${parecidos.length} insumo(s) com descrição parecida no UAU. Confira se não é o mesmo antes de cadastrar.`)

  return { ok: errors.length === 0, existsInUau: !!sameCode || sameDescription.length > 0, errors, warnings, similar, suggestedCode }
}
