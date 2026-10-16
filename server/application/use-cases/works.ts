/**
 * Obras cadastradas e ativas no UAU, só de centro de custo "C": campo "Obra" da solicitação e
 * filtro do acompanhamento.
 */
import type { WorkDTO } from '../../../shared/contracts'
import { PERMISSIONS } from '../../../shared/domain/roles'
import { isConstructionWork } from '../../../shared/domain/works'
import { requirePermission } from '../context'
import type { UseCaseDeps } from '../ports'

const P = PERMISSIONS

export async function listWorks({ uau, ctx }: UseCaseDeps): Promise<WorkDTO[]> {
  requirePermission(ctx, P.requestCreate, P.requestReadOwn, P.requestReadAll)
  return (await uau.listWorks()).filter(isConstructionWork)
}
