/**
 * Corpos enviados ao UAU. Ficam no domínio para que o gestor veja, antes de aprovar,
 * exatamente o JSON que será gravado.
 *
 * Aprovação em dois passos:
 *   1. InsumosGeral/InserirInsumosGeral   → cria o insumo ativo e "pendente/não confirmado" (confirmado = 0)
 *   2. InsumosGeral/AtualizarInsumosGeral → muda a situação para "confirmado" (confirmado = 1)
 */
import { categoryCode } from './categories'
import { normalizeDraft, type InsumoDraft } from './draft'

export const UAU_ROUTES = {
  listCatalog: 'InsumosGeral/ConsultarInsumosGeralPorDescricao',
  insert: 'InsumosGeral/InserirInsumosGeral',
  updateStatus: 'InsumosGeral/AtualizarInsumosGeral',
} as const

/** Status do insumo no UAU (campo status / AtInat_ins) */
export const UAU_STATUS = { active: 0, inactive: 1 } as const
/** Situação de confirmação (campo confirmado / Conf_ins) */
export const UAU_CONFIRMATION = { pending: 0, confirmed: 1 } as const

export type UauInsertBody = Record<string, string | number | boolean>

export interface UauConfirmBody {
  listaInsumosAtualizar: { codigo: string; confirmado: number }[]
}

/**
 * Corpo de InserirInsumosGeral. Campos vazios não são enviados (o UAU usa o padrão dele).
 * `today` em aaaa-mm-dd: data da cotação quando há preço.
 */
export function buildInsertBody(raw: InsumoDraft, opts: { uauUser: string; today: string }): UauInsertBody {
  const d = normalizeDraft(raw)
  const body: UauInsertBody = {
    codigo: d.codigo,
    descricao: d.descricao,
    unidade: d.unidade,
    usuario: opts.uauUser,
    status: UAU_STATUS.active,
    confirmado: UAU_CONFIRMATION.pending,
  }
  // Nome do campo na rota de inserção → valor do rascunho
  const optional: [string, string | number | boolean | null][] = [
    ['grupo', d.grupo],
    // De-para: a tela trabalha com a descrição da categoria; o UAU recebe o código
    ['CategoriaDoInsumo', categoryCode(d.categoria)],
    ['controle', d.controle],
    ['tipoPagamento', d.tipoPagamento],
    ['controlaEstoque', d.controlaEstoque],
    ['CAP', d.cap],
    ['CAPAplicacaoMaterial', d.capAplicacao],
    ['CAPEstorno', d.capEstorno],
    ['CAPTransacaoFinanceira', d.capTransacaoFinanceira],
    ['categoriaMovFin', d.categoriaMovFin],
    ['NCM', d.ncm],
    ['CEST', d.cest],
    ['diasDeCompra', d.diasDeCompra],
    ['diasUtilizacao', d.diasUtilizacao],
    ['diasEntrega', d.diasEntrega],
    ['numeroDeCompras', d.numeroDeCompras],
    ['numeroPagamentos', d.numeroPagamentos],
    ['pagamentoSobre', d.pagamentoSobre],
    ['frequenciaCompra', d.frequenciaCompra],
    ['comoPagar', d.comoPagar],
    ['calcEncargo', d.calcEncargo],
    ['patrimonio', d.patrimonio],
    ['controlarPrecoMeta', d.controlarPrecoMeta],
    ['itemManutencao', d.itemManutencao],
  ]
  for (const [key, value] of optional) if (value !== null && value !== '') body[key] = value
  if (d.preco) {
    body.preco = d.preco
    body.dataCotacao = opts.today
  }
  return body
}

/** Corpo de AtualizarInsumosGeral que muda a situação do insumo para confirmado. */
export function buildConfirmBody(codigo: string): UauConfirmBody {
  return { listaInsumosAtualizar: [{ codigo, confirmado: UAU_CONFIRMATION.confirmed }] }
}
