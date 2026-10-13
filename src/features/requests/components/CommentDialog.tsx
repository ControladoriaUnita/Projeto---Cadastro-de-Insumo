import { useEffect, useState } from 'react'
import { Alert, Button, Dialog, Field, Textarea } from '@/components/ui'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** Motivo obrigatório (devolver, recusar) */
  required?: boolean
  loading?: boolean
  error?: string | null
  onConfirm: (comment: string) => void
  onCancel: () => void
}

/** Confirmação com campo de motivo (DESIGN_SYSTEM §11: explica a consequência e oferece saída). */
export function CommentDialog({ open, title, description, confirmLabel, tone = 'primary', required, loading, error, onConfirm, onCancel }: Props) {
  const [comment, setComment] = useState('')
  useEffect(() => {
    if (open) setComment('')
  }, [open])
  const blocked = required && !comment.trim()

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className="mr-auto">
            Cancelar
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={blocked} onClick={() => onConfirm(comment.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Motivo" required={required} hint={required ? 'Quem abriu a solicitação verá este texto.' : 'Opcional.'}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} autoFocus />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Dialog>
  )
}
