import { useMemo, useState } from 'react'
import { Check, Pencil, Search, UserPlus, X } from 'lucide-react'
import type { AccessRequestDTO, ManagedUserDTO } from '@shared/contracts'
import { ROLE_LABELS, type RoleKey } from '@shared/domain/roles'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Input, KpiStrip, Select, Skeleton, Tabs } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { useAccessRequests, useResolveAccessRequest, useUsers } from './api'
import { ROLES, ROLE_TONES, RolePicker } from './RolePicker'
import { UserDialog } from './UserDialog'

type TabKey = 'users' | 'requests'
type RoleFilter = RoleKey | 'all' | 'inactive'


const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const th = 'border-b border-border bg-ink-50 px-3 py-2 text-left text-xs font-semibold text-text-muted first:pl-5 last:pr-5'
const td = 'border-b border-border px-3 py-2.5 align-middle first:pl-5 last:pr-5'

/** Tela exclusiva da gestão: quem usa o app, com qual papel, e os pedidos de acesso. */
export function UsersPage() {
  const users = useUsers()
  const requests = useAccessRequests()
  const [tab, setTab] = useState<TabKey>('users')
  const list = users.data ?? []
  const active = list.filter((u) => u.active)
  const pending = requests.data?.length ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Usuários e permissões"
        description="Quem entra com a conta Microsoft 365 da Unità já pode solicitar insumos (perfil Obra). Aqui você muda o papel, define a obra padrão, desativa acessos e decide os pedidos de acesso."
      />
      <KpiStrip
        className="mb-4"
        items={[
          { label: 'Usuários ativos', value: active.length },
          { label: 'Gestão', value: active.filter((u) => u.role === 'gestor').length },
          { label: 'Analistas', value: active.filter((u) => u.role === 'analista').length },
          { label: 'Obra', value: active.filter((u) => u.role === 'obra').length },
          { label: 'Pedidos de acesso', value: pending, emphasis: pending > 0 },
        ]}
      />
      <Card>
        <div className="px-4">
          <Tabs<TabKey>
            items={[
              { key: 'users', label: 'Usuários', count: list.length },
              { key: 'requests', label: 'Pedidos de acesso', count: pending },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        {tab === 'users' ? (
          users.isLoading ? (
            <Skeleton className="m-4 h-60" />
          ) : users.isError ? (
            <Alert tone="error" className="m-4">
              {errorMessage(users.error)}
            </Alert>
          ) : (
            <UsersTable users={list} />
          )
        ) : requests.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : requests.isError ? (
          <Alert tone="error" className="m-4">
            {errorMessage(requests.error)}
          </Alert>
        ) : (
          <AccessRequestsTable rows={requests.data ?? []} />
        )}
      </Card>
    </>
  )
}

function UsersTable({ users }: { users: ManagedUserDTO[] }) {
  const { user: me } = useAuth()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [editing, setEditing] = useState<ManagedUserDTO | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const q = norm(query.trim())
    return users.filter((u) => {
      if (role === 'inactive' ? u.active : role !== 'all' && (u.role !== role || !u.active)) return false
      return !q || norm(`${u.fullName} ${u.email ?? ''} ${u.workName ?? ''}`).includes(q)
    })
  }, [users, query, role])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou obra" className="pl-9" aria-label="Buscar usuário" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} className="w-auto" aria-label="Filtrar por papel">
          <option value="all">Todos os papéis</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
          <option value="inactive">Desativados</option>
        </Select>
        <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>
          Adicionar usuário
        </Button>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={th}>Nome</th>
                <th className={th}>Papel</th>
                <th className={th}>Obra padrão</th>
                <th className={th}>Situação</th>
                <th className={th}>Último login</th>
                <th className={cn(th, 'text-right')}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="group cursor-pointer" onClick={() => setEditing(u)}>
                  <td className={cn(td, 'group-hover:bg-ink-50')}>
                    <p className="font-medium text-text">
                      {u.fullName}
                      {u.id === me?.id && (
                        <Badge tone="primary" className="ml-2">
                          você
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">{u.email ?? '—'}</p>
                  </td>
                  <td className={cn(td, 'group-hover:bg-ink-50')}>
                    <Badge tone={ROLE_TONES[u.role]}>{u.roleLabel}</Badge>
                  </td>
                  <td className={cn(td, 'text-text-muted group-hover:bg-ink-50')}>{u.workName ?? '—'}</td>
                  <td className={cn(td, 'group-hover:bg-ink-50')}>
                    {u.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="error">Desativado</Badge>}
                  </td>
                  <td className={cn(td, 'tabular whitespace-nowrap text-text-muted group-hover:bg-ink-50')}>
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : u.linkedMicrosoft ? '—' : 'Ainda não entrou'}
                  </td>
                  <td className={cn(td, 'text-right group-hover:bg-ink-50')}>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil className="size-4" />}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(u)
                      }}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nenhum usuário encontrado" description={users.length ? 'Ajuste a busca ou o filtro de papel.' : 'Quem entrar com a conta Microsoft aparece aqui.'} />
      )}
      <UserDialog open={creating} onClose={() => setCreating(false)} />
      <UserDialog open={!!editing} user={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function AccessRequestsTable({ rows }: { rows: AccessRequestDTO[] }) {
  const resolve = useResolveAccessRequest()
  const [approving, setApproving] = useState<AccessRequestDTO | null>(null)
  const [approveRole, setApproveRole] = useState<RoleKey>('analista')
  const [rejecting, setRejecting] = useState<AccessRequestDTO | null>(null)

  const close = () => {
    setApproving(null)
    setRejecting(null)
    resolve.reset()
  }

  if (!rows.length) {
    return <EmptyState title="Nenhum pedido de acesso pendente" description='Quem precisa de perfil de analista ou gestão pede pelo link "Solicitar acesso" na tela de login.' />
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={th}>Pessoa</th>
              <th className={th}>Papel pedido</th>
              <th className={th}>Obra</th>
              <th className={th}>Mensagem</th>
              <th className={th}>Pedido em</th>
              <th className={cn(th, 'text-right')}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <p className="font-medium text-text">{r.fullName}</p>
                  <p className="text-xs text-text-muted">{r.email}</p>
                  {r.existingUser && (
                    <p className="mt-0.5 text-xs text-text-muted">
                      Já entrou no app como {ROLE_LABELS[r.existingUser.role]}
                      {r.existingUser.active ? '' : ' (desativado)'}
                    </p>
                  )}
                </td>
                <td className={td}>
                  <Badge tone={ROLE_TONES[r.requestedRole]}>{ROLE_LABELS[r.requestedRole]}</Badge>
                </td>
                <td className={cn(td, 'text-text-muted')}>{r.workName ?? '—'}</td>
                <td className={cn(td, 'max-w-72 text-text-muted')}>
                  <p className="line-clamp-2" title={r.message ?? undefined}>
                    {r.message || '—'}
                  </p>
                </td>
                <td className={cn(td, 'tabular whitespace-nowrap text-text-muted')}>{formatDateTime(r.createdAt)}</td>
                <td className={cn(td, 'text-right whitespace-nowrap')}>
                  <div className="inline-flex gap-2">
                    <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setRejecting(r)}>
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Check className="size-4" />}
                      onClick={() => {
                        setApproveRole(r.requestedRole)
                        setApproving(r)
                      }}
                    >
                      Aprovar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!approving}
        title="Aprovar pedido de acesso"
        description={approving ? `${approving.fullName} (${approving.email})` : undefined}
        confirmLabel="Aprovar"
        loading={resolve.isPending}
        onCancel={close}
        onConfirm={() => approving && resolve.mutate({ id: approving.id, decision: 'approve', role: approveRole }, { onSuccess: close })}
      >
        <p className="mb-3">
          {approving?.existingUser
            ? 'A pessoa já entrou no app: o papel dela muda na hora.'
            : 'O perfil fica pronto e é ligado à conta Microsoft no primeiro login, pelo e-mail.'}
        </p>
        <RolePicker value={approveRole} onChange={setApproveRole} />
        {resolve.isError && (
          <Alert tone="error" className="mt-3">
            {errorMessage(resolve.error)}
          </Alert>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!rejecting}
        title="Recusar pedido de acesso?"
        description={rejecting ? `${rejecting.fullName} (${rejecting.email})` : undefined}
        confirmLabel="Recusar"
        tone="danger"
        loading={resolve.isPending}
        onCancel={close}
        onConfirm={() => rejecting && resolve.mutate({ id: rejecting.id, decision: 'reject' }, { onSuccess: close })}
      >
        <p>O pedido sai da lista. Se a pessoa já entra no app, ela continua com o papel atual.</p>
        {resolve.isError && (
          <Alert tone="error" className="mt-3">
            {errorMessage(resolve.error)}
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  )
}
