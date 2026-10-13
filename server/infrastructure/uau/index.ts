/**
 * Escolhe o UauGateway conforme UAU_MODE (mock | real). Instância única por processo,
 * para reaproveitar o token e o cache do cadastro entre requisições.
 */
import { AppError } from '../../application/context'
import { envOption, envValue } from '../env'
import type { UauGateway } from '../../application/ports'
import { HttpUauGateway } from './http-uau-gateway'
import { MockUauGateway } from './mock-uau-gateway'

let instance: UauGateway | null = null

/** UAU_GRAVACAO=real libera a gravação no UAU real (no simulado sempre grava na memória). */
export function uauWriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOption('UAU_GRAVACAO', env) === 'real'
}

export function uauMode(env: NodeJS.ProcessEnv = process.env): 'mock' | 'real' {
  return envOption('UAU_MODE', env) === 'real' ? 'real' : 'mock'
}

export function getUauGateway(env: NodeJS.ProcessEnv = process.env): UauGateway {
  if (instance) return instance
  if (uauMode(env) === 'mock') return (instance = new MockUauGateway())

  const config = {
    baseUrl: envValue('UAU_BASE_URL', env),
    integrationToken: envValue('UAU_INTEGRATION_TOKEN', env),
    login: envValue('UAU_LOGIN', env),
    // A senha pode conter aspas: só tira espaços das pontas, nunca aspas
    password: env.UAU_PASSWORD?.trim() || null,
  }
  const missing = Object.entries({ UAU_BASE_URL: config.baseUrl, UAU_INTEGRATION_TOKEN: config.integrationToken, UAU_LOGIN: config.login, UAU_PASSWORD: config.password })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    throw new AppError('UAU_NOT_CONFIGURED', `Integração UAU sem configuração no servidor: ${missing.join(', ')}.`, 503)
  }
  instance = new HttpUauGateway({
    baseUrl: config.baseUrl!,
    integrationToken: config.integrationToken!,
    login: config.login!,
    password: config.password!,
    writeEnabled: uauWriteEnabled(env),
  })
  return instance
}

/** Só para testes: troca o gateway (ex.: MockUauGateway com falhas programadas). */
export function setUauGatewayForTests(gateway: UauGateway | null) {
  instance = gateway
}
