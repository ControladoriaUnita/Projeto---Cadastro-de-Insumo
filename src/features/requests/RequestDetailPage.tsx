import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, Ban } from 'lucide-react'
import { APPROVAL_QUEUE, DRAFTING_QUEUE } from '@shared/domain/request/workflow'
import { PERMISSIONS } from '@shared/domain/roles'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, CardBody, CardHeader, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDateTime, formatRequestNumber } from '@/utils/format'
import { useRequest, useRequestAction } from './api'
import { CommentDialog } from './components/CommentDialog'
import { ProgressSteps } from './components/ProgressSteps'
import { RequestSummary } from './components/RequestSummary'
import { RequestTimeline } from './components/RequestTimeline'
import { StatusBadge, UrgencyBadge } from './components/StatusBadge'
import { STATUS_META } from './status'

/** Detalhe da solicitação: etapa atual, resultado e histórico. */
export function RequestDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { can } = useAuth()
  const request = useRequest(id)
  const action = useRequestAction(id ?? '')
  const [cancelling, setCancelling] = useState(false)

  if (request.isLoading) return <Skeleton className="h-64" />
  if (request.isError || !request.data) return <Alert tone="error">{errorMessage(request.error)}</Alert>
  const r = request.data
  const meta = STATUS_META[r.status]

  const workLink =
    can(PERMISSIONS.draftEdit) && DRAFTING_QUEUE.includes(r.status)
      ? { to: PATHS.draft(r.id), label: 'Abrir cadastro' }
      : can(PERMISSIONS.approvalDecide) && APPROVAL_QUEUE.includes(r.status)
        ? { to: PATHS.approve(r.id), label: 'Abrir aprovação' }
        : null

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento"
        backTo={PATHS.requests}
        title={`${formatRequestNumber(r.number)} · ${r.draft?.descricao || r.description}`}
        meta={
          <>
            <StatusBadge status={r.status} />
            <UrgencyBadge urgency={r.urgency} />
          </>
        }
        description={`Atualizada em ${formatDateTime(r.updatedAt)}`}
        actions={
          <>
            {r.actions.includes('cancel') && (
              <Button variant="secondary" icon={<Ban className="size-4" />} onClick={() => setCancelling(true)}>
                Cancelar solicitação
              </Button>
            )}
            {workLink && (
              <Link to={workLink.to}>
                <Button variant="primary" icon={<ArrowRight className="size-4" />}>
                  {workLink.label}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {(location.state as { created?: boolean } | null)?.created && (
        <Alert tone="success" className="mb-4" title="Solicitação enviada">
          O analista de cadastro já pode ver o seu pedido. Acompanhe por esta tela.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          <Card>
            <CardBody className="grid gap-4">
              <ProgressSteps status={r.status} />
              <p className="text-sm text-ink-700">{meta.hint}</p>
              {r.status === 'aprovado' && r.uauCode && (
                <Alert tone="success" title={`Código no UAU: ${r.uauCode}`}>
                  {r.draft?.descricao} · confirmado em {formatDateTime(r.confirmedAt)}
                </Alert>
              )}
              {r.lastComment && (r.status === 'recusado' || r.status === 'cancelado' || r.status === 'em_cadastro') && (
                <Alert tone={r.status === 'em_cadastro' ? 'warning' : 'error'} title={r.status === 'em_cadastro' ? 'Devolvido pela gestão' : 'Motivo'}>
                  {r.lastComment}
                </Alert>
              )}
            </CardBody>
          </Card>
          <RequestSummary request={r} />
        </div>

        <Card className="self-start">
          <CardHeader title="Histórico" />
          <CardBody>
            <RequestTimeline events={r.events} technical={can(PERMISSIONS.approvalDecide)} />
          </CardBody>
        </Card>
      </div>

      <CommentDialog
        open={cancelling}
        title="Cancelar solicitação?"
        description="O analista deixa de ver o pedido. Para pedir de novo, abra outra solicitação."
        confirmLabel="Cancelar solicitação"
        tone="danger"
        loading={action.isPending}
        error={action.isError ? errorMessage(action.error) : null}
        onCancel={() => setCancelling(false)}
        onConfirm={(comment) => action.mutate({ action: 'cancel', comment }, { onSuccess: () => setCancelling(false) })}
      />
    </>
  )
}
