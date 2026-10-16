# API UAU — rotas usadas por esta plataforma

Servidor: `https://gamma-api.seniorcloud.com.br:51572/uauAPI` (Swagger em `/swagger/ui/index`).
Todas as rotas são `POST <servidor>/api/v1.0/<Controller>/<Metodo>` com os headers
`X-INTEGRATION-Authorization` (token de integração) e `Authorization` (token do login).

## Autenticação

`Autenticador/AutenticarUsuario` com `{ Login, Senha }` devolve o token como texto. O cliente
(`server/infrastructure/uau/uau-client.ts`) guarda o token por 59 minutos, compartilha o mesmo login
entre chamadas simultâneas e renova uma vez quando recebe HTTP 401.

## Leitura

| Rota | Uso | Observações |
|---|---|---|
| `InsumosGeral/ConsultarInsumosGeralPorDescricao` | cadastro inteiro | `{ "Descricao": "%" }` traz tudo (~13 mil itens). Descrição vazia responde 400. Cache de 10 min no servidor. Leva de 10 s a mais de 1 min; duas leituras simultâneas deixam o UAU bem mais lento. |
| `Obras/ObterObrasAtivas` | obras ativas (campo "Obra" da solicitação e filtro do acompanhamento) | Sem parâmetros; ~1 s. Cache de 10 min no servidor. Gravamos na solicitação "`Cod_obr` - `Descr_obr`". |

**Não usar para consultar por código** (testado em 13/10/2026):

- `InsumosGeral/ConsultarInsumosGeral` com `{ "codigo_insumo": "IM10733" }` devolve lista **vazia** mesmo para códigos existentes (o Swagger descreve como "revisão de um veículo ou equipamento").
- `InsumosGeral/ConsultarInsumosGeralPorChave` exige os campos da inserção (`descricao`, `usuario`, `unidadesInsumo`); não está claro que seja só leitura.

Por isso, para conferir se um código está livre logo antes de gravar, a plataforma relê o cadastro inteiro.

**Categorias de insumo:** a API não tem rota que devolva a descrição das categorias (testado em
16/10/2026: composições e lista de preço de referência não trazem as categorias de insumo). A tela
mostra a descrição pelo de-para em `shared/domain/insumo/categories.ts` e a inserção envia o código.

Colunas usadas (`shared/domain/insumo/catalog.ts`) → campo da inserção:

| Coluna do cadastro | Inserção | | Coluna do cadastro | Inserção |
|---|---|---|---|---|
| `Cod_ins` | `codigo` | | `Compra_ins` | `diasDeCompra` |
| `Descr_ins` | `descricao` | | `Util_ins` | `diasUtilizacao` |
| `Unid_ins` | `unidade` | | `Antec_ins` | `diasEntrega` |
| `Categ_ins` | `CategoriaDoInsumo` | | `NCompra_ins` | `numeroDeCompras` |
| `Tipo_ins` | `grupo` (0 = sem grupo, em insumos antigos) | | `NTVenc_ins` | `numeroPagamentos` |
| `G1G2_ins` | `controle` | | `DtVenc_ins` | `pagamentoSobre` (1 entrega, 2 pedido; 0 é ignorado) |
| `TPagto_ins` | `tipoPagamento` | | `Tcompra_ins` | `frequenciaCompra` (ex.: V0001) |
| `Est_ins` | `controlaEstoque` | | `Tvenc_ins` | `comoPagar` (ex.: V0059) |
| `preco_ins` | `preco` | | `Encargo_ins` | `calcEncargo` |
| `Cap_ins`, `CapAplic_Ins` | `CAP`, `CAPAplicacaoMaterial` | | `Patrimonio_Ins` | `patrimonio` |
| `CapEstorno_ins`, `CapTransacaoFin_ins` | `CAPEstorno`, `CAPTransacaoFinanceira` | | `ControlaPrecoMeta_Ins` | `controlarPrecoMeta` |
| `CategMovFin_ins`, `NCM_Ins`, `CEST_ins` | `categoriaMovFin`, `NCM`, `CEST` | | `ItemManutPat_Ins` | `itemManutencao` |
| `AtInat_ins` | `status` (0 ativo, 1 inativo) | | `Conf_ins` | `confirmado` |

Os nomes da coluna da direita batem com a descrição do Swagger, mas a correspondência
coluna → campo dos prazos e frequências foi deduzida pelo nome. Confira o primeiro insumo
gravado na tela do UAU.

As respostas vêm em dois formatos: lista simples, ou DataSet com uma linha de tipos
(`System.String, mscorlib…`) e nulos como a string `"null"`. Ambos são normalizados.

## Gravação (só na aprovação da gestão)

### 1. `InsumosGeral/InserirInsumosGeral`

Obrigatórios: `codigo`, `descricao`, `usuario`. Enviamos ainda `unidade`, `status: 0` (ativo),
`confirmado: 0` (pendente) e, quando preenchidos, todos os campos da tabela acima, mais
`preco` + `dataCotacao`.
Em 08/10/2026 um envio real respondeu HTTP 200 com corpo vazio.

### 2. `InsumosGeral/AtualizarInsumosGeral` — mudança de situação

```json
{ "listaInsumosAtualizar": [{ "codigo": "IM10733", "confirmado": 1 }] }
```

Pelo Swagger, `confirmado` é "Status de confirmação do insumo: 0 Pendente/Não confirmado; 1 Confirmado".
A mesma rota também inativa (`status: 1`). A API **não tem rota para excluir** insumos.

> A confirmação pela `AtualizarInsumosGeral` ainda **não foi testada com dados reais**.
> Teste primeiro numa base de homologação, se houver.

## Padrão de código

Prefixo + 5 dígitos: `IM` materiais (grupo 3), `IS` serviços (grupos 4/5), `IP` despesas indiretas, `TR` tributos.
