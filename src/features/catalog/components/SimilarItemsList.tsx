import type { SimilarItem } from '@shared/contracts'
import { Badge } from '@/components/ui'
import { cn } from '@/utils/cn'

/** Lista de insumos parecidos com a pontuação de semelhança. */
export function SimilarItemsList({ items, onPick, className }: { items: SimilarItem[]; onPick?: (codigo: string) => void; className?: string }) {
  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((s) => (
        <li key={s.codigo}>
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(s.codigo)}
            className="flex w-full items-start gap-3 px-4 py-2 text-left enabled:hover:bg-ink-50 disabled:cursor-default"
          >
            <span className="tabular w-16 shrink-0 text-xs font-semibold text-text">{s.codigo}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text">{s.descricao}</span>
              <span className="block text-[11px] leading-4 text-text-muted">
                {s.unidade}
                {!s.ativo && ' · inativo'}
              </span>
            </span>
            <Badge tone={s.score === 100 ? 'error' : s.score >= 70 ? 'warning' : 'neutral'} title="Semelhança da descrição">
              {s.score}%
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}
