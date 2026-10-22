import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Mail, RefreshCw, XCircle } from 'lucide-react'
import type { IntegrationStatusDTO, TestEmailResultDTO, UauCheckStep } from '@shared/contracts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Badge, Button, Card, CardHeader, KpiStrip, Skeleton } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/utils/cn'
import { formatDateTime, formatInteger } from '@/utils/format'

const EMAIL_LABELS: Record<IntegrationStatusDTO['emailProvider'], string> = {
  none: 'Desligado',
  log: 'Só no log do servidor',
  graph: 'Microsoft 365',
}

/**
 * Diagnóstico da integração (gestão): testa, a partir do servidor publicado, o login e uma
 * consulta ao UAU, e mostra onde falha. Não grava nada.
 */
export function IntegrationPage() {
  const status = useQuery({
    queryKey: ['integration', 'uau'],
    queryFn: () => api<IntegrationStatusDTO>('/integration/uau'),
    staleTime: 0,
    retry: false,
  })
  const data = status.data
  const allOk = data?.uau.steps.every((s) => s.ok)

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Integração com o UAU"
        description="Testa a conexão a partir do servidor (o mesmo que grava os insumos). Não grava nada."
        actions={
          <Button icon={<RefreshCw className="size-4" />} loading={status.isFetching} onClick={() => status.refetch()}>
            Testar de novo
          </Button>
        }
      />

      {status.isLoading ? (
        <Skeleton className="h-48" />
      ) : status.isError ? (
        <Alert tone="error">{errorMessage(status.error)}</Alert>
      ) : data ? (
        <div className="grid gap-4">
          <KpiStrip
            items={[
              {
                label: 'UAU',
                value: data.uauMode === 'real' ? 'Real' : 'Simulado',
                tone: data.uauMode === 'real' ? 'success' : 'warning',
                hint: data.uau.host ?? undefined,
              },
              { label: 'Gravação no UAU', value: data.uauWriteEnabled ? 'Ligada' : 'Simulação' },
              { label: 'Aviso por e-mail', value: EMAIL_LABELS[data.emailProvider] },
              {
                label: 'Cadastro em memória',
                value: data.uau.catalog.cached ? `${formatInteger(data.uau.catalog.items)} insumos` : 'Ainda não lido',
                hint: data.uau.catalog.loadedAt ? `lido ${formatDateTime(data.uau.catalog.loadedAt)}` : undefined,
              },
            ]}
          />

          <Card>
            <CardHeader
              title="Teste de conexão"
              description={`Executado em ${formatDateTime(data.checkedAt)}`}
              actions={<Badge tone={allOk ? 'success' : 'error'}>{allOk ? 'Funcionando' : 'Com falha'}</Badge>}
            />
            <ul className="divide-y divide-border">
              {data.uau.steps.map((s) => (
                <StepRow key={s.name} step={s} />
              ))}
            </ul>
          </Card>

          <EmailTestCard provider={data.emailProvider} />

          {!allOk && (
            <Alert tone="warning" title="O que verificar">
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  <strong>Login recusado:</strong> confira na Vercel <code>UAU_LOGIN</code>, <code>UAU_PASSWORD</code> e <code>UAU_INTEGRATION_TOKEN</code>.
                  Cole o valor exato, sem aspas em volta, e faça Redeploy.
                </li>
                <li>
                  <strong>Sem conexão / tempo esgotado:</strong> o servidor do UAU pode aceitar só IPs liberados. Peça à Senior/Globaltec para liberar o acesso
                  a partir da Vercel.
                </li>
                <li>
                  <strong>Lentidão:</strong> o UAU pode estar sobrecarregado; teste de novo em alguns minutos.
                </li>
              </ul>
            </Alert>
          )}
        </div>
      ) : null}
    </>
  )
}

/** Manda um e-mail de teste para quem está logado e mostra o resultado (ou o erro do Microsoft 365). */
function EmailTestCard({ provider }: { provider: IntegrationStatusDTO['emailProvider'] }) {
  const test = useMutation({ mutationFn: () => api<TestEmailResultDTO>('/integration/test-email', { method: 'POST' }) })
  return (
    <Card>
      <CardHeader
        title="Teste de e-mail"
        description="Envia um e-mail de teste para você, pelo mesmo caminho dos avisos de aprovação e de ajuste."
        actions={
          <Button icon={<Mail className="size-4" />} loading={test.isPending} disabled={provider === 'none'} onClick={() => test.mutate()}>
            Enviar e-mail de teste
          </Button>
        }
      />
      <div className="px-5 py-4">
        {test.isSuccess ? (
          <Alert tone="success">
            {test.data.provider === 'graph'
              ? `E-mail enviado para ${test.data.to}. Confira a caixa de entrada (e a pasta de spam).`
              : `Teste registrado só no log do servidor (EMAIL_PROVIDER=${test.data.provider}): nenhum e-mail sai. Para envio real, use EMAIL_PROVIDER=graph.`}
          </Alert>
        ) : test.isError ? (
          <Alert tone="error">{errorMessage(test.error)}</Alert>
        ) : (
          <p className="text-sm text-text-muted">
            {provider === 'none' ? 'O aviso por e-mail está desligado (EMAIL_PROVIDER=none).' : 'Nenhum teste enviado ainda.'}
          </p>
        )}
      </div>
    </Card>
  )
}

function StepRow({ step }: { step: UauCheckStep }) {
  const Icon = step.ok ? CheckCircle2 : XCircle
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Icon className={cn('mt-0.5 size-5 shrink-0', step.ok ? 'text-success' : 'text-error')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{step.name}</p>
        <p className={cn('text-sm break-words', step.ok ? 'text-text-muted' : 'text-error')}>{step.detail}</p>
      </div>
      {step.ms !== null && <span className="tabular shrink-0 text-xs text-text-muted">{formatInteger(step.ms)} ms</span>}
    </li>
  )
}
