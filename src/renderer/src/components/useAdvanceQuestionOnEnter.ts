import { useEffect } from 'react'

export function useAdvanceQuestionOnEnter(enabled: boolean, onNext: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('button, input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      onNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onNext])
}
