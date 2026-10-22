import { useCallback, useEffect, useState } from 'react'

/** Tela cheia do app inteiro; acompanha também saídas pelo Esc/F11 do navegador. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log('Erro fullscreen:', err)
      })
    } else {
      void document.exitFullscreen()
    }
  }, [])

  return { isFullscreen, toggleFullscreen, supported: document.fullscreenEnabled }
}
