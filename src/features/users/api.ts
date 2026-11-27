/**
 * Hooks da tela "Usuários e permissões" (gestão). Toda escrita recarrega usuários e pedidos.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AccessRequestDTO, CreateUserInput, ManagedUserDTO, ResolveAccessRequestInput, UpdateUserInput } from '@shared/contracts'
import { api } from '@/lib/api'

const keys = {
  all: ['admin'] as const,
  users: ['admin', 'users'] as const,
  accessRequests: ['admin', 'access-requests'] as const,
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api<ManagedUserDTO[]>('/admin/users') })
}

export function useAccessRequests() {
  return useQuery({ queryKey: keys.accessRequests, queryFn: () => api<AccessRequestDTO[]>('/admin/access-requests') })
}

function useAdminWrite<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      // O próprio perfil pode ter mudado (nome, obra padrão)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useCreateUser() {
  return useAdminWrite((input: CreateUserInput) => api<ManagedUserDTO>('/admin/users', { method: 'POST', body: input }))
}

export function useUpdateUser() {
  return useAdminWrite(({ id, ...patch }: UpdateUserInput & { id: string }) => api<ManagedUserDTO>(`/admin/users/${id}`, { method: 'PATCH', body: patch }))
}

export function useResolveAccessRequest() {
  return useAdminWrite(({ id, ...input }: ResolveAccessRequestInput & { id: string }) =>
    api<{ ok: true }>(`/admin/access-requests/${id}/resolve`, { method: 'POST', body: input }),
  )
}
