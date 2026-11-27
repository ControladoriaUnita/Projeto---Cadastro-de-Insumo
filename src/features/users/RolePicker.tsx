import { ROLE_DESCRIPTIONS } from '@shared/domain/access'
import { ROLE_LABELS, type RoleKey } from '@shared/domain/roles'
import type { Tone } from '@/components/ui'
import { cn } from '@/utils/cn'

export const ROLE_TONES: Record<RoleKey, Tone> = { gestor: 'primary', analista: 'info', obra: 'neutral' }
export const ROLES: RoleKey[] = ['obra', 'analista', 'gestor']

/** Escolha do papel com a descrição do que cada um faz. */
export function RolePicker({ value, onChange, disabled }: { value: RoleKey; onChange: (r: RoleKey) => void; disabled?: (r: RoleKey) => boolean }) {
  return (
    <div role="radiogroup" aria-label="Papel" className="grid gap-2">
      {ROLES.map((r) => {
        const off = disabled?.(r) ?? false
        const selected = value === r
        return (
          <label
            key={r}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 transition-colors',
              selected ? 'border-primary bg-primary-soft' : 'border-border hover:bg-ink-50',
              off && 'cursor-not-allowed opacity-50',
            )}
          >
            <input type="radio" name="role" className="mt-0.5 accent-primary" checked={selected} disabled={off} onChange={() => onChange(r)} />
            <span>
              <span className="block text-sm font-medium text-text">{ROLE_LABELS[r]}</span>
              <span className="block text-xs text-text-muted">{ROLE_DESCRIPTIONS[r]}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
