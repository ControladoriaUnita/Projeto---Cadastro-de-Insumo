/**
 * Planilha de importação no navegador: gera o modelo .xlsx e lê o arquivo enviado.
 * O ExcelJS (~1 MB) só é baixado quando alguém usa a importação.
 */
import {
  KIND_OPTIONS,
  MAX_BATCH_ITEMS,
  SHEET_COLUMNS,
  SHEET_NAME,
  URGENCY_OPTIONS,
  parseSheetRows,
  type SheetParseResult,
} from '@shared/domain/request/spreadsheet'

export const TEMPLATE_FILE_NAME = 'modelo-importacao-insumos.xlsx'
const MAX_FILE_BYTES = 5 * 1024 * 1024

async function loadExcel() {
  const mod = await import('exceljs')
  return (mod as unknown as { default?: typeof mod }).default ?? mod
}

/** Cor do tema (tokens.css) no formato ARGB do Excel. */
function themeArgb(token: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim()
  const m = /^#([0-9a-f]{6})$/i.exec(v)
  return m ? `FF${m[1]!.toUpperCase()}` : fallback
}

const listFormula = (options: string[]) => [`"${options.join(',')}"`]

export async function downloadTemplate(): Promise<void> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cadastro de Insumos — Unità'
  const primary = themeArgb('primary', 'FFFF5A00')
  const soft = themeArgb('ink-100', 'FFF0EEEC')

  const ws = wb.addWorksheet(SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = SHEET_COLUMNS.map((c) => ({ header: c.required ? `${c.header} *` : c.header, key: c.field, width: c.width }))
  const header = ws.getRow(1)
  header.height = 24
  header.eachCell((cell, i) => {
    const col = SHEET_COLUMNS[i - 1]!
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } }
    cell.alignment = { vertical: 'middle' }
    cell.note = `${col.required ? 'Obrigatório. ' : 'Opcional. '}${col.hint}`
  })
  const kindCol = SHEET_COLUMNS.findIndex((c) => c.field === 'kind') + 1
  const urgencyCol = SHEET_COLUMNS.findIndex((c) => c.field === 'urgency') + 1
  for (let r = 2; r <= MAX_BATCH_ITEMS + 1; r++) {
    ws.getCell(r, kindCol).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: listFormula(KIND_OPTIONS),
      showErrorMessage: true,
      errorTitle: 'Tipo inválido',
      error: `Escolha: ${KIND_OPTIONS.join(', ')}`,
    }
    ws.getCell(r, urgencyCol).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: listFormula(URGENCY_OPTIONS),
      showErrorMessage: true,
      errorTitle: 'Urgência inválida',
      error: 'Escolha: Normal ou Urgente',
    }
  }

  const help = wb.addWorksheet('Instruções')
  help.getColumn(1).width = 34
  help.getColumn(2).width = 70
  const title = help.addRow(['Como preencher a planilha de importação'])
  title.font = { bold: true, size: 14 }
  help.addRow([])
  for (const line of [
    `Preencha a aba "${SHEET_NAME}": uma linha por insumo, a partir da linha 2.`,
    'Não altere nem apague a linha de cabeçalho (os nomes das colunas).',
    'Colunas com * são obrigatórias. A obra é escolhida na tela, antes de enviar.',
    `Até ${MAX_BATCH_ITEMS} insumos por planilha. Linhas em branco são ignoradas.`,
    'Depois de importar, você confere e ajusta tudo na tela antes de enviar.',
  ]) {
    help.addRow([`• ${line}`]).getCell(1).alignment = { wrapText: false }
  }
  help.addRow([])
  const colsHead = help.addRow(['Coluna', 'O que informar'])
  colsHead.font = { bold: true }
  colsHead.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: soft } }))
  for (const c of SHEET_COLUMNS) help.addRow([c.required ? `${c.header} *` : c.header, c.hint])
  help.addRow([])
  help.addRow(['Exemplo de linha preenchida']).font = { bold: true }
  help.addRow(['Tipo', 'Material'])
  help.addRow(['Insumo', 'Rejunte epóxi cinza platina 1kg'])
  help.addRow(['Unidade', 'kg'])
  help.addRow(['Urgência', 'Normal'])
  help.addRow(['Onde será usado', 'Banheiros das torres A e B'])
  help.addRow(['Especificação ou marca de referência', 'Quartzolit ou similar'])

  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = TEMPLATE_FILE_NAME
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lê o .xlsx (aba "Insumos" ou a primeira) e devolve as linhas já interpretadas. */
export async function readSpreadsheet(file: File): Promise<SheetParseResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    return { ok: false, error: 'Envie um arquivo .xlsx. No Excel, use "Salvar como" → Pasta de Trabalho do Excel (.xlsx).' }
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'Arquivo muito grande (máximo 5 MB).' }
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    return { ok: false, error: 'Não foi possível abrir o arquivo. Confira se é uma planilha do Excel válida.' }
  }
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0]
  if (!ws) return { ok: false, error: 'A planilha está vazia.' }
  const cells: string[][] = []
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const values: string[] = []
    for (let c = 1; c <= Math.max(ws.columnCount, SHEET_COLUMNS.length); c++) values.push(row.getCell(c).text ?? '')
    cells[n - 1] = values
  })
  return parseSheetRows(Array.from(cells, (r) => r ?? []))
}
