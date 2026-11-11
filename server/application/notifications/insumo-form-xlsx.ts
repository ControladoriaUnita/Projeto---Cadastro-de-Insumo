/**
 * Formulário SUP-F090 "Cadastro de Insumo" em Excel, anexado ao e-mail de insumo aprovado.
 * Reproduz o modelo da operação (logo, cabeçalho, colunas e rodapé "Solicitado por") em vez de
 * abrir o arquivo modelo: a tabela do Excel original não é lida pela biblioteca.
 */
import { CATEGORY_DESCRIPTIONS, categoryLabel } from '../../../shared/domain/insumo/categories'
import type { EmailAttachment, RequestRecord } from '../ports'
import { FORM_LOGO_JPEG_BASE64 } from './form-logo'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const SHEET_NAME = 'Formulário Cadastro Insumo'
const FIRST_ITEM_ROW = 8
/** Linhas do formulário mesmo com poucos insumos (o modelo vai até a 61) */
const MIN_ITEM_ROWS = 10

// Cores e fontes do modelo (tema "Office 2007 - 2010": preto = texto, branco = fundo)
const BLACK = 'FF000000'
const WHITE = 'FFFFFFFF'
const font = (size: number, bold = false, color = BLACK) => ({ name: 'Calibri', size, bold, color: { argb: color } })
const medium = { style: 'medium' as const, color: { argb: BLACK } }
const thin = { style: 'thin' as const, color: { argb: BLACK } }

const COLUMNS: { key: string; header: string; width: number }[] = [
  { key: 'B', header: 'OBSERVAÇÃO', width: 25.4 },
  { key: 'C', header: 'DESCRIÇÃO DO INSUMO', width: 169.9 },
  { key: 'D', header: 'UNIDADE', width: 11.9 },
  { key: 'E', header: 'NORMA', width: 19.6 },
  { key: 'F', header: 'REFERÊNCIA PRODUTO (MARCA)', width: 30.4 },
  { key: 'G', header: 'UTILIZAÇÃO', width: 25.6 },
  { key: 'H', header: 'CATEGORIA', width: 47.9 },
  { key: 'I', header: 'JUSTIFICATIVA (EM CASO DE SUBSTITUIÇÃO DE INSUMO ORÇADO)', width: 43.6 },
  { key: 'J', header: 'CÓDIGO DO INSUMO ANTERIOR', width: 20.9 },
  { key: 'K', header: 'INSUMO ANTERIOR (PREVISTO NO ORÇ)', width: 26.1 },
]

/** Data do dia em Brasília, como data "pura" do Excel (sem fuso). */
function brasiliaDate(iso: string): Date {
  const d = new Date(Date.parse(iso) - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Uma linha por insumo: o que a operação precisa para conferir o cadastro no UAU. */
function itemRow(r: RequestRecord): Record<string, string> {
  return {
    B: r.uauCode ?? r.draft?.codigo ?? '',
    C: r.draft?.descricao ?? r.description,
    D: r.draft?.unidade ?? r.unit,
    E: '',
    F: r.specification,
    G: r.justification,
    H: r.draft?.categoria ? categoryLabel(r.draft.categoria) : '',
    I: '',
    J: '',
    K: '',
  }
}

async function loadExcel() {
  const mod = await import('exceljs')
  return (mod as unknown as { default?: typeof mod }).default ?? mod
}

export async function buildInsumoFormXlsx(requests: RequestRecord[]): Promise<EmailAttachment> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cadastro de Insumos — Unità'
  const ws = wb.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: FIRST_ITEM_ROW - 1, showGridLines: false, zoomScale: 70 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })
  ws.getColumn('A').width = 1.6
  for (const c of COLUMNS) ws.getColumn(c.key).width = c.width
  ws.getColumn('L').width = 1.6
  ws.getRow(1).height = 5.1
  for (const n of [2, 3, 4, 5]) ws.getRow(n).height = 15

  // ------------------------------------------------------------------ cabeçalho (linhas 2–5)
  const first = requests[0]
  const requestDate = first ? brasiliaDate(first.createdAt) : brasiliaDate(new Date().toISOString())
  const header = (address: string, value: string | Date | null) => {
    const cell = ws.getCell(address)
    cell.value = value
    cell.font = font(12, true)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    return cell
  }
  ws.mergeCells('B2:B4')
  ws.mergeCells('C2:J2')
  ws.mergeCells('C3:J4')
  header('B2', null).border = { top: medium, left: medium, bottom: medium, right: medium }
  header('C2', 'FORMULÁRIO').border = { top: medium, left: medium, bottom: medium, right: medium }
  header('C3', 'CADASTRO DE INSUMO').border = { top: medium, left: medium, bottom: medium, right: medium }
  header('K2', 'SUP-F090').border = { top: medium, right: medium }
  header('K3', 'Revisão: 00').border = { right: medium }
  const date = header('K4', requestDate)
  date.numFmt = 'dd/mm/yyyy'
  date.border = { right: medium, bottom: medium }
  const logo = wb.addImage({ base64: FORM_LOGO_JPEG_BASE64, extension: 'jpeg' })
  ws.addImage(logo, { tl: { col: 1.15, row: 1.1 }, ext: { width: 116, height: 52 }, editAs: 'oneCell' })

  ws.mergeCells('B5:K5')
  const band = ws.getCell('B5')
  band.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } }
  band.border = { top: medium, left: medium, bottom: medium, right: medium }

  // ------------------------------------------------------------------ títulos (linha 7)
  const titles = ws.getRow(FIRST_ITEM_ROW - 1)
  titles.height = 38.25
  for (const c of COLUMNS) {
    const cell = ws.getCell(`${c.key}${FIRST_ITEM_ROW - 1}`)
    cell.value = c.header
    cell.font = font(11, false, WHITE)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { left: thin, right: thin }
  }

  // ------------------------------------------------------------------ insumos (a partir da linha 8)
  const rows = Math.max(requests.length, MIN_ITEM_ROWS)
  for (let i = 0; i < rows; i++) {
    const values = requests[i] ? itemRow(requests[i]!) : null
    const n = FIRST_ITEM_ROW + i
    ws.getRow(n).height = 15.6
    for (const c of COLUMNS) {
      const cell = ws.getCell(`${c.key}${n}`)
      cell.value = values?.[c.key] || null
      cell.font = font(11)
      cell.alignment = c.key === 'C' ? { horizontal: 'left', vertical: 'top', wrapText: true } : { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = { left: thin, right: thin, bottom: thin }
    }
  }

  // ------------------------------------------------------------------ rodapé
  const footer = FIRST_ITEM_ROW + rows + 1
  ws.getRow(footer).height = 30
  const label = (address: string, value: string) => {
    const cell = ws.getCell(address)
    cell.value = value
    cell.font = font(12, true)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { top: medium, left: medium, bottom: medium, right: thin }
  }
  const field = (address: string, value: string | Date) => {
    const cell = ws.getCell(address)
    cell.value = value
    cell.font = font(12)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { top: medium, left: thin, bottom: medium, right: medium }
    return cell
  }
  label(`B${footer}`, 'Solicitado por:')
  field(`C${footer}`, [...new Set(requests.map((r) => r.requesterName))].join(', '))
  label(`J${footer}`, 'Data da Solicitação:')
  field(`K${footer}`, requestDate).numFmt = 'dd/mm/yyyy'
  ws.pageSetup.printArea = `A1:L${footer + 1}`

  // ------------------------------------------------------------------ categorias (aba de apoio do modelo)
  const cats = wb.addWorksheet('Planilha1')
  cats.columns = [
    { header: 'Código', key: 'code', width: 12 },
    { header: 'Descrição', key: 'description', width: 50 },
    { header: 'Status', key: 'status', width: 12 },
  ]
  for (const [code, description] of Object.entries(CATEGORY_DESCRIPTIONS)) cats.addRow({ code, description, status: '0 - Ativo' })

  const buffer = await wb.xlsx.writeBuffer()
  const code = first?.uauCode ?? first?.draft?.codigo ?? 'insumo'
  return {
    name: `SUP-F090 Cadastro de Insumo - ${requests.length === 1 ? code : `${requests.length} insumos`}.xlsx`,
    contentType: XLSX_TYPE,
    contentBase64: Buffer.from(buffer as ArrayBuffer).toString('base64'),
  }
}
