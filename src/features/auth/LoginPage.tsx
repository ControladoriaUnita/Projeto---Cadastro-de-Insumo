import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert, Button } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

/** Logo da Microsoft (quatro quadrados), como pede o guia de marca para "Entrar com a Microsoft". */
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="var(--color-ms-red)" />
      <rect x="11" y="1" width="9" height="9" fill="var(--color-ms-green)" />
      <rect x="1" y="11" width="9" height="9" fill="var(--color-ms-blue)" />
      <rect x="11" y="11" width="9" height="9" fill="var(--color-ms-yellow)" />
    </svg>
  )
}

/** Login com a conta Microsoft 365 da empresa, em popup (o app roda em iframe no portal). */
export function LoginPage() {
  const { access, demo, entraConfigured, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Já entrou, ou o servidor está em modo demonstração (sem login)
  if (demo || access === 'ready' || access === 'inactive') return <Navigate to="/" replace />

  const enter = async () => {
    setLoading(true)
    setError(null)
    try {
      await signIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Entrar" description="Use sua conta Microsoft 365 da Unità (o mesmo e-mail e senha do Outlook e do Teams).">
      {access === 'error' && (
        <Alert tone="error" className="mb-4">
          Não foi possível falar com o servidor. Tente recarregar a página.
        </Alert>
      )}
      {access !== 'loading' && !entraConfigured && (
        <Alert tone="warning" className="mb-4">
          O login Microsoft ainda não foi configurado no servidor. Avise quem administra o app.
        </Alert>
      )}
      <div className="grid gap-4">
        <Button variant="primary" loading={loading} icon={<MicrosoftLogo />} onClick={enter} disabled={!entraConfigured}>
          Entrar com Microsoft 365
        </Button>
        {loading && <p className="text-center text-sm text-text-muted">Conclua o login na janela da Microsoft que abriu.</p>}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <div className="mt-6 border-t border-border pt-4 text-center text-sm text-text-muted">
        Quem é da obra entra direto e já pode solicitar insumos.
        <p className="mt-2">
          Precisa do perfil de analista ou gestão?{' '}
          <Link to="/solicitar-acesso" className="font-medium text-primary hover:underline">
            Solicitar acesso
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
