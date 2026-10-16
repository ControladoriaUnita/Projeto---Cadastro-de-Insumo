/**
 * Recorte de exemplo do cadastro geral de insumos, no formato cru do UAU
 * (mesmos nomes de coluna de InsumosGeral/ConsultarInsumosGeralPorDescricao).
 * Usado no modo simulado (UAU_MODE=mock) e nos testes.
 */
type Row = Record<string, string | number>

const material = (Cod_ins: string, Descr_ins: string, Unid_ins: string, Categ_ins: string, extra: Row = {}): Row => ({
  Cod_ins,
  Descr_ins,
  Unid_ins,
  Categ_ins,
  Tipo_ins: 3,
  G1G2_ins: 1,
  TPagto_ins: 0,
  Est_ins: 1,
  AtInat_ins: 0,
  Conf_ins: 1,
  Cap_ins: '1.1.3.01',
  CapAplic_Ins: '4.1.1.01',
  ...extra,
})

const service = (Cod_ins: string, Descr_ins: string, Unid_ins: string, Categ_ins: string, extra: Row = {}): Row => ({
  Cod_ins,
  Descr_ins,
  Unid_ins,
  Categ_ins,
  Tipo_ins: 4,
  G1G2_ins: 2,
  TPagto_ins: 1,
  Est_ins: 0,
  AtInat_ins: 0,
  Conf_ins: 1,
  Cap_ins: '4.1.2.03',
  ...extra,
})

export const SAMPLE_CATALOG: Row[] = [
  material('IM00012', 'CIMENTO PORTLAND CP II-E-32 SACO 50KG', 'sc', '007.001', { NCM_Ins: '25232910' }),
  material('IM00013', 'CIMENTO PORTLAND CP V-ARI SACO 40KG', 'sc', '007.001', { NCM_Ins: '25232910' }),
  material('IM00105', 'AREIA MEDIA LAVADA', 'm³', '007.002'),
  material('IM00106', 'AREIA FINA LAVADA', 'm³', '007.002'),
  material('IM00110', 'BRITA 1', 'm³', '007.002'),
  material('IM00111', 'BRITA 0 (PEDRISCO)', 'm³', '007.002'),
  material('IM00230', 'ARGAMASSA COLANTE AC-II SACO 20KG', 'sc', '007.003'),
  material('IM00231', 'ARGAMASSA COLANTE AC-III SACO 20KG', 'sc', '007.003'),
  material('IM00245', 'REJUNTE CIMENTICIO CINZA 1KG', 'kg', '007.003'),
  material('IM00246', 'REJUNTE EPOXI BRANCO 1KG', 'kg', '007.003'),
  material('IM00410', 'BLOCO CERAMICO VEDACAO 14X19X39CM', 'un', '007.004'),
  material('IM00411', 'BLOCO DE CONCRETO ESTRUTURAL 14X19X39CM', 'un', '007.004'),
  material('IM00520', 'ACO CA-50 10,0MM', 'kg', '007.005', { NCM_Ins: '72142000' }),
  material('IM00521', 'ACO CA-50 12,5MM', 'kg', '007.005', { NCM_Ins: '72142000' }),
  material('IM00530', 'ARAME RECOZIDO 18 BWG', 'kg', '007.005'),
  material('IM00701', 'TINTA ACRILICA FOSCA BRANCA 18L', 'gl', '008.002'),
  material('IM00702', 'MASSA CORRIDA PVA 25KG', 'lt', '008.002'),
  material('IM00810', 'TUBO PVC SOLDAVEL 25MM BARRA 6M', 'br', '009.001'),
  material('IM00811', 'TUBO PVC ESGOTO 100MM BARRA 6M', 'br', '009.001'),
  material('IM00950', 'CABO FLEXIVEL 2,5MM² 750V', 'm', '010.001'),
  material('IM00951', 'CABO FLEXIVEL 4,0MM² 750V', 'm', '010.001'),
  material('IM01020', 'PORCELANATO 60X60 ACETINADO', 'm²', '008.004'),
  material('IM10731', 'MANTA ASFALTICA 4MM TIPO III', 'm²', '008.006'),
  material('IM10732', 'IMPERMEABILIZANTE CIMENTICIO BICOMPONENTE 18KG', 'cx', '008.006'),
  material('IM00099', 'CAL HIDRATADA CH-III 20KG (DESCONTINUADO)', 'sc', '007.001', { AtInat_ins: 1 }),
  service('IS00410', 'MAO DE OBRA DE ALVENARIA', 'm²', '068.001'),
  service('IS00411', 'MAO DE OBRA DE REVESTIMENTO CERAMICO', 'm²', '068.001'),
  service('IS00520', 'LOCACAO DE BETONEIRA 400L', 'mês', '068.003', { Tipo_ins: 2 }),
  service('IS00521', 'LOCACAO DE ANDAIME TUBULAR', 'mês', '068.003', { Tipo_ins: 2 }),
  service('IS00600', 'FRETE DE ENTULHO CACAMBA 5M³', 'un', '068.004', { Tipo_ins: 5 }),
  service('IS00610', 'IMPERMEABILIZACAO DE LAJE COM MANTA', 'm²', '068.001'),
  service('IP00015', 'ALUGUEL DE CONTAINER ESCRITORIO', 'mês', '090.001'),
  service('IP00020', 'CONSULTORIA DE SEGURANCA DO TRABALHO', 'vb', '090.002'),
  service('TR00001', 'ISS SOBRE SERVICOS', 'vb', '095.001'),
]

/** Obras de exemplo, no formato cru de Obras/ObterObrasAtivas. */
export const SAMPLE_WORKS: Row[] = [
  { Cod_obr: 'P212C', Empresa_obr: 1, Descr_obr: 'Pazza Ipanema 212', Status_obr: 0 },
  { Cod_obr: 'J001C', Empresa_obr: 1, Descr_obr: 'Joy+ Evans', Status_obr: 0 },
  { Cod_obr: 'P007C', Empresa_obr: 1, Descr_obr: 'Metrocasa - Dom Bosco - Construção', Status_obr: 0 },
  { Cod_obr: 'P007A', Empresa_obr: 1, Descr_obr: 'Metrocasa - Dom Bosco - Assistência Técnica', Status_obr: 0 },
  { Cod_obr: 'DHO', Empresa_obr: 1, Descr_obr: 'Desenvolvimento Humano Organizacional', Status_obr: 0 },
]
