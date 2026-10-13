import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, LogIn, Mail } from 'lucide-react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

type Mode = 'login' | 'forgot'

/** Login com as credenciais do Supabase Auth, e pedido de nova senha por e-mail. */
export function LoginPage() {
  const { access, demo, signIn, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  // Já entrou (ou o servidor está em modo demonstração, sem login)
  if (demo || access === 'ready' || access === 'inactive') return <Navigate to="/" replace />

  const run = (action: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setSent(false)
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout title="Esqueci minha senha" description="Enviaremos um link para você definir uma nova senha.">
        {sent ? (
          <div className="grid gap-4">
            <Alert tone="success" title="Verifique seu e-mail">
              Se {email} estiver cadastrado, você vai receber um link em alguns minutos. Confira também a caixa de spam.
            </Alert>
            <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => switchMode('login')}>
              Voltar para o login
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={run(async () => {
              await requestPasswordReset(email)
              setSent(true)
            })}
          >
            <Field label="E-mail">
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" variant="primary" loading={loading} icon={<Mail className="size-4" />}>
              Enviar link
            </Button>
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => switchMode('login')}>
              Voltar para o login
            </Button>
          </form>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Entrar" description="Use o e-mail corporativo e a senha cadastrados para você.">
      {access === 'error' && (
        <Alert tone="error" className="mb-4">
          Não foi possível falar com o servidor. Tente recarregar a página.
        </Alert>
      )}
      <form className="grid gap-4" onSubmit={run(() => signIn(email, password))}>
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Senha">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="primary" loading={loading} icon={<LogIn className="size-4" />} className="mt-2">
          Entrar
        </Button>
        <button type="button" onClick={() => switchMode('forgot')} className="justify-self-center text-sm font-medium text-ink-600 hover:text-text hover:underline">
          Esqueci minha senha
        </button>
      </form>
    </AuthLayout>
  )
}
