import type { ReactNode } from 'react'
import { Wand2 } from 'lucide-react'
import type { DraftContextDTO } from '@shared/contracts'
import { CONTROLS, GROUPS, PAYMENT_BASIS, PAYMENT_TYPES, YES_NO } from '@shared/domain/insumo/catalog'
import { categoryCode, categoryLabel } from '@shared/domain/insumo/categories'
import { CODE_PREFIXES, prefixOf } from '@shared/domain/insumo/code'
import type { DraftField, InsumoDraft } from '@shared/domain/insumo/draft'
import { Button, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { CopyFromInsumo } from './CopyFromInsumo'
import { PriceInput } from './PriceInput'
import type { DraftEditor } from './useDraftEditor'

interface Props {
  editor: DraftEditor
  context: DraftContextDTO | undefined
  /** Descrição pedida pela obra (sugestões de insumos para copiar) */
  requestDescription: string
  disabled?: boolean
}

type NumberField = { [K in DraftField]: InsumoDraft[K] extends number | null ? K : never }[DraftField]
type TextField = { [K in DraftField]: InsumoDraft[K] extends string ? K : never }[DraftField]
type FlagField = { [K in DraftField]: InsumoDraft[K] extends boolean ? K : never }[DraftField]

/**
 * Formulário do cadastro do insumo (campos de InsumosGeral/InserirInsumosGeral).
 * Usado pelo analista (criação) e pela gestão (revisão antes de gravar no UAU).
 */
export function InsumoForm({ editor, context, requestDescription, disabled }: Props) {
  const { draft, patch, fieldIssues } = editor
  const issue = (f: DraftField) => fieldIssues[f]
  const error = (f: DraftField) => (issue(f)?.tone === 'error' ? issue(f)!.message : null)
  const hint = (f: DraftField, fallback?: ReactNode) => (issue(f)?.tone === 'warning' ? <span className="text-warning">{issue(f)!.message}</span> : fallback)

  // ------------------------------------------------------------------ controles por tipo de campo
  const text = (f: TextField, props: { maxLength?: number; list?: string; placeholder?: string; className?: string } = {}) => (
    <Input value={draft[f]} onChange={(e) => patch({ [f]: e.target.value })} disabled={disabled} {...props} />
  )
  const choice = (f: NumberField, options: Record<number, string>) => (
    <Select value={draft[f] === null ? '' : String(draft[f])} onChange={(e) => patch({ [f]: e.target.value === '' ? null : Number(e.target.value) })} disabled={disabled}>
      <option value="">—</option>
      {Object.entries(options).map(([value, label]) => (
        <option key={value} value={value}>
          {value} · {label}
        </option>
      ))}
    </Select>
  )
  /** Inteiro ≥ 0; vazio = não informado */
  const integer = (f: NumberField) => (
    <Input
      inputMode="numeric"
      className="tabular text-right"
      value={draft[f] ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value.trim()
        if (v === '') patch({ [f]: null })
        else if (/^\d{1,4}$/.test(v)) patch({ [f]: Number(v) })
      }}
    />
  )
  const flag = (f: FlagField) => (
    <Select value={draft[f] ? '1' : '0'} onChange={(e) => patch({ [f]: e.target.value === '1' })} disabled={disabled}>
      <option value="0">Não</option>
      <option value="1">Sim</option>
    </Select>
  )

  const prefix = prefixOf(draft.codigo) ?? ''
  const suggested = context?.prefixes.find((p) => p.prefix === prefix)?.nextCode ?? null
  const maxDesc = context?.maxDescriptionLength || 250
  const copiedHint = draft.modeloCodigo ? ` Copiada de ${draft.modeloCodigo}: ajuste para o novo insumo.` : ''

  return (
    <div className="grid gap-4">
      <Section title="1. Copiar de um insumo existente" description="Recomendado: traz todas as informações de um insumo parecido. Depois, ajuste o que muda (normalmente descrição e preço).">
        <CopyFromInsumo editor={editor} requestDescription={requestDescription} disabled={disabled} />
      </Section>

      <Section title="2. Identificação e preço">
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field label="Prefixo" hint={context?.prefixes.find((p) => p.prefix === prefix)?.label}>
            <Select
              value={prefix}
              disabled={disabled}
              onChange={(e) => {
                const next = context?.prefixes.find((p) => p.prefix === e.target.value)?.nextCode
                patch({ codigo: next ?? e.target.value })
              }}
            >
              <option value="">—</option>
              {CODE_PREFIXES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-start gap-2">
            <Field label="Código" required error={error('codigo')} hint={hint('codigo', 'Prefixo + 5 dígitos. Sugerido: primeira lacuna da numeração.')} className="flex-1">
              <Input
                value={draft.codigo}
                onChange={(e) => patch({ codigo: e.target.value.toUpperCase() })}
                maxLength={7}
                className="tabular font-semibold uppercase"
                disabled={disabled}
              />
            </Field>
            {suggested && suggested !== draft.codigo && !disabled && (
              <Button variant="secondary" className="mt-7" icon={<Wand2 className="size-4" />} onClick={() => patch({ codigo: suggested })}>
                Usar {suggested}
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field
            label="Descrição"
            required
            error={error('descricao')}
            hint={hint('descricao', `${draft.descricao.length}/${maxDesc} caracteres. Padrão do UAU: maiúsculas, sem acento.${copiedHint}`)}
          >
            {text('descricao', { maxLength: 250 })}
          </Field>
          <Field label="Preço (R$)" error={error('preco')} hint="Grava também a data da cotação.">
            <PriceInput value={draft.preco} onChange={(preco) => patch({ preco })} disabled={disabled} />
          </Field>
        </div>
      </Section>

      <Section title="3. Classificação">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Unidade" required error={error('unidade')} hint={hint('unidade')}>
            {text('unidade', { list: 'dl-unidades', maxLength: 20 })}
          </Field>
          <Field
            label="Categoria"
            required
            error={error('categoria')}
            hint={hint('categoria', draft.categoria && categoryLabel(draft.categoria) !== draft.categoria ? `Código no UAU: ${draft.categoria}` : undefined)}
          >
            {/* Mostra a descrição; o rascunho guarda o código do UAU (de-para em categories.ts) */}
            <Input
              value={categoryLabel(draft.categoria)}
              onChange={(e) => patch({ categoria: categoryCode(e.target.value) })}
              list="dl-categorias"
              maxLength={120}
              placeholder="Descrição da categoria"
              disabled={disabled}
            />
          </Field>
          <Field label="Grupo" required error={error('grupo')} hint={hint('grupo')}>
            {choice('grupo', GROUPS)}
          </Field>
          <Field label="Controle" error={error('controle')}>
            {choice('controle', CONTROLS)}
          </Field>
          <Field label="Tipo de pagamento" error={error('tipoPagamento')}>
            {choice('tipoPagamento', PAYMENT_TYPES)}
          </Field>
          <Field label="Controla estoque" error={error('controlaEstoque')}>
            {choice('controlaEstoque', YES_NO)}
          </Field>
        </div>
      </Section>

      <Section title="4. Contábil e fiscal">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CAP principal" hint={hint('cap')}>
            {text('cap', { list: 'dl-caps', maxLength: 40 })}
          </Field>
          <Field label="CAP aplicação de material">{text('capAplicacao', { list: 'dl-caps', maxLength: 40 })}</Field>
          <Field label="CAP estorno">{text('capEstorno', { maxLength: 40 })}</Field>
          <Field label="CAP transação financeira">{text('capTransacaoFinanceira', { maxLength: 40 })}</Field>
          <Field label="Categoria mov. financeira">{text('categoriaMovFin', { maxLength: 40 })}</Field>
          <Field label="NCM" hint={hint('ncm')}>
            {text('ncm', { maxLength: 20 })}
          </Field>
          <Field label="CEST">{text('cest', { maxLength: 20 })}</Field>
        </div>
      </Section>

      <Section title="5. Prazos, pagamento e controles" description="Normalmente vêm do insumo copiado.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Dias para compra" error={error('diasDeCompra')}>
            {integer('diasDeCompra')}
          </Field>
          <Field label="Dias na obra antes do uso" error={error('diasUtilizacao')}>
            {integer('diasUtilizacao')}
          </Field>
          <Field label="Dias para entrega" error={error('diasEntrega')}>
            {integer('diasEntrega')}
          </Field>
          <Field label="Compras por mês" error={error('numeroDeCompras')}>
            {integer('numeroDeCompras')}
          </Field>
          <Field label="Número de pagamentos" error={error('numeroPagamentos')}>
            {integer('numeroPagamentos')}
          </Field>
          <Field label="Pagamento sobre" error={error('pagamentoSobre')}>
            {choice('pagamentoSobre', PAYMENT_BASIS)}
          </Field>
          <Field label="Frequência de compra" hint="Código do UAU, ex.: V0001">
            {text('frequenciaCompra', { maxLength: 20, className: 'uppercase' })}
          </Field>
          <Field label="Frequência de pagamento" hint="Código do UAU, ex.: V0059">
            {text('comoPagar', { maxLength: 20, className: 'uppercase' })}
          </Field>
          <Field label="Cálculo de encargo">{choice('calcEncargo', YES_NO)}</Field>
          <Field label="Patrimônio">{choice('patrimonio', YES_NO)}</Field>
          <Field label="Controla preço meta">{flag('controlarPrecoMeta')}</Field>
          <Field label="Item de manutenção">{flag('itemManutencao')}</Field>
        </div>
      </Section>

      <datalist id="dl-unidades">{context?.unidades.slice(0, 300).map((u) => <option key={u.value} value={u.value}>{`${u.count} insumos`}</option>)}</datalist>
      <datalist id="dl-categorias">
        {context?.categorias.slice(0, 500).map((c) => (
          <option key={c.value} value={categoryLabel(c.value)}>{`${c.value} · ${c.count} insumos`}</option>
        ))}
      </datalist>
      <datalist id="dl-caps">{context?.caps.slice(0, 300).map((c) => <option key={c.value} value={c.value}>{`${c.count} insumos`}</option>)}</datalist>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 px-5 py-4">{children}</div>
    </Card>
  )
}
