import { CONTROLS, GROUPS, PAYMENT_TYPES } from '@shared/domain/insumo/catalog'
import { Alert, Badge, Dialog, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useCatalogItem } from './api'

const label = (map: Record<number, string>, v: number | null) => (v === null ? '—' : `${v} · ${map[v] ?? '?'}`)

/** Todos os campos que o UAU devolveu para o insumo. */
export function CatalogItemDialog({ codigo, onClose }: { codigo: string | null; onClose: () => void }) {
  const detail = useCatalogItem(codigo)
  const item = detail.data?.item
  const raw = detail.data?.raw ?? {}

  return (
    <Dialog open={!!codigo} onClose={onClose} title={codigo ?? ''} description={item?.descricao} width="min(94vw, 44rem)">
      {detail.isLoading ? (
        <Skeleton className="h-48" />
      ) : detail.isError || !item ? (
        <Alert tone="error">{errorMessage(detail.error)}</Alert>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
            <Badge tone={item.confirmado ? 'info' : 'warning'}>{item.confirmado ? 'Confirmado' : 'Não confirmado'}</Badge>
            <Badge>{item.unidade}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ['Categoria', item.categoria || '—'],
              ['Grupo', label(GROUPS, item.grupo)],
              ['Controle', label(CONTROLS, item.controle)],
              ['Tipo de pagamento', label(PAYMENT_TYPES, item.tipoPagamento)],
              ['CAP', item.cap || '—'],
              ['NCM', item.ncm || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-muted">{k}</dt>
                <dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-text-muted">Todos os campos do UAU ({Object.keys(raw).length})</summary>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {Object.entries(raw).map(([k, v]) => (
                  <tr key={k} className="border-b border-border">
                    <td className="py-1 pr-3 font-medium text-text-muted">{k}</td>
                    <td className="py-1 break-all text-text">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </Dialog>
  )
}
