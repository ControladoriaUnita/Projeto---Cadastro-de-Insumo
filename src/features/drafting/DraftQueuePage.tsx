import { useState } from 'react'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Card, EmptyState, Skeleton, Tabs } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useRequests } from '@/features/requests/api'
import { RequestsTable } from '@/features/requests/components/RequestsTable'

type View = 'solicitado' | 'em_cadastro'

/** Fila do analista: pedidos novos e cadastros em andamento (urgentes primeiro, depois os mais antigos). */
export function DraftQueuePage() {
  const requests = useRequests('drafting')
  const [view, setView] = useState<View>('solicitado')
  const all = requests.data ?? []
  const rows = all.filter((r) => r.status === view)

  return (
    <>
      <PageHeader
        eyebrow="Analista de cadastro"
        title="Cadastro de insumos"
        description="Monte o cadastro de cada pedido e envie para aprovação. Nada é gravado no UAU nesta etapa."
      />
      <Card>
        <div className="px-4">
          <Tabs<View>
            value={view}
            onChange={setView}
            items={[
              { key: 'solicitado', label: 'Novas solicitações', count: all.filter((r) => r.status === 'solicitado').length },
              { key: 'em_cadastro', label: 'Em cadastro', count: all.filter((r) => r.status === 'em_cadastro').length },
            ]}
          />
        </div>
        {requests.isLoading ? (
          <div className="grid gap-2 p-5">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : requests.isError ? (
          <Alert tone="error" className="m-5">
            {errorMessage(requests.error)}
          </Alert>
        ) : rows.length ? (
          <RequestsTable rows={rows} columns={['number', 'description', 'work', 'requester', 'analyst', 'status', 'deadline', 'created']} linkTo={(r) => PATHS.draft(r.id)} />
        ) : (
          <EmptyState title={view === 'solicitado' ? 'Nenhuma solicitação nova' : 'Nenhum cadastro em andamento'} description="A fila está em dia." />
        )}
      </Card>
    </>
  )
}
