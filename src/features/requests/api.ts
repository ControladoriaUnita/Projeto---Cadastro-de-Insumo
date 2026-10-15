/**
 * Hooks de dados das solicitações (TanStack Query). Toda escrita invalida listas e detalhe.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApproveResultDTO,
  CreateRequestBatchResultDTO,
  CreateRequestInput,
  DraftPreviewDTO,
  InsumoDraft,
  RequestDTO,
  RequestDetailDTO,
  RequestScope,
} from '@shared/contracts'
import { api } from '@/lib/api'

const keys = {
  all: ['requests'] as const,
  list: (scope: RequestScope) => ['requests', 'list', scope] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
}

export function useRequests(scope: RequestScope) {
  return useQuery({ queryKey: keys.list(scope), queryFn: () => api<RequestDTO[]>(`/requests?scope=${scope}`) })
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api<RequestDetailDTO>(`/requests/${id}`),
    enabled: !!id,
  })
}

function useWrite<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useCreateRequest() {
  return useWrite((input: CreateRequestInput) => api<RequestDetailDTO>('/requests', { method: 'POST', body: input }))
}

/** Vários insumos de uma vez: uma solicitação por insumo. */
export function useCreateRequests() {
  return useWrite((items: CreateRequestInput[]) => api<CreateRequestBatchResultDTO>('/requests/batch', { method: 'POST', body: { items } }))
}

/** Ações simples do fluxo (POST /requests/:id/<ação>). */
export function useRequestAction(id: string) {
  return useWrite(({ action, comment }: { action: 'cancel' | 'start-draft' | 'submit' | 'return' | 'reject'; comment?: string }) =>
    api<RequestDetailDTO>(`/requests/${id}/${action}`, { method: 'POST', body: comment === undefined ? {} : { comment } }),
  )
}

export function useSaveDraft(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: InsumoDraft) => api<RequestDetailDTO>(`/requests/${id}/draft`, { method: 'PUT', body: { draft } }),
    onSuccess: (data) => qc.setQueryData(keys.detail(id), data),
  })
}

export function useApprove(id: string) {
  return useWrite((draft?: InsumoDraft) => api<ApproveResultDTO>(`/requests/${id}/approve`, { method: 'POST', body: { draft } }))
}

export function useResume(id: string) {
  return useWrite(() => api<ApproveResultDTO>(`/requests/${id}/resume`, { method: 'POST' }))
}

export function previewDraft(id: string, draft: InsumoDraft) {
  return api<DraftPreviewDTO>(`/requests/${id}/preview`, { method: 'POST', body: { draft } })
}
