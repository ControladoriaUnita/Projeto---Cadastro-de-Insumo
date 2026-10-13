/** Normalização de texto para buscas: sem acento e em minúsculas. */
export function fold(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Palavras com 2+ caracteres, sem acento e sem pontuação. */
export function tokenize(value: unknown): string[] {
  return fold(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2)
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
