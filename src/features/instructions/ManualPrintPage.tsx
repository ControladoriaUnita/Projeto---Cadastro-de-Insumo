import { MANUAL_SLIDES, SLIDE_HEIGHT, SLIDE_WIDTH, renderSlide } from './ManualDeck'

/**
 * Todos os slides do manual, um por página, para gerar o PDF (scripts/build-manual-pdf.mjs).
 * Rota pública: o conteúdo é o mesmo do PDF que qualquer pessoa pode baixar.
 */
export function ManualPrintPage() {
  return (
    <>
      <style>{`@page { size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px; margin: 0 } html, body { background: white }`}</style>
      {MANUAL_SLIDES.map((s, i) => (
        <section key={s.title} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, breakAfter: 'page', overflow: 'hidden' }}>
          {renderSlide(i)}
        </section>
      ))}
    </>
  )
}
