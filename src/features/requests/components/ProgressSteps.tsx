import { Check, X } from 'lucide-react'
import type { RequestStatus } from '@shared/domain/request/workflow'
import { cn } from '@/utils/cn'
import { STATUS_META, STEPS } from '../status'

/**
 * Linha de etapas da solicitação (Solicitado → Cadastro → Aprovação → No UAU).
 * Recusada/cancelada aparece como etapa interrompida.
 */
export function ProgressSteps({ status, className }: { status: RequestStatus; className?: string }) {
  const meta = STATUS_META[status]
  const stopped = meta.step === null
  const current = meta.step ?? 0
  const done = status === 'aprovado'

  return (
    <ol className={cn('flex items-center gap-2', className)} aria-label={`Etapa atual: ${meta.label}`}>
      {STEPS.map((label, i) => {
        const complete = done || i < current
        const active = !done && !stopped && i === current
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                complete && 'border-success bg-success text-primary-foreground',
                active && 'border-primary bg-primary-soft text-primary',
                !complete && !active && 'border-border bg-surface text-ink-400',
                stopped && i === 0 && 'border-error bg-error-soft text-error',
              )}
              aria-hidden
            >
              {complete ? <Check className="size-3.5" /> : stopped && i === 0 ? <X className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('truncate text-xs font-medium', active ? 'text-primary' : complete ? 'text-text' : 'text-text-muted')}>{label}</span>
            {i < STEPS.length - 1 && <span aria-hidden className={cn('h-px flex-1', complete ? 'bg-success' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}
