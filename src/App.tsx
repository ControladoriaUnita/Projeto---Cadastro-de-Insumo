import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PERMISSIONS, type Permission } from '@shared/domain/roles'
import { HOME_BY_ROLE, PATHS } from '@/app/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { Alert, Spinner } from '@/components/ui'
import { ApprovalPage } from '@/features/approval/ApprovalPage'
import { ApprovalQueuePage } from '@/features/approval/ApprovalQueuePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { DraftPage } from '@/features/drafting/DraftPage'
import { DraftQueuePage } from '@/features/drafting/DraftQueuePage'
import { NewRequestPage } from '@/features/requests/NewRequestPage'
import { RequestDetailPage } from '@/features/requests/RequestDetailPage'
import { RequestsPage } from '@/features/requests/RequestsPage'
import { useAuth } from '@/lib/auth'

const P = PERMISSIONS

function Protected() {
  const { hasSession, loading, user } = useAuth()
  if (!hasSession) return <Navigate to="/entrar" replace />
  if (loading)
    return (
      <div className="flex h-full items-center justify-center text-primary">
        <Spinner />
      </div>
    )
  if (!user)
    return (
      <div className="mx-auto max-w-md p-8">
        <Alert tone="error" title="Usuário sem perfil">
          Seu acesso ainda não foi liberado. Peça à gestão para definir seu papel (obra, analista ou gestão).
        </Alert>
      </div>
    )
  return <AppShell />
}

function Home() {
  const { user } = useAuth()
  return user ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : null
}

const guard = (anyOf: Permission[], page: ReactNode) => <RequirePermission anyOf={anyOf}>{page}</RequirePermission>

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route index element={<Home />} />
        {/* Obra */}
        <Route path={PATHS.newRequest} element={guard([P.requestCreate], <NewRequestPage />)} />
        <Route path={PATHS.requests} element={guard([P.requestReadOwn, P.requestReadAll], <RequestsPage />)} />
        <Route path="/solicitacoes/:id" element={guard([P.requestReadOwn, P.requestReadAll], <RequestDetailPage />)} />
        {/* Analista */}
        <Route path={PATHS.drafting} element={guard([P.draftEdit], <DraftQueuePage />)} />
        <Route path="/cadastro/:id" element={guard([P.draftEdit], <DraftPage />)} />
        <Route path={PATHS.catalog} element={guard([P.catalogRead], <CatalogPage />)} />
        {/* Gestão */}
        <Route path={PATHS.approval} element={guard([P.approvalDecide], <ApprovalQueuePage />)} />
        <Route path="/aprovacao/:id" element={guard([P.approvalDecide], <ApprovalPage />)} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
