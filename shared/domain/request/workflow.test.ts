import { describe, expect, it } from 'vitest'
import { permissionsFor, type RoleKey } from '../roles'
import { assertCanPerform, availableActions, canRead, type RequestStatus } from './workflow'

const actor = (id: string, role: RoleKey) => ({ id, permissions: permissionsFor(role) })
const OBRA = actor('obra', 'obra')
const OUTRA_OBRA = actor('outra', 'obra')
const ANALISTA = actor('analista', 'analista')
const GESTOR = actor('gestor', 'gestor')

const req = (status: RequestStatus) => ({ status, requesterId: 'obra' })

describe('fluxo da solicitação', () => {
  it('obra só cancela a própria solicitação ainda não iniciada', () => {
    expect(availableActions(req('solicitado'), OBRA)).toEqual(['cancel'])
    expect(availableActions(req('solicitado'), OUTRA_OBRA)).toEqual([])
    expect(availableActions(req('em_cadastro'), OBRA)).toEqual([])
  })

  it('analista inicia, salva, envia e recusa — mas não aprova', () => {
    expect(availableActions(req('solicitado'), ANALISTA)).toEqual(['start_draft', 'reject', 'request_adjustment'])
    expect(availableActions(req('em_cadastro'), ANALISTA)).toEqual(['save_draft', 'submit', 'reject', 'request_adjustment'])
    expect(availableActions(req('aguardando_aprovacao'), ANALISTA)).toEqual([])
  })

  it('gestor revisa, devolve, recusa e aprova', () => {
    expect(availableActions(req('aguardando_aprovacao'), GESTOR)).toEqual(['save_draft', 'return', 'reject', 'approve'])
    expect(availableActions(req('inserido_nao_confirmado'), GESTOR)).toEqual(['resume'])
    expect(availableActions(req('aprovado'), GESTOR)).toEqual([])
  })

  it('analista devolve à obra com comentário; a obra ajusta e reenvia', () => {
    expect(() => assertCanPerform('request_adjustment', req('solicitado'), ANALISTA, '')).toThrow('motivo')
    expect(availableActions(req('requer_ajuste'), OBRA)).toEqual(['cancel', 'resubmit'])
    expect(availableActions(req('requer_ajuste'), OUTRA_OBRA)).toEqual([])
    expect(availableActions(req('requer_ajuste'), ANALISTA)).toEqual([])
  })

  it('devolver e recusar exigem motivo', () => {
    expect(() => assertCanPerform('return', req('aguardando_aprovacao'), GESTOR, ' ')).toThrow('motivo')
    expect(() => assertCanPerform('return', req('aguardando_aprovacao'), GESTOR, 'Ajustar a unidade')).not.toThrow()
  })

  it('explica quando a ação não cabe na situação ou no perfil', () => {
    expect(() => assertCanPerform('approve', req('em_cadastro'), GESTOR)).toThrow('situação atual')
    expect(() => assertCanPerform('approve', req('aguardando_aprovacao'), ANALISTA)).toThrow('perfil')
  })

  it('obra vê só as próprias solicitações', () => {
    expect(canRead(req('solicitado'), OBRA)).toBe(true)
    expect(canRead(req('solicitado'), OUTRA_OBRA)).toBe(false)
    expect(canRead(req('solicitado'), ANALISTA)).toBe(true)
  })
})
