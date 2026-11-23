import { useEffect } from 'react'
import { useKeyboardShortcut, useKeyboardShortcuts } from '../data/keyboardShortcuts'

export function useAdvanceQuestionOnEnter(enabled: boolean, onNext: () => void): void {
  useKeyboardShortcut('quiz.nextQuestion', onNext, enabled)
  const { hasActiveBinding } = useKeyboardShortcuts()
  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Enter' ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        hasActiveBinding(event)
      )
        return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        target?.closest(
          'dialog[open], [role="dialog"], button, input, textarea, select, [contenteditable="true"]'
        )
      )
        return
      event.preventDefault()
      onNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, hasActiveBinding, onNext])
}
