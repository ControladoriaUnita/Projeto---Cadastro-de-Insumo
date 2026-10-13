/**
 * Escolhe o UauGateway conforme UAU_MODE (mock | real). Instância única por processo,
 * para reaproveitar o token e o cache do cadastro entre requisições.
 */
import { AppError } from '../../application/context'
import type { UauGateway } from '../../application/ports'
import { HttpUauGateway } from './http-uau-gateway'
import { MockUauGateway } from './mock-uau-gateway'

let instance: UauGateway | null = null

export function uauMode(env: NodeJS.ProcessEnv = process.env): 'mock' | 'real' {
  return env.UAU_MODE === 'real' ? 'real' : 'mock'
}

export function getUauGateway(env: NodeJS.ProcessEnv = process.env): UauGateway {
  if (instance) return instance
  if (uauMode(env) === 'mock') return (instance = new MockUauGateway())

  const required = ['UAU_BASE_URL', 'UAU_INTEGRATION_TOKEN', 'UAU_LOGIN', 'UAU_PASSWORD'] as const
  const missing = required.filter((k) => !env[k])
  if (missing.length) {
    throw new AppError('UAU_NOT_CONFIGURED', `Integração UAU sem configuração no servidor: ${missing.join(', ')}.`, 503)
  }
  instance = new HttpUauGateway({
    baseUrl: env.UAU_BASE_URL!,
    integrationToken: env.UAU_INTEGRATION_TOKEN!,
    login: env.UAU_LOGIN!,
    password: env.UAU_PASSWORD!,
    writeEnabled: env.UAU_GRAVACAO === 'real',
  })
  return instance
}

/** Só para testes: troca o gateway (ex.: MockUauGateway com falhas programadas). */
export function setUauGatewayForTests(gateway: UauGateway | null) {
  instance = gateway
}
