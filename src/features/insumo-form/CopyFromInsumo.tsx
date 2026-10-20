import { useState } from 'react'
import { Copy, Search } from 'lucide-react'
import { Alert, Button, Input, Spinner } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { useCatalog, useSimilarItems } from '@/features/catalog/api'
import type { DraftEditor } from './useDraftEditor'

const MIN_TERM = 2
const SUGGESTIONS = 5

interface Props {
  editor: DraftEditor
  /** Descrição pedida pela obra: base das sugestões */
  requestDescription: string
  disabled?: boolean
}

/**
 * Copia TODAS as informações de um insumo existente (classificação, contas, prazos, descrição
 * e preço). Muitos insumos novos só mudam descrição e preço: copiar mantém o padrão do cadastro.
 */
export function CopyFromInsumo({ editor, requestDescription, disabled }: Props) {
  const [q, setQ] = useState('')
  const [changing, setChanging] = useState(false)
  const term = useDebouncedValue(q, 300).trim()
  const searching = term.length >= MIN_TERM
  const results = useCatalog({ q: term, pageSize: 8, status: 'ativo' }, { enabled: searching })
  const suggestions = useSimilarItems(requestDescription)
  const copied = editor.draft.modeloCodigo

  const copy = async (codigo: string) => {
    await editor.copyFrom(codigo)
    setQ('')
    setChanging(false)
  }

  if (copied && !changing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
        <span>
          Informações copiadas de <strong className="tabular">{copied}</strong>. Ajuste a <strong>descrição</strong> e o <strong>preço</strong> do novo insumo.
        </span>
        {!disabled && (
          <Button size="sm" variant="ghost" icon={<Copy className="size-4" />} onClick={() => setChanging(true)}>
            Copiar de outro
          </Button>
        )}
      </div>
    )
  }

  if (disabled) return <p className="text-sm text-text-muted">Nenhum insumo usado como base.</p>

  const row = (codigo: string, descricao: string, unidade: string) => (
    <li key={codigo}>
      <button
        type="button"
        disabled={!!editor.copying}
        onClick={() => copy(codigo)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-ink-50 disabled:opacity-60"
      >
        <span className="tabular w-16 shrink-0 font-semibold">{codigo}</span>
        <span className="min-w-0 flex-1 truncate">{descricao}</span>
        <span className="shrink-0 text-xs text-text-muted">{unidade}</span>
        {editor.copying === codigo ? <Spinner className="size-4 text-primary" /> : <Copy className="size-4 shrink-0 text-ink-400" aria-label="Copiar" />}
      </button>
    </li>
  )

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou descrição · use * para segmentar" className="pl-9" aria-label="Buscar insumo para copiar" />
        {searching && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-control border border-border bg-surface shadow-overlay">
            {results.isFetching && !results.data ? (
              <div className="flex justify-center py-4 text-primary">
                <Spinner />
              </div>
            ) : results.isError ? (
              <p className="px-3 py-3 text-sm text-error">{errorMessage(results.error)}</p>
            ) : results.data?.items.length ? (
              <ul>{results.data.items.map((i) => row(i.codigo, i.descricao, i.unidade))}</ul>
            ) : (
              <p className="px-3 py-3 text-sm text-text-muted">Nenhum insumo encontrado.</p>
            )}
          </div>
        )}
      </div>

      {!!suggestions.data?.length && (
        <div className="rounded-control border border-border">
          <p className="border-b border-border bg-ink-50 px-3 py-1.5 text-xs font-semibold text-text-muted">Parecidos com o pedido — clique para copiar</p>
          <ul className="divide-y divide-border">{suggestions.data.slice(0, SUGGESTIONS).map((s) => row(s.codigo, s.descricao, s.unidade))}</ul>
        </div>
      )}

      {editor.copyError && <Alert tone="error">{editor.copyError}</Alert>}
    </div>
  )
}
