/**
 * UauGateway real: lê o cadastro geral de insumos e grava (inserção + confirmação) na API UAU.
 */
import { fromUauRow, type CatalogItem } from '../../../shared/domain/insumo/catalog'
import { normalizeCode } from '../../../shared/domain/insumo/code'
import { UAU_ROUTES, type UauConfirmBody, type UauInsertBody } from '../../../shared/domain/insumo/uau-payload'
import { IntegrationError } from '../../application/context'
import type { CatalogSnapshot, UauGateway, UauWriteResult } from '../../application/ports'
import { UauClient, extractRows, type UauConfig } from './uau-client'

const CATALOG_TTL_MS = 10 * 60 * 1000
// O cadastro inteiro (~13 mil insumos) leva alguns segundos
const CATALOG_TIMEOUT_MS = 180_000

interface CatalogCache extends CatalogSnapshot {
  at: number
  raw: Map<string, Record<string, unknown>>
}

const withoutEmpty = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== ''))

export class HttpUauGateway implements UauGateway {
  readonly mode = 'real' as const
  readonly writeEnabled: boolean
  readonly user: string
  private readonly client: UauClient
  private cache: CatalogCache | null = null
  private loading: Promise<CatalogCache> | null = null

  constructor(config: UauConfig) {
    this.client = new UauClient(config)
    this.writeEnabled = config.writeEnabled
    this.user = config.login
  }

  async loadCatalog({ refresh = false } = {}): Promise<CatalogSnapshot> {
    if (!refresh && this.cache && Date.now() - this.cache.at < CATALOG_TTL_MS) return this.cache
    // Pedidos simultâneos compartilham a mesma leitura
    this.loading ??= this.readCatalog().finally(() => {
      this.loading = null
    })
    return this.loading
  }

  /**
   * A API não tem "listar todos": descrição "%" (LIKE '%%') traz o cadastro inteiro.
   * Descrição vazia responde HTTP 400.
   */
  private async readCatalog(): Promise<CatalogCache> {
    const res = await this.client.call(UAU_ROUTES.listCatalog, { Descricao: '%' }, { timeoutMs: CATALOG_TIMEOUT_MS })
    if (!res.ok) throw new IntegrationError(`O UAU não devolveu o cadastro de insumos (HTTP ${res.status}).`)
    const raw = new Map<string, Record<string, unknown>>()
    const items: CatalogItem[] = []
    for (const row of extractRows(res.data)) {
      const item = fromUauRow(row)
      if (!item.codigo || raw.has(item.codigo)) continue
      raw.set(item.codigo, withoutEmpty(row))
      items.push(item)
    }
    this.cache = { items, raw, loadedAt: new Date().toISOString(), at: Date.now() }
    return this.cache
  }

  async getRawItem(codigo: string) {
    if (!this.cache) await this.loadCatalog()
    return this.cache?.raw.get(normalizeCode(codigo)) ?? null
  }

  /**
   * Relê o cadastro inteiro (sem cache) e procura o código. A API não tem consulta por código
   * confiável: ConsultarInsumosGeral devolve vazio mesmo para códigos existentes e
   * ConsultarInsumosGeralPorChave exige os campos da inserção.
   */
  async findByCode(codigo: string): Promise<CatalogItem | null> {
    const code = normalizeCode(codigo)
    const snapshot = await this.loadCatalog({ refresh: true })
    return snapshot.items.find((i) => i.codigo === code) ?? null
  }

  insert(body: UauInsertBody): Promise<UauWriteResult> {
    return this.write(UAU_ROUTES.insert, body)
  }

  confirm(body: UauConfirmBody): Promise<UauWriteResult> {
    return this.write(UAU_ROUTES.updateStatus, body)
  }

  invalidateCatalog() {
    this.cache = null
  }

  private async write(route: string, body: unknown): Promise<UauWriteResult> {
    const res = await this.client.call(route, body)
    return { ok: res.ok, status: res.status, response: res.data }
  }
}
