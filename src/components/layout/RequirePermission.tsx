import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Permission } from '@shared/domain/roles'
import { HOME_BY_ROLE } from '@/app/navigation'
import { useAuth } from '@/lib/auth'

/**
 * Esconde a tela de quem não tem acesso e manda para a tela inicial do papel.
 * A API aplica a mesma regra — isto só evita mostrar uma tela que daria "sem permissão".
 */
export function RequirePermission({ anyOf, children }: { anyOf: Permission[]; children: ReactNode }) {
  const { user, can } = useAuth()
  if (!user) return null
  if (!anyOf.some(can)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  return <>{children}</>
}
