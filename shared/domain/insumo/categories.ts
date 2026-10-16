/**
 * De-para das categorias de insumo: código do UAU (Categ_ins / CategoriaDoInsumo) ↔ descrição.
 *
 * A tela mostra a descrição para o analista; o UAU só aceita o código. A API do UAU não tem
 * rota que devolva a descrição das categorias de insumo, por isso a tabela fica aqui.
 * Para incluir ou corrigir: uma linha por categoria, com o código exatamente como no UAU.
 */
import { fold } from './text'

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // '007.002': 'AGREGADOS',
}

const byDescription = new Map(Object.entries(CATEGORY_DESCRIPTIONS).map(([code, description]) => [fold(description), code]))

/** Descrição da categoria; sem descrição cadastrada, o próprio código. */
export function categoryLabel(code: string): string {
  return CATEGORY_DESCRIPTIONS[code.trim()] ?? code
}

/** Código do UAU a partir do que foi digitado/escolhido (descrição ou código). */
export function categoryCode(value: string): string {
  const v = value.trim()
  if (CATEGORY_DESCRIPTIONS[v]) return v
  return byDescription.get(fold(v)) ?? v
}
