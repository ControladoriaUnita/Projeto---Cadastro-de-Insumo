import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Search } from 'lucide-react'
import { fold } from '@shared/domain/insumo/text'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface FilterOption {
  value: string
  count: number
}

interface Props {
  label: string
  options: FilterOption[]
  /** Valores marcados; null = sem filtro (todos) */
  selected: string[] | null
  onChange: (selected: string[] | null) => void
}

const WIDTH = 288

/** Filtro de coluna como o do Excel: busca, "Selecionar tudo" e uma caixa por valor. */
export function ColumnFilter({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const active = selected !== null

  const visible = useMemo(() => {
    const terms = fold(text).split(/\s+/).filter(Boolean)
    if (!terms.length) return options
    return options.filter((o) => {
      const f = fold(o.value)
      return terms.every((t) => f.includes(t))
    })
  }, [options, text])

  const openPanel = () => {
    setDraft(new Set(selected ?? options.map((o) => o.value)))
    setText('')
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) => t instanceof Node && (panelRef.current?.contains(t) || buttonRef.current?.contains(t))
    const onDown = (e: MouseEvent) => !inside(e.target) && setOpen(false)
    const onScroll = (e: Event) => !inside(e.target) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const visibleChecked = visible.filter((o) => draft.has(o.value)).length
  const allVisible = visible.length > 0 && visibleChecked === visible.length

  const toggle = (value: string) =>
    setDraft((d) => {
      const next = new Set(d)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })

  const toggleAll = () =>
    setDraft((d) => {
      const next = new Set(d)
      for (const o of visible) {
        if (allVisible) next.delete(o.value)
        else next.add(o.value)
      }
      return next
    })

  const apply = () => {
    // Com busca, vale só o que está visível e marcado (como no Excel)
    const chosen = (text.trim() ? visible : options).filter((o) => draft.has(o.value)).map((o) => o.value)
    onChange(chosen.length === options.length ? null : chosen)
    setOpen(false)
  }

  const chosenCount = (text.trim() ? visible : options).filter((o) => draft.has(o.value)).length

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        title={active ? `Filtrando ${label.toLowerCase()} (${selected?.length ?? 0})` : `Filtrar ${label.toLowerCase()}`}
        aria-label={`Filtrar coluna ${label}`}
        aria-expanded={open}
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-ink-200',
          active ? 'bg-primary-soft text-primary' : 'text-ink-400',
        )}
      >
        <Filter className={cn('size-3.5', active && 'fill-current')} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Filtro da coluna ${label}`}
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="fixed z-50 rounded-control border border-border bg-surface text-sm font-normal text-text shadow-lg"
          >
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && chosenCount > 0 && apply()}
                  placeholder="Pesquisar"
                  aria-label={`Pesquisar valores de ${label}`}
                  className="h-8 w-full rounded-control border border-border bg-surface pr-2 pl-8 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {visible.length ? (
                <>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-ink-50">
                    <input
                      type="checkbox"
                      checked={allVisible}
                      ref={(el) => {
                        if (el) el.indeterminate = visibleChecked > 0 && !allVisible
                      }}
                      onChange={toggleAll}
                      className="accent-primary"
                    />
                    <span className="font-medium">{text.trim() ? '(Selecionar todos os resultados)' : '(Selecionar tudo)'}</span>
                  </label>
                  {visible.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-ink-50">
                      <input type="checkbox" checked={draft.has(o.value)} onChange={() => toggle(o.value)} className="accent-primary" />
                      <span className="min-w-0 flex-1 truncate" title={o.value}>
                        {o.value}
                      </span>
                      <span className="tabular text-xs text-text-muted">{o.count}</span>
                    </label>
                  ))}
                </>
              ) : (
                <p className="px-3 py-2 text-text-muted">Nenhum valor encontrado.</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border p-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!active}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                Limpar filtro
              </Button>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" disabled={chosenCount === 0} onClick={apply}>
                  OK
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
