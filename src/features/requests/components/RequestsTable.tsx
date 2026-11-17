import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RequestDTO } from '@shared/contracts'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRequestNumber } from '@/utils/format'
import { DEADLINE_META, STATUS_META } from '../status'
import { ColumnFilter, type FilterOption } from './ColumnFilter'
import { DeadlineBadge } from './DeadlineBadge'
import { StatusBadge, UrgencyBadge } from './StatusBadge'

interface Column {
  label: string
  render: (r: RequestDTO) => ReactNode
  /** Texto usado no filtro da coluna (estilo Excel) */
  filterValue: (r: RequestDTO) => string
  /** Ordem dos valores na lista do filtro (padrão: o próprio texto) */
  filterSort?: (r: RequestDTO) => string
  align?: 'right'
  className?: string
}

/** Só a data (dd/mm/aaaa), no fuso de São Paulo */
const dateOnly = (iso: string) => formatDateTime(iso).slice(0, 10)

const COLUMNS = {
  number: {
    label: 'Nº',
    render: (r) => formatRequestNumber(r.number),
    filterValue: (r) => formatRequestNumber(r.number),
    className: 'tabular w-20 text-text-muted',
  },
  description: {
    label: 'Insumo',
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{r.draft?.descricao || r.description}</p>
        <p className="truncate text-[11px] leading-4 text-text-muted">{r.uauCode ?? r.draft?.codigo ?? r.unit}</p>
      </div>
    ),
    filterValue: (r) => r.draft?.descricao || r.description,
  },
  work: { label: 'Obra', render: (r) => r.workName, filterValue: (r) => r.workName, className: 'whitespace-nowrap' },
  requester: { label: 'Solicitante', render: (r) => r.requester.name, filterValue: (r) => r.requester.name, className: 'whitespace-nowrap' },
  analyst: { label: 'Analista', render: (r) => r.analyst?.name ?? '—', filterValue: (r) => r.analyst?.name ?? '—', className: 'whitespace-nowrap' },
  status: {
    label: 'Situação',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={r.status} />
        <UrgencyBadge urgency={r.urgency} />
      </div>
    ),
    filterValue: (r) => STATUS_META[r.status].label,
  },
  deadline: {
    label: 'Prazo',
    render: (r) => <DeadlineBadge deadline={r.deadline} />,
    filterValue: (r) => (r.deadline ? DEADLINE_META[r.deadline.state].label : '—'),
  },
  updated: {
    label: 'Atualizada',
    render: (r) => formatDateTime(r.updatedAt),
    filterValue: (r) => dateOnly(r.updatedAt),
    filterSort: (r) => r.updatedAt,
    align: 'right',
    className: 'tabular whitespace-nowrap text-text-muted',
  },
  created: {
    label: 'Aberta em',
    render: (r) => formatDateTime(r.createdAt),
    filterValue: (r) => dateOnly(r.createdAt),
    filterSort: (r) => r.createdAt,
    align: 'right',
    className: 'tabular whitespace-nowrap text-text-muted',
  },
} satisfies Record<string, Column>

export type RequestColumn = keyof typeof COLUMNS

/** Valores marcados em cada coluna; coluna ausente = sem filtro. */
export type ColumnFilters = Partial<Record<RequestColumn, string[]>>

/** Aplica os filtros de coluna; `except` ignora uma coluna (para montar a lista dela). */
export function applyColumnFilters(rows: RequestDTO[], filters: ColumnFilters, except?: RequestColumn): RequestDTO[] {
  const active = (Object.entries(filters) as [RequestColumn, string[]][]).filter(([key]) => key !== except)
  if (!active.length) return rows
  const sets = active.map(([key, values]) => [COLUMNS[key] as Column, new Set(values)] as const)
  return rows.filter((r) => sets.every(([col, set]) => set.has(col.filterValue(r))))
}

/** Valores distintos da coluna com a quantidade de linhas de cada um. */
function filterOptions(rows: RequestDTO[], key: RequestColumn): FilterOption[] {
  const col: Column = COLUMNS[key]
  const byValue = new Map<string, { count: number; sort: string }>()
  for (const r of rows) {
    const value = col.filterValue(r)
    const entry = byValue.get(value)
    if (entry) entry.count++
    else byValue.set(value, { count: 1, sort: col.filterSort?.(r) ?? value })
  }
  return [...byValue.entries()]
    .sort(([, a], [, b]) => a.sort.localeCompare(b.sort, 'pt-BR', { numeric: true }))
    .map(([value, { count }]) => ({ value, count }))
}

interface FilterProps {
  /** Linhas antes dos filtros de coluna: cada lista mostra os valores possíveis com os outros filtros */
  source: RequestDTO[]
  value: ColumnFilters
  onChange: (filters: ColumnFilters) => void
}

/**
 * Tabela de solicitações; clique (ou Enter) na linha abre `linkTo(r)`.
 * Com `filters`, cada coluna ganha um filtro como o do Excel.
 */
export function RequestsTable({ rows, columns, linkTo, filters }: { rows: RequestDTO[]; columns: RequestColumn[]; linkTo: (r: RequestDTO) => string; filters?: FilterProps }) {
  const navigate = useNavigate()
  const cols: (Column & { key: RequestColumn })[] = columns.map((key) => ({ key, ...COLUMNS[key] }))
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
                {filters ? (
                  <span className={cn('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                    {c.label}
                    <ColumnFilter
                      label={c.label}
                      options={filterOptions(applyColumnFilters(filters.source, filters.value, c.key), c.key)}
                      selected={filters.value[c.key] ?? null}
                      onChange={(selected) => {
                        const next = { ...filters.value }
                        if (selected === null) delete next[c.key]
                        else next[c.key] = selected
                        filters.onChange(next)
                      }}
                    />
                  </span>
                ) : (
                  c.label
                )}
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
          {!rows.length && (
            <tr>
              <td colSpan={cols.length} className="px-5 py-8 text-center text-sm text-text-muted">
                Nenhuma solicitação com esses filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
