import { useEffect, useState } from 'react'
import { createUserSchema, type ManagedUserDTO } from '@shared/contracts'
import type { RoleKey } from '@shared/domain/roles'
import { Alert, Button, Dialog, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { WorkSelect } from '@/features/requests/components/RequestFields'
import { useCreateUser, useUpdateUser } from './api'
import { RolePicker } from './RolePicker'

interface Props {
  open: boolean
  onClose: () => void
  /** Sem usuário = cadastro novo */
  user?: ManagedUserDTO | null
}

/** Cadastro antecipado ou edição de papel, obra padrão e situação. */
export function UserDialog({ open, onClose, user }: Props) {
  const { user: me } = useAuth()
  const create = useCreateUser()
  const update = useUpdateUser()
  const editing = !!user
  const self = !!user && user.id === me?.id

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleKey>('obra')
  const [workName, setWorkName] = useState('')
  const [active, setActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  // Recarrega o formulário a cada abertura
  useEffect(() => {
    if (!open) return
    setFullName(user?.fullName ?? '')
    setEmail(user?.email ?? '')
    setRole(user?.role ?? 'obra')
    setWorkName(user?.workName ?? '')
    setActive(user?.active ?? true)
    setErrors({})
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user])

  const mutation = editing ? update : create

  const save = () => {
    const parsed = createUserSchema.safeParse({ fullName, email: editing ? (user!.email ?? 'sem-email@x.invalid') : email, role, workName })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors({ fullName: f.fullName?.[0], email: editing ? undefined : f.email?.[0] })
      if (f.fullName || (!editing && f.email)) return
    }
    setErrors({})
    if (editing) {
      update.mutate({ id: user!.id, fullName, role, workName, active }, { onSuccess: onClose })
    } else {
      create.mutate({ fullName, email, role, workName }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="min(94vw, 34rem)"
      title={editing ? 'Editar usuário' : 'Adicionar usuário'}
      description={
        editing
          ? user!.email
          : 'Cadastre antes do primeiro login para já entrar com o papel certo. A pessoa entra com a conta Microsoft 365 e é reconhecida pelo e-mail.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Cancelar
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={save}>
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Nome" required error={errors.fullName}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoFocus />
        </Field>
        {!editing && (
          <Field label="E-mail corporativo" required error={errors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} placeholder="nome@unitaengenharia.com.br" />
          </Field>
        )}
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-700">Papel</span>
          <RolePicker value={role} onChange={setRole} disabled={(r) => self && r !== 'gestor'} />
          {self && <p className="text-xs text-text-muted">Você não pode tirar o próprio papel de gestão.</p>}
        </div>
        <Field label="Obra padrão" hint="Já vem preenchida quando a pessoa abre uma solicitação. Opcional.">
          <WorkSelect value={workName} onChange={setWorkName} />
        </Field>
        {workName && (
          <button type="button" onClick={() => setWorkName('')} className="-mt-2 justify-self-start text-xs font-medium text-ink-600 hover:text-text hover:underline">
            Remover obra padrão
          </button>
        )}
        {editing && (
          <label className="flex items-start gap-3 rounded-control border border-border px-3 py-2.5">
            <input type="checkbox" className="mt-0.5 accent-primary" checked={active} disabled={self} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <span className="block text-sm font-medium text-text">Acesso ativo</span>
              <span className="block text-xs text-text-muted">
                {self ? 'Você não pode desativar o próprio acesso.' : 'Desativado, a pessoa não entra mais no app. O histórico das solicitações é mantido.'}
              </span>
            </span>
          </label>
        )}
        {mutation.isError && <Alert tone="error">{errorMessage(mutation.error)}</Alert>}
        {/* Enter envia o formulário */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}
