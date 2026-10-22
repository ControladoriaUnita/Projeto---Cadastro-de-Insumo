import { STAGE_DEADLINE_DAYS, type DeadlineStage, type RequestDeadlines, type StageDeadline } from '@shared/domain/request/deadline'
import { Badge } from '@/components/ui'
import { formatDateTime } from '@/utils/format'
import { DEADLINE_META, DEADLINE_STAGE_LABELS } from '../status'

const STAGES: DeadlineStage[] = ['cadastro', 'aprovacao']

function deadlineHint(d: StageDeadline): string {
  return d.state === 'concluido' ? `Concluído em ${formatDateTime(d.doneAt)}` : `Prazo até ${formatDateTime(d.dueAt)}`
}

/** Situação do prazo de uma etapa; "—" se a etapa ainda não começou. */
export function DeadlineBadge({ stage, deadline }: { stage: DeadlineStage; deadline: StageDeadline | null }) {
  if (!deadline) return <span className="text-text-muted">—</span>
  const meta = DEADLINE_META[deadline.state]
  return (
    <Badge tone={meta.tone} title={`${DEADLINE_STAGE_LABELS[stage]}: ${deadlineHint(deadline)}`}>
      {meta.label}
    </Badge>
  )
}

/** Prazo das duas etapas, uma por linha (listas). */
export function DeadlineList({ deadlines }: { deadlines: RequestDeadlines }) {
  return (
    <dl className="grid grid-cols-[auto_auto] items-center justify-start gap-x-2 gap-y-1">
      {STAGES.map((stage) => (
        <div key={stage} className="contents">
          <dt className="text-[11px] leading-4 text-text-muted">{DEADLINE_STAGE_LABELS[stage]}</dt>
          <dd>
            <DeadlineBadge stage={stage} deadline={deadlines[stage]} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Prazo das duas etapas com datas (detalhe da solicitação). */
export function DeadlinePanel({ deadlines }: { deadlines: RequestDeadlines }) {
  return (
    <div className="grid gap-3">
      {STAGES.map((stage) => {
        const d = deadlines[stage]
        return (
          <div key={stage} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{DEADLINE_STAGE_LABELS[stage]}</p>
              <p className="text-xs text-text-muted">{d ? deadlineHint(d) : 'Ainda não começou'}</p>
            </div>
            <DeadlineBadge stage={stage} deadline={d} />
          </div>
        )
      })}
      <p className="text-xs text-text-muted">
        Cada etapa tem {STAGE_DEADLINE_DAYS} dias. Devolver à obra reinicia o prazo do cadastro; devolver ao analista reinicia o da aprovação.
      </p>
    </div>
  )
}
