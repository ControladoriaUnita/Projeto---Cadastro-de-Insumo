-- =============================================================================
-- Login pelo Microsoft 365 (Entra ID)
--
-- 1. O login deixa de ser pelo Supabase Auth: o perfil não depende mais de auth.users.
--    Perfis antigos mantêm o mesmo id (as solicitações continuam ligadas a eles).
-- 2. entra_oid: object id da conta Microsoft, gravado no 1º login (o vínculo inicial é
--    pelo e-mail). last_login_at: último login.
-- 3. Conta nova da organização entra como obra, já ativa (criada pelo servidor). A gestão
--    muda o papel (analista/gestor) ou desativa (active = false) direto nesta tabela.
-- =============================================================================

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

alter table public.profiles add column if not exists entra_oid text;
alter table public.profiles add column if not exists last_login_at timestamptz;

create unique index if not exists profiles_entra_oid_idx on public.profiles (entra_oid) where entra_oid is not null;
-- Busca do login por e-mail sem diferenciar maiúsculas
create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email)) where email is not null;

comment on column public.profiles.entra_oid is 'Object id da conta Microsoft 365 (Entra ID), gravado no primeiro login.';
