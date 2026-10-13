/**
 * Tipo do insumo pedido pela obra → prefixo sugerido para o código.
 */
import type { CodePrefix } from '../insumo/code'

export const REQUEST_KINDS = {
  material: { label: 'Material', prefix: 'IM' },
  servico: { label: 'Serviço', prefix: 'IS' },
  despesa_indireta: { label: 'Despesa indireta (aluguel, consultoria…)', prefix: 'IP' },
} as const satisfies Record<string, { label: string; prefix: CodePrefix }>

export type RequestKind = keyof typeof REQUEST_KINDS
export const REQUEST_KIND_KEYS = Object.keys(REQUEST_KINDS) as [RequestKind, ...RequestKind[]]

export const URGENCIES = { normal: 'Normal', urgente: 'Urgente' } as const
export type Urgency = keyof typeof URGENCIES
