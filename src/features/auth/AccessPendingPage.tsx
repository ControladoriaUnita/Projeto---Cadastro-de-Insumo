import { LogOut } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

/** Login válido, mas o perfil foi desativado pela gestão (profiles.active = false). */
export function AccessPendingPage() {
  const { signOut } = useAuth()
  return (
    <AuthLayout title="Acesso desativado">
      <Alert tone="warning">
        Seu login Microsoft está correto, mas o seu acesso ao app está desativado. Peça à gestão para liberar seu perfil.
      </Alert>
      <Button className="mt-4 w-full" icon={<LogOut className="size-4" />} onClick={signOut}>
        Sair
      </Button>
    </AuthLayout>
  )
}
