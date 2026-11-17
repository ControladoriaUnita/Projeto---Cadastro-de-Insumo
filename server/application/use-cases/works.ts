/**
 * Obras que podem ser escolhidas no campo "Obra" da solicitação e no filtro do acompanhamento:
 * a lista cadastrada em shared/domain/works.ts (mais "Escritório" para pedidos internos).
 */
import type { WorkDTO } from '../../../shared/contracts'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { registeredWorks } from '../../../shared/domain/works'
import { requirePermission } from '../context'
import type { UseCaseDeps } from '../ports'

const P = PERMISSIONS

export async function listWorks({ ctx }: UseCaseDeps): Promise<WorkDTO[]> {
  requirePermission(ctx, P.requestCreate, P.requestReadOwn, P.requestReadAll)
  return registeredWorks()
}
