import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { LogoMicrosoft } from '@/components/UnitaLogin'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'
import { LoginNotice, TI_EMAIL, useLoginNotice } from './LoginNotice'

/** Login com a conta Microsoft 365 da empresa, em popup (o app roda em iframe no portal). */
export function LoginPage() {
  const { access, demo, entraConfigured, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const notice = useLoginNotice()

  // Já entrou, ou o servidor está em modo demonstração (sem login)
  if (demo || access === 'ready' || access === 'inactive') return <Navigate to="/" replace />
  // Comunicado do novo login: aparece uma vez por navegador, antes da tela de login
  if (notice.pending) return <LoginNotice onContinue={notice.dismiss} />

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
    <AuthLayout title="Bem-vindo" description="Use sua conta Microsoft 365 da Unità (o mesmo e-mail e senha do Outlook e do Teams).">
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
        <button type="button" className="ul-botao" onClick={enter} disabled={!entraConfigured || loading}>
          {loading ? <span className="ul-girando" /> : <LogoMicrosoft />}
          {loading ? 'Abrindo a Microsoft…' : 'Entrar com Microsoft 365'}
        </button>
        {loading && <p className="text-center text-sm text-text-muted">Conclua o login na janela da Microsoft que abriu.</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-center text-xs text-text-muted">
          Não sabe a senha do seu e-mail institucional? Procure o TI:{' '}
          <a href={`mailto:${TI_EMAIL}`} className="font-medium text-primary hover:underline">
            {TI_EMAIL}
          </a>
        </p>
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
