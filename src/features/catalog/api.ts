/**
 * Hooks do cadastro de insumos do UAU (somente leitura).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CatalogItemDetailDTO, CatalogPageDTO, CatalogQuery, DraftContextDTO, SimilarItem } from '@shared/contracts'
import { api, toQuery } from '@/lib/api'

// O cadastro inteiro vem do UAU em alguns segundos; o servidor guarda em cache por 10 minutos
const CATALOG_STALE_MS = 60_000

export function useCatalog(query: Partial<CatalogQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['catalog', query],
    queryFn: () => api<CatalogPageDTO>(`/catalog${toQuery(query)}`),
    placeholderData: keepPreviousData,
    staleTime: CATALOG_STALE_MS,
    enabled,
  })
}

export function useCatalogItem(codigo: string | null) {
  return useQuery({
    queryKey: ['catalog', 'item', codigo],
    queryFn: () => api<CatalogItemDetailDTO>(`/catalog/items/${encodeURIComponent(codigo!)}`),
    enabled: !!codigo,
    staleTime: CATALOG_STALE_MS,
  })
}

/** Força o servidor a reler o cadastro inteiro do UAU (ignora o cache de 10 minutos). */
export function useRefreshCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<CatalogPageDTO>(`/catalog${toQuery({ refresh: '1', pageSize: 10 })}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  })
}

/** Insumos com descrição parecida (texto já com debounce). */
export function useSimilarItems(description: string) {
  const q = description.trim()
  return useQuery({
    queryKey: ['catalog', 'similar', q],
    queryFn: () => api<SimilarItem[]>(`/catalog/similar${toQuery({ q })}`),
    enabled: q.length >= 3,
    staleTime: CATALOG_STALE_MS,
  })
}

export function useDraftContext(requestId: string | undefined) {
  return useQuery({
    queryKey: ['catalog', 'draft-context', requestId],
    queryFn: () => api<DraftContextDTO>(`/catalog/draft-context${toQuery({ requestId })}`),
    enabled: !!requestId,
    staleTime: CATALOG_STALE_MS,
  })
}
