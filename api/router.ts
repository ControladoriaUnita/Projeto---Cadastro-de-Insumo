/**
 * Vercel Function única para /api/* (ver rewrites em vercel.json).
 * Mantém a camada HTTP fina: toda regra está em server/application e shared/domain.
 */
import { handle } from '../server/http/router'

// A leitura completa do cadastro do UAU leva de 10 s a mais de 1 min (a aprovação relê antes de gravar).
// Confira o limite máximo do seu plano na Vercel (varia por plano).
export const config = { maxDuration: 300 }

export default {
  fetch(request: Request): Promise<Response> {
    return handle(request)
  },
}
