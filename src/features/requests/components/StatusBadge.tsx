import type { RequestStatus } from '@shared/domain/request/workflow'
import { Badge } from '@/components/ui'
import { STATUS_META } from '../status'

export function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} title={meta.hint}>
      {meta.label}
    </Badge>
  )
}

export function UrgencyBadge({ urgency }: { urgency: 'normal' | 'urgente' }) {
  return urgency === 'urgente' ? <Badge tone="error">Urgente</Badge> : null
}
