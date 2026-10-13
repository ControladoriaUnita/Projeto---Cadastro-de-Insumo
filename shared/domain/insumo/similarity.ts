/**
 * Insumos com descrição parecida: evita cadastrar (ou pedir) algo que já existe.
 * Pontuação: Jaccard das palavras; descrição igual = 100; uma contida na outra ≥ 80.
 */
import type { CatalogItem } from './catalog'
import { fold, tokenize } from './text'

export interface SimilarItem {
  codigo: string
  descricao: string
  unidade: string
  ativo: boolean
  /** 0..100 */
  score: number
}

export const SIMILARITY_THRESHOLD = 0.4
export const IDENTICAL_SCORE = 100

export function findSimilar(description: string, items: CatalogItem[], limit = 8): SimilarItem[] {
  const target = new Set(tokenize(description))
  if (!target.size) return []
  const targetText = fold(description).trim()
  const out: SimilarItem[] = []
  for (const item of items) {
    const words = new Set(tokenize(item.descricao))
    if (!words.size) continue
    let common = 0
    for (const w of target) if (words.has(w)) common++
    if (!common) continue
    let score = common / (target.size + words.size - common)
    const itemText = fold(item.descricao).trim()
    if (itemText === targetText) score = 1
    else if (itemText.includes(targetText) || targetText.includes(itemText)) score = Math.max(score, 0.8)
    if (score >= SIMILARITY_THRESHOLD) {
      out.push({ codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, ativo: item.ativo, score: Math.round(score * 100) })
    }
  }
  return out.sort((a, b) => b.score - a.score || a.codigo.localeCompare(b.codigo)).slice(0, limit)
}
