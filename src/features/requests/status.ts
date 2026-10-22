/**
 * Como cada situação aparece na tela (rótulo, cor e texto para a obra).
 */
import type { DeadlineState } from '@shared/domain/request/deadline'
import type { RequestEventType, RequestStatus } from '@shared/domain/request/workflow'
import type { Tone } from '@/components/ui'

interface StatusMeta {
  label: string
  tone: Tone
  /** Explicação em linguagem simples (tela da obra) */
  hint: string
  /** Etapa na linha do tempo (0..3); null = fora do caminho feliz */
  step: number | null
}

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  solicitado: { label: 'Solicitado', tone: 'primary', hint: 'Aguardando o analista iniciar o cadastro.', step: 0 },
  requer_ajuste: { label: 'Requer ajuste', tone: 'warning', hint: 'O analista devolveu a solicitação. Veja o comentário, ajuste e reenvie.', step: 0 },
  em_cadastro: { label: 'Em cadastro', tone: 'info', hint: 'O analista está montando o cadastro do insumo.', step: 1 },
  aguardando_aprovacao: { label: 'Em aprovação', tone: 'warning', hint: 'Cadastro pronto, aguardando a gestão revisar e aprovar.', step: 2 },
  em_insercao: { label: 'Inserindo no UAU', tone: 'warning', hint: 'A gestão aprovou e o insumo está sendo gravado no UAU.', step: 2 },
  inserido_nao_confirmado: { label: 'No UAU, sem confirmação', tone: 'warning', hint: 'O insumo foi criado no UAU; falta confirmar a situação.', step: 3 },
  aprovado: { label: 'Aprovado', tone: 'success', hint: 'Insumo criado e confirmado no UAU. Já pode ser usado.', step: 3 },
  recusado: { label: 'Recusado', tone: 'error', hint: 'A solicitação não seguiu. Veja o motivo.', step: null },
  cancelado: { label: 'Cancelado', tone: 'neutral', hint: 'Cancelada por quem solicitou.', step: null },
}

export const STEPS = ['Solicitado', 'Cadastro', 'Aprovação', 'No UAU'] as const

export const EVENT_LABELS: Record<RequestEventType, string> = {
  created: 'Solicitação aberta',
  cancel: 'Solicitação cancelada',
  start_draft: 'Cadastro iniciado',
  save_draft: 'Cadastro ajustado pela gestão',
  submit: 'Enviado para aprovação',
  return: 'Devolvido ao analista',
  reject: 'Solicitação recusada',
  approve: 'Aprovado pela gestão',
  resume: 'Inserção retomada',
  uau_inserted: 'Insumo inserido no UAU (não confirmado)',
  uau_insert_failed: 'O UAU recusou a inserção',
  uau_confirmed: 'Situação confirmada no UAU',
  uau_confirm_failed: 'Falha ao confirmar no UAU',
  uau_already_present: 'Insumo já estava no UAU',
  email_sent: 'Aviso enviado por e-mail',
  email_failed: 'Falha ao enviar o aviso por e-mail',
  request_adjustment: 'Devolvido à obra para ajuste',
  resubmit: 'Solicitação ajustada e reenviada',
}

const FAILURES: RequestEventType[] = ['uau_insert_failed', 'uau_confirm_failed', 'reject', 'email_failed']
export const isFailureEvent = (t: RequestEventType) => FAILURES.includes(t)

export const DEADLINE_META: Record<DeadlineState, { label: string; tone: Tone }> = {
  dentro_do_prazo: { label: 'Dentro do prazo', tone: 'success' },
  vencido: { label: 'Prazo vencido', tone: 'error' },
  aguardando_obra: { label: 'Com a obra', tone: 'info' },
  concluido: { label: 'Concluído', tone: 'neutral' },
}
