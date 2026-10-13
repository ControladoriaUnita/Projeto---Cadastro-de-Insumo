/**
 * Pedido de acesso feito na tela de login (ninguém cria conta sozinho).
 */
import type { RoleKey } from './roles'

/** Domínio padrão; o servidor pode trocar com ACCESS_REQUEST_DOMAINS. */
export const DEFAULT_CORPORATE_DOMAINS = ['unitaengenharia.com.br']

/** O que cada papel faz, para a pessoa escolher o perfil certo. */
export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  obra: 'Solicita insumos novos e acompanha cada pedido.',
  analista: 'Monta o cadastro dos insumos e envia para aprovação.',
  gestor: 'Revisa, aprova e grava os insumos no UAU.',
}

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export function isCorporateEmail(email: string, domains: readonly string[]): boolean {
  const domain = emailDomain(email)
  return domains.some((d) => domain === d.toLowerCase())
}
