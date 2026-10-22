import { describe, expect, it } from 'vitest'
import { computeDeadlines, type DeadlineEvent } from './deadline'
import type { RequestEventType } from './workflow'

/** Dia N às 9h (UTC) */
const day = (n: number, hour = 9) => new Date(Date.UTC(2026, 9, n, hour)).toISOString()
const ev = (type: RequestEventType, at: string): DeadlineEvent => ({ type, at })
const at = (n: number, hour = 9) => new Date(day(n, hour))

describe('prazo das etapas', () => {
  it('cadastro conta 3 dias desde a abertura; aprovação ainda não começou', () => {
    const events = [ev('created', day(1)), ev('start_draft', day(2))]
    expect(computeDeadlines(events, at(4)).cadastro).toEqual({ state: 'dentro_do_prazo', startedAt: day(1), dueAt: day(4), doneAt: null })
    expect(computeDeadlines(events, at(4, 10)).cadastro?.state).toBe('vencido')
    expect(computeDeadlines(events, at(4)).aprovacao).toBeNull()
  })

  it('envio conclui o cadastro e inicia a aprovação', () => {
    const d = computeDeadlines([ev('created', day(1)), ev('submit', day(6))], at(8))
    expect(d.cadastro).toMatchObject({ state: 'concluido', doneAt: day(6) })
    expect(d.aprovacao).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(6), dueAt: day(9) })
  })

  it('devolver à obra reinicia o prazo do cadastro sem mexer na aprovação', () => {
    const base = [ev('created', day(1)), ev('submit', day(2)), ev('return', day(3))]
    const before = computeDeadlines(base, at(10))
    const after = computeDeadlines([...base, ev('request_adjustment', day(9))], at(10))
    expect(before.cadastro?.state).toBe('concluido')
    expect(after.cadastro).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(9), dueAt: day(12) })
    expect(after.aprovacao).toEqual(before.aprovacao)
  })

  it('devolução feita antes do envio também reinicia o cadastro', () => {
    const events = [ev('created', day(1)), ev('request_adjustment', day(3)), ev('resubmit', day(5))]
    expect(computeDeadlines(events, at(6)).cadastro).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(3) })
    expect(computeDeadlines(events, at(7)).cadastro?.state).toBe('vencido')
  })

  it('devolver ao analista reinicia o prazo da aprovação sem mexer no cadastro', () => {
    const base = [ev('created', day(1)), ev('submit', day(2))]
    const before = computeDeadlines(base, at(10))
    const after = computeDeadlines([...base, ev('return', day(9))], at(10))
    expect(before.aprovacao?.state).toBe('vencido')
    expect(after.aprovacao).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(9), dueAt: day(12) })
    expect(after.cadastro).toEqual(before.cadastro)
  })

  it('reenvio depois da devolução não reinicia a aprovação', () => {
    const events = [ev('created', day(1)), ev('submit', day(2)), ev('return', day(3)), ev('submit', day(5))]
    expect(computeDeadlines(events, at(7)).aprovacao).toMatchObject({ state: 'vencido', startedAt: day(3) })
  })

  it('aprovar conclui; falha no UAU volta a contar sem reiniciar', () => {
    const approved = [ev('created', day(1)), ev('submit', day(2)), ev('approve', day(3))]
    expect(computeDeadlines(approved, at(20)).aprovacao).toMatchObject({ state: 'concluido', doneAt: day(3) })
    const failed = [...approved, ev('uau_insert_failed', day(3, 10))]
    expect(computeDeadlines(failed, at(4)).aprovacao).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(2) })
    expect(computeDeadlines(failed, at(6)).aprovacao?.state).toBe('vencido')
  })

  it('recusar ou cancelar encerra a etapa em andamento', () => {
    const rejected = computeDeadlines([ev('created', day(1)), ev('submit', day(2)), ev('reject', day(8))], at(20))
    expect(rejected.cadastro).toMatchObject({ state: 'concluido', doneAt: day(2) })
    expect(rejected.aprovacao).toMatchObject({ state: 'concluido', doneAt: day(8) })
    const cancelled = computeDeadlines([ev('created', day(1)), ev('cancel', day(2))], at(20))
    expect(cancelled).toEqual({ cadastro: { state: 'concluido', startedAt: day(1), dueAt: day(4), doneAt: day(2) }, aprovacao: null })
  })

  it('ignora a ordem de chegada e os eventos que não são de prazo', () => {
    const events = [ev('email_sent', day(4)), ev('submit', day(2)), ev('save_draft', day(3)), ev('created', day(1))]
    expect(computeDeadlines(events, at(4)).aprovacao).toMatchObject({ state: 'dentro_do_prazo', startedAt: day(2) })
  })
})
