/**
 * Insumos com descrição parecida: evita cadastrar (ou pedir) algo que já existe.
 * Pontuação: Jaccard dos termos (palavras e números). 100 só para descrição igual
 * (ignorando acento, maiúsculas e espaços). Medidas diferentes limitam a nota: é outro insumo.
 */
import type { CatalogItem } from './catalog'
import { numbersOf, searchText, tokenize } from './text'

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
/** Nota máxima de um insumo com as mesmas palavras mas medidas/números diferentes. */
const DIFFERENT_NUMBERS_MAX = 0.75
/** Nota máxima de um insumo com os mesmos termos em outra ordem ou pontuação. */
const SAME_TERMS_MAX = 0.95

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')

export function findSimilar(description: string, items: CatalogItem[], limit = 8): SimilarItem[] {
  const targetTerms = tokenize(description)
  const target = new Set(targetTerms)
  if (!target.size) return []
  const targetText = searchText(description)
  const targetNumbers = numbersOf(description)
  const out: SimilarItem[] = []
  for (const item of items) {
    const words = new Set(tokenize(item.descricao))
    if (!words.size) continue
    let common = 0
    for (const w of target) if (words.has(w)) common++
    if (!common) continue
    const itemText = searchText(item.descricao)
    let score = common / (target.size + words.size - common)
    if (itemText === targetText) score = 1
    else {
      if (itemText.includes(targetText) || targetText.includes(itemText)) score = Math.max(score, 0.8)
      score = Math.min(score, SAME_TERMS_MAX)
      if (!sameSet(numbersOf(item.descricao), targetNumbers)) score = Math.min(score, DIFFERENT_NUMBERS_MAX)
    }
    if (score >= SIMILARITY_THRESHOLD) {
      out.push({ codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, ativo: item.ativo, score: Math.round(score * 100) })
    }
  }
  return out.sort((a, b) => b.score - a.score || a.codigo.localeCompare(b.codigo)).slice(0, limit)
}
