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

/** Sem repetidos (mesmo texto) e em ordem alfabética. */
export function sortWorks(works: WorkDTO[]): WorkDTO[] {
  const unique = new Map(works.filter((w) => w.codigo).map((w) => [w.label, w]))
  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

/**
 * Obras que a obra/colaborador pode escolher na solicitação e no filtro do acompanhamento
 * (cliente → obra), mais "Escritório" para pedidos internos. Para incluir ou tirar uma obra,
 * edite esta lista.
 */
export const REGISTERED_WORKS: readonly { cliente: string; obra: string }[] = [
  { cliente: 'Benx/Hines', obra: 'Viva Benx Estação Vila Mariana' },
  { cliente: 'Benx/Hines', obra: 'Viva Benx Klabin' },
  { cliente: 'Habita', obra: 'Habita Atlântico Meridional' },
  { cliente: 'Habita', obra: 'Habita Elza Guimarães' },
  { cliente: 'Habita', obra: 'Habita Sacomã' },
  { cliente: 'Jerônimo da Veiga', obra: 'Conceito Taboão' },
  { cliente: 'Joy+', obra: 'Praça Santa Helena' },
  { cliente: 'Lidera', obra: 'Vila Suissa Residencial' },
  { cliente: 'Limac', obra: 'Serena Tucuruvi' },
  { cliente: 'Marka Prime', obra: 'Marka Tucuruvi' },
  { cliente: 'Metrocasa', obra: 'MetroCasa Artur Alvim' },
  { cliente: 'Metrocasa', obra: 'MetroCasa Campo Belo' },
  { cliente: 'Metrocasa', obra: 'MetroCasa Estação Vila Prudente' },
  { cliente: 'Metrocasa', obra: 'MetroCasa Vista Cupecê' },
  { cliente: 'Miraus', obra: 'Miraus Alvorada' },
  { cliente: 'Pazza', obra: 'Ipanema 212' },
  { cliente: 'REV 3', obra: 'Flow Vila Matilde' },
  { cliente: 'REV 3', obra: 'Twist Alto da Mooca' },
  { cliente: 'REV 3', obra: 'Vila das Belezas' },
  { cliente: 'Teen', obra: 'Bumerangue' },
]

/** Obra para pedidos internos (sem cliente). */
export const OFFICE_WORK = 'Escritório'

/** Lista do campo "Obra": "Cliente - Obra", na ordem acima, e "Escritório" no fim. */
export function registeredWorks(): WorkDTO[] {
  return [
    ...REGISTERED_WORKS.map(({ cliente, obra }) => ({ codigo: '', empresa: null, descricao: obra, label: `${cliente} - ${obra}` })),
    { codigo: '', empresa: null, descricao: OFFICE_WORK, label: OFFICE_WORK },
  ]
}
