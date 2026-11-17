/** Conteúdo do e-mail "insumo aprovado". Função pura: recebe a solicitação e devolve assunto, HTML e texto. */
import { categoryLabel } from '../../../shared/domain/insumo/categories'
import { formatDateTime, formatRequestNumber } from '../../../shared/format'
import type { RequestRecord } from '../ports'
import { renderEmail, requestLink, type EmailContent } from './layout'

export type ApprovalEmailContent = EmailContent

/** Descrição da categoria com o código do UAU; sem descrição cadastrada, só o código. */
function category(code: string | undefined): string {
  const c = code?.trim()
  if (!c) return '—'
  const label = categoryLabel(c)
  return label === c ? c : `${label} (${c})`
}

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
      ['Categoria', category(r.draft?.categoria)],
      ['Obra', r.workName],
      ['Solicitação', `${formatRequestNumber(r.number)} · aberta por ${r.requesterName}`],
      ['Aprovado por', `${r.approverName ?? '—'} em ${formatDateTime(r.confirmedAt)}`],
    ],
    link: requestLink(appUrl, r.id),
    linkLabel: 'Ver solicitação',
  })
}
