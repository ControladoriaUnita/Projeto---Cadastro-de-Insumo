/**
 * Camada HTTP (controllers finos). Converte Request → caso de uso → Response.
 * Uma única Vercel Function (api/router.ts) atende todas as rotas /api/*.
 */
import { z, ZodError, type ZodTypeAny } from 'zod'
import {
  accessRequestSchema,
  approveSchema,
  catalogQuerySchema,
  commentSchema,
  createRequestBatchSchema,
  createRequestSchema,
  listRequestsQuerySchema,
  saveDraftSchema,
  type ApiErrorBody,
  type AppConfigDTO,
  type UserDTO,
} from '../../shared/contracts'
import { GUEST_OBRA_ID } from '../../shared/domain/access'
import { ROLE_LABELS } from '../../shared/domain/roles'
import { AppError, toAppError, type Actor, type RequestContext } from '../application/context'
import type { UseCaseDeps } from '../application/ports'
import { submitAccessRequest } from '../application/use-cases/access-requests'
import * as catalog from '../application/use-cases/catalog'
import { checkIntegration, sendTestEmail } from '../application/use-cases/integration'
import * as requests from '../application/use-cases/requests'
import { listWorks } from '../application/use-cases/works'
import { authConfig, corporateDomains, dataSource, demoUsers, openSession, publicRepositories } from '../infrastructure/session'
import { emailProvider, getMailer } from '../infrastructure/email'
import { envPresence } from '../infrastructure/env'
import { getUauGateway, uauMode, uauWriteEnabled } from '../infrastructure/uau'

type Params = Record<string, string>
type Handler = (a: { url: URL; params: Params; deps: UseCaseDeps; body: () => Promise<unknown> }) => Promise<unknown>

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
  status: number
}

const routes: Route[] = []
function route(method: string, path: string, handler: Handler, status = 200) {
  const keys: string[] = []
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '/?$')
  routes.push({ method, pattern, keys, handler, status })
}

const parse = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => schema.parse(data)
const uuidParam = z.string().uuid()
const query = (url: URL) => Object.fromEntries(url.searchParams)
const optionalComment = z.object({ comment: z.string().trim().max(2000).optional() })

function toUserDTO(actor: Actor): UserDTO {
  return { ...actor, roleLabel: ROLE_LABELS[actor.role], guest: actor.id === GUEST_OBRA_ID }
}

// ----------------------------------------------------------------------------- sessão
route('GET', '/me', async ({ deps }) => ({ user: toUserDTO(deps.ctx.actor) }))
route('GET', '/config', async (): Promise<AppConfigDTO> => {
  const mode = uauMode()
  return { dataSource: dataSource(), uauMode: mode, uauWriteEnabled: mode === 'mock' || uauWriteEnabled(), emailProvider: emailProvider() }
})

// ----------------------------------------------------------------------------- solicitações
route('GET', '/requests', async ({ deps, url }) => requests.listRequests(deps, parse(listRequestsQuerySchema, query(url)).scope))
route('POST', '/requests', async ({ deps, body }) => requests.createRequest(deps, parse(createRequestSchema, await body())), 201)
route('POST', '/requests/batch', async ({ deps, body }) => requests.createRequests(deps, parse(createRequestBatchSchema, await body()).items), 201)
route('GET', '/requests/:id', async ({ deps, params }) => requests.getRequest(deps, parse(uuidParam, params.id)))
route('POST', '/requests/:id/cancel', async ({ deps, params, body }) =>
  requests.cancelRequest(deps, parse(uuidParam, params.id), parse(optionalComment, await body()).comment ?? null))
route('POST', '/requests/:id/start-draft', async ({ deps, params }) => requests.startDraft(deps, parse(uuidParam, params.id)))
route('PUT', '/requests/:id/draft', async ({ deps, params, body }) =>
  requests.saveDraft(deps, parse(uuidParam, params.id), parse(saveDraftSchema, await body()).draft))
route('POST', '/requests/:id/preview', async ({ deps, params, body }) =>
  catalog.previewDraft(deps, parse(saveDraftSchema, await body()).draft, parse(uuidParam, params.id)))
route('POST', '/requests/:id/submit', async ({ deps, params }) => requests.submitForApproval(deps, parse(uuidParam, params.id)))
route('POST', '/requests/:id/return', async ({ deps, params, body }) =>
  requests.returnToAnalyst(deps, parse(uuidParam, params.id), parse(commentSchema, await body()).comment))
route('POST', '/requests/:id/reject', async ({ deps, params, body }) =>
  requests.rejectRequest(deps, parse(uuidParam, params.id), parse(commentSchema, await body()).comment))
route('POST', '/requests/:id/approve', async ({ deps, params, body }) =>
  requests.approveRequest(deps, parse(uuidParam, params.id), parse(approveSchema, await body()).draft))
route('POST', '/requests/:id/resume', async ({ deps, params }) => requests.resumeApproval(deps, parse(uuidParam, params.id)))
route('POST', '/requests/:id/request-adjustment', async ({ deps, params, body }) =>
  requests.requestAdjustment(deps, parse(uuidParam, params.id), parse(commentSchema, await body()).comment))
route('POST', '/requests/:id/resubmit', async ({ deps, params, body }) =>
  requests.resubmitRequest(deps, parse(uuidParam, params.id), parse(createRequestSchema, await body())))

// ----------------------------------------------------------------------------- obras UAU
route('GET', '/works', async ({ deps }) => listWorks(deps))

// ----------------------------------------------------------------------------- cadastro UAU
route('GET', '/catalog', async ({ deps, url }) => catalog.searchCatalog(deps, parse(catalogQuerySchema, query(url))))
route('GET', '/catalog/similar', async ({ deps, url }) => catalog.findSimilarItems(deps, (url.searchParams.get('q') ?? '').slice(0, 200)))
route('GET', '/catalog/draft-context', async ({ deps, url }) =>
  catalog.getDraftContext(deps, url.searchParams.get('requestId') ? parse(uuidParam, url.searchParams.get('requestId')) : undefined))
route('GET', '/catalog/items/:codigo', async ({ deps, params }) => catalog.getCatalogItem(deps, parse(z.string().max(20), params.codigo)))

// ----------------------------------------------------------------------------- integração
route('GET', '/integration/uau', async ({ deps }) => checkIntegration(deps, { emailProvider: emailProvider() }))
route('POST', '/integration/test-email', async ({ deps }) => sendTestEmail(deps, { emailProvider: emailProvider() }))

// ----------------------------------------------------------------------------- dispatcher
function json(data: unknown, status: number, correlationId: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-correlation-id': correlationId, 'cache-control': 'no-store' },
  })
}

function errorResponse(err: AppError, correlationId: string) {
  const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details, correlationId } }
  return json(body, err.status, correlationId)
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AppError('INVALID_JSON', 'Corpo da requisição inválido.', 400)
  }
}

function resolvePath(url: URL): string {
  // Na Vercel o rewrite envia /api/router?__path=<resto>; localmente a URL chega como /api/<resto>
  const fromRewrite = url.searchParams.get('__path')
  if (fromRewrite !== null) return '/' + fromRewrite.replace(/^\/+/, '')
  return url.pathname.replace(/^\/api/, '') || '/'
}

export async function handle(req: Request): Promise<Response> {
  const correlationId = req.headers.get('x-correlation-id')?.slice(0, 64) || globalThis.crypto.randomUUID()
  const url = new URL(req.url)
  const path = resolvePath(url)

  try {
    if (path === '/health') {
      // Diagnóstico de deploy: modo atual e quais variáveis existem (só sim/não, nunca valores)
      return json({ ok: true, time: new Date().toISOString(), dataSource: dataSource(), uauMode: uauMode(), env: envPresence() }, 200, correlationId)
    }
    // Pública: a tela precisa saber, antes do login, se usa Supabase ou o modo demonstração
    if (path === '/auth-config') return json(authConfig(), 200, correlationId)
    // Pública: pedido de acesso feito na tela de login (não cria conta)
    if (path === '/access-requests' && req.method === 'POST') {
      const input = parse(accessRequestSchema, await readJson(req))
      return json(await submitAccessRequest((await publicRepositories()).accessRequests, input, { corporateDomains: corporateDomains() }), 201, correlationId)
    }

    if (dataSource() === 'memory' && process.env.VERCEL_ENV === 'production' && process.env.ALLOW_DEMO_MODE !== 'true') {
      throw new AppError('DEMO_DISABLED', 'Modo demonstração desligado em produção. Configure DATA_SOURCE=supabase.', 503)
    }
    if (path === '/demo-users') {
      if (dataSource() !== 'memory') throw new AppError('NOT_FOUND', 'Rota inexistente.', 404)
      return json(demoUsers(), 200, correlationId)
    }

    const match = routes
      .filter((r) => r.method === req.method)
      .map((r) => ({ r, m: r.pattern.exec(path) }))
      .find((x) => x.m)
    if (!match) {
      const exists = routes.some((r) => r.pattern.test(path))
      throw new AppError(exists ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND', exists ? 'Método não permitido.' : 'Rota inexistente.', exists ? 405 : 404)
    }

    const opened = await openSession({ authorization: req.headers.get('authorization'), demoUser: req.headers.get('x-demo-user') })
    if (opened.status === 'unauthenticated') throw new AppError('UNAUTHENTICATED', 'Sessão inválida ou expirada. Entre novamente.', 401)
    if (opened.status === 'inactive') {
      throw new AppError('PROFILE_INACTIVE', 'Seu acesso ainda não foi liberado. Peça à gestão para ativar seu perfil.', 403)
    }
    const { session } = opened

    const ctx: RequestContext = { correlationId, actor: session.actor, now: () => new Date() }
    // UAU e e-mail só são instanciados quando o caso de uso precisa deles
    const deps: UseCaseDeps = {
      repos: session.repos,
      ctx,
      get uau() {
        return getUauGateway()
      },
      get mailer() {
        return getMailer()
      },
    }
    const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m![i + 1]!)]))
    const body = () => readJson(req)
    const result = await match.r.handler({ url, params, deps, body })
    return json(result ?? { ok: true }, match.r.status, correlationId)
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION', 'Dados inválidos.', 422, err.flatten()), correlationId)
    }
    const appErr = toAppError(err)
    if (appErr.status >= 500) console.error(`[${correlationId}]`, err)
    return errorResponse(appErr, correlationId)
  }
}
