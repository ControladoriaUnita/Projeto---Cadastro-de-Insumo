/**
 * Insumo do cadastro geral do UAU, traduzido dos nomes de coluna da API
 * (InsumosGeral/ConsultarInsumosGeralPorDescricao) para nomes legíveis.
 */

export interface CatalogItem {
  codigo: string
  descricao: string
  unidade: string
  categoria: string
  /** Tipo_ins: 1 Mão de obra · 2 Equipamentos · 3 Materiais · 4 Serviços · 5 Transporte */
  grupo: number | null
  /** G1G2_ins: 1 por quantidade · 2 por verba */
  controle: number | null
  /** TPagto_ins: 0 Cotação · 1 Medição · 2 Solicitação de pagamento */
  tipoPagamento: number | null
  /** Est_ins: 0 não controla · 1 controla */
  controlaEstoque: number | null
  ativo: boolean
  confirmado: boolean
  /** preco_ins como string canônica ("2.2") ou vazio */
  preco: string
  cap: string
  capAplicacao: string
  capEstorno: string
  capTransacaoFinanceira: string
  categoriaMovFin: string
  ncm: string
  cest: string
  // Prazos e pagamento (Compra_ins, Util_ins, Antec_ins, NCompra_ins, NTVenc_ins, DtVenc_ins, Tcompra_ins, Tvenc_ins)
  diasDeCompra: number | null
  diasUtilizacao: number | null
  diasEntrega: number | null
  numeroDeCompras: number | null
  numeroPagamentos: number | null
  /** 1 Entrega · 2 Pedido */
  pagamentoSobre: number | null
  /** Código da frequência de compra (ex.: V0001) */
  frequenciaCompra: string
  /** Código da frequência de pagamento (ex.: V0059) */
  comoPagar: string
  // Controles (Encargo_ins, Patrimonio_Ins, ControlaPrecoMeta_Ins, ItemManutPat_Ins)
  calcEncargo: number | null
  patrimonio: number | null
  controlarPrecoMeta: boolean
  itemManutencao: boolean
}

export const GROUPS: Record<number, string> = { 1: 'Mão de obra', 2: 'Equipamentos', 3: 'Materiais', 4: 'Serviços', 5: 'Transporte' }
/** Nome do grupo; o UAU tem insumos antigos com grupo 0 (não classificado). */
export function groupLabel(grupo: number | string | null): string {
  if (grupo === null || grupo === '') return '—'
  const n = Number(grupo)
  return GROUPS[n] ?? (n === 0 ? 'Sem grupo' : String(grupo))
}
export const CONTROLS: Record<number, string> = { 1: 'Por quantidade', 2: 'Por verba' }
export const PAYMENT_TYPES: Record<number, string> = { 0: 'Cotação', 1: 'Medição', 2: 'Solicitação de pagamento' }
export const PAYMENT_BASIS: Record<number, string> = { 1: 'Entrega', 2: 'Pedido' }
export const YES_NO: Record<number, string> = { 0: 'Não', 1: 'Sim' }

export type UauRow = Record<string, unknown>

const text = (v: unknown) => (v === null || v === undefined || v === 'null' ? '' : String(v).trim())
const int = (v: unknown) => {
  const s = text(v)
  return /^-?\d+$/.test(s) ? Number(s) : null
}
const flag = (v: unknown) => v === true || text(v) === '1' || text(v).toLowerCase() === 'true'
/** Preço vem como número no JSON; String() preserva o valor sem fazer conta. */
const price = (v: unknown) => {
  const s = text(v).replace(',', '.')
  return /^\d+(\.\d+)?$/.test(s) ? s : ''
}
/** pagamentoSobre só aceita 1 ou 2; o UAU às vezes guarda 0 (não definido). */
const oneOf = (v: number | null, allowed: number[]) => (v !== null && allowed.includes(v) ? v : null)

/** Linha crua do UAU → CatalogItem. Status AtInat_ins: 0 ativo, 1 inativo. */
export function fromUauRow(row: UauRow): CatalogItem {
  return {
    codigo: text(row.Cod_ins).toUpperCase(),
    descricao: text(row.Descr_ins),
    unidade: text(row.Unid_ins),
    categoria: text(row.Categ_ins),
    grupo: int(row.Tipo_ins),
    controle: int(row.G1G2_ins),
    tipoPagamento: int(row.TPagto_ins),
    controlaEstoque: int(row.Est_ins),
    ativo: (text(row.AtInat_ins) || '0') === '0',
    confirmado: flag(row.Conf_ins),
    preco: price(row.preco_ins),
    cap: text(row.Cap_ins),
    capAplicacao: text(row.CapAplic_Ins),
    capEstorno: text(row.CapEstorno_ins),
    capTransacaoFinanceira: text(row.CapTransacaoFin_ins),
    categoriaMovFin: text(row.CategMovFin_ins),
    ncm: text(row.NCM_Ins),
    cest: text(row.CEST_ins),
    diasDeCompra: int(row.Compra_ins),
    diasUtilizacao: int(row.Util_ins),
    diasEntrega: int(row.Antec_ins),
    numeroDeCompras: int(row.NCompra_ins),
    numeroPagamentos: int(row.NTVenc_ins),
    pagamentoSobre: oneOf(int(row.DtVenc_ins), [1, 2]),
    frequenciaCompra: text(row.Tcompra_ins).toUpperCase(),
    comoPagar: text(row.Tvenc_ins).toUpperCase(),
    calcEncargo: oneOf(int(row.Encargo_ins), [0, 1]),
    patrimonio: oneOf(int(row.Patrimonio_Ins), [0, 1]),
    controlarPrecoMeta: flag(row.ControlaPrecoMeta_Ins),
    itemManutencao: flag(row.ItemManutPat_Ins),
  }
}

/** Valores distintos de um campo e quantos insumos usam cada um (mais usados primeiro). */
export function countValues(items: CatalogItem[], pick: (i: CatalogItem) => string | number | null): { value: string; count: number }[] {
  const m = new Map<string, number>()
  for (const i of items) {
    const v = pick(i)
    if (v === null || v === '') continue
    m.set(String(v), (m.get(String(v)) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }))
}
