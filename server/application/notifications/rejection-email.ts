/** Conteúdo do e-mail "solicitação recusada" (analista ou gestão recusou). Função pura. */
import { formatRequestNumber } from '../../../shared/format'
import type { RequestRecord } from '../ports'
import { renderEmail, requestLink, type EmailContent } from './layout'

export function buildRejectionEmail(r: RequestRecord, reason: string, rejectedBy: string, appUrl: string | null): EmailContent {
  const number = formatRequestNumber(r.number)
  return renderEmail({
    subject: `Solicitação ${number} recusada: ${r.description}`,
    eyebrow: 'Solicitação recusada',
    title: `${number} · ${r.description}`,
    intro: 'A solicitação foi recusada e não seguirá para cadastro no UAU. Veja o motivo abaixo; se ainda precisar do insumo, abra uma nova solicitação.',
    highlight: { label: `Motivo (${rejectedBy})`, text: reason },
    rows: [
      ['Insumo', r.description],
      ['Unidade', r.unit],
      ['Obra', r.workName],
      ['Solicitação', `${number} · aberta por ${r.requesterName}`],
    ],
    link: requestLink(appUrl, r.id),
    linkLabel: 'Ver solicitação',
  })
}
