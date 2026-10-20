/**
 * Manual "Cadastro de Insumos · padrão de nomenclatura" (Setor de Orçamentos) em slides.
 * É a única fonte do manual: a aba Instruções mostra os slides e a rota /manual imprime o PDF
 * (scripts/build-manual-pdf.mjs). Cada slide é desenhado em 1280×720 e escalado na tela.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import logo from '@/assets/brand/logo-unita.png'
import logoWhite from '@/assets/brand/logo-unita-white.png'
import pattern from '@/assets/brand/pattern-un.png'
import { cn } from '@/utils/cn'

/** Inter troca "1,20x1,20" por "1,20×1,20" (calt); no manual o texto tem de sair exatamente como se cadastra. */
const LITERAL_TEXT = { fontFeatureSettings: '"calt" 0' }

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

const SEQUENCE = [
  { title: 'O que é', detail: 'Nome do item: janela, bloco, barra de apoio' },
  { title: 'Material', detail: 'Matéria-prima: alumínio, concreto, aço inox' },
  { title: 'Complemento', detail: 'Tipo, classe, modelo, acabamento' },
  { title: 'Medidas', detail: 'Dimensões sempre com unidade' },
  { title: 'Norma', detail: 'NBR entre parênteses, no final' },
]

const RULES = [
  { title: 'Só a primeira letra maiúscula.', detail: 'Nada de texto todo em caixa alta.' },
  { title: 'Sem marca ou fornecedor.', detail: 'A marca vai no campo “marca de referência”.' },
  { title: 'Informar a matéria-prima.', detail: 'Latão, plástico, alumínio, madeira, aço inox.' },
  { title: 'Medidas com unidade.', detail: 'Ø3mm, 60x60cm, 3/4".' },
  { title: 'Norma no final.', detail: 'Entre parênteses: (NBR 6136).' },
  { title: 'Sempre a mesma sequência.', detail: 'É ela que torna a base pesquisável. Veja a seguir.' },
]

interface Example {
  kicker: string
  title: string
  /** Partes na ordem da sequência; `label` sobrescreve o nome da parte (ex.: "O que é o serviço") */
  parts: { value: string; label?: string }[]
  description: string
  note?: string
}

const EXAMPLES: Example[] = [
  {
    kicker: 'Exemplo 1 · Material',
    title: 'Esquadria de alumínio',
    parts: [{ value: 'Janela' }, { value: 'de alumínio' }, { value: '01 folha fixa; linha 25; vidro 4mm' }, { value: '1,20x1,20m' }, { value: '(NBR 10821)' }],
    description: 'Janela de alumínio 01 folha fixa; linha 25; vidro 4mm - 1,20x1,20m - (NBR 10821)',
  },
  {
    kicker: 'Exemplo 2 · Material',
    title: 'Bloco de concreto estrutural',
    parts: [{ value: 'Bloco' }, { value: 'de concreto' }, { value: 'estrutural fbk 8,0MPa' }, { value: '14x19x39cm' }, { value: '(NBR 6136)' }],
    description: 'Bloco de concreto estrutural fbk 8,0MPa - 14x19x39cm - (NBR 6136)',
  },
  {
    kicker: 'Exemplo 3 · Material',
    title: 'Barra de apoio para acessibilidade',
    parts: [{ value: 'Barra de apoio' }, { value: 'em aço inox' }, { value: 'reta' }, { value: '70cm' }, { value: '(NBR 9050)' }],
    description: 'Barra de apoio em aço inox reta - 70cm - (NBR 9050)',
  },
  {
    kicker: 'Exemplo 4 · Serviço',
    title: 'Serviços seguem a mesma lógica',
    parts: [{ value: 'Execução de impermeabilização', label: 'O que é o serviço' }, { value: 'com manta asfáltica' }, { value: 'uma camada, aderida a maçarico' }],
    description: 'Execução de impermeabilização com manta asfáltica uma camada, aderida a maçarico',
    note: 'Medida e norma entram ao final sempre que se aplicarem ao serviço.',
  },
]

const SPECIFICITY = [
  { level: 'Genérico', items: ['Ferro'] },
  { level: 'Família', items: ['Ferro fundido', 'Aço'] },
  { level: 'Tipo de aço', items: ['Aço carbono', 'Aço inox', 'Galvanizado', 'Aço liga'] },
]

const COMPARISONS = [
  {
    wrong: 'JANELA DE ALUMINIO 120X120',
    right: 'Janela de alumínio 01 folha fixa; linha 25; vidro 4mm - 1,20x1,20m - (NBR 10821)',
    why: 'Caixa alta, sem complemento, sem unidade e sem norma',
  },
  { wrong: 'Bloco [marca] 14x19x39', right: 'Bloco de concreto estrutural fbk 8,0MPa - 14x19x39cm - (NBR 6136)', why: 'Marca na descrição, sem material e sem classe' },
  { wrong: 'Barra inox reta 70', right: 'Barra de apoio em aço inox reta - 70cm - (NBR 9050)', why: 'Item incompleto, ordem trocada, medida sem unidade' },
  {
    wrong: 'Manta p/ laje Impermeabilização',
    right: 'Execução de impermeabilização com manta asfáltica uma camada, aderida a maçarico',
    why: 'Abreviação, maiúscula no meio, sem material e método',
  },
]

// ----------------------------------------------------------------------------- moldura

function NumberBadge({ n, size = 'md', className }: { n: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'size-7 text-[13px]', md: 'size-9 text-base', lg: 'size-12 text-xl' }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-display font-semibold text-primary-foreground tabular-nums', sizes[size], className)}>
      {n}
    </span>
  )
}

function SlideFrame({ page, total, kicker, title, lead, children }: { page: number; total: number; kicker?: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="relative flex size-full flex-col bg-surface px-[88px] pt-[52px] pb-[36px] text-text" style={LITERAL_TEXT}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[10px] bg-primary" />
      <header className="flex items-center justify-between">
        <img src={logo} alt="Unità Engenharia" className="h-[34px] w-auto" />
        <span className="text-[13px] font-semibold tracking-[0.18em] text-text-muted uppercase">Setor de Orçamentos</span>
      </header>
      <div className="mt-[36px]">
        {kicker && <p className="text-[15px] font-semibold tracking-[0.14em] text-primary uppercase">{kicker}</p>}
        <h2 className="mt-1 font-display text-[44px] leading-[1.1] font-semibold tracking-tight text-ink-900">{title}</h2>
        {lead && <p className="mt-3 max-w-[900px] text-[20px] leading-snug text-text-muted">{lead}</p>}
      </div>
      <div className="mt-[28px] flex min-h-0 flex-1 flex-col pb-[24px]">{children}</div>
      <footer className="flex items-center justify-between border-t border-border pt-[14px] text-[13px] text-text-muted">
        <span>Cadastro de Insumos · Padrão de nomenclatura</span>
        <span className="tabular-nums">
          {page} / {total}
        </span>
      </footer>
    </div>
  )
}

// ----------------------------------------------------------------------------- slides

function CoverSlide() {
  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-ink-900 px-[88px] py-[64px] text-primary-foreground" style={LITERAL_TEXT}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[10px] bg-primary" />
      <img src={pattern} alt="" aria-hidden className="pointer-events-none absolute right-0 bottom-0 left-0 w-full opacity-[0.12]" />
      <img src={logoWhite} alt="Unità Engenharia" className="h-[52px] w-auto self-start" />
      <div className="mt-auto mb-[120px]">
        <p className="text-[18px] font-semibold tracking-[0.2em] text-primary uppercase">Setor de Orçamentos</p>
        <h1 className="mt-4 font-display text-[88px] leading-none font-semibold tracking-tight">Cadastro de Insumos</h1>
        <p className="mt-6 text-[30px] text-ink-300">Qual o padrão de nomenclatura?</p>
      </div>
    </div>
  )
}

function RulesSlide({ page, total }: { page: number; total: number }) {
  return (
    <SlideFrame page={page} total={total} kicker="Padrão de nomenclatura" title="As seis regras">
      <ol className="grid flex-1 grid-cols-3 grid-rows-2 gap-[20px]">
        {RULES.map((r, i) => {
          const last = i === RULES.length - 1
          return (
            <li key={r.title} className={cn('flex gap-[18px] rounded-[14px] border p-[24px]', last ? 'border-primary bg-primary-soft' : 'border-border bg-ink-50')}>
              <NumberBadge n={i + 1} size="lg" />
              <div>
                <p className="text-[22px] leading-tight font-semibold text-ink-900">{r.title}</p>
                <p className="mt-2 text-[18px] leading-snug text-ink-600">{r.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </SlideFrame>
  )
}

function SequenceSlide({ page, total }: { page: number; total: number }) {
  return (
    <SlideFrame page={page} total={total} kicker="Padrão de nomenclatura" title="A sequência da descrição">
      <ol className="flex items-stretch gap-[14px]">
        {SEQUENCE.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-[14px]">
            <div className={cn('flex h-[250px] flex-1 flex-col rounded-[14px] border p-[22px]', i === SEQUENCE.length - 1 ? 'border-primary bg-primary-soft' : 'border-border bg-ink-50')}>
              <NumberBadge n={i + 1} />
              <p className="mt-[20px] font-display text-[24px] font-semibold text-ink-900">{s.title}</p>
              <p className="mt-2 text-[17px] leading-snug text-ink-600">{s.detail}</p>
            </div>
            {i < SEQUENCE.length - 1 && <ArrowRight aria-hidden className="size-6 shrink-0 text-primary" />}
          </li>
        ))}
      </ol>
      <div className="mt-[32px] flex gap-4 rounded-[14px] bg-ink-900 px-[28px] py-[22px] text-[19px] leading-snug text-ink-100">
        <span className="font-semibold text-primary">Atenção</span>
        <p>O complemento entra quando é ele que diferencia o insumo. Se não houver norma aplicável, a descrição termina nas medidas.</p>
      </div>
    </SlideFrame>
  )
}

function ExampleSlide({ example, page, total }: { example: Example; page: number; total: number }) {
  return (
    <SlideFrame page={page} total={total} kicker={example.kicker} title={example.title}>
      <ol className="flex flex-wrap items-start gap-[12px]">
        {example.parts.map((p, i) => {
          const norm = i === 4
          return (
            <li key={p.value} className="flex flex-col gap-[10px]">
              <span className={cn('rounded-[10px] border px-[16px] py-[14px] text-[21px] font-semibold', norm ? 'border-primary bg-primary text-primary-foreground' : 'border-ink-300 bg-ink-50 text-ink-900')}>
                {p.value}
              </span>
              <span className="flex items-center gap-2 text-[15px] font-medium text-ink-600">
                <NumberBadge n={i + 1} size="sm" />
                {p.label ?? SEQUENCE[i]!.title}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-auto rounded-[14px] border-l-[6px] border-primary bg-ink-900 px-[30px] py-[24px]">
        <p className="text-[13px] font-semibold tracking-[0.16em] text-ink-300 uppercase">Descrição cadastrada</p>
        <p className="mt-2 text-[26px] leading-snug font-medium text-primary-foreground">{example.description}</p>
        {example.note && <p className="mt-3 text-[17px] text-ink-300">{example.note}</p>}
      </div>
    </SlideFrame>
  )
}

function SpecificSlide({ page, total }: { page: number; total: number }) {
  return (
    <SlideFrame page={page} total={total} kicker="Material" title="Seja específico" lead="“Ferro” não define o insumo. Desça até o nível que muda preço e aplicação.">
      <ol className="flex flex-1 items-stretch gap-[14px]">
        {SPECIFICITY.map((s, i) => (
          <li key={s.level} className="flex items-center gap-[14px]" style={{ flex: 1 + i * 0.15 }}>
            <div className="flex h-full flex-1 flex-col justify-center rounded-[14px] border border-border bg-ink-50 p-[24px]">
              <p className="text-[14px] font-semibold tracking-[0.14em] text-text-muted uppercase">{s.level}</p>
              <ul className="mt-3 grid gap-1">
                {s.items.map((it) => (
                  <li key={it} className="text-[22px] font-semibold text-ink-900">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <ArrowRight aria-hidden className="size-6 shrink-0 text-primary" />
          </li>
        ))}
        <li className="flex flex-[1.9] flex-col justify-center rounded-[14px] border-2 border-primary bg-primary-soft p-[28px]">
          <p className="text-[14px] font-semibold tracking-[0.14em] text-primary uppercase">Especificação</p>
          <p className="mt-4 text-[22px] leading-snug text-ink-900">
            <span className="font-semibold">Carbono:</span> SAE 1020, ASTM A36, CA-50
          </p>
          <p className="mt-3 text-[22px] leading-snug text-ink-900">
            <span className="font-semibold">Inox:</span> AISI 304, AISI 316, AISI 430
          </p>
        </li>
      </ol>
    </SlideFrame>
  )
}

function ComparisonSlide({ page, total }: { page: number; total: number }) {
  return (
    <SlideFrame page={page} total={total} kicker="Revisão" title="Como chega e como deve chegar">
      <table className="w-full table-fixed border-collapse text-left text-[17px] leading-snug">
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[44%]" />
          <col className="w-[29%]" />
        </colgroup>
        <thead>
          <tr className="text-[13px] tracking-[0.12em] uppercase">
            <th className="pb-3 font-semibold text-error">
              <X aria-hidden className="mr-1.5 inline size-4" />
              Fora do padrão
            </th>
            <th className="pb-3 font-semibold text-success">
              <Check aria-hidden className="mr-1.5 inline size-4" />
              No padrão
            </th>
            <th className="pb-3 font-semibold text-text-muted">O que estava errado</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISONS.map((c) => (
            <tr key={c.wrong} className="border-t border-border align-top">
              <td className="py-[16px] pr-5 font-medium text-error line-through decoration-error/40">{c.wrong}</td>
              <td className="py-[16px] pr-5 font-semibold text-ink-900">{c.right}</td>
              <td className="py-[16px] text-ink-600">{c.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SlideFrame>
  )
}

/** Slides na ordem do manual. */
export const MANUAL_SLIDES: { title: string; render: (page: number, total: number) => ReactNode }[] = [
  { title: 'Capa', render: () => <CoverSlide /> },
  { title: 'As seis regras', render: (p, t) => <RulesSlide page={p} total={t} /> },
  { title: 'A sequência da descrição', render: (p, t) => <SequenceSlide page={p} total={t} /> },
  ...EXAMPLES.map((ex) => ({ title: ex.title, render: (p: number, t: number) => <ExampleSlide example={ex} page={p} total={t} /> })),
  { title: 'Seja específico', render: (p, t) => <SpecificSlide page={p} total={t} /> },
  { title: 'Como chega e como deve chegar', render: (p, t) => <ComparisonSlide page={p} total={t} /> },
]

export function renderSlide(index: number) {
  return MANUAL_SLIDES[index]!.render(index + 1, MANUAL_SLIDES.length)
}

/** Mostra um slide 1280×720 escalado para a largura disponível. */
export function ScaledSlide({ index, className }: { index: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / SLIDE_WIDTH)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn('relative aspect-video w-full overflow-hidden', className)}>
      {scale > 0 && (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})` }}>
          {renderSlide(index)}
        </div>
      )}
    </div>
  )
}
