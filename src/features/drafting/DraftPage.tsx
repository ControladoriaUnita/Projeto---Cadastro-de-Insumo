import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, Save, Send, XCircle } from 'lucide-react'
import type { RequestDetailDTO } from '@shared/contracts'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, CardBody, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { formatRequestNumber } from '@/utils/format'
import { DraftWorkspace } from '@/features/insumo-form/DraftWorkspace'
import { useDraftEditor } from '@/features/insumo-form/useDraftEditor'
import { useRequest, useRequestAction } from '@/features/requests/api'
import { CommentDialog } from '@/features/requests/components/CommentDialog'
import { RequestSummary } from '@/features/requests/components/RequestSummary'
import { StatusBadge, UrgencyBadge } from '@/features/requests/components/StatusBadge'

/** Tela do analista: cria o cadastro do insumo a partir da solicitação e envia para aprovação. */
export function DraftPage() {
  const { id = '' } = useParams()
  const request = useRequest(id)

  if (request.isLoading) return <Skeleton className="h-64" />
  if (request.isError || !request.data) return <Alert tone="error">{errorMessage(request.error)}</Alert>
  const r = request.data

  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        backTo={PATHS.drafting}
        title={`${formatRequestNumber(r.number)} · ${r.description}`}
        meta={
          <>
            <StatusBadge status={r.status} />
            <UrgencyBadge urgency={r.urgency} />
          </>
        }
        description={`${r.workName} · pedido por ${r.requester.name}`}
      />
      {r.status === 'solicitado' ? (
        <StartDraft request={r} />
      ) : r.draft ? (
        <DraftEditorView key={r.id} request={r} />
      ) : (
        <div className="grid max-w-3xl gap-4">
          <Alert tone="info">
            Esta solicitação foi encerrada sem cadastro. <Link to={PATHS.request(r.id)} className="font-medium underline">Ver acompanhamento</Link>
          </Alert>
          <RequestSummary request={r} />
        </div>
      )}
    </>
  )
}

/** Pedido ainda não assumido: mostra o que a obra pediu e o botão para iniciar. */
function StartDraft({ request }: { request: RequestDetailDTO }) {
  const action = useRequestAction(request.id)
  const navigate = useNavigate()
  const [rejecting, setRejecting] = useState(false)

  return (
    <div className="grid max-w-3xl gap-4">
      <RequestSummary request={request} />
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-ink-700">Ao iniciar, a solicitação fica com você e o rascunho já vem com descrição, unidade e o próximo código livre.</p>
          {request.actions.includes('reject') && (
            <Button variant="ghost" icon={<XCircle className="size-4" />} onClick={() => setRejecting(true)}>
              Recusar
            </Button>
          )}
          {request.actions.includes('start_draft') && (
            <Button variant="primary" icon={<Play className="size-4" />} loading={action.isPending} onClick={() => action.mutate({ action: 'start-draft' })}>
              Iniciar cadastro
            </Button>
          )}
        </CardBody>
        {action.isError && !rejecting && (
          <Alert tone="error" className="mx-5 mb-4">
            {errorMessage(action.error)}
          </Alert>
        )}
      </Card>
      <CommentDialog
        open={rejecting}
        title="Recusar solicitação?"
        description="A obra verá o motivo. Se o insumo já existir, informe o código para ela usar."
        confirmLabel="Recusar"
        tone="danger"
        required
        loading={action.isPending}
        error={action.isError ? errorMessage(action.error) : null}
        onCancel={() => setRejecting(false)}
        onConfirm={(comment) => action.mutate({ action: 'reject', comment }, { onSuccess: () => navigate(PATHS.drafting) })}
      />
    </div>
  )
}

function DraftEditorView({ request }: { request: RequestDetailDTO }) {
  const editable = request.actions.includes('save_draft')
  const editor = useDraftEditor(request.id, request.draft, { validate: editable })
  const action = useRequestAction(request.id)
  const navigate = useNavigate()
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = editor.preview.data?.validation
  const canSubmit = request.actions.includes('submit') && editor.previewCurrent && !!validation?.ok

  const submit = async () => {
    setError(null)
    try {
      if (editor.dirty) await editor.save()
      await action.mutateAsync({ action: 'submit' })
      navigate(PATHS.drafting)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const notice = !editable ? (
    <Alert tone="info" title="Cadastro enviado">
      Esta solicitação já está com a gestão. <Link to={PATHS.request(request.id)} className="font-medium underline">Ver acompanhamento</Link>
    </Alert>
  ) : request.lastComment ? (
    <Alert tone="warning" title="Devolvido pela gestão">
      {request.lastComment}
    </Alert>
  ) : null

  return (
    <>
      <DraftWorkspace
        request={request}
        editor={editor}
        readOnly={!editable}
        notice={notice}
        actions={
          editable ? (
            <>
              <Button
                variant="primary"
                className="flex-1"
                icon={<Send className="size-4" />}
                loading={action.isPending}
                disabled={!canSubmit}
                title={canSubmit ? undefined : 'Corrija os erros da conferência para enviar'}
                onClick={submit}
              >
                Enviar para aprovação
              </Button>
              <Button icon={<Save className="size-4" />} loading={editor.saving} disabled={!editor.dirty} onClick={() => editor.save().catch((e) => setError(errorMessage(e)))}>
                Salvar
              </Button>
              {request.actions.includes('reject') && (
                <Button variant="ghost" icon={<XCircle className="size-4" />} onClick={() => setRejecting(true)}>
                  Recusar
                </Button>
              )}
              <p className="w-full text-xs text-text-muted">
                {editor.dirty ? 'Alterações não salvas.' : 'Tudo salvo.'} Nada é gravado no UAU até a gestão aprovar.
              </p>
              {error && (
                <Alert tone="error" className="w-full">
                  {error}
                </Alert>
              )}
            </>
          ) : (
            <Link to={PATHS.request(request.id)} className="w-full">
              <Button className="w-full">Ver acompanhamento</Button>
            </Link>
          )
        }
      />
      <CommentDialog
        open={rejecting}
        title="Recusar solicitação?"
        description="O cadastro em andamento é descartado e a obra verá o motivo."
        confirmLabel="Recusar"
        tone="danger"
        required
        loading={action.isPending}
        error={action.isError ? errorMessage(action.error) : null}
        onCancel={() => setRejecting(false)}
        onConfirm={(comment) => action.mutate({ action: 'reject', comment }, { onSuccess: () => navigate(PATHS.drafting) })}
      />
    </>
  )
}
