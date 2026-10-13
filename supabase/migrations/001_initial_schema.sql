-- =============================================================================
-- Cadastro de Insumos — esquema inicial
--
-- Acesso: o navegador só faz login (Supabase Auth). Leitura e gravação passam pela API,
-- que usa a service role e aplica as permissões por papel. Por isso o RLS fica ligado
-- SEM políticas para anon/authenticated: ninguém acessa as tabelas direto do navegador.
-- =============================================================================

-- Perfis: um por usuário do Supabase Auth -------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text,
  role        text not null check (role in ('obra', 'analista', 'gestor')),
  -- Obra padrão de quem tem o papel "obra"
  work_name   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Papel de cada usuário: obra (solicita), analista (cadastra), gestor (aprova e grava no UAU).';

-- Solicitações ----------------------------------------------------------------
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

-- Histórico (append-only) -----------------------------------------------------
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
  -- Corpo enviado e resposta do UAU (sem credenciais)
  details      jsonb
);

create index insumo_request_events_request_idx on public.insumo_request_events (request_id, at);

create or replace function public.forbid_event_changes() returns trigger language plpgsql as $$
begin
  raise exception 'EVENTS_APPEND_ONLY: o histórico não pode ser alterado';
end $$;

create trigger insumo_request_events_append_only
  before update or delete on public.insumo_request_events
  for each row execute function public.forbid_event_changes();

-- RLS ligado, sem políticas: só a service role (API) acessa -------------------
alter table public.profiles enable row level security;
alter table public.insumo_requests enable row level security;
alter table public.insumo_request_events enable row level security;
