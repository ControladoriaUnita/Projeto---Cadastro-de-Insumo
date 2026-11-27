import { useState } from 'react'
import { ArrowRight, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

/**
 * Comunicado mostrado uma única vez, antes da tela de login, sobre o novo login com o
 * Microsoft 365. Para mostrar um comunicado novo a todos de novo, troque a versão da chave.
 */
const NOTICE_KEY = 'insumos.comunicado.login-microsoft.v1'

function readSeen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'visto'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(NOTICE_KEY, 'visto')
  } catch {
    /* armazenamento bloqueado: o comunicado pode aparecer de novo, sem prejuízo */
  }
}

/** true enquanto o comunicado ainda não foi visto neste navegador; `dismiss` o fecha para sempre. */
export function useLoginNotice() {
  const [pending, setPending] = useState(() => !readSeen())
  return {
    pending,
    dismiss: () => {
      markSeen()
      setPending(false)
    },
  }
}

const steps = [
  {
    icon: Mail,
    title: 'Use seu e-mail institucional',
    text: 'O mesmo endereço @unitaengenharia.com.br que você usa no Outlook e no Teams.',
  },
  {
    icon: KeyRound,
    title: 'E a senha desse e-mail',
    text: 'É a mesma senha que você usa para acessar seu e-mail. Não existe mais uma senha separada para este app.',
  },
  {
    icon: ShieldCheck,
    title: 'O login abre em uma janela da Microsoft',
    text: 'Se a janela não aparecer, permita pop-ups para este site no navegador e clique em "Entrar" de novo.',
  },
]

export function LoginNotice({ onContinue }: { onContinue: () => void }) {
  return (
    <AuthLayout title="Novidade: o login mudou" description="A partir de agora, todos entram no Cadastro de Insumos com a conta Microsoft 365 da Unità.">
      <ul className="grid gap-4">
        {steps.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-text">{title}</span>
              <span className="block text-sm text-text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <Alert tone="warning" title="Não sabe sua senha?" className="mt-5">
        Procure o <strong>TI</strong> para recuperar ou redefinir a senha do seu e-mail institucional.
      </Alert>
      <Button variant="primary" className="mt-6 w-full" icon={<ArrowRight className="size-4" />} onClick={onContinue} autoFocus>
        Entendi, ir para o login
      </Button>
    </AuthLayout>
  )
}
