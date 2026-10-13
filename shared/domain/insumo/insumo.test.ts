import { describe, expect, it } from 'vitest'
import { formatBRL, parseDecimalBR } from '../../format'
import { fromUauRow, type CatalogItem } from './catalog'
import { nextFreeCode } from './code'
import { EMPTY_DRAFT, buildCatalogIndex, draftFromModel, validateDraft, type InsumoDraft } from './draft'
import { findSimilar } from './similarity'
import { buildConfirmBody, buildInsertBody } from './uau-payload'

const item = (codigo: string, descricao: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  ...fromUauRow({ Cod_ins: codigo, Descr_ins: descricao, Unid_ins: 'kg', Categ_ins: '007.003', Tipo_ins: 3, Cap_ins: '1.1.3.01' }),
  ...extra,
})

const catalog = [item('IM00245', 'REJUNTE CIMENTICIO CINZA 1KG'), item('IM00246', 'REJUNTE EPOXI BRANCO 1KG'), item('IS00410', 'MAO DE OBRA DE ALVENARIA')]
const index = buildCatalogIndex(catalog)

const valid: InsumoDraft = {
  ...EMPTY_DRAFT,
  codigo: 'IM00247',
  descricao: 'REJUNTE EPOXI CINZA PLATINA 1KG',
  unidade: 'kg',
  categoria: '007.003',
  grupo: 3,
}

describe('código do insumo', () => {
  it('preenche a primeira lacuna a partir do menor código existente', () => {
    expect(nextFreeCode('IM', ['IM00001', 'IM00002', 'IM00004', 'IM00009'])).toBe('IM00003')
    expect(nextFreeCode('IM', ['IM00245', 'IM00247', 'IS00246'])).toBe('IM00246')
  })

  it('sem lacunas segue crescente; reservados contam como usados', () => {
    expect(nextFreeCode('IM', ['IM00245', 'IM00246', 'IS00410'])).toBe('IM00247')
    expect(nextFreeCode('IM', ['IM00001', 'IM00002', 'im00003'])).toBe('IM00004')
    expect(nextFreeCode('TR', [])).toBe('TR00001')
  })
})

describe('copiar de um insumo existente', () => {
  it('traz todas as informações, inclusive descrição, preço e prazos, e guarda o modelo', () => {
    const model = fromUauRow({
      Cod_ins: 'IM00001', Descr_ins: 'SARRAFO PINUS 2,5X7CM', Unid_ins: 'm', Categ_ins: '045.001', Tipo_ins: 3, G1G2_ins: 2,
      Cap_ins: 'DES0001', CapAplic_Ins: 'C006', preco_ins: 2.2, Compra_ins: 1, Util_ins: 1, Antec_ins: 1, NCompra_ins: 1,
      NTVenc_ins: 1, DtVenc_ins: 1, Tcompra_ins: 'v0001', Tvenc_ins: 'V0059', Encargo_ins: 0, Patrimonio_Ins: 0,
      ControlaPrecoMeta_Ins: false, ItemManutPat_Ins: false, AtInat_ins: 0, Conf_ins: 1,
    })
    const copy = draftFromModel(model)
    expect(copy).toMatchObject({
      modeloCodigo: 'IM00001', descricao: 'SARRAFO PINUS 2,5X7CM', preco: '2.2', cap: 'DES0001', capAplicacao: 'C006',
      diasDeCompra: 1, pagamentoSobre: 1, frequenciaCompra: 'V0001', comoPagar: 'V0059', calcEncargo: 0,
    })
    expect(copy).not.toHaveProperty('codigo')
    expect(copy).not.toHaveProperty('ativo')
  })
})

describe('linha do UAU', () => {
  it('traduz colunas, nulos "null" e status', () => {
    const i = fromUauRow({ Cod_ins: 'im00001', Descr_ins: ' AREIA ', Unid_ins: 'm³', AtInat_ins: '1', Conf_ins: 0, NCM_Ins: 'null' })
    expect(i).toMatchObject({ codigo: 'IM00001', descricao: 'AREIA', ativo: false, confirmado: false, ncm: '' })
  })
})

describe('insumos parecidos', () => {
  it('pontua descrição igual com 100 e ignora acentos', () => {
    const [first] = findSimilar('Rejunte epóxi branco 1kg', catalog)
    expect(first).toMatchObject({ codigo: 'IM00246', score: 100 })
  })
  it('não devolve nada sem palavras em comum', () => {
    expect(findSimilar('tinta acrilica', catalog)).toEqual([])
  })
})

describe('validação do rascunho', () => {
  it('aceita rascunho completo', () => {
    const v = validateDraft(valid, { index, reserved: new Map() })
    expect(v.errors).toEqual([])
    expect(v.ok).toBe(true)
    expect(v.suggestedCode).toBe('IM00247')
  })

  it('bloqueia código existente, reservado e fora do padrão', () => {
    const ctx = { index, reserved: new Map([['IM00247', '#0003']]) }
    expect(validateDraft({ ...valid, codigo: 'IM00245' }, ctx).errors[0]?.field).toBe('codigo')
    expect(validateDraft(valid, ctx).errors[0]?.message).toContain('#0003')
    expect(validateDraft({ ...valid, codigo: 'XX1' }, ctx).ok).toBe(false)
  })

  it('bloqueia descrição idêntica a um insumo existente', () => {
    const v = validateDraft({ ...valid, descricao: 'rejunte epoxi branco 1kg' }, { index, reserved: new Map() })
    expect(v.errors.map((e) => e.message).join(' ')).toContain('IM00246')
  })

  it('exige campos obrigatórios e avisa sobre unidade desconhecida', () => {
    const v = validateDraft({ ...EMPTY_DRAFT, codigo: 'IM00247', descricao: 'ALGO NOVO QUALQUER', unidade: 'xyz' }, { index, reserved: new Map() })
    expect(v.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['categoria', 'grupo']))
    expect(v.warnings.map((e) => e.field)).toContain('unidade')
  })
})

describe('corpo enviado ao UAU', () => {
  it('insere ativo e pendente, sem campos vazios, com data da cotação quando há preço', () => {
    const body = buildInsertBody({ ...valid, preco: '389.9' }, { uauUser: 'PORTAL', today: '2026-10-13' })
    expect(body).toEqual({
      codigo: 'IM00247',
      descricao: 'REJUNTE EPOXI CINZA PLATINA 1KG',
      unidade: 'kg',
      usuario: 'PORTAL',
      status: 0,
      confirmado: 0,
      grupo: 3,
      CategoriaDoInsumo: '007.003',
      controlarPrecoMeta: false,
      itemManutencao: false,
      preco: '389.9',
      dataCotacao: '2026-10-13',
    })
  })

  it('envia prazos e frequências copiados do modelo', () => {
    const body = buildInsertBody({ ...valid, diasDeCompra: 5, pagamentoSobre: 2, comoPagar: 'V0059' }, { uauUser: 'PORTAL', today: '2026-10-13' })
    expect(body).toMatchObject({ diasDeCompra: 5, pagamentoSobre: 2, comoPagar: 'V0059' })
  })

  it('confirmação muda a situação para confirmado', () => {
    expect(buildConfirmBody('IM00247')).toEqual({ listaInsumosAtualizar: [{ codigo: 'IM00247', confirmado: 1 }] })
  })
})

describe('formatação', () => {
  it('converte entrada pt-BR sem float', () => {
    expect(parseDecimalBR('1.234,56')).toBe('1234.56')
    expect(parseDecimalBR('R$ 150.000')).toBe('150000')
    expect(parseDecimalBR('12,5')).toBe('12.5')
    expect(parseDecimalBR('abc')).toBeNull()
    expect(formatBRL('1234.5')).toBe('R$ 1.234,50')
  })
})
