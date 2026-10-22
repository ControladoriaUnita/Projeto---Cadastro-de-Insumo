-- =============================================================================
-- E-mail do solicitante
--
-- A obra entra sem login, então o e-mail digitado no formulário é o único jeito de avisá-la
-- quando o insumo for aprovado ou a solicitação voltar para ajuste. Obrigatório no formulário;
-- fica opcional no banco porque as solicitações antigas não têm.
-- =============================================================================

alter table public.insumo_requests add column if not exists requester_email text;
