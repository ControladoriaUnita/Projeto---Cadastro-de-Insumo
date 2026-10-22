# Cadastro de Insumos — Unità Engenharia

Plataforma para pedir, cadastrar e aprovar **insumos novos no UAU** (Globaltec/Senior), com papéis separados:

```
Obra solicita ──▶ Analista cria o cadastro e pede aprovação ──▶ Gestão revisa, ajusta, insere no UAU e confirma
                  (nada é gravado no UAU até aqui)              (InserirInsumosGeral + AtualizarInsumosGeral)
```

Stack: **React 19 + TypeScript (strict) + Vite 7 + Tailwind CSS 4** · **Vercel Functions** · **Supabase (Auth + PostgreSQL)** · Zod · TanStack Query.
Identidade visual: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) (tokens em `src/styles/tokens.css`). Projeto independente: não depende de nenhuma outra pasta.

---

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # DATA_SOURCE=memory e UAU_MODE=mock já vêm configurados
npm run dev                  # http://localhost:5174
```

No **modo demonstração** a API roda dentro do `vite dev`, com solicitações em memória e uma **UAU simulado** (catálogo de exemplo). O seletor **"Demonstração — entrar como"** no topo troca entre Obra, Analista e Gestão para percorrer o fluxo inteiro. Há solicitações de exemplo em cada etapa.

> No PowerShell, `npm run ...` pode ser bloqueado pela política de scripts. Use o Git Bash ou `npx vite`.

### Com o UAU real

No `.env.local`:

| Variável | Valor |
|---|---|
| `UAU_MODE` | `real` |
| `UAU_BASE_URL`, `UAU_INTEGRATION_TOKEN`, `UAU_LOGIN`, `UAU_PASSWORD` | credenciais do usuário de integração (PORTAL) |
| `UAU_GRAVACAO` | `simulacao` (padrão): a aprovação valida e mostra o JSON, mas **não grava**. `real`: grava. |

A base atual do UAU **parece ser produção** e a API **não exclui insumos** (só inativa). Só ligue `UAU_GRAVACAO=real` de propósito.

### Produção (Vercel + Supabase)

1. Crie o projeto no Supabase e aplique `supabase/migrations/001_initial_schema.sql`.
2. Crie os usuários no Supabase Auth e um registro em `profiles` para cada um (`role`: `obra`, `analista` ou `gestor`; `work_name` para a obra).
3. Na Vercel, configure as variáveis do `.env.example` com `DATA_SOURCE=supabase`. **Nunca** prefixe credenciais com `VITE_`.

---

## Papéis e telas

| Papel | O que faz | Telas |
|---|---|---|
| **Obra** | Pede insumos e acompanha cada pedido | Solicitar insumo · Acompanhamento (só os próprios) |
| **Analista** | Monta o cadastro e envia para aprovação; pode recusar pedidos | Cadastro (fila + criação) · Insumos UAU · Acompanhamento |
| **Gestão** | Tudo, mais: ajusta o cadastro, aprova e grava no UAU | Aprovação (fila + revisão) · todas as outras |

A regra de quem pode o quê está em **um lugar só**: [`shared/domain/roles.ts`](shared/domain/roles.ts) (permissões por papel) e [`shared/domain/request/workflow.ts`](shared/domain/request/workflow.ts) (ações por situação). A API aplica as regras; a tela só usa as mesmas regras para esconder o que não cabe.

### Fluxo da solicitação

| Situação | Quem age | Ações |
|---|---|---|
| `solicitado` | Obra / Analista | cancelar (obra) · iniciar cadastro · recusar |
| `em_cadastro` | Analista | salvar · enviar para aprovação · recusar |
| `aguardando_aprovacao` | Gestão | ajustar · aprovar · devolver ao analista · recusar |
| `em_insercao` → `inserido_nao_confirmado` | Gestão | retomar (se a aprovação parou no meio) |
| `aprovado` · `recusado` · `cancelado` | — | encerrada |

Devolver e recusar exigem motivo, que aparece para a obra. Cada passo fica no **histórico** (append-only), incluindo o JSON enviado e a resposta do UAU.

### Vários insumos de uma vez

Na tela **Solicitar insumo**, a obra informa a obra uma vez e adiciona quantos insumos precisar (até 100 por envio):

- **Adicionar insumo**: novo bloco em branco, já com o tipo e a urgência do anterior.
- **Importar planilha**: explica o preenchimento e oferece **Baixar modelo** (`.xlsx` com as colunas, listas de Tipo e Urgência e uma aba de instruções) e **Selecionar arquivo**. As linhas entram na tela para conferência; campos faltando e tipo/urgência não reconhecidos ficam marcados e bloqueiam o envio até serem corrigidos.

Cada insumo vira **uma solicitação** (`POST /api/requests/batch`), e o fluxo de cadastro e aprovação continua item a item. Se algum item for inválido, o lote inteiro é recusado e nada é gravado. A leitura da planilha fica em [`shared/domain/request/spreadsheet.ts`](shared/domain/request/spreadsheet.ts) (colunas achadas pelo nome, em qualquer ordem). O ExcelJS só é baixado quando alguém abre a importação.

### Aprovação no UAU (dois passos)

1. `InsumosGeral/InserirInsumosGeral` cria o insumo **ativo e não confirmado** (`status: 0`, `confirmado: 0`).
2. `InsumosGeral/AtualizarInsumosGeral` muda a **situação para confirmado** (`confirmado: 1`).

Antes de gravar, o servidor relê o cadastro inteiro do UAU (sem cache), revalida e confere que o código continua livre. Isso leva de 10 s a mais de 1 minuto, conforme a carga do UAU. A solicitação é travada em `em_insercao` para duas pessoas não aprovarem ao mesmo tempo. Se a inserção falhar, volta para a fila; se a confirmação falhar, fica em `inserido_nao_confirmado` e **Retomar** termina sem inserir de novo.

**Um insumo de cada vez.** A gestão aprova cada insumo individualmente, na tela dele, digitando o código para confirmar. Não existe aprovação em lote, inclusive para insumos que a obra enviou juntos (a tela avisa "insumo 2 de 5 enviados juntos"). O servidor também só deixa uma gravação no UAU por vez: enquanto um insumo estiver em `em_insercao`, outra aprovação ou retomada recebe `409 UAU_BUSY`. Uma gravação parada há mais de 5 minutos é tratada como interrompida (vai para **Retomar**) e não trava a fila. Depois de aprovar, **Próximo insumo** abre o seguinte da fila.

Na tela de aprovação, a aba **Insumos do UAU** mostra o cadastro inteiro (busca, filtros, detalhe), já filtrado pelas palavras principais da descrição, para o gestor conferir repetidos e parecidos antes de aprovar.

### Cadastro do insumo

- **Copiar de um insumo existente**: busca ou sugestões parecidas com o pedido. Copia **todas** as informações (descrição, preço, unidade, classificação, contas contábeis, prazos, frequências e controles); só o código continua o do rascunho. Depois, o analista ajusta o que muda, normalmente descrição e preço. A conferência bloqueia descrição igual à de um insumo do UAU, então a cópia nunca vira duplicado.
- **Código**: prefixo (IM, IS, IP, TR) + 5 dígitos. A sugestão parte do **menor código existente** e devolve a **primeira lacuna** da numeração; sem lacunas, segue crescente. Códigos reservados por outros cadastros em andamento contam como usados. (No UAU real, em 13/10/2026: IM00432, IS00208, IP00099, TR00037.)
- **Conferência ao vivo** contra o cadastro do UAU. O **único impedimento** de cadastrar é o insumo **já existir no UAU**: mesmo código, ou mesma descrição (ignorando acento, maiúsculas, espaços repetidos e vírgula/ponto decimal), ativo ou inativo. Além disso só trava o que o UAU não teria como gravar: código, descrição e unidade em branco, código já usado por outro cadastro em andamento, valores fora das listas do UAU e Medição com controle por quantidade. Todo o resto é aviso e não desabilita os botões (código fora do padrão ou fora da sequência, sem categoria/grupo, unidade/categoria/CAP nunca usados, descrição curta, longa ou parecida, grupo incomum para o prefixo). No envio e na aprovação o servidor relê o UAU sem cache; se o UAU não responder (ou devolver o cadastro vazio), nada é enviado nem gravado e a mensagem diz o motivo.
- **Prévia do JSON** exato das duas chamadas, na tela da gestão.

### Aviso por e-mail

O formulário de solicitação tem o campo obrigatório **E-mail do solicitante** (a obra entra sem login, então é por ele que ela é avisada). Os avisos:

| Quando | Para quem | Conteúdo |
|---|---|---|
| Insumo aprovado (inserido e confirmado no UAU) | e-mail do solicitante e analista; `EMAIL_APPROVAL_CC` em cópia | código, descrição, obra e link para a solicitação |
| Analista devolve à obra (*requer ajuste*) | e-mail do solicitante | motivo da devolução e link para ajustar e reenviar |

Uma falha no envio **não desfaz** a ação (aprovação ou devolução): fica registrada no histórico como "falha no e-mail". Solicitações antigas, sem e-mail no formulário, avisam só quem tem login.

| `EMAIL_PROVIDER` | Comportamento |
|---|---|
| `log` (padrão) | o e-mail aparece só no terminal do servidor |
| `graph` | envio real pelo Microsoft 365 |
| `none` | desligado |

Para usar `graph`, a TI registra um aplicativo no **Microsoft Entra ID** com a permissão de aplicativo **Mail.Send** (com consentimento do administrador) e informa `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` e a caixa remetente em `EMAIL_SENDER`. Recomendado: restringir o aplicativo a essa caixa com uma *application access policy* do Exchange.

---

## Arquitetura

```
UI (React)  →  /api/* (Vercel Function única)  →  Casos de uso  →  Domínio puro
src/            server/http/router.ts             server/application  shared/domain
                                                       │
                                                       ▼
                                                Portas (ports.ts)
                                  ┌───────────────┬────┴───────────────┐
                           Supabase (produção)  Memória (demo)    UauGateway (real | simulado)
```

```
api/router.ts                     Vercel Function (rewrite /api/* → /api/router)
server/
  http/router.ts                  rotas finas + validação Zod + erros padronizados
  application/
    context.ts                    ator, permissões, AppError
    ports.ts                      interfaces: repositórios e UauGateway
    use-cases/requests.ts         fluxo da solicitação (inclui aprovação em dois passos)
    use-cases/catalog.ts          busca no cadastro, parecidos, prévia/validação
    use-cases/notifications.ts    aviso por e-mail na aprovação e na devolução (falha não derruba o fluxo)
    notifications/                conteúdo dos e-mails
  infrastructure/
    uau/                          cliente HTTP (token em cache, 401, normalização), gateway real e simulado
    supabase/                     cliente (service role) + repositórios
    memory/                       repositórios em memória + semente de demonstração
    email/                        Microsoft 365 (Graph), log e desligado
    session.ts                    escolhe repositórios e identifica o usuário
shared/
  domain/roles.ts                 papéis e permissões
  domain/request/                 máquina de estados, tipos de pedido
  domain/insumo/                  código, catálogo, parecidos, rascunho/validação, corpo do UAU
  contracts/                      DTOs + schemas Zod usados pela UI e pela API
  format.ts                       formatação pt-BR (sem float)
src/
  app/navigation.ts               rotas, menus por permissão, tela inicial por papel
  features/requests               solicitar, acompanhar, detalhe (obra)
  features/drafting               fila e criação do cadastro (analista)
  features/approval               fila e aprovação (gestão)
  features/insumo-form            formulário, conferência e prévia (compartilhado)
  features/catalog                insumos do UAU
  components/ui, components/layout
supabase/migrations/              esquema versionado
```

**Para crescer sem bagunça:** regra de negócio nova vai para `shared/domain` (com teste); operação nova é um caso de uso em `server/application/use-cases` + uma linha em `server/http/router.ts`; tela nova é uma pasta em `src/features` + rota em `App.tsx` + item em `src/app/navigation.ts`.

> **Não adicione `"type": "module"` ao `package.json`.** A Vercel compila a API arquivo por arquivo; como módulo ES, os imports sem extensão (`'../server/http/router'`) não são encontrados e toda rota `/api/*` falha com `FUNCTION_INVOCATION_FAILED`. Arquivos que precisam de módulo ES usam `.mts`/`.mjs`.

### Rotas da API

| Método | Rota | Quem |
|---|---|---|
| GET | `/api/me`, `/api/config` | todos |
| GET / POST | `/api/requests?scope=mine\|drafting\|approval\|all` | por papel |
| GET | `/api/requests/:id` | quem pode ver |
| POST | `/api/requests/:id/{cancel,start-draft,submit,return,reject,approve,resume}` | conforme o fluxo |
| PUT | `/api/requests/:id/draft` | analista / gestão |
| POST | `/api/requests/:id/preview` | analista / gestão (validação + JSON, não grava) |
| GET | `/api/catalog`, `/api/catalog/items/:codigo`, `/api/catalog/draft-context` | analista / gestão |
| GET | `/api/catalog/similar?q=` | todos |

---

## Integração com o UAU: diagnóstico

- **Tela Integração** (gestão): testa, a partir do servidor publicado, um login novo e uma busca pequena no UAU, com o tempo de cada passo e o motivo da falha (login recusado, tempo esgotado, servidor inacessível, possível bloqueio de IP, certificado). Não grava nada.
- **Logs da Vercel** (Project → Logs): uma linha `[uau] <rota> → HTTP <status> em <ms> ms` por chamada; falhas aparecem como `[uau] … → falhou: <motivo>`. Nunca há corpo nem credenciais no log.
- **`/api/health`** (público): modo atual e quais variáveis existem (só sim/não).
- Variáveis na Vercel: cole o valor exato, **sem aspas em volta**. A senha do UAU é usada como está (só espaços nas pontas são removidos), porque pode conter aspas.

## Segurança

- **Credenciais só no servidor** (`.env.local` / variáveis da Vercel). O navegador nunca fala com o UAU nem recebe token, login ou senha.
- O navegador usa o Supabase **só para login**. Tabelas com RLS ligado e sem políticas: só a API (service role) acessa, depois de validar o JWT e o papel.
- Gravação no UAU desligada por padrão (`UAU_GRAVACAO=simulacao`); a aprovação exige digitar o código para confirmar.
- Antes de cada commit: `npm run check:secrets`.

## Testes

```bash
npm run check    # typecheck (app + servidor) + "nenhum hex fora de tokens.css" + testes
npm test         # domínio (código, parecidos, validação, corpo do UAU, fluxo) + API completa em modo memória
```

## Próximos passos sugeridos

1. Confirmar com o administrador do UAU se há base de homologação e testar `UAU_GRAVACAO=real` lá.
2. Restringir o usuário PORTAL no UAU (hoje sem grupo e sem segurança) aos programas que o app usa.
3. Configurar o envio real de e-mail (Microsoft 365) e, se fizer sentido, avisar também nas outras etapas (devolução, recusa).
4. Lista de obras vinda do UAU (`Obras/ObterObrasAtivas`) no lugar do campo de texto.
5. Exportar o cadastro filtrado em CSV na tela "Insumos UAU".
