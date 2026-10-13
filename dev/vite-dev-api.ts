/**
 * Plugin de desenvolvimento: atende /api/* dentro do `vite dev` usando o mesmo
 * router das Vercel Functions (sem precisar do `vercel dev`).
 */
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Plugin } from 'vite'

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
}

/**
 * A API lê process.env (como na Vercel), mas o Vite só expõe VITE_* ao navegador.
 * Carrega .env.local e depois .env; variáveis já definidas no ambiente não são sobrescritas.
 */
function loadServerEnv(root: string) {
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file)
    if (existsSync(path)) process.loadEnvFile(path)
  }
}

export function devApi(): Plugin {
  return {
    name: 'insumos-dev-api',
    apply: 'serve',
    configureServer(server) {
      loadServerEnv(server.config.root)
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const mod = (await server.ssrLoadModule('/server/http/router.ts')) as { handle: (r: Request) => Promise<Response> }
          const response = await mod.handle(await toRequest(req))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: { code: 'DEV_SERVER', message: String(err) } }))
        }
      })
    },
  }
}
