import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Card, CardHeader, EmptyState, KpiStrip, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useRequests } from '@/features/requests/api'
import { RequestsTable } from '@/features/requests/components/RequestsTable'

/** Fila da gestão: cadastros prontos para revisar e aprovações que pararam no meio. */
export function ApprovalQueuePage() {
  const requests = useRequests('approval')
  const all = requests.data ?? []
  const waiting = all.filter((r) => r.status === 'aguardando_aprovacao')
  const pending = all.filter((r) => r.status !== 'aguardando_aprovacao')

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Aprovação de insumos"
        description="Cada insumo é aprovado individualmente: abra, revise, ajuste se precisar e aprove. Só então ele é inserido no UAU e tem a situação confirmada, um de cada vez."
      />
      <KpiStrip
        className="mb-4"
        items={[
          { label: 'Aguardando aprovação', value: waiting.length, emphasis: waiting.length > 0 },
          { label: 'Urgentes', value: waiting.filter((r) => r.urgency === 'urgente').length },
          { label: 'Pendências no UAU', value: pending.length, tone: pending.length ? 'warning' : undefined, hint: pending.length ? 'retomar' : undefined },
        ]}
      />

      {requests.isLoading ? (
        <Skeleton className="h-40" />
      ) : requests.isError ? (
        <Alert tone="error">{errorMessage(requests.error)}</Alert>
      ) : (
        <div className="grid gap-4">
          {pending.length > 0 && (
            <Card>
              <CardHeader title="Pendências no UAU" description="A aprovação começou, mas não terminou (ex.: falha ao confirmar a situação). Abra e use “Retomar”." />
              <RequestsTable rows={pending} columns={['number', 'description', 'work', 'status', 'deadline', 'updated']} linkTo={(r) => PATHS.approve(r.id)} />
            </Card>
          )}
          <Card>
            <CardHeader title="Aguardando aprovação" description="Urgentes primeiro, depois os mais antigos. Insumos enviados juntos pela obra também são aprovados um a um." />
            {waiting.length ? (
              <RequestsTable rows={waiting} columns={['number', 'description', 'work', 'analyst', 'status', 'deadline', 'updated']} linkTo={(r) => PATHS.approve(r.id)} />
            ) : (
              <EmptyState title="Nenhum cadastro aguardando" description="Quando o analista enviar um cadastro, ele aparece aqui." />
            )}
          </Card>
        </div>
      )}
    </>
  )
}
