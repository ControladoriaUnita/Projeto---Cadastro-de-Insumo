import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { SimilarItem } from '@shared/contracts'
import { Badge } from '@/components/ui'
import { cn } from '@/utils/cn'

/** Código selecionável (um clique seleciona tudo) + botão que copia para a área de transferência. */
function CopyableCode({ codigo }: { codigo: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sem permissão de área de transferência: o código continua selecionável para Ctrl+C
    }
  }
  return (
    <span className="flex w-24 shrink-0 items-center gap-1 py-2 pl-4">
      <span className="tabular cursor-text text-xs font-semibold text-text select-all">{codigo}</span>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copiado' : 'Copiar código'}
        aria-label={copied ? `Código ${codigo} copiado` : `Copiar código ${codigo}`}
        className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-text"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  )
}

/** Lista de insumos parecidos com a pontuação de semelhança. */
export function SimilarItemsList({ items, onPick, className }: { items: SimilarItem[]; onPick?: (codigo: string) => void; className?: string }) {
  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((s) => (
        <li key={s.codigo} className="flex items-start">
          <CopyableCode codigo={s.codigo} />
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(s.codigo)}
            className="flex min-w-0 flex-1 items-start gap-3 py-2 pr-4 pl-2 text-left enabled:hover:bg-ink-50 disabled:cursor-default"
          >
            <span className="min-w-0 flex-1 select-text">
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
