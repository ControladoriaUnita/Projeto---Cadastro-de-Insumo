import { describe, expect, it } from 'vitest'
import { describeNetworkError } from './uau-client'

// Formato do erro do fetch do Node (undici): TypeError('fetch failed') com a causa em `cause.code`
const fetchFailed = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code } })

describe('falhas de rede com o UAU', () => {
  it('explica tempo esgotado, DNS, conexão recusada e possível bloqueio de IP', () => {
    expect(describeNetworkError(Object.assign(new Error('x'), { name: 'TimeoutError' }), 60_000)).toContain('não respondeu em 60 s')
    expect(describeNetworkError(fetchFailed('ENOTFOUND'), 1)).toContain('UAU_BASE_URL')
    expect(describeNetworkError(fetchFailed('ECONNREFUSED'), 1)).toContain('recusou a conexão')
    expect(describeNetworkError(fetchFailed('UND_ERR_CONNECT_TIMEOUT'), 1)).toContain('bloqueio por IP')
    expect(describeNetworkError(fetchFailed('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), 1)).toContain('Certificado')
  })

  it('nunca devolve vazio', () => {
    expect(describeNetworkError(new Error('qualquer'), 1)).toContain('qualquer')
    expect(describeNetworkError(undefined, 1)).toContain('erro desconhecido')
  })
})
