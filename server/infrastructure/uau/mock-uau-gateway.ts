/**
 * UauGateway simulado (UAU_MODE=mock): catálogo de exemplo em memória. Inserções e confirmações
 * alteram só essa memória, para exercitar o fluxo completo sem tocar no UAU real.
 */
import { fromUauRow, type CatalogItem } from '../../../shared/domain/insumo/catalog'
import { normalizeCode } from '../../../shared/domain/insumo/code'
import { UAU_CONFIRMATION, type UauConfirmBody, type UauInsertBody } from '../../../shared/domain/insumo/uau-payload'
import type { CatalogSnapshot, UauGateway, UauWriteResult } from '../../application/ports'
import { SAMPLE_CATALOG } from './sample-catalog'

export class MockUauGateway implements UauGateway {
  readonly mode = 'mock' as const
  readonly writeEnabled = true
  readonly user = 'PORTAL'
  /** Para testes: a próxima chamada desse tipo falha */
  failNext: { insert?: boolean; confirm?: boolean } = {}
  private rows = new Map<string, Record<string, unknown>>()
  private loadedAt = new Date().toISOString()

  constructor(rows: Record<string, unknown>[] = SAMPLE_CATALOG) {
    for (const row of rows) this.rows.set(normalizeCode(row.Cod_ins), { ...row })
  }

  async loadCatalog(): Promise<CatalogSnapshot> {
    return { items: [...this.rows.values()].map(fromUauRow), loadedAt: this.loadedAt }
  }

  async getRawItem(codigo: string) {
    return this.rows.get(normalizeCode(codigo)) ?? null
  }

  async findByCode(codigo: string): Promise<CatalogItem | null> {
    const row = this.rows.get(normalizeCode(codigo))
    return row ? fromUauRow(row) : null
  }

  async insert(body: UauInsertBody): Promise<UauWriteResult> {
    if (this.consumeFailure('insert')) return { ok: false, status: 500, response: { Mensagem: 'Falha simulada na inserção.' } }
    const code = normalizeCode(body.codigo)
    if (this.rows.has(code)) return { ok: false, status: 400, response: { Mensagem: `Insumo ${code} já cadastrado.` } }
    this.rows.set(code, {
      Cod_ins: code,
      Descr_ins: body.descricao,
      Unid_ins: body.unidade,
      Categ_ins: body.CategoriaDoInsumo ?? '',
      Tipo_ins: body.grupo ?? '',
      G1G2_ins: body.controle ?? '',
      TPagto_ins: body.tipoPagamento ?? '',
      Est_ins: body.controlaEstoque ?? '',
      Cap_ins: body.CAP ?? '',
      CapAplic_Ins: body.CAPAplicacaoMaterial ?? '',
      NCM_Ins: body.NCM ?? '',
      AtInat_ins: body.status,
      Conf_ins: body.confirmado,
    })
    this.touch()
    return { ok: true, status: 200, response: '' }
  }

  async confirm(body: UauConfirmBody): Promise<UauWriteResult> {
    if (this.consumeFailure('confirm')) return { ok: false, status: 500, response: { Mensagem: 'Falha simulada na confirmação.' } }
    for (const item of body.listaInsumosAtualizar) {
      const row = this.rows.get(normalizeCode(item.codigo))
      if (!row) return { ok: false, status: 400, response: { Mensagem: `Insumo ${item.codigo} não encontrado.` } }
      row.Conf_ins = item.confirmado ?? UAU_CONFIRMATION.confirmed
    }
    this.touch()
    return { ok: true, status: 200, response: '' }
  }

  invalidateCatalog() {
    this.touch()
  }

  private touch() {
    this.loadedAt = new Date().toISOString()
  }

  private consumeFailure(kind: 'insert' | 'confirm'): boolean {
    if (!this.failNext[kind]) return false
    this.failNext[kind] = false
    return true
  }
}
