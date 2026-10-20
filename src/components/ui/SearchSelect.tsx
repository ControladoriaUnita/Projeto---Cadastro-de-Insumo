import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { fold } from '@shared/domain/insumo/text'
import { cn } from '@/utils/cn'
import { controlClass } from './Input'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  /** Mostra um "x" para limpar (ex.: filtro "Todas as obras") */
  clearable?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const MAX_SHOWN = 100

/** Lista de seleção em que se digita para filtrar (sem acento, qualquer parte do nome). */
export function SearchSelect({ value, onChange, options, placeholder, clearable, disabled, className, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const terms = fold(text).split(/\s+/).filter(Boolean)
    if (!terms.length) return options
    return options.filter((o) => {
      const f = fold(o)
      return terms.every((t) => f.includes(t))
    })
  }, [options, text])
  const shown = filtered.slice(0, MAX_SHOWN)

  useEffect(() => setActive(0), [text])
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (option: string) => {
    onChange(option)
    setOpen(false)
    setText('')
  }

  return (
    <div className={cn('relative', className)}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        className={cn(controlClass, 'h-10 pr-14', !open && value && 'placeholder:text-text')}
        // Fechado mostra a opção escolhida; aberto mostra o que se está digitando
        value={open ? text : value}
        placeholder={open && value ? value : placeholder}
        disabled={disabled}
        onFocus={(e) => {
          setOpen(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setOpen(false)
          setText('')
        }}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(i + 1, shown.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && open && shown[active]) {
            e.preventDefault()
            pick(shown[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
            setText('')
          }
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-ink-400">
        {clearable && value && !disabled && (
          <button
            type="button"
            className="pointer-events-auto rounded p-0.5 hover:bg-ink-100 hover:text-text"
            aria-label="Limpar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick('')}
          >
            <X className="size-4" />
          </button>
        )}
        <ChevronDown className="size-4" aria-hidden />
      </div>
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-control border border-border bg-surface py-1 text-sm shadow-lg"
        >
          {shown.length === 0 && <li className="px-3 py-2 text-text-muted">Nenhuma opção encontrada</li>}
          {shown.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              className={cn('cursor-pointer px-3 py-2 text-text', i === active && 'bg-ink-50', o === value && 'font-medium text-primary')}
              // mousedown para escolher antes do blur fechar a lista
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {o}
            </li>
          ))}
          {filtered.length > MAX_SHOWN && (
            <li className="px-3 py-2 text-xs text-text-muted">Mais {filtered.length - MAX_SHOWN} opções: continue digitando para filtrar.</li>
          )}
        </ul>
      )}
    </div>
  )
}
