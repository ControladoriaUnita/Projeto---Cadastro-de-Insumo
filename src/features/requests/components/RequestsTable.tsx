import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RequestDTO } from '@shared/contracts'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRequestNumber } from '@/utils/format'
import { StatusBadge, UrgencyBadge } from './StatusBadge'

interface Column {
  label: string
  render: (r: RequestDTO) => ReactNode
  align?: 'right'
  className?: string
}

const COLUMNS = {
  number: { label: 'Nº', render: (r) => formatRequestNumber(r.number), className: 'tabular w-20 text-text-muted' },
  description: {
    label: 'Insumo',
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{r.draft?.descricao || r.description}</p>
        <p className="truncate text-[11px] leading-4 text-text-muted">{r.uauCode ?? r.draft?.codigo ?? r.unit}</p>
      </div>
    ),
  },
  work: { label: 'Obra', render: (r) => r.workName, className: 'whitespace-nowrap' },
  requester: { label: 'Solicitante', render: (r) => r.requester.name, className: 'whitespace-nowrap' },
  analyst: { label: 'Analista', render: (r) => r.analyst?.name ?? '—', className: 'whitespace-nowrap' },
  status: {
    label: 'Situação',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={r.status} />
        <UrgencyBadge urgency={r.urgency} />
      </div>
    ),
  },
  updated: { label: 'Atualizada', render: (r) => formatDateTime(r.updatedAt), align: 'right', className: 'tabular whitespace-nowrap text-text-muted' },
  created: { label: 'Aberta em', render: (r) => formatDateTime(r.createdAt), align: 'right', className: 'tabular whitespace-nowrap text-text-muted' },
} satisfies Record<string, Column>

export type RequestColumn = keyof typeof COLUMNS

/** Tabela de solicitações; clique (ou Enter) na linha abre `linkTo(r)`. */
export function RequestsTable({ rows, columns, linkTo }: { rows: RequestDTO[]; columns: RequestColumn[]; linkTo: (r: RequestDTO) => string }) {
  const navigate = useNavigate()
  const cols: (Column & { key: string })[] = columns.map((key) => ({ key, ...COLUMNS[key] }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className={cn('border-b border-border bg-ink-50 px-3 py-2 text-xs font-semibold text-text-muted first:pl-5', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              tabIndex={0}
              onClick={() => navigate(linkTo(r))}
              onKeyDown={(e) => e.key === 'Enter' && navigate(linkTo(r))}
              className="group cursor-pointer"
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cn('max-w-96 border-b border-border px-3 py-2.5 align-middle group-hover:bg-ink-50 first:pl-5', c.align === 'right' && 'text-right', c.className)}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
