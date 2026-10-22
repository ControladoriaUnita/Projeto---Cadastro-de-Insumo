import { afterEach, describe, expect, it } from 'vitest'
import { getMailer, setMailerForTests } from './index'
import { GraphMailer } from './graph-mailer'

const graph = {
  EMAIL_PROVIDER: 'graph',
  GRAPH_TENANT_ID: '11111111-2222-3333-4444-555555555555',
  GRAPH_CLIENT_ID: '66666666-7777-8888-9999-000000000000',
  GRAPH_CLIENT_SECRET: 'abc8Q~valor.do.segredo_123',
  EMAIL_SENDER: 'cadastro@unitaengenharia.com.br',
}

afterEach(() => setMailerForTests(null))

describe('configuração do e-mail (Microsoft 365)', () => {
  it('lista as variáveis que faltam', () => {
    expect(() => getMailer({ EMAIL_PROVIDER: 'graph', GRAPH_TENANT_ID: graph.GRAPH_TENANT_ID })).toThrow(
      'GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, EMAIL_SENDER',
    )
  })

  it('avisa quando o segredo colado é o "ID do segredo" (GUID), não o valor', () => {
    expect(() => getMailer({ ...graph, GRAPH_CLIENT_SECRET: ' 0d1e2f3a-4b5c-6d7e-8f90-a1b2c3d4e5f6 ' })).toThrow('ID do segredo')
  })

  it('aceita valores com espaços ou aspas em volta', () => {
    expect(getMailer({ ...graph, GRAPH_CLIENT_SECRET: ` "${graph.GRAPH_CLIENT_SECRET}" ` })).toBeInstanceOf(GraphMailer)
  })
})
