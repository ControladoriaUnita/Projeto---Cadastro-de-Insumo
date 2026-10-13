import { useEffect, useState } from 'react'
import type { InsumoDraft } from '@shared/contracts'
import { Alert, Button, Dialog, Field, Input } from '@/components/ui'

interface Props {
  open: boolean
  draft: InsumoDraft
  loading: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmação da gravação no UAU. Exige digitar o código: a API não exclui insumos,
 * então um cadastro errado só pode ser inativado depois.
 */
export function ApproveDialog({ open, draft, loading, error, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  const matches = typed.trim().toUpperCase() === draft.codigo

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Aprovar e gravar no UAU?"
      description={`${draft.codigo} · ${draft.descricao}`}
      width="min(92vw, 34rem)"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className="mr-auto">
            Cancelar
          </Button>
          <Button variant="primary" loading={loading} disabled={!matches} onClick={onConfirm}>
            Aprovar e gravar
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            O insumo é <strong>inserido</strong> no UAU como ativo e não confirmado.
          </li>
          <li>
            A situação muda para <strong>confirmado</strong>, liberando o uso.
          </li>
        </ol>
        <Alert tone="warning">O UAU não permite excluir insumos. Um cadastro errado só pode ser inativado depois.</Alert>
        <Field label={`Digite ${draft.codigo} para confirmar`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="tabular uppercase" autoFocus />
        </Field>
        {loading && (
          <Alert tone="info">Relendo o cadastro do UAU para garantir que o código continua livre e gravando. Pode levar até alguns minutos; não feche a tela.</Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Dialog>
  )
}
