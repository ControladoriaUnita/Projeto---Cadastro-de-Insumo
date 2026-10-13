import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { ROLE_LABELS, type RoleKey } from '@shared/domain/roles'
import { HOME_BY_ROLE } from '@/app/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

/** Modo demonstração: alterna o usuário para testar cada papel e o fluxo inteiro. */
export function DemoUserSwitcher() {
  const { user, switchDemoUser } = useAuth()
  const navigate = useNavigate()
  const users = useQuery({
    queryKey: ['demo-users'],
    queryFn: () => api<{ id: string; fullName: string; role: RoleKey }[]>('/demo-users'),
    staleTime: Infinity,
  })
  if (!users.data) return null
  return (
    <label className="flex items-center gap-2 rounded-control bg-white/10 px-2 py-1 text-xs text-ink-200">
      <UserRound className="size-3.5" aria-hidden />
      <span className="hidden md:inline">Demonstração — entrar como</span>
      <select
        value={user?.id ?? ''}
        onChange={(e) => {
          const next = users.data.find((u) => u.id === e.target.value)
          switchDemoUser(e.target.value)
          if (next) navigate(HOME_BY_ROLE[next.role])
        }}
        className="rounded bg-transparent text-xs font-medium text-white focus:outline-none [&>option]:text-text"
      >
        {users.data.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} ({ROLE_LABELS[u.role]})
          </option>
        ))}
      </select>
    </label>
  )
}
