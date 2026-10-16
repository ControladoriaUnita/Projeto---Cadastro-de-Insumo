import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus, Send, Trash2 } from 'lucide-react'
import { createRequestSchema, type CreateRequestInput } from '@shared/contracts'
import { REQUEST_KINDS, REQUESTABLE_KINDS, URGENCIES, type Urgency } from '@shared/domain/request/kinds'
import { MAX_BATCH_ITEMS, type SheetRow } from '@shared/domain/request/spreadsheet'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, CardHeader, Field, Input, Select, Spinner, Textarea } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/utils/cn'
import { useSimilarItems } from '@/features/catalog/api'
import { SimilarItemsList } from '@/features/catalog/components/SimilarItemsList'
import { useCreateRequest, useCreateRequests } from './api'
import { ImportSpreadsheetDialog } from './components/ImportSpreadsheetDialog'
import { WorkSelect } from './components/RequestFields'

type ItemInput = Omit<CreateRequestInput, 'workName' | 'requesterName'>
type Kind = CreateRequestInput['kind']
type ItemErrors = Partial<Record<keyof ItemInput, string>>

interface Item extends ItemInput {
  key: number
  /** Linha da planilha de onde veio (importação) */
  line: number | null
}

let nextKey = 1
const emptyItem = (): Item => ({
  key: nextKey++,
  line: null,
  kind: 'material',
  urgency: 'normal',
  description: '',
  unit: '',
  specification: '',
  justification: '',
})

const isBlank = (i: Item) => !i.description.trim() && !i.unit.trim() && !i.justification.trim() && !i.specification.trim()

function validateItem(item: Item, workName: string, requesterName: string): { data: CreateRequestInput | null; errors: ItemErrors } {
  const { key: _key, line: _line, ...input } = item
  const parsed = createRequestSchema.safeParse({ ...input, workName, requesterName })
  if (parsed.success) return { data: parsed.data, errors: {} }
  const fieldErrors = parsed.error.flatten().fieldErrors
  const errors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([k]) => k !== 'workName' && k !== 'requesterName')
      .map(([k, v]) => [k, v?.[0]]),
  ) as ItemErrors
  return { data: null, errors }
}

/** Tela da obra: pede um ou vários insumos novos (digitando ou por planilha) e mostra se já existe algo parecido no UAU. */
export function NewRequestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const createOne = useCreateRequest()
  const createMany = useCreateRequests()

  const [workName, setWorkName] = useState(user?.workName ?? '')
  const [workError, setWorkError] = useState<string | undefined>()
  // Obra sem login digita o nome; quem entrou já vem preenchido
  const [requesterName, setRequesterName] = useState(user && !user.guest ? user.fullName : '')
  const [requesterError, setRequesterError] = useState<string | undefined>()
  const [items, setItems] = useState<Item[]>(() => [emptyItem()])
  const [errors, setErrors] = useState<Record<number, ItemErrors>>({})
  const [activeKey, setActiveKey] = useState(items[0]!.key)
  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null)

  const mutation = items.length > 1 ? createMany : createOne
  const active = items.find((i) => i.key === activeKey) ?? items[0]!
  const activeIndex = items.indexOf(active)
  const similar = useSimilarItems(useDebouncedValue(active.description, 400))
  const pendingCount = Object.values(errors).filter((e) => Object.values(e).some(Boolean)).length

  const setField = <K extends keyof ItemInput>(key: number, field: K, value: ItemInput[K]) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, [field]: value } : i)))
    setErrors((e) => (e[key]?.[field] ? { ...e, [key]: { ...e[key], [field]: undefined } } : e))
  }

  const addItem = () => {
    if (items.length >= MAX_BATCH_ITEMS) return
    const last = items[items.length - 1]
    // Novo item já vem com o tipo e a urgência do anterior (pedidos parecidos em sequência)
    const item = { ...emptyItem(), kind: last?.kind ?? 'material', urgency: last?.urgency ?? 'normal' }
    setItems((list) => [...list, item])
    setActiveKey(item.key)
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#item-${item.key} [data-focus]`)?.focus())
  }

  const removeItem = (key: number) => {
    setItems((list) => (list.length > 1 ? list.filter((i) => i.key !== key) : list))
    setErrors(({ [key]: _removed, ...rest }) => rest)
  }

  const importRows = (rows: SheetRow[], truncated: boolean) => {
    const keep = items.filter((i) => !isBlank(i))
    const room = MAX_BATCH_ITEMS - keep.length
    const imported = rows.slice(0, room).map((r) => ({ ...emptyItem(), ...r.item, line: r.line }))
    const nextErrors: Record<number, ItemErrors> = {}
    imported.forEach((item, i) => {
      // Campos faltando + tipo/urgência não reconhecidos na planilha
      const found = { ...validateItem(item, workName || 'obra', requesterName || 'solicitante').errors, ...rows[i]!.issues }
      if (Object.keys(found).length) nextErrors[item.key] = found
    })
    setItems([...keep, ...imported])
    setErrors((e) => ({ ...e, ...nextErrors }))
    if (imported[0]) setActiveKey(imported[0].key)
    const cut = truncated || rows.length > room
    const issues = Object.keys(nextErrors).length
    const parts = [`${imported.length} ${imported.length === 1 ? 'insumo importado' : 'insumos importados'} da planilha.`]
    if (issues) parts.push(`${issues} ${issues === 1 ? 'precisa' : 'precisam'} de ajuste (marcados em vermelho).`)
    if (cut) parts.push(`O limite é ${MAX_BATCH_ITEMS} insumos por envio; o restante ficou de fora.`)
    setNotice({ tone: issues || cut ? 'warning' : 'success', text: parts.join(' ') })
  }

  const submit = () => {
    setNotice(null)
    const work = workName.trim()
    const wErr = work.length < 2 ? 'Informe a obra.' : undefined
    setWorkError(wErr)
    const requester = requesterName.trim()
    const rErr = requester.length < 3 ? 'Informe o nome do solicitante.' : undefined
    setRequesterError(rErr)
    const results = items.map((i) => {
      const r = validateItem(i, work, requester)
      // Tipo/urgência não reconhecidos na planilha seguem bloqueando até a pessoa escolher na tela
      const { kind, urgency } = errors[i.key] ?? {}
      const sheetIssues = Object.fromEntries(Object.entries({ kind, urgency }).filter(([, v]) => v)) as ItemErrors
      const all = { ...r.errors, ...sheetIssues }
      return { key: i.key, errors: all, data: Object.keys(all).length ? null : r.data }
    })
    const nextErrors = Object.fromEntries(results.filter((r) => !r.data).map((r) => [r.key, r.errors]))
    setErrors(nextErrors)
    const firstBad = results.find((r) => !r.data)
    if (wErr || rErr || firstBad) {
      if (firstBad) {
        setActiveKey(firstBad.key)
        document.getElementById(`item-${firstBad.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    const data = results.map((r) => r.data!)
    if (data.length === 1) {
      createOne.mutate(data[0]!, { onSuccess: (r) => navigate(PATHS.request(r.id), { state: { created: true } }) })
    } else {
      createMany.mutate(data, { onSuccess: (r) => navigate(PATHS.requests, { state: { createdCount: r.requests.length } }) })
    }
  }

  const sending = createOne.isPending || createMany.isPending
  const sendLabel = items.length === 1 ? 'Enviar solicitação' : `Enviar ${items.length} solicitações`

  return (
    <>
      <PageHeader
        eyebrow="Obra"
        title="Solicitar insumo novo"
        description="Descreva os insumos que não encontrou no UAU. Cada insumo vira uma solicitação: o analista de cadastro recebe e você acompanha cada etapa."
        actions={
          <Button onClick={() => setImportOpen(true)} icon={<FileSpreadsheet className="size-4" />}>
            Importar planilha
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="grid content-start gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Card>
            <CardHeader title="Obra" description="Vale para todos os insumos deste envio." />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Field label="Nome do solicitante" required error={requesterError}>
                <Input
                  value={requesterName}
                  onChange={(e) => {
                    setRequesterName(e.target.value)
                    setRequesterError(undefined)
                  }}
                  autoComplete="name"
                  maxLength={120}
                />
              </Field>
              <Field label="Obra" required error={workError}>
                <WorkSelect
                  value={workName}
                  onChange={(v) => {
                    setWorkName(v)
                    setWorkError(undefined)
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={`Insumos (${items.length})`}
              description="Adicione quantos precisar, digitando ou importando uma planilha."
              actions={
                <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)} icon={<FileSpreadsheet className="size-4" />}>
                  Importar planilha
                </Button>
              }
            />
            {notice && (
              <Alert
                tone={notice.tone}
                className="mx-5 mt-4"
                action={
                  <button type="button" className="text-xs font-medium underline" onClick={() => setNotice(null)}>
                    Fechar
                  </button>
                }
              >
                {notice.text}
              </Alert>
            )}
            <ol className="divide-y divide-border">
              {items.map((item, index) => (
                <ItemFields
                  key={item.key}
                  item={item}
                  index={index}
                  errors={errors[item.key] ?? {}}
                  active={item.key === active.key && items.length > 1}
                  removable={items.length > 1}
                  onFocus={() => setActiveKey(item.key)}
                  onChange={(field, value) => setField(item.key, field, value)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
              <Button onClick={addItem} disabled={items.length >= MAX_BATCH_ITEMS} icon={<Plus className="size-4" />}>
                Adicionar insumo
              </Button>
              {items.length >= MAX_BATCH_ITEMS && <span className="text-xs text-text-muted">Limite de {MAX_BATCH_ITEMS} insumos por envio.</span>}
            </div>
          </Card>

          {mutation.isError && <Alert tone="error">{errorMessage(mutation.error)}</Alert>}
          {pendingCount > 0 && (
            <Alert tone="error">
              {pendingCount === 1 ? '1 insumo tem' : `${pendingCount} insumos têm`} campos a corrigir, marcados em vermelho.
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={sending} icon={<Send className="size-4" />}>
              {sendLabel}
            </Button>
          </div>
        </form>

        <Card className="self-start lg:sticky lg:top-4">
          <CardHeader
            title="Já existe no UAU?"
            description={
              items.length > 1
                ? `Parecidos com o insumo ${activeIndex + 1}${active.description.trim() ? `: ${active.description.trim()}` : ''}.`
                : 'Insumos com descrição parecida com o que você digitou.'
            }
          />
          {active.description.trim().length < 3 ? (
            <p className="px-5 py-4 text-sm text-text-muted">Digite o nome do insumo para conferir.</p>
          ) : similar.isFetching && !similar.data ? (
            <div className="flex justify-center py-6 text-primary">
              <Spinner />
            </div>
          ) : similar.isError ? (
            <p className="px-5 py-4 text-sm text-text-muted">Não foi possível consultar o UAU agora. Você pode enviar a solicitação mesmo assim.</p>
          ) : similar.data?.length ? (
            <>
              <SimilarItemsList items={similar.data} />
              <p className="border-t border-border px-5 py-3 text-xs text-text-muted">Se algum servir, use o código dele em vez de pedir um novo.</p>
            </>
          ) : (
            <p className="px-5 py-4 text-sm text-text-muted">Nenhum insumo parecido encontrado.</p>
          )}
        </Card>
      </div>

      <ImportSpreadsheetDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importRows} />
    </>
  )
}

interface ItemFieldsProps {
  item: Item
  index: number
  errors: ItemErrors
  active: boolean
  removable: boolean
  onFocus: () => void
  onChange: <K extends keyof ItemInput>(field: K, value: ItemInput[K]) => void
  onRemove: () => void
}

function ItemFields({ item, index, errors, active, removable, onFocus, onChange, onRemove }: ItemFieldsProps) {
  const hasErrors = Object.values(errors).some(Boolean)
  return (
    <li id={`item-${item.key}`} onFocus={onFocus} className={cn('border-l-2 border-transparent px-5 py-4', active && 'border-primary bg-ink-50', hasErrors && 'border-error')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-700">
          Insumo {index + 1}
          {item.line !== null && <span className="ml-2 text-xs font-normal text-text-muted">linha {item.line} da planilha</span>}
        </p>
        {removable && (
          <Button size="sm" variant="ghost" onClick={onRemove} icon={<Trash2 className="size-4" />} aria-label={`Remover insumo ${index + 1}`}>
            Remover
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[11rem_minmax(0,1fr)_7rem_8rem]">
        <Field label="Tipo" required error={errors.kind}>
          {/* Valor não reconhecido na planilha: fica em branco até a pessoa escolher */}
          <Select value={errors.kind ? '' : item.kind} onChange={(e) => onChange('kind', e.target.value as Kind)}>
            {errors.kind && (
              <option value="" disabled>
                Escolha…
              </option>
            )}
            {REQUESTABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {REQUEST_KINDS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Insumo" required error={errors.description} hint="Ex.: Rejunte epóxi cinza platina 1kg" className="sm:col-span-2 xl:col-span-1">
          <Input data-focus value={item.description} onChange={(e) => onChange('description', e.target.value)} maxLength={200} />
        </Field>
        <Field label="Unidade" required error={errors.unit} hint="kg, m², un…">
          <Input value={item.unit} onChange={(e) => onChange('unit', e.target.value)} maxLength={20} />
        </Field>
        <Field label="Urgência" error={errors.urgency}>
          <Select value={errors.urgency ? '' : item.urgency} onChange={(e) => onChange('urgency', e.target.value as Urgency)}>
            {errors.urgency && (
              <option value="" disabled>
                Escolha…
              </option>
            )}
            {Object.entries(URGENCIES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Onde será usado" required error={errors.justification}>
          <Textarea value={item.justification} onChange={(e) => onChange('justification', e.target.value)} maxLength={2000} className="min-h-16" />
        </Field>
        <Field label="Especificação técnica ou marca de referência" hint="Opcional, mas ajuda o analista a classificar.">
          <Textarea value={item.specification} onChange={(e) => onChange('specification', e.target.value)} maxLength={2000} className="min-h-16" />
        </Field>
      </div>
    </li>
  )
}
