import type { ReactNode } from 'react'
import { UnitaLogin } from '@/components/UnitaLogin'

/**
 * Tela de entrada no modelo único da Unità ("Kit - Tela de Login Unità", igual ao Cadastro de Fornecedores):
 * painel grafite da marca à esquerda e cartão de acesso à direita. O visual vem de public/unita-login/.
 */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <UnitaLogin
      area="Orçamentos"
      ferramenta="Cadastro de insumos"
      descricao="Solicitação, análise e cadastro de insumos no UAU em um só fluxo."
      titulo={title}
      subtitulo={description ?? null}
      // O login é em popup e os erros aparecem no próprio cartão: não lemos ?erro= do endereço
      erro={null}
    >
      {children}
    </UnitaLogin>
  )
}
