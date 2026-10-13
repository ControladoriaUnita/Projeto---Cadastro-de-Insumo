/**
 * Diagnóstico da integração com o UAU, para a gestão (tela "Integração"). Só leitura:
 * faz um login novo e uma consulta pequena, e diz onde a conexão falha, se falhar.
 */
import type { IntegrationStatusDTO } from '../../../shared/contracts'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { requirePermission } from '../context'
import type { UseCaseDeps } from '../ports'

export interface IntegrationSettings {
  emailProvider: IntegrationStatusDTO['emailProvider']
}

export async function checkIntegration({ uau, ctx }: UseCaseDeps, settings: IntegrationSettings): Promise<IntegrationStatusDTO> {
  requirePermission(ctx, PERMISSIONS.approvalDecide)
  return {
    checkedAt: ctx.now().toISOString(),
    uauMode: uau.mode,
    uauWriteEnabled: uau.writeEnabled,
    emailProvider: settings.emailProvider,
    uau: await uau.checkConnection(),
  }
}
