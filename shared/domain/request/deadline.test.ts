import { describe, expect, it } from 'vitest'
import { addBusinessDays, computeDeadline, type DeadlineEvent } from './deadline'
import type { RequestEventType } from './workflow'

/** Dia N de outubro/2026 às 9h (UTC). 1º/10 é quinta-feira; 3–4 e 10–11 são fim de semana. */
const day = (n: number, hour = 9) => new Date(Date.UTC(2026, 9, n, hour)).toISOString()
const ev = (type: RequestEventType, at: string): DeadlineEvent => ({ type, at })
const at = (n: number, hour = 9) => new Date(day(n, hour))

describe('prazo da solicitação', () => {
  it('conta 3 dias úteis desde a abertura (sábado e domingo não contam)', () => {
    const events = [ev('created', day(1)), ev('start_draft', day(2))]
    // quinta → sexta, segunda, terça
    expect(computeDeadline(events, at(6))).toEqual({ state: 'dentro_do_prazo', startedAt: day(1), dueAt: day(6), doneAt: null })
    expect(computeDeadline(events, at(6, 10))?.state).toBe('vencido')
  })

  it('dias úteis no horário de Brasília', () => {
    // sexta 15h em Brasília (18h UTC) → quarta 15h
    expect(addBusinessDays(day(2, 18), 3)).toBe(day(7, 18))
    // aberta no sábado → quarta, mesmo horário
    expect(addBusinessDays(day(3, 13), 3)).toBe(day(7, 13))
    // sexta 23h em Brasília (sábado 2h UTC) ainda é sexta: vence quarta 23h
    expect(addBusinessDays(day(3, 2), 3)).toBe(day(8, 2))
  })

  it('enviar para aprovação não mexe no prazo', () => {
    const events = [ev('created', day(1)), ev('submit', day(2))]
    expect(computeDeadline(events, at(3))).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(1), dueAt: day(6) })
    expect(computeDeadline(events, at(7))?.state).toBe('vencido')
  })

  it('devolver ao analista (return) não zera o prazo', () => {
    const events = [ev('created', day(1)), ev('submit', day(2)), ev('return', day(3)), ev('submit', day(3, 12))]
    expect(computeDeadline(events, at(7))).toMatchObject({ state: 'vencido', startedAt: day(1), dueAt: day(6) })
  })

  it('devolver à obra pausa; o reenvio da obra conta de novo os 3 dias úteis', () => {
    const returned = [ev('created', day(1)), ev('start_draft', day(2)), ev('request_adjustment', day(3))]
    expect(computeDeadline(returned, at(10))).toEqual({ state: 'aguardando_obra', startedAt: day(3), dueAt: null, doneAt: null })
    const resubmitted = [...returned, ev('resubmit', day(9))]
    // reenvio na sexta (9) → segunda, terça, quarta (14)
    expect(computeDeadline(resubmitted, at(14))).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(9), dueAt: day(14) })
    expect(computeDeadline(resubmitted, at(14, 10))?.state).toBe('vencido')
  })

  it('aprovar conclui; falha no UAU volta a contar sem reiniciar', () => {
    const approved = [ev('created', day(1)), ev('submit', day(2)), ev('approve', day(3))]
    expect(computeDeadline(approved, at(20))).toMatchObject({ state: 'concluido', doneAt: day(3) })
    const failed = [...approved, ev('uau_insert_failed', day(3, 10))]
    expect(computeDeadline(failed, at(5))).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(1) })
    expect(computeDeadline(failed, at(7))?.state).toBe('vencido')
  })

  it('recusar ou cancelar encerra a contagem', () => {
    const rejected = computeDeadline([ev('created', day(1)), ev('submit', day(2)), ev('reject', day(8))], at(20))
    expect(rejected).toMatchObject({ state: 'concluido', doneAt: day(8) })
    const cancelled = computeDeadline([ev('created', day(1)), ev('cancel', day(2))], at(20))
    expect(cancelled).toEqual({ state: 'concluido', startedAt: day(1), dueAt: day(6), doneAt: day(2) })
  })

  it('ignora a ordem de chegada e os eventos que não são de prazo', () => {
    const events = [ev('email_sent', day(4)), ev('resubmit', day(3)), ev('save_draft', day(3)), ev('request_adjustment', day(2)), ev('created', day(1))]
    expect(computeDeadline(events, at(4))).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(3) })
    expect(computeDeadline([], at(4))).toBeNull()
  })
})
