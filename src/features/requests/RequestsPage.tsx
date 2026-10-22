import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Hash, Plus, Search, UserRound, X } from 'lucide-react'
import type { RequestDTO } from '@shared/contracts'
import { fold, textMatcher } from '@shared/domain/insumo/text'
import { FINAL_STATUSES } from '@shared/domain/request/workflow'
import { PERMISSIONS } from '@shared/domain/roles'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, EmptyState, Input, KpiStrip, SearchSelect, Skeleton, Tabs } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRequests, useWorks } from './api'
import { RequestsTable } from './components/RequestsTable'

type View = 'open' | 'done' | 'all'

interface RequestSearch {
  /** Nº da solicitação ("6", "0006" ou "#0006") */
  number: string
  /** Insumo: descrição pedida, descrição do cadastro ou código */
  text: string
  requester: string
}

const NO_SEARCH: RequestSearch = { number: '', text: '', requester: '' }

/** Busca sem acento e sem diferenciar maiúsculas; a descrição aceita * como no UAU. */
function matchesSearch(r: RequestDTO, s: RequestSearch): boolean {
  const digits = s.number.replace(/\D/g, '')
  if (digits && r.number !== Number(digits)) return false
  const matches = textMatcher(s.text)
  if (matches && !matches([r.description, r.draft?.descricao, r.draft?.codigo, r.uauCode].filter(Boolean).join(' '))) return false
  const requester = fold(s.requester.trim())
  if (requester && !fold(r.requester.name).includes(requester)) return false
  return true
}

/** Acompanhamento: a obra vê as próprias solicitações; analista e gestão veem todas. */
export function RequestsPage() {
  const { can } = useAuth()
  const seesAll = can(PERMISSIONS.requestReadAll)
  const requests = useRequests(seesAll ? 'all' : 'mine')
  const [view, setView] = useState<View>('open')
  const createdCount = (useLocation().state as { createdCount?: number } | null)?.createdCount
  const [work, setWork] = useState('')
  const [search, setSearch] = useState<RequestSearch>(NO_SEARCH)
  const searching = search.number.trim() !== '' || search.text.trim() !== '' || search.requester.trim() !== ''
  const works = useWorks()

  // Obras do UAU; se o UAU não responder, as obras das próprias solicitações
  const workOptions = useMemo(
    () => works.data?.map((w) => w.label) ?? [...new Set((requests.data ?? []).map((r) => r.workName))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [works.data, requests.data],
  )

  const groups = useMemo(() => {
    const all = (requests.data ?? []).filter((r) => (!work || r.workName === work) && matchesSearch(r, search))
    const done = all.filter((r) => FINAL_STATUSES.includes(r.status))
    return { all, done, open: all.filter((r) => !FINAL_STATUSES.includes(r.status)) }
  }, [requests.data, work, search])

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

      {!!createdCount && (
        <Alert tone="success" className="mb-4" title={`${createdCount} solicitações enviadas`}>
          Cada insumo virou uma solicitação e o analista de cadastro já pode ver todas. Acompanhe por esta tela.
        </Alert>
      )}

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
              <SearchSelect
                value={work}
                onChange={setWork}
                options={workOptions}
                clearable
                placeholder="Todas as obras · digite para buscar"
                className="w-72 max-w-full"
                aria-label="Filtrar por obra"
              />
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="relative w-40">
            <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={search.number}
              onChange={(e) => setSearch((s) => ({ ...s, number: e.target.value }))}
              inputMode="numeric"
              placeholder="Nº da solicitação"
              className="pl-9"
              aria-label="Buscar pelo número da solicitação"
            />
          </div>
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={search.text}
              onChange={(e) => setSearch((s) => ({ ...s, text: e.target.value }))}
              placeholder="Descrição ou código · use * para segmentar"
              className="pl-9"
              aria-label="Buscar pela descrição do insumo"
            />
          </div>
          <div className="relative w-64 max-w-full">
            <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={search.requester}
              onChange={(e) => setSearch((s) => ({ ...s, requester: e.target.value }))}
              placeholder="Nome do solicitante"
              className="pl-9"
              aria-label="Buscar pelo nome do solicitante"
            />
          </div>
          {(searching || work) && (
            <Button
              variant="ghost"
              icon={<X className="size-4" />}
              onClick={() => {
                setSearch(NO_SEARCH)
                setWork('')
              }}
            >
              Limpar filtros
            </Button>
          )}
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
            columns={seesAll ? ['number', 'description', 'work', 'requester', 'status', 'deadline', 'updated'] : ['number', 'description', 'status', 'deadline', 'created', 'updated']}
            linkTo={(r) => PATHS.request(r.id)}
          />
        ) : (
          <EmptyState
            title={searching || work ? 'Nenhuma solicitação encontrada' : view === 'open' ? 'Nenhuma solicitação em andamento' : 'Nada por aqui'}
            description={searching || work ? 'Confira os filtros ou clique em “Limpar filtros”.' : 'Quando você pedir um insumo novo, ele aparece nesta lista.'}
          />
        )}
      </Card>
    </>
  )
}
