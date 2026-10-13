-- =============================================================================
-- Cadastro de Insumos — esquema inicial
--
-- Acesso: o navegador só faz login (Supabase Auth). Leitura e gravação passam pela API,
-- que usa a service role e aplica as permissões por papel. Por isso o RLS fica ligado
-- SEM políticas e anon/authenticated não têm acesso: ninguém lê as tabelas direto do navegador.
--
-- O cadastro de insumos em si continua no UAU (fonte oficial); aqui ficam usuários,
-- solicitações e o histórico de cada uma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfis: um por usuário do Supabase Auth
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text unique,
  role        text not null default 'obra' check (role in ('obra', 'analista', 'gestor')),
  -- Obra padrão de quem tem o papel "obra"
  work_name   text,
  -- Usuário novo entra inativo: a gestão libera e define o papel (ver supabase/README.md)
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Papel de cada usuário: obra (solicita), analista (cadastra), gestor (aprova e grava no UAU).';

-- Cria o perfil (inativo) assim que um usuário é criado no Supabase Auth
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    lower(new.email)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Solicitações
-- -----------------------------------------------------------------------------
create table public.insumo_requests (
  id              uuid primary key default gen_random_uuid(),
  number          integer generated always as identity unique,
  status          text not null default 'solicitado' check (status in (
                    'solicitado', 'em_cadastro', 'aguardando_aprovacao', 'em_insercao',
                    'inserido_nao_confirmado', 'aprovado', 'recusado', 'cancelado')),
  kind            text not null check (kind in ('material', 'servico', 'despesa_indireta')),
  urgency         text not null default 'normal' check (urgency in ('normal', 'urgente')),
  work_name       text not null,
  description     text not null,
  unit            text not null,
  specification   text not null default '',
  justification   text not null,
  requester_id    uuid not null references public.profiles (id),
  requester_name  text not null,
  analyst_id      uuid references public.profiles (id),
  analyst_name    text,
  approver_id     uuid references public.profiles (id),
  approver_name   text,
  -- Rascunho do cadastro (formato InsumoDraft em shared/domain/insumo/draft.ts)
  draft           jsonb,
  uau_code        text,
  inserted_at     timestamptz,
  confirmed_at    timestamptz,
  last_comment    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index insumo_requests_status_idx on public.insumo_requests (status);
create index insumo_requests_requester_idx on public.insumo_requests (requester_id);

-- Um código do UAU só pode estar em um cadastro em andamento ou aprovado
create unique index insumo_requests_active_code_idx
  on public.insumo_requests ((draft ->> 'codigo'))
  where status in ('aguardando_aprovacao', 'em_insercao', 'inserido_nao_confirmado', 'aprovado')
    and coalesce(draft ->> 'codigo', '') <> '';

-- -----------------------------------------------------------------------------
-- Histórico (append-only): não pode ser alterado nem apagado.
-- Consequência: uma solicitação com histórico também não pode ser apagada (o cascade é barrado).
-- -----------------------------------------------------------------------------
create table public.insumo_request_events (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.insumo_requests (id) on delete cascade,
  at           timestamptz not null default now(),
  actor_id     uuid references public.profiles (id),
  actor_name   text not null,
  type         text not null,
  from_status  text,
  to_status    text,
  comment      text,
  -- Corpo enviado e resposta do UAU, destinatários de e-mail (nunca credenciais)
  details      jsonb
);

create index insumo_request_events_request_idx on public.insumo_request_events (request_id, at);

create or replace function public.forbid_event_changes() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'EVENTS_APPEND_ONLY: o histórico não pode ser alterado';
end $$;

create trigger insumo_request_events_append_only
  before update or delete on public.insumo_request_events
  for each row execute function public.forbid_event_changes();

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger insumo_requests_touch before update on public.insumo_requests
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Acesso: RLS ligado e sem políticas; só a service role (API no servidor) acessa
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.insumo_requests enable row level security;
alter table public.insumo_request_events enable row level security;

revoke all on public.profiles, public.insumo_requests, public.insumo_request_events from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.insumo_requests to service_role;
grant select, insert on public.insumo_request_events to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
