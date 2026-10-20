import type { RequestEventDTO } from '@shared/contracts'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { EVENT_LABELS, isFailureEvent } from '../status'

/** Histórico da solicitação. */
export function RequestTimeline({ events }: { events: RequestEventDTO[] }) {
  return (
    <ol className="relative grid gap-4 border-l border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative min-w-0">
          <span
            aria-hidden
            className={cn('absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-surface', isFailureEvent(e.type) ? 'bg-error' : 'bg-primary')}
          />
          <p className="text-sm font-medium text-text">{EVENT_LABELS[e.type]}</p>
          <p className="text-xs text-text-muted">
            {formatDateTime(e.at)} · {e.actorName}
          </p>
          {e.comment && <p className="mt-1 rounded-control bg-ink-50 px-3 py-2 text-sm break-words text-ink-700">{e.comment}</p>}
        </li>
      ))}
    </ol>
  )
}
