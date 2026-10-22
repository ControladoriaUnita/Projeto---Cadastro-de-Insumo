/**
 * Moldura comum dos e-mails: cabeçalho Unità, título, tabela de dados e botão para a solicitação.
 * Estilos inline (clientes de e-mail ignoram <style>), com as cores Unità.
 */

// Cores da marca (docs/DESIGN_SYSTEM.md). E-mail não lê CSS do app, então ficam aqui.
const COLORS = { orange: '#FE5000', ink: '#231F20', text: '#1A1817', muted: '#77716D', border: '#E2DFDC', bg: '#F8F7F6' }

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface EmailLayout {
  subject: string
  /** Etiqueta acima do título (ex.: "Insumo aprovado") */
  eyebrow: string
  title: string
  intro: string
  /** Texto em destaque (ex.: o motivo da devolução) */
  highlight?: { label: string; text: string }
  rows: [string, string][]
  link: string | null
  linkLabel: string
}

/** Link para a solicitação no app (null quando APP_URL não está configurado). */
export const requestLink = (appUrl: string | null, id: string) => (appUrl ? `${appUrl.replace(/\/+$/, '')}/solicitacoes/${id}` : null)

export function renderEmail(e: EmailLayout): EmailContent {
  const text = [
    e.intro,
    ...(e.highlight ? ['', `${e.highlight.label}:`, e.highlight.text] : []),
    '',
    ...e.rows.map(([k, v]) => `${k}: ${v}`),
    ...(e.link ? ['', `${e.linkLabel}: ${e.link}`] : []),
  ].join('\n')

  const paragraphs = (s: string) => escape(s).replace(/\r?\n/g, '<br>')

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:${COLORS.bg};font-family:Inter,Segoe UI,Arial,sans-serif;color:${COLORS.text}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden">
        <tr><td style="background:${COLORS.ink};border-bottom:2px solid ${COLORS.orange};padding:16px 24px;color:#FFFFFF;font-size:16px;font-weight:600">Unità · Cadastro de Insumos</td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.orange}">${escape(e.eyebrow)}</p>
          <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3">${escape(e.title)}</h1>
          <p style="margin:0 0 20px;font-size:14px;color:${COLORS.muted}">${escape(e.intro)}</p>
          ${
            e.highlight
              ? `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${COLORS.orange};background:${COLORS.bg};font-size:14px"><p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${COLORS.muted}">${escape(e.highlight.label)}</p><p style="margin:0">${paragraphs(e.highlight.text)}</p></div>`
              : ''
          }
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid ${COLORS.border}">
            ${e.rows
              .map(
                ([k, v]) =>
                  `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};white-space:nowrap">${escape(k)}</td><td style="padding:8px 0;border-bottom:1px solid ${COLORS.border}">${escape(v)}</td></tr>`,
              )
              .join('')}
          </table>
          ${
            e.link
              ? `<p style="margin:24px 0 0"><a href="${escape(e.link)}" style="display:inline-block;background:${COLORS.orange};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">${escape(e.linkLabel)}</a></p>`
              : ''
          }
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:${COLORS.muted}">E-mail automático. Não responda.</p>
    </td></tr>
  </table>
</body></html>`

  return { subject: e.subject, html, text }
}
