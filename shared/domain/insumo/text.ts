/** Normalização de texto para buscas: sem acento e em minúsculas. */
export function fold(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Texto comparável: sem acento, minúsculo, "1,60" → "1.60", "×" → "x", espaços únicos.
 * É o que a busca e a semelhança comparam, para que medidas e números contem.
 */
export function searchText(value: unknown): string {
  return fold(value)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/×/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palavras que não ajudam a diferenciar insumos. */
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'com', 'para', 'por', 'na', 'no', 'nas', 'nos'])

/**
 * Termos da descrição: palavras com 2+ letras (sem as de ligação) e TODOS os números,
 * com decimais inteiros. "guarda-corpo h=1,60m" → ["guarda", "corpo", "1.60"]
 */
export function tokenize(value: unknown): string[] {
  const out: string[] = []
  for (const t of searchText(value).match(/\d+(?:\.\d+)*|[a-z]+/g) ?? []) {
    if (/^\d/.test(t)) out.push(t)
    else if (t.length >= 2 && !STOPWORDS.has(t)) out.push(t)
  }
  return out
}

/** Números e medidas de uma descrição ("1,60x0,60m" → ["1.60", "0.60"]). */
export function numbersOf(value: unknown): string[] {
  return tokenize(value).filter((t) => /^\d/.test(t))
}

/**
 * Busca no estilo do UAU. Sem "*": cada termo digitado precisa aparecer no texto (qualquer ordem).
 * Com "*": os trechos entre os asteriscos precisam aparecer NESTA ordem, com qualquer coisa
 * entre eles ("janela*veneziana*0,60"). Devolve null quando não há o que buscar.
 */
export function textMatcher(query: unknown): ((text: string) => boolean) | null {
  const q = searchText(query)
  if (!q.replace(/\*/g, '').trim()) return null
  if (q.includes('*')) {
    const parts = q.split('*').map((p) => p.trim()).filter(Boolean)
    const pattern = new RegExp(parts.map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'))
    return (text) => pattern.test(searchText(text))
  }
  const terms = q.split(' ')
  return (text) => {
    const t = searchText(text)
    return terms.every((term) => t.includes(term))
  }
}

/**
 * Palavras principais de uma descrição para busca (ignora medidas, números e palavras curtas).
 * "ARGAMASSA COLANTE AC-III CINZA 20KG" → ["argamassa", "colante"]
 */
export function mainWords(value: unknown, limit = 2): string[] {
  return tokenize(value)
    .filter((t) => t.length >= 4 && !/\d/.test(t))
    .slice(0, limit)
}

/** Espaços repetidos viram um só; bordas aparadas. */
export function squish(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}
