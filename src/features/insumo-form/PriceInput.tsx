import { useEffect, useState } from 'react'
import { Input } from '@/components/ui'
import { formatDecimal, parseDecimalBR } from '@/utils/format'

interface Props {
  /** Valor canônico ("1234.56") ou vazio */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  'aria-describedby'?: string
}

/** Preço em pt-BR sem float: aceita "1.234,56" ou "R$ 150", mostra formatado fora do foco. */
export function PriceInput({ value, onChange, disabled, ...aria }: Props) {
  const display = (v: string) => (v ? formatDecimal(v) : '')
  const [text, setText] = useState(display(value))
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!focused) setText(display(value))
  }, [value, focused])

  return (
    <Input
      {...aria}
      inputMode="decimal"
      placeholder="0,00"
      className="tabular text-right"
      value={text}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        if (!text.trim()) {
          setInvalid(false)
          return onChange('')
        }
        const parsed = parseDecimalBR(text)
        setInvalid(parsed === null || parsed.startsWith('-'))
        if (parsed !== null && !parsed.startsWith('-')) onChange(parsed)
      }}
    />
  )
}
