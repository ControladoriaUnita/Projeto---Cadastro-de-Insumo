import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import type { CatalogQuery } from '@shared/contracts'
import { groupLabel } from '@shared/domain/insumo/catalog'
import { Alert, Badge, Button, Card, EmptyState, Input, KpiStrip, Select, Skeleton } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { cn } from '@/utils/cn'
import { formatDateTime, formatInteger } from '@/utils/format'
import { useCatalog, useRefreshCatalog } from './api'
import { CatalogItemDialog } from './CatalogItemDialog'

type Filters = Pick<CatalogQuery, 'status' | 'categoria' | 'unidade' | 'grupo' | 'sort' | 'dir' | 'page'>

const INITIAL: Filters = { status: '', categoria: '', unidade: '', grupo: '', sort: 'codigo', dir: 'asc', page: 1 }
const PAGE_SIZE = 50

const COLUMNS: { key: CatalogQuery['sort'] | 'grupo' | 'status'; label: string; sortable: boolean; className?: string }[] = [
  { key: 'codigo', label: 'Código', sortable: true, className: 'w-28' },
  { key: 'descricao', label: 'Descrição', sortable: true },
  { key: 'unidade', label: 'Un.', sortable: true, className: 'w-20' },
  { key: 'categoria', label: 'Categoria', sortable: true, className: 'w-28' },
  { key: 'grupo', label: 'Grupo', sortable: false, className: 'w-32' },
  { key: 'status', label: 'Situação', sortable: false, className: 'w-36' },
]

/**
 * Consulta do cadastro geral de insumos do UAU: busca sem acento por código ou descrição
 * (vários termos = todos precisam aparecer), filtros, ordenação, paginação e detalhe.
 * Usada na tela "Insumos UAU" e na aprovação (conferir repetidos antes de gravar).
 */
export function CatalogBrowser({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [filters, setFilters] = useState<Filters>(INITIAL)
  const [selected, setSelected] = useState<string | null>(null)
  const term = useDebouncedValue(q, 250)
  const catalog = useCatalog({ q: term, ...filters, pageSize: PAGE_SIZE })
  const refresh = useRefreshCatalog()
  const data = catalog.data

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const sortBy = (key: CatalogQuery['sort']) => set({ sort: key, dir: filters.sort === key && filters.dir === 'asc' ? 'desc' : 'asc' })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <KpiStrip
        className="mb-4"
        items={[
          { label: 'Insumos no cadastro', value: data ? formatInteger(data.catalogTotal) : '—' },
          { label: 'Categorias', value: data ? formatInteger(data.facets.categorias.length) : '—' },
          { label: 'No filtro atual', value: data ? formatInteger(data.total) : '—', emphasis: true },
          { label: 'Lido do UAU em', value: data ? formatDateTime(data.loadedAt) : '—' },
        ]}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
          <Button icon={<RefreshCw className="size-4" />} loading={refresh.isPending} onClick={() => refresh.mutate()} title="Relê o cadastro inteiro do UAU">
            Atualizar do UAU
          </Button>
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                set({})
              }}
              placeholder="Código ou descrição · use * para segmentar (ex.: janela*veneziana*0,60)"
              title="Sem *: todas as palavras, em qualquer ordem. Com *: os trechos na ordem digitada, como no UAU."
              className="pl-9"
              aria-label="Buscar insumo"
            />
          </div>
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value as Filters['status'] })} className="w-36" aria-label="Situação">
            <option value="">Ativos e inativos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </Select>
          <Select value={filters.grupo} onChange={(e) => set({ grupo: e.target.value })} className="w-44" aria-label="Grupo">
            <option value="">Todos os grupos</option>
            {data?.facets.grupos.map((g) => (
              <option key={g.value} value={g.value}>
                {groupLabel(g.value)} ({formatInteger(g.count)})
              </option>
            ))}
          </Select>
          <Select value={filters.categoria} onChange={(e) => set({ categoria: e.target.value })} className="w-48" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {data?.facets.categorias.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({formatInteger(c.count)})
              </option>
            ))}
          </Select>
          <Select value={filters.unidade} onChange={(e) => set({ unidade: e.target.value })} className="w-40" aria-label="Unidade">
            <option value="">Todas as unidades</option>
            {data?.facets.unidades.map((u) => (
              <option key={u.value} value={u.value}>
                {u.value} ({formatInteger(u.count)})
              </option>
            ))}
          </Select>
        </div>

        {catalog.isLoading ? (
          <div className="grid gap-2 p-5">
            <p className="text-sm text-text-muted">Lendo o cadastro de insumos no UAU… pode levar alguns segundos.</p>
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : catalog.isError || refresh.isError ? (
          <Alert tone="error" className="m-5">
            {errorMessage(catalog.error ?? refresh.error)}
          </Alert>
        ) : data?.items.length ? (
          <div className={cn('overflow-x-auto', catalog.isFetching && 'opacity-60')}>
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={cn('border-b border-border bg-ink-50 px-3 py-2 text-left text-xs font-semibold text-text-muted first:pl-5', c.className)}>
                      {c.sortable ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => sortBy(c.key as CatalogQuery['sort'])}>
                          {c.label}
                          {filters.sort === c.key && (filters.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.codigo} tabIndex={0} className="group cursor-pointer" onClick={() => setSelected(i.codigo)} onKeyDown={(e) => e.key === 'Enter' && setSelected(i.codigo)}>
                    <td className="tabular border-b border-border px-3 py-2 pl-5 font-medium group-hover:bg-ink-50">{i.codigo}</td>
                    <td className="border-b border-border px-3 py-2 group-hover:bg-ink-50">{i.descricao}</td>
                    <td className="border-b border-border px-3 py-2 group-hover:bg-ink-50">{i.unidade}</td>
                    <td className="tabular border-b border-border px-3 py-2 group-hover:bg-ink-50">{i.categoria || '—'}</td>
                    <td className="border-b border-border px-3 py-2 text-text-muted group-hover:bg-ink-50">{groupLabel(i.grupo)}</td>
                    <td className="border-b border-border px-3 py-2 group-hover:bg-ink-50">
                      <div className="flex flex-wrap gap-1">
                        {!i.ativo && <Badge>Inativo</Badge>}
                        {!i.confirmado && <Badge tone="warning">Não confirmado</Badge>}
                        {i.ativo && i.confirmado && <Badge tone="success">Ativo</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum insumo com esses filtros" description="Tente outros termos. A busca ignora acentos e aceita parte da palavra." />
        )}

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-text-muted">
            <span className="tabular">
              {formatInteger((data.page - 1) * data.pageSize + 1)}–{formatInteger(Math.min(data.page * data.pageSize, data.total))} de {formatInteger(data.total)}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
                Anterior
              </Button>
              <Button size="sm" variant="ghost" disabled={data.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
                Próxima <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CatalogItemDialog codigo={selected} onClose={() => setSelected(null)} />
    </>
  )
}
