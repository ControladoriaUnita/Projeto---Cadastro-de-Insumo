/**
 * Prazo da solicitação, deduzido do histórico: 3 dias corridos da abertura até a aprovação.
 *
 *   começa     na abertura (`created`);
 *   pausa      quando o analista devolve à obra (`request_adjustment`): o tempo com a obra não conta;
 *   reinicia   quando a obra reenvia (`resubmit`): mais 3 dias a partir do reenvio;
 *   termina    ao aprovar (`approve`). Se o UAU recusar a inserção, volta a contar sem reiniciar.
 *
 * Enviar para aprovação (`submit`) e a gestão devolver ao analista (`return`) não mexem no prazo.
 * Recusar ou cancelar encerra a contagem.
 */
import type { RequestEventType } from './workflow'

export const REQUEST_DEADLINE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export type DeadlineState = 'dentro_do_prazo' | 'vencido' | 'aguardando_obra' | 'concluido'

export interface RequestDeadline {
  state: DeadlineState
  /** Início da contagem: abertura, último reenvio da obra ou, em `aguardando_obra`, a devolução */
  startedAt: string
  /** null em `aguardando_obra` (o prazo só volta a existir quando a obra reenviar) */
  dueAt: string | null
  /** Quando a contagem terminou (só em `concluido`) */
  doneAt: string | null
}

/** O mínimo do evento que a regra precisa. */
export interface DeadlineEvent {
  at: string
  type: RequestEventType
}

/** Eventos que mexem no prazo (o resto do histórico é ignorado). */
export const DEADLINE_EVENT_TYPES: readonly RequestEventType[] = ['created', 'request_adjustment', 'resubmit', 'approve', 'uau_insert_failed', 'reject', 'cancel']

interface Clock {
  startedAt: string
  paused: boolean
  doneAt: string | null
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString()

/** null = sem abertura no histórico */
export function computeDeadline(events: readonly DeadlineEvent[], now: Date): RequestDeadline | null {
  let clock: Clock | null = null
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at))
  for (const e of sorted) {
    if (e.type === 'created') {
      clock = { startedAt: e.at, paused: false, doneAt: null }
      continue
    }
    if (!clock) continue
    switch (e.type) {
      case 'request_adjustment':
        if (!clock.doneAt) clock = { startedAt: e.at, paused: true, doneAt: null }
        break
      case 'resubmit':
        if (!clock.doneAt) clock = { startedAt: e.at, paused: false, doneAt: null }
        break
      case 'approve':
        if (!clock.doneAt) clock.doneAt = e.at
        break
      case 'uau_insert_failed':
        clock.doneAt = null
        break
      case 'reject':
      case 'cancel':
        if (!clock.doneAt) clock.doneAt = e.at
        break
    }
  }
  if (!clock) return null
  if (clock.paused && !clock.doneAt) return { state: 'aguardando_obra', startedAt: clock.startedAt, dueAt: null, doneAt: null }
  const dueAt = addDays(clock.startedAt, REQUEST_DEADLINE_DAYS)
  const state: DeadlineState = clock.doneAt ? 'concluido' : now.getTime() > Date.parse(dueAt) ? 'vencido' : 'dentro_do_prazo'
  return { state, startedAt: clock.startedAt, dueAt, doneAt: clock.doneAt }
}
