import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { accessRequestSchema, type AccessRequestInput, type AuthConfigDTO } from '@shared/contracts'
import { ROLE_DESCRIPTIONS, isCorporateEmail } from '@shared/domain/access'
import { ROLE_LABELS, type RoleKey } from '@shared/domain/roles'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { AuthLayout } from './AuthLayout'

type FormErrors = Partial<Record<keyof AccessRequestInput, string>>
// A obra não precisa de cadastro: solicita insumos sem login
const ROLES = ['analista', 'gestor'] as const satisfies readonly RoleKey[]

/**
 * Quem não tem acesso pede aqui. Não cria conta: o pedido vai para a tabela access_requests
 * no Supabase, onde a gestão aprova e convida o e-mail.
 */
export function RequestAccessPage() {
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfigDTO>('/auth-config'), staleTime: Infinity })
  const domains = config.data?.corporateDomains ?? []
  const [form, setForm] = useState<AccessRequestInput>({ fullName: '', email: '', requestedRole: 'analista', workName: '', message: '', website: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const send = useMutation({ mutationFn: (input: AccessRequestInput) => api<{ ok: true }>('/access-requests', { method: 'POST', body: input }) })

  const set = <K extends keyof AccessRequestInput>(key: K, value: AccessRequestInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = accessRequestSchema.safeParse(form)
    const fieldErrors: FormErrors = parsed.success
      ? {}
      : Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0]]))
    // Aviso de domínio junto com os demais erros (o servidor confere de novo)
    if (!fieldErrors.email && form.email.trim() && domains.length && !isCorporateEmail(form.email, domains)) {
      fieldErrors.email = `Use seu e-mail corporativo (${domains.map((d) => '@' + d).join(' ou ')}).`
    }
    setErrors(fieldErrors)
    if (parsed.success && !Object.keys(fieldErrors).length) send.mutate(parsed.data)
  }

  if (send.isSuccess) {
    return (
      <AuthLayout title="Pedido enviado">
        <Alert tone="success" title="Recebemos seu pedido">
          A gestão vai analisar. Quando o acesso for liberado, você recebe um e-mail em {form.email.trim().toLowerCase()} para definir sua senha.
        </Alert>
        <Link to="/entrar" className="mt-4 block">
          <Button className="w-full" icon={<ArrowLeft className="size-4" />}>
            Voltar para o login
          </Button>
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Solicitar acesso" description="Ninguém cria a própria conta: seu pedido vai para a gestão, que libera o acesso.">
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field label="Nome completo" required error={errors.fullName}>
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" maxLength={120} autoFocus />
        </Field>
        <Field label="E-mail corporativo" required error={errors.email} hint={domains.length ? `Somente ${domains.map((d) => '@' + d).join(' ou ')}` : undefined}>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" maxLength={160} />
        </Field>
        <Field label="Perfil" required hint={ROLE_DESCRIPTIONS[form.requestedRole]}>
          <Select value={form.requestedRole} onChange={(e) => set('requestedRole', e.target.value as AccessRequestInput['requestedRole'])}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mensagem para a gestão" hint="Opcional.">
          <Textarea value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={1000} />
        </Field>
        {/* Campo-isca: escondido para pessoas; robôs costumam preencher */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => set('website', e.target.value)} />
        {send.isError && <Alert tone="error">{errorMessage(send.error)}</Alert>}
        <Button type="submit" variant="primary" loading={send.isPending} icon={<Send className="size-4" />}>
          Enviar pedido
        </Button>
        <Link to="/entrar" className="justify-self-center text-sm font-medium text-ink-600 hover:text-text hover:underline">
          Já tenho acesso
        </Link>
      </form>
    </AuthLayout>
  )
}
