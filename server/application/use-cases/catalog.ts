/**
 * Casos de uso do cadastro de insumos do UAU (somente leitura): busca paginada,
 * insumos parecidos, listas para o formulário e prévia/validação do rascunho.
 */
import type {
  CatalogItemDetailDTO,
  CatalogPageDTO,
  CatalogQuery,
  DraftContextDTO,
  DraftPreviewDTO,
  SimilarItem,
} from '../../../shared/contracts'
import { countValues, type CatalogItem } from '../../../shared/domain/insumo/catalog'
import { CODE_PREFIXES, PREFIXES, normalizeCode } from '../../../shared/domain/insumo/code'
import { buildCatalogIndex, suggestCodes, validateDraft, type DraftValidation, type InsumoDraft } from '../../../shared/domain/insumo/draft'
import { findSimilar } from '../../../shared/domain/insumo/similarity'
import { fold, textMatcher, tokenize } from '../../../shared/domain/insumo/text'
import { buildConfirmBody, buildInsertBody } from '../../../shared/domain/insumo/uau-payload'
import { CODE_RESERVING_STATUSES } from '../../../shared/domain/request/workflow'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { formatRequestNumber } from '../../../shared/format'
import { notFound, requirePermission } from '../context'
import type { Repositories, UauGateway, UseCaseDeps } from '../ports'

const P = PERMISSIONS

// ----------------------------------------------------------------------------- busca

const SORTERS: Record<CatalogQuery['sort'], (i: CatalogItem) => string> = {
  codigo: (i) => i.codigo,
  descricao: (i) => fold(i.descricao),
  unidade: (i) => fold(i.unidade),
  categoria: (i) => i.categoria,
}

export async function searchCatalog({ uau, ctx }: UseCaseDeps, query: CatalogQuery): Promise<CatalogPageDTO> {
  requirePermission(ctx, P.catalogRead)
  const snapshot = await uau.loadCatalog({ refresh: query.refresh === '1' })
  const matches = textMatcher(query.q)

  const filtered = snapshot.items.filter((i) => {
    if (query.status === 'ativo' && !i.ativo) return false
    if (query.status === 'inativo' && i.ativo) return false
    if (query.categoria && i.categoria !== query.categoria) return false
    if (query.unidade && i.unidade !== query.unidade) return false
    if (query.grupo && String(i.grupo ?? '') !== query.grupo) return false
    return !matches || matches(`${i.codigo} ${i.descricao}`)
  })

  const key = SORTERS[query.sort]
  const dir = query.dir === 'desc' ? -1 : 1
  filtered.sort((a, b) => key(a).localeCompare(key(b), 'pt-BR') * dir)

  const start = (query.page - 1) * query.pageSize
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    catalogTotal: snapshot.items.length,
    page: query.page,
    pageSize: query.pageSize,
    loadedAt: snapshot.loadedAt,
    facets: {
      unidades: countValues(snapshot.items, (i) => i.unidade),
      categorias: countValues(snapshot.items, (i) => i.categoria),
      grupos: countValues(snapshot.items, (i) => i.grupo),
    },
  }
}

export async function getCatalogItem({ uau, ctx }: UseCaseDeps, codigo: string): Promise<CatalogItemDetailDTO> {
  requirePermission(ctx, P.catalogRead, P.draftEdit)
  const code = normalizeCode(codigo)
  const snapshot = await uau.loadCatalog()
  const item = snapshot.items.find((i) => i.codigo === code)
  if (!item) throw notFound(`Insumo ${code}`)
  return { item, raw: (await uau.getRawItem(code)) ?? {} }
}

/** Insumos parecidos — a obra usa antes de pedir; o analista, antes de cadastrar. */
export async function findSimilarItems({ uau, ctx }: UseCaseDeps, description: string): Promise<SimilarItem[]> {
  requirePermission(ctx, P.catalogSearch)
  if (tokenize(description).length === 0) return []
  const snapshot = await uau.loadCatalog()
  return findSimilar(description, snapshot.items, 8)
}

// ----------------------------------------------------------------------------- formulário de cadastro

/** Códigos usados por outros cadastros em andamento → número da solicitação. */
export async function reservedCodes(repos: Repositories, excludeRequestId?: string): Promise<Map<string, string>> {
  const open = await repos.requests.list({ statuses: CODE_RESERVING_STATUSES })
  const out = new Map<string, string>()
  for (const r of open) {
    if (r.id === excludeRequestId || !r.draft?.codigo) continue
    out.set(normalizeCode(r.draft.codigo), formatRequestNumber(r.number))
  }
  return out
}

export async function getDraftContext({ repos, uau, ctx }: UseCaseDeps, requestId?: string): Promise<DraftContextDTO> {
  requirePermission(ctx, P.draftEdit, P.approvalDecide)
  const [snapshot, reserved] = await Promise.all([uau.loadCatalog(), reservedCodes(repos, requestId)])
  const index = buildCatalogIndex(snapshot.items)
  const next = suggestCodes(index, reserved.keys())
  return {
    prefixes: CODE_PREFIXES.map((p) => ({ prefix: p, label: PREFIXES[p].label, nextCode: next[p] ?? null })),
    unidades: countValues(snapshot.items, (i) => i.unidade),
    categorias: countValues(snapshot.items, (i) => i.categoria),
    caps: countValues(snapshot.items, (i) => i.cap),
    maxDescriptionLength: index.maxDescriptionLength,
  }
}

/** Valida o rascunho contra o cadastro atual do UAU e os códigos reservados. */
export async function validateAgainstCatalog(repos: Repositories, uau: UauGateway, draft: InsumoDraft, requestId?: string): Promise<DraftValidation> {
  const [snapshot, reserved] = await Promise.all([uau.loadCatalog(), reservedCodes(repos, requestId)])
  return validateDraft(draft, { index: buildCatalogIndex(snapshot.items), reserved })
}

export async function previewDraft(deps: UseCaseDeps, draft: InsumoDraft, requestId?: string): Promise<DraftPreviewDTO> {
  requirePermission(deps.ctx, P.draftEdit, P.approvalDecide)
  const validation = await validateAgainstCatalog(deps.repos, deps.uau, draft, requestId)
  const today = deps.ctx.now().toISOString().slice(0, 10)
  return {
    validation,
    insertBody: buildInsertBody(draft, { uauUser: deps.uau.user, today }),
    confirmBody: buildConfirmBody(normalizeCode(draft.codigo)),
  }
}
