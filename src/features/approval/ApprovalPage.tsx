import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardCheck, RotateCcw, Search, Undo2, XCircle } from 'lucide-react'
import type { ApproveResultDTO, RequestDetailDTO } from '@shared/contracts'
import { mainWords } from '@shared/domain/insumo/text'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, CardBody, CardHeader, Skeleton, Tabs } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDateTime, formatRequestNumber } from '@/utils/format'
import { CatalogBrowser } from '@/features/catalog/CatalogBrowser'
import { DraftWorkspace } from '@/features/insumo-form/DraftWorkspace'
import { useDraftEditor } from '@/features/insumo-form/useDraftEditor'
import { useApprove, useRequest, useRequestAction, useRequests, useResume } from '@/features/requests/api'
import { CommentDialog } from '@/features/requests/components/CommentDialog'
import { RequestTimeline } from '@/features/requests/components/RequestTimeline'
import { StatusBadge, UrgencyBadge } from '@/features/requests/components/StatusBadge'
import { ApproveDialog } from './ApproveDialog'

/** Tela da gestão: revisa e ajusta o cadastro, confere repetidos no UAU e grava. */
export function ApprovalPage() {
  const { id = '' } = useParams()
  const request = useRequest(id)

  if (request.isLoading) return <Skeleton className="h-64" />
  if (request.isError || !request.data) return <Alert tone="error">{errorMessage(request.error)}</Alert>
  const r = request.data

  return (
    <>
      <PageHeader
        eyebrow="Aprovação"
        backTo={PATHS.approval}
        title={`${formatRequestNumber(r.number)} · ${r.draft?.descricao || r.description}`}
        meta={
          <>
            <StatusBadge status={r.status} />
            <UrgencyBadge urgency={r.urgency} />
          </>
        }
        description={`${r.workName} · pedido por ${r.requester.name}${r.analyst ? ` · cadastrado por ${r.analyst.name}` : ''}`}
      />
      {r.draft ? (
        <ApprovalWorkspace key={r.id} request={r} />
      ) : (
        <Alert tone="info">
          Esta solicitação ainda não tem cadastro. <Link to={PATHS.request(r.id)} className="font-medium underline">Ver acompanhamento</Link>
        </Alert>
      )}
    </>
  )
}

type OpenDialog = 'approve' | 'return' | 'reject' | null
type ApprovalTab = 'review' | 'catalog'

const searchTerms = (description: string) => mainWords(description, 2).join(' ')

/** Posição no envio em lote (gravada no histórico ao criar), ou null se foi pedido sozinho. */
function batchInfo(request: RequestDetailDTO): { position: number; size: number } | null {
  const details = request.events.find((e) => e.type === 'created')?.details as { batch?: { position: number; size: number } } | null
  return details?.batch ?? null
}

/** Depois de aprovar: leva ao próximo insumo da fila, para a gestão seguir um por vez. */
function NextInQueue({ currentId }: { currentId: string }) {
  const queue = useRequests('approval')
  const waiting = (queue.data ?? []).filter((r) => r.status === 'aguardando_aprovacao' && r.id !== currentId)
  const next = waiting[0]
  if (queue.isLoading) return null
  return next ? (
    <Link to={PATHS.approve(next.id)}>
      <Button size="sm" variant="primary" icon={<ArrowRight className="size-4" />}>
        Próximo insumo ({waiting.length} aguardando)
      </Button>
    </Link>
  ) : (
    <Link to={PATHS.approval}>
      <Button size="sm">Fila vazia · voltar</Button>
    </Link>
  )
}

function ApprovalWorkspace({ request }: { request: RequestDetailDTO }) {
  const { config } = useAuth()
  const navigate = useNavigate()
  const editor = useDraftEditor(request.id, request.draft, { validate: request.actions.includes('approve') })
  const approve = useApprove(request.id)
  const resume = useResume(request.id)
  const action = useRequestAction(request.id)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [result, setResult] = useState<ApproveResultDTO | null>(null)
  const [tab, setTab] = useState<ApprovalTab>('review')
  const batch = batchInfo(request)

  const can = (a: RequestDetailDTO['actions'][number]) => request.actions.includes(a)
  const writeEnabled = config?.uauWriteEnabled ?? false
  const ready = !editor.blocker

  const onApproved = (res: ApproveResultDTO) => {
    setResult(res)
    setDialog(null)
  }

  const actions = (
    <>
      {can('approve') && (
        <>
          <Button
            variant="primary"
            className="flex-1"
            icon={<CheckCircle2 className="size-4" />}
            disabled={!ready || !writeEnabled}
            onClick={() => setDialog('approve')}
          >
            Aprovar e inserir no UAU
          </Button>
          <Button icon={<Undo2 className="size-4" />} onClick={() => setDialog('return')}>
            Devolver
          </Button>
          <Button variant="ghost" icon={<XCircle className="size-4" />} onClick={() => setDialog('reject')}>
            Recusar
          </Button>
          {editor.blocker && editor.previewCurrent && <p className="w-full text-xs font-medium text-error">{editor.blocker}</p>}
          <p className="w-full text-xs text-text-muted">
            {!writeEnabled
              ? 'Gravação no UAU desligada (simulação). Para gravar, o servidor precisa de UAU_GRAVACAO=real.'
              : editor.dirty
                ? 'Seus ajustes serão salvos e registrados no histórico ao aprovar.'
                : 'Você pode ajustar qualquer campo antes de aprovar.'}
          </p>
        </>
      )}
      {can('resume') && (
        <>
          <Alert tone="warning" className="w-full" title={request.status === 'em_insercao' ? 'Inserção interrompida' : 'Insumo no UAU sem confirmação'}>
            {request.status === 'em_insercao'
              ? 'A aprovação começou e não terminou. Retomar confere no UAU se o insumo já existe antes de inserir.'
              : `O insumo ${request.uauCode} já está no UAU. Falta mudar a situação para confirmado.`}
          </Alert>
          <Button
            variant="primary"
            className="w-full"
            icon={<RotateCcw className="size-4" />}
            loading={resume.isPending}
            disabled={!writeEnabled}
            onClick={() => resume.mutate(undefined, { onSuccess: onApproved })}
          >
            Retomar inserção no UAU
          </Button>
          {resume.isError && (
            <Alert tone="error" className="w-full">
              {errorMessage(resume.error)}
            </Alert>
          )}
        </>
      )}
      {request.status === 'aprovado' && (
        <Alert tone="success" className="w-full" title={`Aprovado · ${request.uauCode}`}>
          Inserido e confirmado no UAU em {formatDateTime(request.confirmedAt)}.
        </Alert>
      )}
      {!can('approve') && !can('resume') && request.status !== 'aprovado' && (
        <Link to={PATHS.request(request.id)} className="w-full">
          <Button className="w-full">Ver acompanhamento</Button>
        </Link>
      )}
    </>
  )

  return (
    <>
      {result && (
        <Alert
          tone={result.warning ? 'warning' : 'success'}
          className="mb-4"
          title={result.warning ? 'Aprovação incompleta' : 'Insumo gravado e confirmado no UAU'}
          action={result.warning ? undefined : <NextInQueue currentId={request.id} />}
        >
          {result.warning ?? `${result.request.uauCode} · ${result.request.draft?.descricao}`}
        </Alert>
      )}
      {batch && can('approve') && (
        <Alert tone="info" className="mb-4" title={`Insumo ${batch.position} de ${batch.size} enviados juntos pela obra`}>
          A aprovação é individual: só este insumo será gravado no UAU. Os outros do mesmo envio continuam na fila, cada um com a sua revisão.
        </Alert>
      )}
      <div className="mb-4">
        <Tabs<ApprovalTab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'review', label: 'Revisão do cadastro', icon: <ClipboardCheck className="size-4" /> },
            { key: 'catalog', label: 'Insumos do UAU', icon: <Search className="size-4" /> },
          ]}
        />
      </div>
      {tab === 'catalog' ? (
        // Busca já com as palavras principais da descrição, para achar repetidos e parecidos
        <CatalogBrowser initialQuery={searchTerms(editor.draft.descricao || request.description)} />
      ) : (
        <DraftWorkspace
          request={request}
          editor={editor}
          readOnly={!can('save_draft')}
          actions={actions}
          aside={
            <Card>
              <CardHeader title="Histórico" />
              <CardBody>
                <RequestTimeline events={request.events} />
              </CardBody>
            </Card>
          }
        />
      )}

      <ApproveDialog
        open={dialog === 'approve'}
        draft={editor.draft}
        loading={approve.isPending}
        error={approve.isError ? errorMessage(approve.error) : null}
        onCancel={() => setDialog(null)}
        onConfirm={() => approve.mutate(editor.dirty ? editor.draft : undefined, { onSuccess: onApproved })}
      />
      <CommentDialog
        open={dialog === 'return'}
        title="Devolver ao analista?"
        description="O cadastro volta para edição com o seu comentário."
        confirmLabel="Devolver"
        required
        loading={action.isPending}
        error={action.isError ? errorMessage(action.error) : null}
        onCancel={() => setDialog(null)}
        onConfirm={(comment) => action.mutate({ action: 'return', comment }, { onSuccess: () => navigate(PATHS.approval) })}
      />
      <CommentDialog
        open={dialog === 'reject'}
        title="Recusar solicitação?"
        description="Nada é gravado no UAU e a obra verá o motivo."
        confirmLabel="Recusar"
        tone="danger"
        required
        loading={action.isPending}
        error={action.isError ? errorMessage(action.error) : null}
        onCancel={() => setDialog(null)}
        onConfirm={(comment) => action.mutate({ action: 'reject', comment }, { onSuccess: () => navigate(PATHS.approval) })}
      />
    </>
  )
}
