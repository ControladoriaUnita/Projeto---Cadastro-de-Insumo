import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FINAL_STATUSES } from '@shared/domain/request/workflow'
import { PERMISSIONS } from '@shared/domain/roles'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, EmptyState, KpiStrip, Select, Skeleton, Tabs } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRequests, useWorks } from './api'
import { RequestsTable } from './components/RequestsTable'

type View = 'open' | 'done' | 'all'

/** Acompanhamento: a obra vê as próprias solicitações; analista e gestão veem todas. */
export function RequestsPage() {
  const { can } = useAuth()
  const seesAll = can(PERMISSIONS.requestReadAll)
  const requests = useRequests(seesAll ? 'all' : 'mine')
  const [view, setView] = useState<View>('open')
  const [work, setWork] = useState('')
  const works = useWorks()

  // Obras do UAU; se o UAU não responder, as obras das próprias solicitações
  const workOptions = useMemo(
    () => works.data?.map((w) => w.label) ?? [...new Set((requests.data ?? []).map((r) => r.workName))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [works.data, requests.data],
  )

  const groups = useMemo(() => {
    const all = (requests.data ?? []).filter((r) => !work || r.workName === work)
    const done = all.filter((r) => FINAL_STATUSES.includes(r.status))
    return { all, done, open: all.filter((r) => !FINAL_STATUSES.includes(r.status)) }
  }, [requests.data, work])

  const rows = groups[view]
  const approved = groups.done.filter((r) => r.status === 'aprovado').length

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento"
        title={seesAll ? 'Solicitações de insumo' : 'Minhas solicitações'}
        description="Situação de cada pedido, do envio até o insumo confirmado no UAU."
        actions={
          can(PERMISSIONS.requestCreate) && (
            <Link to={PATHS.newRequest}>
              <Button variant="primary" icon={<Plus className="size-4" />}>
                Nova solicitação
              </Button>
            </Link>
          )
        }
      />

      <KpiStrip
        className="mb-4"
        items={[
          { label: 'Em andamento', value: groups.open.length },
          { label: 'Aprovadas', value: approved, tone: 'success' },
          { label: 'Recusadas ou canceladas', value: groups.done.length - approved },
        ]}
      />

      <Card>
        <div className="px-4">
          <Tabs<View>
            value={view}
            onChange={setView}
            items={[
              { key: 'open', label: 'Em andamento', count: groups.open.length },
              { key: 'done', label: 'Concluídas', count: groups.done.length },
              { key: 'all', label: 'Todas', count: groups.all.length },
            ]}
            trailing={
              <Select value={work} onChange={(e) => setWork(e.target.value)} className="w-72 max-w-full" aria-label="Filtrar por obra">
                <option value="">Todas as obras</option>
                {workOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
        {requests.isLoading ? (
          <div className="grid gap-2 p-5">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : requests.isError ? (
          <Alert tone="error" className="m-5">
            {errorMessage(requests.error)}
          </Alert>
        ) : rows.length ? (
          <RequestsTable
            rows={rows}
            columns={seesAll ? ['number', 'description', 'work', 'requester', 'status', 'updated'] : ['number', 'description', 'status', 'created', 'updated']}
            linkTo={(r) => PATHS.request(r.id)}
          />
        ) : (
          <EmptyState
            title={view === 'open' ? 'Nenhuma solicitação em andamento' : 'Nada por aqui'}
            description="Quando você pedir um insumo novo, ele aparece nesta lista."
          />
        )}
      </Card>
    </>
  )
}
