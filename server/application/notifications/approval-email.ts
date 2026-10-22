/** Conteúdo do e-mail "insumo aprovado". Função pura: recebe a solicitação e devolve assunto, HTML e texto. */
import { formatDateTime, formatRequestNumber } from '../../../shared/format'
import type { RequestRecord } from '../ports'
import { renderEmail, requestLink, type EmailContent } from './layout'

export type ApprovalEmailContent = EmailContent

export function buildApprovalEmail(r: RequestRecord, appUrl: string | null): ApprovalEmailContent {
  const code = r.uauCode ?? r.draft?.codigo ?? ''
  const description = r.draft?.descricao ?? r.description
  return renderEmail({
    subject: `Insumo aprovado: ${code} · ${description}`,
    eyebrow: 'Insumo aprovado',
    title: `${code} · ${description}`,
    intro: 'O insumo solicitado foi criado e confirmado no UAU. Já pode ser usado em pedidos e cotações.',
    rows: [
      ['Código no UAU', code],
      ['Descrição', description],
      ['Unidade', r.draft?.unidade ?? r.unit],
      ['Obra', r.workName],
      ['Solicitação', `${formatRequestNumber(r.number)} · aberta por ${r.requesterName}`],
      ['Aprovado por', `${r.approverName ?? '—'} em ${formatDateTime(r.confirmedAt)}`],
    ],
    link: requestLink(appUrl, r.id),
    linkLabel: 'Ver solicitação',
  })
}
