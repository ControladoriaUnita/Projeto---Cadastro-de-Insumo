import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { DraftValidation } from '@shared/contracts'
import { Card, CardHeader, Spinner } from '@/components/ui'
import { SimilarItemsList } from '@/features/catalog/components/SimilarItemsList'

/**
 * Resultado da validação contra o cadastro atual do UAU. Só impede o cadastro o insumo já existir
 * no UAU (ou o UAU não ter como gravá-lo); os avisos não travam o envio nem a aprovação.
 */
export function ValidationPanel({
  validation,
  loading,
  error,
  onPickSimilar,
}: {
  validation: DraftValidation | undefined
  loading: boolean
  error?: string | null
  /** Clique num parecido para copiar as informações dele */
  onPickSimilar?: (codigo: string) => void
}) {
  return (
    <Card>
      <CardHeader title="Conferência" description="Contra o cadastro atual do UAU." actions={loading && <Spinner className="size-4 text-primary" label="Validando" />} />
      <div className="grid gap-3 px-5 py-4 text-sm">
        {error ? (
          <p className="flex gap-2 text-error">
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        ) : !validation ? (
          <p className="text-text-muted">Validando…</p>
        ) : (
          <>
            {validation.ok && (
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4" aria-hidden /> {validation.warnings.length ? 'Não existe no UAU. Pode cadastrar.' : 'Não existe no UAU. Nenhum problema encontrado.'}
              </p>
            )}
            {!!validation.errors.length && (
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-error">{validation.existsInUau ? 'Já existe no UAU — não pode ser cadastrado' : 'O UAU não aceitaria assim — corrija para continuar'}</p>
                {validation.errors.map((e, i) => (
                  <p key={`e${i}`} className="flex gap-2 text-error">
                    <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {e.message}
                  </p>
                ))}
              </div>
            )}
            {!!validation.warnings.length && (
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-text-muted">Avisos — não impedem o cadastro</p>
                {validation.warnings.map((w, i) => (
                  <p key={`w${i}`} className="flex gap-2 text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w.message}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {!!validation?.similar.length && (
        <div className="border-t border-border">
          <p className="px-5 pt-3 text-xs font-semibold text-text-muted">
            Insumos com descrição parecida{onPickSimilar && ' — clique para copiar'}
          </p>
          <SimilarItemsList items={validation.similar} onPick={onPickSimilar} />
        </div>
      )}
    </Card>
  )
}
