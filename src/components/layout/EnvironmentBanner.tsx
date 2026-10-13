import { FlaskConical } from 'lucide-react'
import { PERMISSIONS } from '@shared/domain/roles'
import { useAuth } from '@/lib/auth'

/**
 * Faixa discreta para quem cadastra e aprova: deixa claro se o UAU é simulado,
 * se a aprovação está em modo simulação (não grava) e se os e-mails saem de verdade.
 */
export function EnvironmentBanner() {
  const { config, can } = useAuth()
  if (!config || !(can(PERMISSIONS.draftEdit) || can(PERMISSIONS.approvalDecide))) return null

  const notes: string[] = []
  if (config.uauMode === 'mock') notes.push('UAU simulado: catálogo de exemplo. Nada é gravado no UAU real.')
  else if (!config.uauWriteEnabled) notes.push('UAU real em modo simulação: a aprovação mostra o JSON, mas não grava.')
  if (can(PERMISSIONS.approvalDecide) && config.emailProvider === 'log') notes.push('Avisos por e-mail só aparecem no terminal do servidor (EMAIL_PROVIDER=log).')
  if (!notes.length) return null
  const message = notes.join(' · ')

  return (
    <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-xs font-medium text-warning lg:px-6 2xl:px-10">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      {message}
    </div>
  )
}
