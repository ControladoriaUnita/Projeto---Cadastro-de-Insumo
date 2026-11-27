# Banco de dados (Supabase)

O que fica no Supabase:

| Tabela | Conteúdo |
|---|---|
| `profiles` | um perfil por usuário (login Microsoft 365): nome, e-mail, papel (`obra`, `analista`, `gestor`), obra padrão e se está ativo |
| `insumo_requests` | as solicitações, com o rascunho do cadastro (`draft`, em JSON) e o resultado no UAU |
| `insumo_request_events` | o histórico de cada solicitação (não pode ser alterado nem apagado) |
| `access_requests` | os pedidos de acesso feitos na tela de login |

O cadastro de insumos continua no UAU, que é a fonte oficial; a plataforma lê de lá.

## 1. Criar as tabelas

No painel do Supabase: **SQL Editor → New query**, cole o conteúdo de cada arquivo de
[`migrations/`](migrations/), **na ordem**, e clique em **Run**. Cada um deve terminar com
"Success. No rows returned". Cada arquivo roda uma vez só.

| Arquivo | O que faz |
|---|---|
| `001_initial_schema.sql` | perfis, solicitações e histórico |
| `002_access_requests.sql` | pedidos de acesso e criação automática do perfil aprovado |
| `003_obra_sem_login_e_ajuste.sql` | obra solicita sem login; situação "requer ajuste" |
| `004_email_do_solicitante.sql` | e-mail do solicitante (recebe os avisos de aprovação e de ajuste) |
| `005_login_microsoft.sql` | login pelo Microsoft 365: perfil independente do Supabase Auth, `entra_oid` e `last_login_at` |

O login é pelo **Microsoft 365** (ver o README principal). O Supabase Auth não é mais usado.

## 2. Liberar um acesso (fluxo normal)

Qualquer pessoa da Unità entra com a conta Microsoft 365. No **primeiro login** o servidor cria
o perfil dela, **já ativo, como obra** (nome e e-mail vêm da Microsoft): ela já pode solicitar
insumos e acompanhar os próprios pedidos.

Para analista ou gestão, quem precisa clica em **"Solicitar acesso"** no login:

1. **Table Editor → `access_requests`**: veja os pedidos com `status = pendente`.
2. Mude o papel da pessoa em `profiles` (passo 3) e marque o pedido como `atendido`
   (ou `recusado`). O campo `notes` é para anotações internas.

Também dá para cadastrar alguém **antes** do primeiro login: insira o perfil com o e-mail
corporativo; no login a Microsoft é ligada a ele pelo e-mail.

```sql
insert into public.profiles (full_name, email, role, active)
values ('Nome do Analista', 'analista@unitaengenharia.com.br', 'analista', true);
```

## 3. Ajustar papéis à mão

Para mudar papel, obra ou liberar alguém que não fez pedido, no **SQL Editor** (um bloco por pessoa):

```sql
-- Gestão: acesso a tudo, aprova e grava no UAU
update public.profiles set full_name = 'Lucas · Controladoria', role = 'gestor', active = true
where email = 'lucas@unitaengenharia.com.br';

-- Analista de cadastro
update public.profiles set full_name = 'Nome do Analista', role = 'analista', active = true
where email = 'analista@unitaengenharia.com.br';

-- Obra (work_name = obra que aparece preenchida na solicitação)
update public.profiles set full_name = 'Nome da Pessoa', role = 'obra', work_name = 'Pazza Ipanema 212', active = true
where email = 'obra@unitaengenharia.com.br';
```

Para conferir: `select email, full_name, role, work_name, active from public.profiles order by role, full_name;`

Para bloquear alguém sem apagar o histórico: `update public.profiles set active = false where email = '...';`

## 4. Chaves para o app

**Project Settings → API Keys** (ou **API**):

| No Supabase | Variável | Onde |
|---|---|---|
| Project URL (`https://<id>.supabase.co`, não o endereço do painel) | `SUPABASE_URL` | servidor |
| chave `anon` / publishable | `SUPABASE_ANON_KEY` | opcional: só o `npm run check:supabase` usa, para conferir o RLS |
| chave `service_role` / secret | `SUPABASE_SERVICE_ROLE_KEY` | **só servidor**, nunca com `VITE_` |

E `DATA_SOURCE=supabase`. Localmente, no `.env.local`; na Vercel, em Settings → Environment Variables.

## Como o login funciona

1. A tela pergunta ao servidor (`/api/auth-config`, público) se o login é Microsoft (`AUTH_MODE=entra`) ou demonstração.
2. O botão **Entrar com Microsoft 365** abre o login da Microsoft num **popup** (o app roda em iframe no portal).
3. O servidor troca o código pelo `id_token`, acha o perfil (pelo `entra_oid` ou pelo e-mail; se não
   existir, cria como obra) e devolve ao app um token de sessão próprio, assinado com `SESSION_SECRET`, válido por 12 h.
4. Toda chamada à API leva o token. O servidor lê o perfil em `profiles` e só libera quem tem
   `active = true`; o papel vem da coluna `role`. Perfil desativado vê "Acesso desativado".

## Segurança

- RLS ligado em todas as tabelas, sem políticas, e sem permissão para `anon`/`authenticated`:
  o navegador não fala com o Supabase.
- Só a API (no servidor, com a chave `service_role`) lê e grava, depois de validar o login e o papel.
