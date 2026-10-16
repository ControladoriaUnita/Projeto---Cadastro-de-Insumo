import { useRef, useState } from 'react'
import { Download, FileUp } from 'lucide-react'
import { MAX_BATCH_ITEMS, SHEET_COLUMNS, SHEET_NAME, type SheetRow } from '@shared/domain/request/spreadsheet'
import { Alert, Button, Dialog } from '@/components/ui'
import { downloadTemplate, readSpreadsheet } from '../spreadsheet'

interface Props {
  open: boolean
  onClose: () => void
  /** Linhas lidas; truncated = a planilha tinha mais que o limite */
  onImport: (rows: SheetRow[], truncated: boolean) => void
}

/** Explica a planilha e oferece o modelo e a escolha do arquivo. */
export function ImportSpreadsheetDialog({ open, onClose, onImport }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'template' | 'file' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  const template = async () => {
    setBusy('template')
    setError(null)
    try {
      await downloadTemplate()
    } catch {
      setError('Não foi possível gerar a planilha modelo. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy('file')
    setError(null)
    try {
      const result = await readSpreadsheet(file)
      if (!result.ok) return setError(result.error)
      onImport(result.rows, result.truncated)
      close()
    } catch {
      setError('Não foi possível ler a planilha. Tente de novo.')
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      width="min(94vw, 36rem)"
      title="Importar planilha"
      description="Para pedir vários insumos de uma vez sem digitar um por um."
      footer={
        <>
          <Button variant="ghost" onClick={close} className="mr-auto">
            Cancelar
          </Button>
          <Button onClick={template} loading={busy === 'template'} disabled={busy === 'file'} icon={<Download className="size-4" />}>
            Baixar modelo
          </Button>
          <Button variant="primary" onClick={() => input.current?.click()} loading={busy === 'file'} disabled={busy === 'template'} icon={<FileUp className="size-4" />}>
            Selecionar arquivo
          </Button>
        </>
      }
    >
      <ol className="grid list-decimal gap-2 pl-5 text-ink-700">
        <li>
          Baixe a <strong>planilha modelo</strong> e preencha a aba “{SHEET_NAME}”, uma linha por insumo (até {MAX_BATCH_ITEMS}).
        </li>
        <li>Não mude os nomes das colunas. Tipo e Urgência têm lista para escolher.</li>
        <li>
          Salve como <strong>.xlsx</strong> e clique em <strong>Selecionar arquivo</strong>.
        </li>
        <li>Os insumos aparecem na tela para você conferir, corrigir e só então enviar.</li>
      </ol>
      <div className="mt-4 rounded-control border border-border bg-ink-50 px-3 py-2">
        <p className="text-xs font-semibold text-ink-700">Colunas</p>
        <ul className="mt-1 grid gap-0.5 text-xs text-text-muted">
          {SHEET_COLUMNS.map((c) => (
            <li key={c.field}>
              <span className="font-medium text-ink-700">
                {c.header}
                {c.required && <span className="text-error"> *</span>}
              </span>{' '}
              — {c.hint}
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </Dialog>
  )
}
