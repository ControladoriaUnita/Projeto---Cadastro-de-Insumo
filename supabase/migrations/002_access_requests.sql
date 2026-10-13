-- =============================================================================
-- Pedidos de acesso
--
-- A tela de login não cria contas: quem não tem acesso preenche um pedido, que cai em
-- `access_requests`. A gestão revisa no Table Editor (ajusta o papel e marca `aprovado`) e
-- convida a pessoa pelo Supabase Auth. Ao criar o usuário, o perfil já nasce ATIVO com o
-- papel aprovado, e o pedido passa para `atendido`.
-- =============================================================================

create table public.access_requests (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (email = lower(email) and email like '%_@_%'),
  full_name       text not null,
  -- Papel que a pessoa pediu
  requested_role  text not null check (requested_role in ('obra', 'analista', 'gestor')),
  work_name       text,
  message         text,
  -- pendente → aprovado/recusado (gestão) → atendido (usuário criado)
  status          text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'atendido')),
  -- Papel liberado pela gestão; vazio = o pedido
  approved_role   text check (approved_role in ('obra', 'analista', 'gestor')),
  -- Anotação interna da gestão (não aparece para quem pediu)
  notes           text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  fulfilled_at    timestamptz,
  user_id         uuid references auth.users (id) on delete set null
);

comment on table public.access_requests is 'Pedidos de acesso feitos na tela de login. Marque status = aprovado (e approved_role, se quiser outro papel) e convide o e-mail pelo Supabase Auth.';
comment on column public.access_requests.status is 'pendente | aprovado | recusado | atendido (preenchido sozinho quando o usuário é criado)';
comment on column public.access_requests.approved_role is 'Papel liberado: obra | analista | gestor. Vazio = o papel pedido.';

-- Um pedido em aberto por e-mail (repetições são ignoradas pela API)
create unique index access_requests_one_open_idx on public.access_requests (email) where status in ('pendente', 'aprovado');
create index access_requests_status_idx on public.access_requests (status, created_at);

-- reviewed_at preenchido quando a gestão muda o status
create or replace function public.access_requests_review_time() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('aprovado', 'recusado') then
    new.reviewed_at := now();
  end if;
  return new;
end $$;

create trigger access_requests_review before update on public.access_requests
  for each row execute function public.access_requests_review_time();

-- -----------------------------------------------------------------------------
-- Criação do usuário: perfil ativo se houver pedido aprovado com o mesmo e-mail
-- (substitui a função da migration 001)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.access_requests%rowtype;
begin
  select * into req
  from public.access_requests
  where email = lower(new.email) and status = 'aprovado'
  order by created_at desc
  limit 1;

  if found then
    insert into public.profiles (id, full_name, email, role, work_name, active)
    values (new.id, req.full_name, lower(new.email), coalesce(req.approved_role, req.requested_role), req.work_name, true)
    on conflict (id) do nothing;

    update public.access_requests
    set status = 'atendido', fulfilled_at = now(), user_id = new.id
    where id = req.id;
  else
    -- Sem pedido aprovado: perfil inativo, liberado depois pela gestão (supabase/README.md)
    insert into public.profiles (id, full_name, email)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
      lower(new.email)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Acesso: só a API (service role) grava os pedidos; o navegador não lê nada
-- -----------------------------------------------------------------------------
alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;
grant select, insert, update on public.access_requests to service_role;
