import type { ReactNode } from 'react'
import type { RequestDTO } from '@shared/contracts'
import { REQUEST_KINDS } from '@shared/domain/request/kinds'
import { Card, CardHeader } from '@/components/ui'
import { formatDateTime, formatRequestNumber } from '@/utils/format'

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-text">{children || '—'}</dd>
    </div>
  )
}

/** O que a obra pediu — referência para o analista e para a gestão. */
export function RequestSummary({ request }: { request: RequestDTO }) {
  return (
    <Card>
      <CardHeader title={`Solicitação ${formatRequestNumber(request.number)}`} description={`Aberta em ${formatDateTime(request.createdAt)} por ${request.requester.name}`} />
      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <Item label="Insumo pedido">{request.description}</Item>
        <Item label="Unidade">{request.unit}</Item>
        <Item label="Tipo">{REQUEST_KINDS[request.kind].label}</Item>
        <Item label="Obra">{request.workName}</Item>
        <div className="sm:col-span-2">
          <Item label="Onde será usado">{request.justification}</Item>
        </div>
        {request.specification && (
          <div className="sm:col-span-2">
            <Item label="Especificação / referência">{request.specification}</Item>
          </div>
        )}
      </dl>
    </Card>
  )
}
