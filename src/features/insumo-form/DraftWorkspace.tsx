import type { ReactNode } from 'react'
import type { RequestDTO } from '@shared/contracts'
import { Card } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useDraftContext } from '@/features/catalog/api'
import { RequestSummary } from '@/features/requests/components/RequestSummary'
import { InsumoForm } from './InsumoForm'
import type { DraftEditor } from './useDraftEditor'
import { ValidationPanel } from './ValidationPanel'

interface Props {
  request: RequestDTO
  editor: DraftEditor
  readOnly?: boolean
  /** Avisos acima do formulário (ex.: devolvido pela gestão) */
  notice?: ReactNode
  /** Botões de ação (coluna da direita, topo) */
  actions: ReactNode
  /** Conteúdo extra na coluna da direita (ex.: prévia do JSON) */
  aside?: ReactNode
}

/** Área de trabalho do cadastro: pedido + formulário à esquerda, ações e conferência à direita. */
export function DraftWorkspace({ request, editor, readOnly, notice, actions, aside }: Props) {
  const context = useDraftContext(request.id)
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="grid content-start gap-4">
        {notice}
        <RequestSummary request={request} />
        <InsumoForm editor={editor} context={context.data} requestDescription={request.description} disabled={readOnly} />
      </div>
      <div className="grid content-start gap-4 xl:sticky xl:top-[74px] xl:max-h-[calc(100vh-90px)] xl:overflow-x-hidden xl:overflow-y-auto [&>*]:min-w-0">
        <Card className="flex flex-wrap gap-2 p-4">{actions}</Card>
        {editor.validate && (
          <ValidationPanel
            validation={editor.preview.data?.validation}
            loading={editor.preview.isFetching}
            error={editor.preview.isError ? errorMessage(editor.preview.error) : null}
            onPickSimilar={readOnly ? undefined : editor.copyFrom}
          />
        )}
        {aside}
      </div>
    </div>
  )
}
