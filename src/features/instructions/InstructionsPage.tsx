import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardList, FileDown, ListPlus, Plus, Search, Send, type LucideIcon } from 'lucide-react'
import { PATHS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, CardHeader } from '@/components/ui'
import { cn } from '@/utils/cn'
import { MANUAL_SLIDES, ScaledSlide } from './ManualDeck'

/** PDF gerado a partir dos mesmos slides (npm run manual:pdf). */
const MANUAL_PDF = '/manual-cadastro-de-insumos.pdf'

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Search,
    title: 'Confira se o insumo já existe',
    text: 'Em “Solicitar insumo”, comece a digitar a descrição e olhe o quadro “Já existe no UAU?” ao lado. Se algum insumo servir, use o código dele em vez de pedir um novo.',
  },
  {
    icon: ClipboardList,
    title: 'Informe quem pede e para qual obra',
    text: 'Preencha o nome do solicitante e escolha a obra (dá para digitar parte do nome para achar na lista). A obra vale para todos os insumos do envio.',
  },
  {
    icon: ListPlus,
    title: 'Descreva cada insumo no padrão',
    text: 'Escolha o tipo, escreva o insumo seguindo a sequência do manual (o que é, material, complemento, medidas, norma), informe a unidade e onde será usado. Marca ou modelo de referência vão em “Especificação técnica ou marca de referência”.',
  },
  {
    icon: Plus,
    title: 'Vários insumos de uma vez',
    text: 'Use “Adicionar insumo” para incluir mais itens no mesmo envio ou “Importar planilha” para trazer uma lista pronta. Campos em vermelho precisam ser corrigidos antes de enviar.',
  },
  {
    icon: Send,
    title: 'Envie e acompanhe',
    text: 'Clique em “Enviar solicitação”. Cada insumo vira uma solicitação que o analista de cadastro recebe; acompanhe a situação em “Acompanhamento”. Se o analista pedir ajuste, a solicitação volta para você corrigir e reenviar.',
  },
]

/** Aba da obra: apresentação do padrão de nomenclatura + passo a passo para pedir um insumo. */
export function InstructionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Obra"
        title="Instruções"
        description="Como descrever um insumo no padrão do Setor de Orçamentos e como pedir o cadastro pelo app."
        actions={
          <>
            <a href={MANUAL_PDF} download="Manual - Cadastro de Insumos.pdf">
              <Button icon={<FileDown className="size-4" />}>Baixar manual (PDF)</Button>
            </a>
            <Link to={PATHS.newRequest}>
              <Button variant="primary" icon={<Plus className="size-4" />}>
                Solicitar insumo
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-6">
        <ManualViewer />
        <Card>
          <CardHeader title="Como solicitar um insumo no app" description="Passo a passo da tela “Solicitar insumo”." />
          <ol className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <s.icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold tracking-wider text-primary uppercase">Passo {i + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-text">{s.title}</h3>
                <p className="text-sm leading-6 text-text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  )
}

/** Slide grande com navegação (botões, setas do teclado e miniaturas). */
function ManualViewer() {
  const [index, setIndex] = useState(0)
  const last = MANUAL_SLIDES.length - 1
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Padrão de nomenclatura"
        description="Manual do Setor de Orçamentos. Use as setas para passar os slides."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} disabled={index === 0} onClick={() => go(index - 1)} aria-label="Slide anterior" />
            <span className="min-w-14 text-center text-sm text-text-muted tabular-nums">
              {index + 1} / {MANUAL_SLIDES.length}
            </span>
            <Button size="sm" variant="ghost" icon={<ChevronRight className="size-4" />} disabled={index === last} onClick={() => go(index + 1)} aria-label="Próximo slide" />
          </div>
        }
      />
      <div className="bg-ink-100 p-3 sm:p-5">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-card shadow-md ring-1 ring-border">
          <ScaledSlide index={index} />
        </div>
      </div>
      <ol className="grid grid-cols-3 gap-3 border-t border-border px-4 py-3 sm:grid-cols-5 lg:grid-cols-9" aria-label="Slides do manual">
        {MANUAL_SLIDES.map((s, i) => (
          <li key={s.title} className="min-w-0">
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === index}
              className={cn('block w-full overflow-hidden rounded-md ring-2 transition', i === index ? 'ring-primary' : 'ring-transparent hover:ring-ink-300')}
            >
              <ScaledSlide index={i} className="pointer-events-none" />
            </button>
            <p className={cn('mt-1 truncate text-xs', i === index ? 'font-medium text-text' : 'text-text-muted')}>
              {i + 1}. {s.title}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
