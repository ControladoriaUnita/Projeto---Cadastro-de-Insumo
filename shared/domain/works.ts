/**
 * Obras ativas do UAU (Obras/ObterObrasAtivas), traduzidas dos nomes de coluna da API.
 */
import type { WorkDTO } from '../contracts'

const text = (v: unknown) => (v === null || v === undefined || v === 'null' ? '' : String(v).trim())

export const workLabel = (codigo: string, descricao: string) => (descricao ? `${codigo} - ${descricao}` : codigo)

/** Linha crua do UAU → obra. */
export function fromUauWorkRow(row: Record<string, unknown>): WorkDTO {
  const codigo = text(row.Cod_obr).toUpperCase()
  const descricao = text(row.Descr_obr)
  const empresa = Number(text(row.Empresa_obr))
  return { codigo, empresa: Number.isFinite(empresa) && text(row.Empresa_obr) !== '' ? empresa : null, descricao, label: workLabel(codigo, descricao) }
}

/**
 * Só obras de centro de custo "C" (construção): o código do UAU termina com a letra do centro
 * de custo, ex.: P007C (construção) e P007A (assistência técnica).
 */
export const isConstructionWork = (w: WorkDTO) => w.codigo.endsWith('C')

/** Sem repetidos (mesmo texto) e em ordem alfabética. */
export function sortWorks(works: WorkDTO[]): WorkDTO[] {
  const unique = new Map(works.filter((w) => w.codigo).map((w) => [w.label, w]))
  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}
