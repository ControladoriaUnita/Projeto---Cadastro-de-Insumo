import { createRequestSchema, type CreateRequestInput, type RequestDTO } from '@shared/contracts'
import { REQUEST_KINDS, REQUESTABLE_KINDS, URGENCIES, type Urgency } from '@shared/domain/request/kinds'
import { Field, Input, SearchSelect, Select, Textarea } from '@/components/ui'
import { useWorks } from '../api'

export type RequestFormErrors = Partial<Record<keyof CreateRequestInput, string>>
type Kind = CreateRequestInput['kind']

/** Valida com o mesmo schema do servidor; devolve os dados ou o erro de cada campo. */
export function validateRequestForm(form: CreateRequestInput): { data: CreateRequestInput } | { errors: RequestFormErrors } {
  const parsed = createRequestSchema.safeParse(form)
  if (parsed.success) return { data: parsed.data }
  return { errors: Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0]])) as RequestFormErrors }
}

/** Formulário a partir de uma solicitação existente (ajuste pedido pelo analista). */
export function formFromRequest(r: RequestDTO): CreateRequestInput {
  return {
    requesterName: r.requester.name,
    requesterEmail: r.requesterEmail ?? '',
    kind: (REQUESTABLE_KINDS as readonly string[]).includes(r.kind) ? (r.kind as Kind) : 'material',
    urgency: r.urgency,
    workName: r.workName,
    description: r.description,
    unit: r.unit,
    specification: r.specification,
    justification: r.justification,
  }
}

interface Props {
  form: CreateRequestInput
  errors: RequestFormErrors
  set: <K extends keyof CreateRequestInput>(key: K, value: CreateRequestInput[K]) => void
}

/** Campos da solicitação de insumo (nova e reenvio depois de ajuste). */
export function RequestFields({ form, errors, set }: Props) {
  return (
    <>
      <Field label="Nome do solicitante" required error={errors.requesterName}>
        <Input value={form.requesterName} onChange={(e) => set('requesterName', e.target.value)} autoComplete="name" maxLength={120} />
      </Field>
      <Field label="E-mail do solicitante" required error={errors.requesterEmail} hint="Recebe o aviso quando o insumo for aprovado ou precisar de ajuste.">
        <Input
          type="email"
          value={form.requesterEmail}
          onChange={(e) => set('requesterEmail', e.target.value)}
          autoComplete="email"
          inputMode="email"
          maxLength={160}
        />
      </Field>
      <Field label="Obra" required error={errors.workName}>
        <WorkSelect value={form.workName} onChange={(v) => set('workName', v)} />
      </Field>
      <Field label="Tipo" required>
        <Select value={form.kind} onChange={(e) => set('kind', e.target.value as Kind)}>
          {REQUESTABLE_KINDS.map((k) => (
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
    </>
  )
}

/** Obras ativas no UAU, com busca digitando; se o UAU não responder, libera digitar o nome da obra. */
export function WorkSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const works = useWorks()
  if (works.isError) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={160} placeholder="Não foi possível carregar as obras do UAU: digite a obra" />
    )
  }
  const options = (works.data ?? []).map((w) => w.label)
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={options}
      disabled={works.isLoading}
      placeholder={works.isLoading ? 'Carregando obras do UAU…' : 'Digite para buscar a obra'}
      aria-label="Obra"
    />
  )
}
