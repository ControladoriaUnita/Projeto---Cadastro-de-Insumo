# Cadastro de Insumos — Unità Engenharia

Plataforma para pedir, cadastrar e aprovar **insumos novos no UAU** (Globaltec/Senior), com papéis separados:

```
Obra solicita ──▶ Analista cria o cadastro e pede aprovação ──▶ Gestão revisa, ajusta, insere no UAU e confirma
                  (nada é gravado no UAU até aqui)              (InserirInsumosGeral + AtualizarInsumosGeral)
```

Stack: **React 19 + TypeScript (strict) + Vite 7 + Tailwind CSS 4** · **Vercel Functions** · **Login Microsoft 365 (Entra ID)** · **Supabase (PostgreSQL)** · Zod · TanStack Query.
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

### Produção (Vercel + Supabase + Microsoft 365)

1. Crie o projeto no Supabase e aplique as migrations de `supabase/migrations/` na ordem (ver [`supabase/README.md`](supabase/README.md)).
2. Registre o app no Microsoft Entra ID (abaixo).
3. Na Vercel, configure as variáveis do `.env.example` com `DATA_SOURCE=supabase` e `AUTH_MODE=entra`. **Nunca** prefixe credenciais com `VITE_`.
4. Entre com a sua conta e dê os papéis na tela **Usuários** (só gestão). O primeiro gestor precisa ser definido uma vez no Supabase (ver `supabase/README.md`, passo 3). Quem é da obra entra direto: o primeiro login cria o perfil como obra.

### Usuários e permissões (tela da gestão)

Em **Usuários** a gestão vê quem usa o app e muda papel (Obra, Analista, Gestão), obra padrão e nome, desativa ou reativa acessos, cadastra alguém antes do primeiro login (é ligado à conta Microsoft pelo e-mail) e aprova ou recusa os pedidos de acesso. A mudança vale na próxima ação da pessoa. Para ninguém se trancar fora: você não tira o próprio papel de gestão nem se desativa, e o app nunca fica sem um gestor ativo.

### Login com o Microsoft 365

Toda tela do app exige login. A pessoa entra com a conta Microsoft 365 da Unità; o **nome** e o **e-mail** do login
preenchem o solicitante de cada pedido (é para esse e-mail que vão os avisos de aprovação, ajuste e recusa).

**Registro no Entra ID** (portal.azure.com → Microsoft Entra ID → *App registrations* → *New registration*):

1. *Supported account types*: **Accounts in this organizational directory only** (single tenant).
2. *Redirect URI*: plataforma **Web**, `https://<seu-app>.vercel.app/api/auth/microsoft/callback`
   (e, para testar no computador, `http://localhost:5174/api/auth/microsoft/callback`).
3. *Certificates & secrets* → *New client secret*. Copie o **Value** (aparece uma vez só).
4. *API permissions*: as delegadas `openid`, `profile` e `email` (Microsoft Graph) bastam; não precisa de consentimento de administrador.
5. Pode ser o mesmo registro usado para o envio de e-mail (`GRAPH_*`) ou um separado.

| Variável | Valor |
|---|---|
| `AUTH_MODE` | `entra` (login Microsoft) · `dev` (seletor de usuários de demonstração, só com `DATA_SOURCE=memory` e nunca em produção) |
| `ENTRA_TENANT_ID` | *Directory (tenant) ID* |
| `ENTRA_CLIENT_ID` | *Application (client) ID* |
| `ENTRA_CLIENT_SECRET` | o *Value* do client secret |
| `SESSION_SECRET` | texto aleatório com 32+ caracteres (assina a sessão; trocar derruba todas as sessões). Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | endereço público do app, **igual** ao do Redirect URI (sem `/` no fim) |

**Dentro do iframe do portal:** a Microsoft não deixa a página de login abrir dentro de um iframe, então o botão
**Entrar com Microsoft 365** abre o login num **popup**. Ao concluir, o popup entrega a sessão ao app e fecha sozinho.
A sessão vale 12 h e fica guardada no navegador (por portal). Requisitos no portal:

- Se o `<iframe>` tiver `sandbox`, inclua `allow-popups` e `allow-popups-to-escape-sandbox` (além de `allow-scripts allow-same-origin allow-forms`).
- O bloqueador de pop-ups pode pedir para liberar o site na primeira vez; a tela avisa quando isso acontece.

---

## Papéis e telas

| Papel | O que faz | Telas |
|---|---|---|
| **Obra** | Pede insumos e acompanha cada pedido | Solicitar insumo · Acompanhamento (só os próprios) |
| **Analista** | Monta o cadastro e envia para aprovação; pode recusar pedidos | Cadastro (fila + criação) · Insumos UAU · Acompanhamento |
| **Gestão** | Tudo, mais: ajusta o cadastro, aprova e grava no UAU, administra usuários | Aprovação (fila + revisão) · Usuários · todas as outras |

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

**Prazo:** são 3 dias úteis (segunda a sexta, horário de Brasília) da abertura da solicitação até a aprovação (`aprovado`), deduzidos do histórico (`shared/domain/request/deadline.ts`). Só a devolução à obra (`requer_ajuste`) mexe no prazo: enquanto a obra corrige, a contagem fica pausada ("Com a obra") e recomeça do zero quando ela reenviar. Enviar para aprovação e a gestão devolver ao analista não zeram o prazo; recusar ou cancelar encerram a contagem.

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

O solicitante é quem está logado: o pedido guarda o **nome e o e-mail da conta Microsoft 365** de quem abriu, e os avisos vão para esse e-mail. Os avisos:

| Quando | Para quem | Conteúdo |
|---|---|---|
| Insumo aprovado (inserido e confirmado no UAU) | e-mail do solicitante e analista; `EMAIL_APPROVAL_CC` em cópia | código, descrição, obra e link para a solicitação |
| Analista devolve à obra (*requer ajuste*) | e-mail do solicitante | motivo da devolução e link para ajustar e reenviar |

Uma falha no envio **não desfaz** a ação (aprovação ou devolução): fica registrada no histórico como "falha no e-mail". Solicitações antigas, sem e-mail do solicitante, avisam só quem tem perfil.

| `EMAIL_PROVIDER` | Comportamento |
|---|---|
| `log` (padrão) | o e-mail aparece só no terminal do servidor |
| `graph` | envio real pelo Microsoft 365 |
| `none` | desligado |

Para conferir a configuração, a gestão usa **Integração → Enviar e-mail de teste**: o teste vai para o e-mail de quem está logado e, se o Microsoft 365 recusar, a tela mostra o motivo.

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
- Login pelo **Microsoft 365** (Entra ID, fluxo *authorization code* com client secret no servidor). O servidor emite uma sessão própria assinada (HMAC, `SESSION_SECRET`, 12 h); o `state` e o `nonce` do login são conferidos, e contas de outro tenant são recusadas.
- O navegador não fala com o Supabase. Tabelas com RLS ligado e sem políticas: só a API (service role) acessa, depois de validar a sessão e o papel.
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
