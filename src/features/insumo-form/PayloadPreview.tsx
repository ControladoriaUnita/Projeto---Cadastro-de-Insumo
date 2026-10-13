import type { DraftPreviewDTO } from '@shared/contracts'
import { UAU_ROUTES } from '@shared/domain/insumo/uau-payload'
import { Card, CardHeader } from '@/components/ui'

/** JSON exato das duas chamadas que a aprovação fará no UAU. */
export function PayloadPreview({ preview }: { preview: DraftPreviewDTO | undefined }) {
  if (!preview) return null
  const steps = [
    { n: 1, title: 'Inserir (não confirmado)', route: UAU_ROUTES.insert, body: preview.insertBody },
    { n: 2, title: 'Mudar a situação para confirmado', route: UAU_ROUTES.updateStatus, body: preview.confirmBody },
  ]
  return (
    <Card>
      <CardHeader title="O que será gravado no UAU" description="Duas chamadas, nesta ordem, ao aprovar." />
      <div className="grid gap-3 px-5 py-4">
        {steps.map((s) => (
          <details key={s.n} open={s.n === 1}>
            <summary className="cursor-pointer text-sm font-medium text-text">
              {s.n}. {s.title}
              <span className="ml-2 font-normal text-text-muted">{s.route}</span>
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-control bg-ink-50 p-3 text-[11px] leading-4 text-ink-700">{JSON.stringify(s.body, null, 2)}</pre>
          </details>
        ))}
      </div>
    </Card>
  )
}
