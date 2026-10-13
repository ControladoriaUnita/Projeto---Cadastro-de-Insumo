# Banco de dados (Supabase)

O que fica no Supabase:

| Tabela | Conteúdo |
|---|---|
| `profiles` | um perfil por usuário do Supabase Auth: nome, e-mail, papel (`obra`, `analista`, `gestor`), obra padrão e se está ativo |
| `insumo_requests` | as solicitações, com o rascunho do cadastro (`draft`, em JSON) e o resultado no UAU |
| `insumo_request_events` | o histórico de cada solicitação (não pode ser alterado nem apagado) |

O cadastro de insumos continua no UAU, que é a fonte oficial; a plataforma lê de lá.

## 1. Criar as tabelas

No painel do Supabase: **SQL Editor → New query**, cole todo o conteúdo de
[`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql) e clique em **Run**.
Deve terminar com "Success. No rows returned".

Rode só uma vez. Mudanças futuras no banco viram novos arquivos (`002_...sql`, `003_...sql`), aplicados na ordem.

## 2. Criar os usuários

**Authentication → Users → Add user → Create new user**: e-mail e senha, com
"Auto Confirm User" marcado. O banco cria o perfil sozinho, **inativo** e com papel `obra`.
Enquanto estiver inativo, a pessoa entra mas vê "Usuário sem perfil".

## 3. Liberar e definir o papel

No **SQL Editor**, ajuste e rode (um bloco por pessoa):

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
| chave `anon` / publishable | `SUPABASE_ANON_KEY` | servidor (repassa à tela de login pela rota pública `/api/auth-config`) |
| chave `service_role` / secret | `SUPABASE_SERVICE_ROLE_KEY` | **só servidor**, nunca com `VITE_` |

E `DATA_SOURCE=supabase`. Localmente, no `.env.local`; na Vercel, em Settings → Environment Variables.

## 5. Endereços do login (link de "esqueci minha senha")

**Authentication → URL Configuration**:

- **Site URL**: o endereço do app na Vercel (ex.: `https://cadastro-insumos.vercel.app`).
- **Redirect URLs**: adicione `https://<seu-app>.vercel.app/redefinir-senha` e, para testar no
  computador, `http://localhost:5174/redefinir-senha`.

Sem isso, o link do e-mail de recuperação abre o endereço errado.

## Como o login funciona

1. A tela pergunta ao servidor (`/api/auth-config`, público) se o app usa o Supabase ou o modo demonstração.
2. O login (e-mail e senha) é feito no Supabase Auth; o navegador recebe um token de sessão.
3. Toda chamada à API leva o token. O servidor confere o token no Supabase, lê o perfil em
   `profiles` e só libera quem tem `active = true`; o papel vem da coluna `role`.
4. Login certo com perfil inativo: a tela mostra "Acesso aguardando liberação".

## Segurança

- RLS ligado em todas as tabelas, sem políticas, e sem permissão para `anon`/`authenticated`:
  o navegador só usa o Supabase para login.
- Só a API (no servidor, com a chave `service_role`) lê e grava, depois de validar o login e o papel.
