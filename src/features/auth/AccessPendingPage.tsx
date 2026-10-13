import { LogOut } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

/** Login válido, mas o perfil ainda não foi liberado pela gestão (profiles.active = false). */
export function AccessPendingPage() {
  const { sessionEmail, signOut } = useAuth()
  return (
    <AuthLayout title="Acesso aguardando liberação">
      <Alert tone="warning">
        Seu login ({sessionEmail ?? 'e-mail'}) está correto, mas o acesso ainda não foi liberado. Peça à gestão para ativar seu perfil e definir seu papel
        (obra, analista ou gestão).
      </Alert>
      <Button className="mt-4 w-full" icon={<LogOut className="size-4" />} onClick={signOut}>
        Sair
      </Button>
    </AuthLayout>
  )
}
