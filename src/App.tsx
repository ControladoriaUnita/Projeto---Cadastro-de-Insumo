import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PERMISSIONS, type Permission } from '@shared/domain/roles'
import { HOME_BY_ROLE, PATHS } from '@/app/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { Alert, Spinner } from '@/components/ui'
import { ApprovalPage } from '@/features/approval/ApprovalPage'
import { ApprovalQueuePage } from '@/features/approval/ApprovalQueuePage'
import { AccessPendingPage } from '@/features/auth/AccessPendingPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequestAccessPage } from '@/features/auth/RequestAccessPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { DraftPage } from '@/features/drafting/DraftPage'
import { DraftQueuePage } from '@/features/drafting/DraftQueuePage'
import { NewRequestPage } from '@/features/requests/NewRequestPage'
import { RequestDetailPage } from '@/features/requests/RequestDetailPage'
import { RequestsPage } from '@/features/requests/RequestsPage'
import { useAuth } from '@/lib/auth'

const P = PERMISSIONS

/** Só mostra o app para quem entrou e tem perfil ativo; o resto vai para a tela certa. */
function Protected() {
  const { access, recovering, error } = useAuth()
  // Link de "esqueci minha senha" caiu na página inicial: leva para definir a senha
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  switch (access) {
    case 'loading':
      return (
        <div className="flex h-full items-center justify-center text-primary">
          <Spinner />
        </div>
      )
    case 'signed-out':
      return <Navigate to="/entrar" replace />
    case 'inactive':
      return <AccessPendingPage />
    case 'error':
      return (
        <div className="mx-auto max-w-md p-8">
          <Alert tone="error" title="Não foi possível entrar">
            {error}
          </Alert>
        </div>
      )
    case 'ready':
      return <AppShell />
  }
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
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/solicitar-acesso" element={<RequestAccessPage />} />
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
