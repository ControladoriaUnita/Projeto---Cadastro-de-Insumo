import { REQUEST_DEADLINE_DAYS, type RequestDeadline } from '@shared/domain/request/deadline'
import { Badge } from '@/components/ui'
import { formatDateTime } from '@/utils/format'
import { DEADLINE_META } from '../status'

function deadlineHint(d: RequestDeadline): string {
  if (d.state === 'concluido') return `Concluído em ${formatDateTime(d.doneAt)}`
  if (d.state === 'aguardando_obra') return `Devolvida à obra em ${formatDateTime(d.startedAt)}; o prazo recomeça quando ela reenviar`
  return `Prazo até ${formatDateTime(d.dueAt)}`
}

/** Situação do prazo da solicitação; "—" se não houver. */
export function DeadlineBadge({ deadline }: { deadline: RequestDeadline | null }) {
  if (!deadline) return <span className="text-text-muted">—</span>
  const meta = DEADLINE_META[deadline.state]
  return (
    <Badge tone={meta.tone} title={deadlineHint(deadline)}>
      {meta.label}
    </Badge>
  )
}

/** Prazo com datas (detalhe da solicitação). */
export function DeadlinePanel({ deadline }: { deadline: RequestDeadline | null }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">Da solicitação à aprovação</p>
          <p className="text-xs text-text-muted">{deadline ? deadlineHint(deadline) : 'Sem prazo'}</p>
        </div>
        <DeadlineBadge deadline={deadline} />
      </div>
      <p className="text-xs text-text-muted">
        São {REQUEST_DEADLINE_DAYS} dias corridos da abertura até a aprovação. Só a devolução à obra zera o prazo: ele recomeça quando a obra reenviar.
      </p>
    </div>
  )
}
