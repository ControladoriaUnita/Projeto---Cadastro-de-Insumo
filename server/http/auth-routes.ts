/**
 * Rotas públicas do login Microsoft. Abertas pela tela num POPUP (o app roda em iframe no portal):
 *
 *   GET  /api/auth/microsoft/login     -> grava o state em cookie e redireciona para a Microsoft
 *   GET  /api/auth/microsoft/callback  -> valida, cria a sessão e devolve o token à janela do app
 *                                          (postMessage para window.opener, mesma origem) e fecha
 *   POST /api/auth/logout              -> apaga o cookie de sessão
 *
 * Sem window.opener (login aberto fora do popup) o callback grava a sessão em cookie e volta
 * para a página inicial.
 */
import { appUrl, entraAuthorizeUrl, entraCallback, issueSession } from '../infrastructure/auth/entra'
import { SESSION_COOKIE, publicRepositories, readCookie } from '../infrastructure/session'

const STATE_COOKIE = 'insumos_oauth_state'
/** Identifica as mensagens do popup para a tela */
export const AUTH_MESSAGE_SOURCE = 'insumos-auth'

function cookie(name: string, value: string, maxAge: number, path: string): string {
  const secure = appUrl().startsWith('https://') ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

const NO_STORE = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }

type PopupResult = { ok: true; token: string; expiresAt: number } | { ok: false; error: string }

/** Página mínima do popup: entrega o resultado à janela do app e fecha. */
function popupPage(result: PopupResult, cookies: string[]): Response {
  // Escapa "<" para o JSON não fechar o <script>
  const payload = JSON.stringify({ source: AUTH_MESSAGE_SOURCE, ...result }).replace(/</g, '\\u003c')
  const title = result.ok ? 'Login concluído' : 'Não foi possível entrar'
  const text = result.ok ? 'Login concluído. Esta janela vai fechar sozinha.' : result.error.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f5f5f4;color:#1c1917}
main{max-width:360px;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;line-height:1.5;margin:0 0 16px}
button{font:inherit;padding:8px 16px;border-radius:6px;border:1px solid #d6d3d1;background:#fff;cursor:pointer}</style></head>
<body><main><h1>${title}</h1><p>${text}</p><button type="button" onclick="window.close()">Fechar janela</button></main>
<script>
(function () {
  var msg = ${payload};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, window.location.origin);
      if (msg.ok) window.close();
      return;
    }
  } catch (e) {}
  // Aberto fora do popup: a sessão ficou no cookie, segue para o app
  if (msg.ok) window.location.replace('/');
})();
</script></body></html>`
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', ...NO_STORE })
  for (const c of cookies) headers.append('set-cookie', c)
  return new Response(html, { status: result.ok ? 200 : 400, headers })
}

export async function handleAuthRoute(req: Request, url: URL, path: string): Promise<Response | null> {
  if (path === '/auth/microsoft/login' && req.method === 'GET') {
    try {
      const { url: authorizeUrl, state } = entraAuthorizeUrl()
      const headers = new Headers({ location: authorizeUrl, ...NO_STORE })
      headers.append('set-cookie', cookie(STATE_COOKIE, state, 600, '/api/auth'))
      return new Response(null, { status: 302, headers })
    } catch (err) {
      return popupPage({ ok: false, error: (err as Error).message }, [])
    }
  }

  if (path === '/auth/microsoft/callback' && req.method === 'GET') {
    const clearState = cookie(STATE_COOKIE, '', 0, '/api/auth')
    // Pessoa cancelou ou a Microsoft recusou antes de devolver o code
    const msError = url.searchParams.get('error')
    if (msError) {
      const cancelled = msError === 'access_denied'
      const detail = url.searchParams.get('error_description')?.split(/\r?\n/)[0] ?? msError
      return popupPage({ ok: false, error: cancelled ? 'Login cancelado.' : `A Microsoft recusou o login. ${detail}` }, [clearState])
    }
    try {
      const code = url.searchParams.get('code') ?? ''
      const state = url.searchParams.get('state') ?? ''
      if (!code || !state) throw new Error('Retorno do login incompleto. Tente entrar de novo.')
      const repos = await publicRepositories()
      const userId = await entraCallback(repos.identity, code, state, readCookie(req.headers.get('cookie'), STATE_COOKIE))
      const session = issueSession(userId)
      return popupPage({ ok: true, token: session.value, expiresAt: Date.now() + session.maxAge * 1000 }, [
        clearState,
        cookie(SESSION_COOKIE, session.value, session.maxAge, '/'),
      ])
    } catch (err) {
      const message = err instanceof Error && err.name === 'TimeoutError' ? 'A Microsoft demorou para responder. Tente de novo.' : (err as Error).message
      if (!(err instanceof Error) || /Supabase/.test(err.message)) console.error('[auth] callback', err)
      return popupPage({ ok: false, error: /Supabase/.test(message) ? 'Erro ao carregar seu perfil. Tente de novo.' : message }, [clearState])
    }
  }

  if (path === '/auth/logout' && req.method === 'POST') {
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', ...NO_STORE })
    headers.append('set-cookie', cookie(SESSION_COOKIE, '', 0, '/'))
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  }

  return null
}
