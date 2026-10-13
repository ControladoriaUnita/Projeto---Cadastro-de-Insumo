/**
 * Estado do editor de cadastro: rascunho local, alterações não salvas, cópia de um insumo
 * existente, prévia/validação no servidor (com debounce) e salvamento.
 */
import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CatalogItemDetailDTO, InsumoDraft } from '@shared/contracts'
import { EMPTY_DRAFT, draftFromModel, type DraftField, type DraftIssue } from '@shared/domain/insumo/draft'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api, errorMessage } from '@/lib/api'
import { previewDraft, useSaveDraft } from '@/features/requests/api'

const sameDraft = (a: InsumoDraft, b: InsumoDraft) => JSON.stringify(a) === JSON.stringify(b)
/** Rascunhos salvos antes de existirem alguns campos chegam incompletos */
const complete = (d: Partial<InsumoDraft> | null | undefined): InsumoDraft => ({ ...EMPTY_DRAFT, ...d })

/** `validate`: false para cadastros encerrados (o código já existe no UAU e a conferência só confundiria). */
export function useDraftEditor(requestId: string, saved: InsumoDraft | null | undefined, { validate = true } = {}) {
  const [draft, setDraft] = useState<InsumoDraft>(() => complete(saved))
  const [baseline, setBaseline] = useState<InsumoDraft>(() => complete(saved))
  const [copying, setCopying] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  // Quando o servidor devolve uma versão nova (outra pessoa salvou, ou acabamos de salvar), adota-a
  useEffect(() => {
    if (!saved) return
    const next = complete(saved)
    if (sameDraft(next, baseline)) return
    setBaseline(next)
    setDraft(next)
  }, [saved, baseline])

  const debounced = useDebouncedValue(draft, 500)
  const preview = useQuery({
    queryKey: ['draft-preview', requestId, debounced],
    queryFn: () => previewDraft(requestId, debounced),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: validate,
  })

  const save = useSaveDraft(requestId)
  const dirty = !sameDraft(draft, baseline)

  /** Copia todas as informações de um insumo existente; o código do rascunho é mantido. */
  const copyFrom = async (codigo: string) => {
    setCopying(codigo)
    setCopyError(null)
    try {
      const { item } = await api<CatalogItemDetailDTO>(`/catalog/items/${encodeURIComponent(codigo)}`)
      setDraft((d) => ({ ...d, ...draftFromModel(item) }))
    } catch (err) {
      setCopyError(errorMessage(err))
    } finally {
      setCopying(null)
    }
  }

  /** Erro (ou aviso) de cada campo, para mostrar junto do controle. */
  const fieldIssues = useMemo(() => {
    const out: Partial<Record<DraftField, { message: string; tone: 'error' | 'warning' }>> = {}
    // Sem validação (cadastro encerrado), ignora o que tiver ficado em cache
    const v = validate ? preview.data?.validation : undefined
    const put = (list: DraftIssue[] | undefined, tone: 'error' | 'warning') => {
      for (const i of list ?? []) if (i.field && !out[i.field]) out[i.field] = { message: i.message, tone }
    }
    put(v?.errors, 'error')
    put(v?.warnings, 'warning')
    return out
  }, [preview.data, validate])

  return {
    draft,
    validate,
    patch: (p: Partial<InsumoDraft>) => setDraft((d) => ({ ...d, ...p })),
    reset: () => setDraft(baseline),
    dirty,
    copyFrom,
    /** Código sendo copiado agora (null = nenhum) */
    copying,
    copyError,
    preview,
    /** A prévia corresponde ao que está na tela (debounce concluído) */
    previewCurrent: sameDraft(debounced, draft) && !preview.isFetching,
    fieldIssues,
    save: () => save.mutateAsync(draft),
    saving: save.isPending,
    saveError: save.error,
  }
}

export type DraftEditor = ReturnType<typeof useDraftEditor>
