/**
 * Conteúdo do e-mail "insumo aprovado". Função pura: recebe a solicitação e devolve assunto,
 * HTML e texto. Estilos inline (clientes de e-mail ignoram <style>), com as cores Unità.
 */
import { formatDateTime, formatRequestNumber } from '../../../shared/format'
import type { RequestRecord } from '../ports'

// Cores da marca (docs/DESIGN_SYSTEM.md). E-mail não lê CSS do app, então ficam aqui.
const COLORS = { orange: '#FE5000', ink: '#231F20', text: '#1A1817', muted: '#77716D', border: '#E2DFDC', bg: '#F8F7F6' }

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface ApprovalEmailContent {
  subject: string
  html: string
  text: string
}

export function buildApprovalEmail(r: RequestRecord, appUrl: string | null): ApprovalEmailContent {
  const code = r.uauCode ?? r.draft?.codigo ?? ''
  const description = r.draft?.descricao ?? r.description
  const link = appUrl ? `${appUrl.replace(/\/+$/, '')}/solicitacoes/${r.id}` : null
  const rows: [string, string][] = [
    ['Código no UAU', code],
    ['Descrição', description],
    ['Unidade', r.draft?.unidade ?? r.unit],
    ['Obra', r.workName],
    ['Solicitação', `${formatRequestNumber(r.number)} · aberta por ${r.requesterName}`],
    ['Aprovado por', `${r.approverName ?? '—'} em ${formatDateTime(r.confirmedAt)}`],
  ]

  const subject = `Insumo aprovado: ${code} · ${description}`

  const text = [
    'O insumo solicitado foi criado e confirmado no UAU. Já pode ser usado em pedidos e cotações.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(link ? ['', `Acompanhe: ${link}`] : []),
  ].join('\n')

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:${COLORS.bg};font-family:Inter,Segoe UI,Arial,sans-serif;color:${COLORS.text}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden">
        <tr><td style="background:${COLORS.ink};border-bottom:2px solid ${COLORS.orange};padding:16px 24px;color:#FFFFFF;font-size:16px;font-weight:600">Unità · Cadastro de Insumos</td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.orange}">Insumo aprovado</p>
          <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3">${escape(code)} · ${escape(description)}</h1>
          <p style="margin:0 0 20px;font-size:14px;color:${COLORS.muted}">O insumo foi criado e confirmado no UAU. Já pode ser usado em pedidos e cotações.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid ${COLORS.border}">
            ${rows
              .map(
                ([k, v]) =>
                  `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};white-space:nowrap">${escape(k)}</td><td style="padding:8px 0;border-bottom:1px solid ${COLORS.border}">${escape(v)}</td></tr>`,
              )
              .join('')}
          </table>
          ${
            link
              ? `<p style="margin:24px 0 0"><a href="${escape(link)}" style="display:inline-block;background:${COLORS.orange};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Ver solicitação</a></p>`
              : ''
          }
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:${COLORS.muted}">E-mail automático. Não responda.</p>
    </td></tr>
  </table>
</body></html>`

  return { subject, html, text }
}
