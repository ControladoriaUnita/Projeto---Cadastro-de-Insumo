import { describe, expect, it } from 'vitest'
import { MAX_BATCH_ITEMS, SHEET_COLUMNS, parseSheetRows } from './spreadsheet'

const header = SHEET_COLUMNS.map((c) => c.header)

describe('planilha de importação', () => {
  it('lê as linhas do modelo e converte tipo e urgência', () => {
    const r = parseSheetRows([
      header,
      ['Material', 'Rejunte epóxi cinza platina 1kg', 'kg', 'Urgente', 'Banheiros da torre A', 'Quartzolit'],
      ['Serviço', 'Locação de andaime', 'mês', '', 'Fachada', ''],
      ['Despesa indireta', 'Consultoria de impermeabilização', 'vb', 'normal', 'Subsolo', ''],
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows.map((x) => [x.line, x.item.kind, x.item.urgency])).toEqual([
      [2, 'material', 'urgente'],
      [3, 'servico', 'normal'],
      [4, 'despesa_indireta', 'normal'],
    ])
    expect(r.rows[0]!.item.specification).toBe('Quartzolit')
    expect(r.rows.every((x) => Object.keys(x.issues).length === 0)).toBe(true)
  })

  it('acha as colunas por nome em qualquer ordem, sem acento e com asterisco', () => {
    const r = parseSheetRows([
      ['Planilha de insumos — obra X'],
      ['ONDE SERA USADO *', 'unidade*', ' Descrição ', 'TIPO'],
      ['Cozinha', 'un', '  Torneira   gourmet  ', 'servico'],
    ])
    expect(r.ok && r.rows[0]).toMatchObject({ line: 3, item: { description: 'Torneira gourmet', unit: 'un', justification: 'Cozinha', kind: 'servico' } })
  })

  it('pula linhas vazias e aponta tipo ou urgência desconhecidos', () => {
    const r = parseSheetRows([header, ['', '', '', '', '', ''], ['Equipamento', 'Betoneira', 'un', 'amanhã', 'Obra', '']])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.line).toBe(3)
    expect(r.rows[0]!.issues.kind).toMatch(/Equipamento/)
    expect(r.rows[0]!.issues.urgency).toMatch(/amanhã/)
  })

  it('recusa planilha sem cabeçalho, sem colunas obrigatórias ou sem insumos', () => {
    expect(parseSheetRows([['a', 'b']])).toMatchObject({ ok: false })
    expect(parseSheetRows([['Insumo', 'Tipo'], ['x', 'Material']])).toMatchObject({ ok: false, error: expect.stringMatching(/Unidade/) })
    expect(parseSheetRows([header])).toMatchObject({ ok: false, error: expect.stringMatching(/nenhum insumo/) })
  })

  it(`limita a ${MAX_BATCH_ITEMS} insumos e avisa que cortou`, () => {
    const rows = Array.from({ length: MAX_BATCH_ITEMS + 5 }, (_, i) => ['Material', `Item ${i}`, 'un', '', 'Obra', ''])
    const r = parseSheetRows([header, ...rows])
    expect(r.ok && r.rows.length).toBe(MAX_BATCH_ITEMS)
    expect(r.ok && r.truncated).toBe(true)
  })
})
