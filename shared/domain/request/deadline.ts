/**
 * Prazo das etapas de cadastro (analista) e de aprovação (gestão), deduzido do histórico.
 *
 * Cada etapa tem 3 dias contados de forma independente, a partir da última interação válida dela:
 *
 *   cadastro   começa na abertura (`created`) e reinicia quando o analista devolve à obra
 *              (`request_adjustment`); termina ao enviar para aprovação (`submit`).
 *   aprovação  começa no primeiro envio (`submit`) e reinicia quando a gestão devolve ao analista
 *              (`return`); termina ao aprovar (`approve`). Se o UAU recusar a inserção, a etapa
 *              volta a contar sem reiniciar.
 *
 * Uma interação de uma etapa nunca mexe no prazo da outra. Recusar ou cancelar encerra a etapa
 * em andamento.
 */
import type { RequestEventType } from './workflow'

export const STAGE_DEADLINE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export type DeadlineStage = 'cadastro' | 'aprovacao'
export type DeadlineState = 'dentro_do_prazo' | 'vencido' | 'concluido'

export interface StageDeadline {
  state: DeadlineState
  /** Última interação válida (início da contagem) */
  startedAt: string
  dueAt: string
  /** Quando a etapa terminou (só em `concluido`) */
  doneAt: string | null
}

/** null = a etapa ainda não começou (ou nunca vai começar) */
export type RequestDeadlines = Record<DeadlineStage, StageDeadline | null>

/** O mínimo do evento que a regra precisa. */
export interface DeadlineEvent {
  at: string
  type: RequestEventType
}

/** Eventos que mexem em algum prazo (o resto do histórico é ignorado). */
export const DEADLINE_EVENT_TYPES: readonly RequestEventType[] = ['created', 'request_adjustment', 'submit', 'return', 'approve', 'uau_insert_failed', 'reject', 'cancel']

interface Clock {
  startedAt: string
  doneAt: string | null
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString()

function evaluate(clock: Clock | null, now: Date): StageDeadline | null {
  if (!clock) return null
  const dueAt = addDays(clock.startedAt, STAGE_DEADLINE_DAYS)
  const state: DeadlineState = clock.doneAt ? 'concluido' : now.getTime() > Date.parse(dueAt) ? 'vencido' : 'dentro_do_prazo'
  return { state, startedAt: clock.startedAt, dueAt, doneAt: clock.doneAt }
}

export function computeDeadlines(events: readonly DeadlineEvent[], now: Date): RequestDeadlines {
  let cadastro: Clock | null = null
  let aprovacao: Clock | null = null
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at))
  for (const e of sorted) {
    switch (e.type) {
      case 'created':
      case 'request_adjustment':
        cadastro = { startedAt: e.at, doneAt: null }
        break
      case 'submit':
        if (cadastro && !cadastro.doneAt) cadastro.doneAt = e.at
        if (!aprovacao) aprovacao = { startedAt: e.at, doneAt: null }
        break
      case 'return':
        aprovacao = { startedAt: e.at, doneAt: null }
        break
      case 'approve':
        if (aprovacao) aprovacao.doneAt = e.at
        break
      case 'uau_insert_failed':
        if (aprovacao) aprovacao.doneAt = null
        break
      case 'reject':
      case 'cancel':
        for (const clock of [cadastro, aprovacao]) if (clock && !clock.doneAt) clock.doneAt = e.at
        break
    }
  }
  return { cadastro: evaluate(cadastro, now), aprovacao: evaluate(aprovacao, now) }
}
