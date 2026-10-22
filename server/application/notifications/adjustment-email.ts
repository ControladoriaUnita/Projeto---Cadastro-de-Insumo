/** Conteúdo do e-mail "solicitação precisa de ajuste" (analista devolveu à obra). Função pura. */
import { formatRequestNumber } from '../../../shared/format'
import type { RequestRecord } from '../ports'
import { renderEmail, requestLink, type EmailContent } from './layout'

export function buildAdjustmentEmail(r: RequestRecord, reason: string, analystName: string, appUrl: string | null): EmailContent {
  const number = formatRequestNumber(r.number)
  return renderEmail({
    subject: `Solicitação ${number} precisa de ajuste: ${r.description}`,
    eyebrow: 'Ajuste necessário',
    title: `${number} · ${r.description}`,
    intro: 'O analista de cadastro devolveu a solicitação para ajuste. Corrija o que foi pedido e reenvie pela tela da solicitação.',
    highlight: { label: `O que ajustar (${analystName})`, text: reason },
    rows: [
      ['Insumo', r.description],
      ['Unidade', r.unit],
      ['Obra', r.workName],
      ['Solicitação', `${number} · aberta por ${r.requesterName}`],
    ],
    link: requestLink(appUrl, r.id),
    linkLabel: 'Ajustar e reenviar',
  })
}
