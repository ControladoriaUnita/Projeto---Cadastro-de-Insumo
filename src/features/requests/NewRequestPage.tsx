import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { createRequestSchema, type CreateRequestInput } from '@shared/contracts'
import { REQUEST_KINDS, REQUEST_KIND_KEYS, URGENCIES, type RequestKind, type Urgency } from '@shared/domain/request/kinds'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, Button, Card, CardHeader, Field, Input, Select, Spinner, Textarea } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useSimilarItems } from '@/features/catalog/api'
import { SimilarItemsList } from '@/features/catalog/components/SimilarItemsList'
import { useCreateRequest } from './api'

type FormErrors = Partial<Record<keyof CreateRequestInput, string>>

/** Tela da obra: pede um insumo novo e já mostra se existe algo parecido no UAU. */
export function NewRequestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateRequest()
  const [form, setForm] = useState<CreateRequestInput>({
    kind: 'material',
    urgency: 'normal',
    workName: user?.workName ?? '',
    description: '',
    unit: '',
    specification: '',
    justification: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const similar = useSimilarItems(useDebouncedValue(form.description, 400))

  const set = <K extends keyof CreateRequestInput>(key: K, value: CreateRequestInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = () => {
    const parsed = createRequestSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])) as FormErrors)
      return
    }
    create.mutate(parsed.data, { onSuccess: (r) => navigate(PATHS.request(r.id), { state: { created: true } }) })
  }

  return (
    <>
      <PageHeader eyebrow="Obra" title="Solicitar insumo novo" description="Descreva o insumo que não encontrou no UAU. O analista de cadastro recebe o pedido e você acompanha cada etapa." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Dados da solicitação" />
          <form
            className="grid gap-4 px-5 py-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field label="Obra" required error={errors.workName}>
              <Input value={form.workName} onChange={(e) => set('workName', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Tipo" required>
              <Select value={form.kind} onChange={(e) => set('kind', e.target.value as RequestKind)}>
                {REQUEST_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {REQUEST_KINDS[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Insumo" required error={errors.description} hint="Ex.: Rejunte epóxi cinza platina 1kg" className="sm:col-span-2">
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={200} />
            </Field>
            <Field label="Unidade" required error={errors.unit} hint="kg, m², un, sc, mês…">
              <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} maxLength={20} />
            </Field>
            <Field label="Urgência">
              <Select value={form.urgency} onChange={(e) => set('urgency', e.target.value as Urgency)}>
                {Object.entries(URGENCIES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Onde será usado" required error={errors.justification} className="sm:col-span-2">
              <Textarea value={form.justification} onChange={(e) => set('justification', e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Especificação técnica ou marca de referência" hint="Opcional, mas ajuda o analista a classificar." className="sm:col-span-2">
              <Textarea value={form.specification} onChange={(e) => set('specification', e.target.value)} maxLength={2000} />
            </Field>
            {create.isError && (
              <Alert tone="error" className="sm:col-span-2">
                {errorMessage(create.error)}
              </Alert>
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" variant="primary" loading={create.isPending} icon={<Send className="size-4" />}>
                Enviar solicitação
              </Button>
            </div>
          </form>
        </Card>

        <Card className="self-start">
          <CardHeader title="Já existe no UAU?" description="Insumos com descrição parecida com o que você digitou." />
          {form.description.trim().length < 3 ? (
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
    </>
  )
}
