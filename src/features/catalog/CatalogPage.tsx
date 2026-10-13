import { PageHeader } from '@/components/layout/PageHeader'
import { CatalogBrowser } from './CatalogBrowser'

/** Cadastro geral de insumos do UAU — para conferir duplicidade antes de criar. */
export function CatalogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Consulta"
        title="Insumos cadastrados no UAU"
        description="Confira se o insumo já existe antes de criar um novo. Clique numa linha para ver todos os campos."
      />
      <CatalogBrowser />
    </>
  )
}
