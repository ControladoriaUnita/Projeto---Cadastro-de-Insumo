-- =============================================================================
-- Obra sem login e devolução para ajuste
--
-- 1. A obra solicita sem login: o solicitante fica vazio (requester_id null) e o nome
--    digitado no formulário vai em requester_name.
-- 2. Nova situação `requer_ajuste`: o analista devolve a solicitação à obra com um comentário;
--    a obra corrige e reenvia.
-- =============================================================================

alter table public.insumo_requests alter column requester_id drop not null;

alter table public.insumo_requests drop constraint if exists insumo_requests_status_check;
alter table public.insumo_requests add constraint insumo_requests_status_check check (status in (
  'solicitado', 'requer_ajuste', 'em_cadastro', 'aguardando_aprovacao', 'em_insercao',
  'inserido_nao_confirmado', 'aprovado', 'recusado', 'cancelado'));
