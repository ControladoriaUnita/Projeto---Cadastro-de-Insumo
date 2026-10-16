/**
 * Obras cadastradas e ativas no UAU: campo "Obra" da solicitação e filtro do acompanhamento.
 */
import type { WorkDTO } from '../../../shared/contracts'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { requirePermission } from '../context'
import type { UseCaseDeps } from '../ports'

const P = PERMISSIONS

export async function listWorks({ uau, ctx }: UseCaseDeps): Promise<WorkDTO[]> {
  requirePermission(ctx, P.requestCreate, P.requestReadOwn, P.requestReadAll)
  return uau.listWorks()
}
