/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  captureShortcut,
  equivalentShortcuts,
  eventModifiers,
  isShortcutModifier,
  normalizeShortcutKey,
  shortcutMatchesKey,
  type KeyboardShortcutBinding,
  type ShortcutModifier
} from './shortcutKeys'

export type { KeyboardShortcutBinding, ShortcutModifier } from './shortcutKeys'

export const keyboardShortcutActions = [
  {
    id: 'app.mode.quiz',
    category: 'Navigation',
    label: 'Ouvrir Quizz monde',
    key: '1',
    modifiers: ['Alt']
  },
  {
    id: 'app.mode.exploration',
    category: 'Navigation',
    label: 'Ouvrir Exploration',
    key: '2',
    modifiers: ['Alt']
  },
  {
    id: 'app.mode.countryQuiz',
    category: 'Navigation',
    label: 'Ouvrir Quiz pays',
    key: '3',
    modifiers: ['Alt']
  },
  {
    id: 'app.mode.comparator',
    category: 'Navigation',
    label: 'Ouvrir Comparateur',
    key: '4',
    modifiers: ['Alt']
  },
  {
    id: 'app.mode.statistics',
    category: 'Navigation',
    label: 'Ouvrir Statistiques',
    key: '5',
    modifiers: ['Alt']
  },
  {
    id: 'settings.toggle',
    category: 'Navigation',
    label: 'Ouvrir ou fermer les paramètres',
    key: ',',
    modifiers: ['Meta']
  },
  {
    id: 'navigation.focusSearch',
    category: 'Navigation',
    label: 'Rechercher dans la vue',
    key: 'f',
    modifiers: ['Control']
  },
  {
    id: 'map.zoomIn',
    category: 'Carte et caméra',
    label: 'Zoom avant',
    key: '+',
    modifiers: ['Shift']
  },
  {
    id: 'map.zoomOut',
    category: 'Carte et caméra',
    label: 'Zoom arrière',
    key: '-',
    modifiers: []
  },
  {
    id: 'map.magnifier',
    category: 'Carte et caméra',
    label: 'Activer la loupe en la maintenant',
    key: 'Shift',
    modifiers: [],
    trigger: 'hold'
  },
  {
    id: 'map.cycleNearbyTerritories',
    category: 'Carte et caméra',
    label: 'Parcourir les petits territoires proches',
    key: 'Alt',
    modifiers: []
  },
  {
    id: 'map.toggleGlobe',
    category: 'Carte et caméra',
    label: 'Basculer plan et globe',
    key: 'g',
    modifiers: []
  },
  {
    id: 'map.panTool',
    category: 'Carte et caméra',
    label: 'Activer le déplacement de la carte',
    key: 'd',
    modifiers: []
  },
  {
    id: 'map.selectionCursor',
    category: 'Carte et caméra',
    label: 'Activer le curseur de sélection',
    key: 'c',
    modifiers: []
  },
  {
    id: 'map.toggleCameraOrbit',
    category: 'Carte et caméra',
    label: 'Basculer la caméra orbitale',
    key: 'o',
    modifiers: []
  },
  {
    id: 'map.toggleCameraControls',
    category: 'Carte et caméra',
    label: 'Afficher les commandes caméra',
    key: 'c',
    modifiers: ['Shift']
  },
  {
    id: 'map.recenterCameraAnchor',
    category: 'Carte et caméra',
    label: 'Recentrer l’ancrage sur la Terre',
    key: '0',
    modifiers: ['Alt']
  },
  {
    id: 'map.toggleLayerControls',
    category: 'Carte et caméra',
    label: 'Afficher les options cartographiques',
    key: 'l',
    modifiers: ['Alt']
  },
  {
    id: 'map.addMask',
    category: 'Masques',
    label: 'Ajouter un masque d’opacité',
    key: 'Enter',
    modifiers: ['Control']
  },
  {
    id: 'map.editMask',
    category: 'Masques',
    label: 'Modifier le masque',
    key: 'Enter',
    modifiers: ['Alt']
  },
  {
    id: 'map.placeMaskAtCenter',
    category: 'Masques',
    label: 'Placer un masque au centre de la carte',
    key: 'Enter',
    modifiers: ['Shift']
  },
  {
    id: 'map.confirmMaskSelection',
    category: 'Masques',
    label: 'Confirmer les territoires du masque',
    key: 'Enter',
    modifiers: ['Alt']
  },
  {
    id: 'quiz.stop',
    category: 'Quiz',
    label: 'Arrêter la partie',
    key: 'q',
    modifiers: ['Alt']
  },
  {
    id: 'quiz.restart',
    category: 'Quiz',
    label: 'Rejouer le quiz',
    key: 'r',
    modifiers: ['Alt']
  },
  {
    id: 'quiz.focusAnswer',
    category: 'Quiz',
    label: 'Revenir au champ de réponse',
    key: 'f',
    modifiers: ['Alt']
  },
  {
    id: 'quiz.verify',
    category: 'Quiz',
    label: 'Vérifier les réponses',
    key: 'Enter',
    modifiers: ['Control']
  },
  {
    id: 'quiz.nextQuestion',
    category: 'Quiz',
    label: 'Passer à la question suivante',
    key: 'n',
    modifiers: []
  },
  { id: 'quiz.revealAnswer', category: 'Quiz', label: 'Voir la réponse', key: 'r', modifiers: [] },
  {
    id: 'comparator.addSuggestion',
    category: 'Comparateur',
    label: 'Ajouter le pays suggéré',
    key: 'Enter',
    modifiers: ['Meta']
  }
] as const

export type KeyboardShortcutActionId = (typeof keyboardShortcutActions)[number]['id']

type KeyboardShortcutContextValue = {
  bindings: Record<KeyboardShortcutActionId, KeyboardShortcutBinding | null>
  assignBinding: (
    actionId: KeyboardShortcutActionId,
    binding: KeyboardShortcutBinding | null
  ) => KeyboardShortcutActionId[]
  resetBindings: () => void
  registerHandler: (
    actionId: KeyboardShortcutActionId,
    handler: (event: KeyboardEvent) => void,
    onRelease?: (event: KeyboardEvent) => void
  ) => () => void
  hasActiveBinding: (event: KeyboardEvent) => boolean
  setCaptureMode: (active: boolean) => void
}

const STORAGE_KEY = 'world-atlas:keyboard-shortcuts:v1'
const defaultBindings = Object.fromEntries(
  keyboardShortcutActions.map((action) => [
    action.id,
    { key: action.key, modifiers: [...action.modifiers] }
  ])
) as Record<KeyboardShortcutActionId, KeyboardShortcutBinding>

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | null>(null)

type ShortcutContext = 'quiz' | 'comparator' | 'exploration' | 'placingMask'

function shortcutContexts(id: KeyboardShortcutActionId): readonly ShortcutContext[] {
  if (id === 'map.magnifier' || id === 'map.cycleNearbyTerritories')
    return ['quiz', 'comparator', 'exploration', 'placingMask']
  if (id.startsWith('quiz.')) return ['quiz']
  if (id.startsWith('comparator.')) return ['comparator']
  if (id === 'map.addMask' || id === 'map.editMask') return ['exploration']
  if (id === 'map.placeMaskAtCenter' || id === 'map.confirmMaskSelection') return ['placingMask']
  if (id === 'map.toggleGlobe' || id === 'map.zoomIn' || id === 'map.zoomOut') {
    return ['quiz', 'exploration', 'placingMask', 'comparator']
  }
  if (id.startsWith('map.')) return ['exploration', 'placingMask']
  return ['quiz', 'comparator', 'exploration', 'placingMask']
}

function shareContext(a: KeyboardShortcutActionId, b: KeyboardShortcutActionId): boolean {
  const contexts = shortcutContexts(a)
  return shortcutContexts(b).some((context) => contexts.includes(context))
}

function readStoredBindings(): Record<KeyboardShortcutActionId, KeyboardShortcutBinding | null> {
  const bindings = { ...defaultBindings } as Record<
    KeyboardShortcutActionId,
    KeyboardShortcutBinding | null
  >
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return bindings
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return bindings

    const restored: KeyboardShortcutActionId[] = []
    for (const action of keyboardShortcutActions) {
      const value = (parsed as Record<string, unknown>)[action.id]
      if (value === null) {
        bindings[action.id] = null
      } else if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as KeyboardShortcutBinding).key === 'string' &&
        Array.isArray((value as KeyboardShortcutBinding).modifiers) &&
        (value as KeyboardShortcutBinding).modifiers.every((modifier) =>
          ['Meta', 'Control', 'Alt', 'Shift'].includes(modifier)
        )
      ) {
        const saved = value as KeyboardShortcutBinding
        bindings[action.id] = {
          key: normalizeShortcutKey(saved.key),
          modifiers: [...new Set(saved.modifiers)],
          ...(typeof saved.code === 'string' && saved.code ? { code: saved.code } : {})
        }
        restored.push(action.id)
      }
    }
    // A new default must never displace a player's existing shortcut after an update.
    const orderedIds = [...new Set([...restored, ...keyboardShortcutActions.map(({ id }) => id)])]
    const kept: KeyboardShortcutActionId[] = []
    for (const id of orderedIds) {
      if (!bindings[id]) continue
      if (
        kept.some(
          (other) => shareContext(id, other) && equivalentShortcuts(bindings[id], bindings[other])
        )
      ) {
        bindings[id] = null
      } else {
        kept.push(id)
      }
    }
  } catch {
    // Use defaults when saved key bindings are unreadable.
  }
  return bindings
}

// Electron exposes the active OS keyboard layout in Chromium. Keep a fallback
// for environments where the keyboard API is unavailable.
type LayoutMap = { get: (code: string) => string | undefined }
type LayoutKeyboard = Partial<EventTarget> & { getLayoutMap?: () => Promise<LayoutMap> }
let keyboardLayout: LayoutMap | undefined

export function shortcutBindingFromEvent(event: KeyboardEvent): KeyboardShortcutBinding {
  return captureShortcut(event, keyboardLayout?.get(event.code))
}

export function keyboardShortcutMatchesEvent(
  event: KeyboardEvent,
  binding: KeyboardShortcutBinding | null | undefined
): boolean {
  return shortcutMatchesKey(
    binding,
    event.code,
    event.key,
    eventModifiers(event),
    keyboardLayout?.get(event.code)
  )
}

export function formatShortcutBinding(
  binding: KeyboardShortcutBinding | null,
  unassignedLabel = 'Non attribué'
): string {
  if (!binding) return unassignedLabel
  const modifierLabels: Record<ShortcutModifier, string> = {
    Meta: '⌘',
    Control: 'Ctrl',
    Alt: '⌥',
    Shift: '⇧'
  }
  const modifiers = ['Control', 'Alt', 'Shift', 'Meta'] as const
  const parts = modifiers
    .filter((modifier) => binding.modifiers.includes(modifier))
    .map((modifier) => modifierLabels[modifier])
  parts.push(
    binding.key === 'Escape'
      ? 'Échap'
      : binding.key === 'Enter'
        ? 'Entrée'
        : binding.key === 'Space'
          ? 'Espace'
          : binding.key === 'Alt'
            ? '⌥'
          : binding.key === 'Shift'
            ? '⇧'
            : binding.key.toLocaleUpperCase()
  )
  return parts.join(' + ')
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

export function KeyboardShortcutProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [bindings, setBindings] = useState(readStoredBindings)
  const [captureMode, setCaptureModeState] = useState(false)
  const bindingsRef = useRef(bindings)
  const captureModeRef = useRef(captureMode)
  const handlersRef = useRef(
    new Map<
      KeyboardShortcutActionId,
      Set<{
        handler: (event: KeyboardEvent) => void
        onRelease?: (event: KeyboardEvent) => void
      }>
    >()
  )

  useEffect(() => {
    bindingsRef.current = bindings
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
    } catch {
      // Keep the current bindings active until the application closes.
    }
  }, [bindings])

  const registerHandler = useCallback(
    (
      actionId: KeyboardShortcutActionId,
      handler: (event: KeyboardEvent) => void,
      onRelease?: (event: KeyboardEvent) => void
    ) => {
      const handlers = handlersRef.current.get(actionId) ?? new Set()
      const registered = { handler, onRelease }
      handlers.add(registered)
      handlersRef.current.set(actionId, handlers)
      return () => {
        handlers.delete(registered)
        if (handlers.size === 0) handlersRef.current.delete(actionId)
      }
    },
    []
  )

  const assignBinding = useCallback(
    (actionId: KeyboardShortcutActionId, binding: KeyboardShortcutBinding | null) => {
      const next = { ...bindingsRef.current }
      const displaced = keyboardShortcutActions
        .filter(
          (action) =>
            action.id !== actionId &&
            shareContext(action.id, actionId) &&
            equivalentShortcuts(next[action.id], binding)
        )
        .map((action) => action.id)
      displaced.forEach((id) => {
        next[id] = null
      })
      next[actionId] = binding
      bindingsRef.current = next
      setBindings(next)
      return displaced
    },
    []
  )

  const resetBindings = useCallback(() => {
    const next = { ...defaultBindings } as Record<
      KeyboardShortcutActionId,
      KeyboardShortcutBinding | null
    >
    bindingsRef.current = next
    setBindings(next)
  }, [])

  const setCaptureMode = useCallback((active: boolean) => {
    captureModeRef.current = active
    setCaptureModeState(active)
  }, [])

  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: LayoutKeyboard }).keyboard
    if (!keyboard?.getLayoutMap) return
    let revision = 0
    const refresh = (): void => {
      const current = ++revision
      void keyboard
        .getLayoutMap?.()
        .then((layout) => {
          if (current === revision) keyboardLayout = layout
        })
        .catch(() => undefined)
    }
    refresh()
    window.addEventListener('focus', refresh)
    keyboard.addEventListener?.('layoutchange', refresh)
    return () => {
      revision++
      window.removeEventListener('focus', refresh)
      keyboard.removeEventListener?.('layoutchange', refresh)
    }
  }, [])

  const findActiveAction = useCallback((event: KeyboardEvent) => {
    if (captureModeRef.current || event.isComposing || event.defaultPrevented) return
    if (
      event.target instanceof Element &&
      event.target.closest('[data-shortcut-dialog],dialog[open]')
    )
      return
    const modifiers = eventModifiers(event)
    if (
      isTextEditingTarget(event.target) &&
      !(event.key === 'Shift' && !event.metaKey && !event.ctrlKey && !event.altKey) &&
      !modifiers.some((modifier) => modifier !== 'Shift')
    )
      return
    const baseKey = keyboardLayout?.get(event.code)
    return keyboardShortcutActions.find(
      ({ id }) =>
        handlersRef.current.get(id)?.size &&
        shortcutMatchesKey(bindingsRef.current[id], event.code, event.key, modifiers, baseKey)
    )
  }, [])
  const hasActiveBinding = useCallback(
    (event: KeyboardEvent) => Boolean(findActiveAction(event)),
    [findActiveAction]
  )

  useEffect(() => {
    let pendingModifier: string | null = null
    let heldAction: { actionId: KeyboardShortcutActionId; key: string; code: string } | null = null
    const cancelModifier = (): void => {
      pendingModifier = null
    }
    const dispatchShortcut = (
      event: KeyboardEvent,
      actionId?: KeyboardShortcutActionId,
      phase: 'trigger' | 'release' = 'trigger'
    ): void => {
      const action = actionId
        ? keyboardShortcutActions.find((candidate) => candidate.id === actionId)
        : findActiveAction(event)
      if (!action) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const handlers = handlersRef.current.get(action.id)
      // The same command may appear in a panel and its fullscreen variant.
      const callbacks = handlers ? [...handlers] : []
      const callback = callbacks[callbacks.length - 1]
      if (phase === 'release') callback?.onRelease?.(event)
      else callback?.handler(event)
    }
    const keyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return
      cancelModifier()
      if (isShortcutModifier(event.key)) {
        const action = findActiveAction(event)
        if (action && 'trigger' in action && action.trigger === 'hold') {
          dispatchShortcut(event, action.id)
          heldAction = { actionId: action.id, key: event.key, code: event.code }
          return
        }
        if (hasActiveBinding(event)) pendingModifier = event.key
        return
      }
      const action = findActiveAction(event)
      if (action && 'trigger' in action && action.trigger === 'hold') {
        dispatchShortcut(event, action.id)
        heldAction = { actionId: action.id, key: event.key, code: event.code }
        return
      }
      dispatchShortcut(event)
    }
    const keyUp = (event: KeyboardEvent): void => {
      if (heldAction && (event.code === heldAction.code || event.key === heldAction.key)) {
        const released = heldAction
        heldAction = null
        dispatchShortcut(event, released.actionId, 'release')
        cancelModifier()
        return
      }
      if (event.key === pendingModifier) dispatchShortcut(event)
      cancelModifier()
    }
    const blur = (): void => {
      cancelModifier()
      if (!heldAction) return
      const released = heldAction
      heldAction = null
      dispatchShortcut(
        new KeyboardEvent('keyup', { key: released.key, code: released.code }),
        released.actionId,
        'release'
      )
    }
    window.addEventListener('keydown', keyDown, true)
    window.addEventListener('keyup', keyUp, true)
    window.addEventListener('pointerdown', cancelModifier, true)
    window.addEventListener('wheel', cancelModifier, { capture: true, passive: true })
    window.addEventListener('blur', blur)
    return () => {
      blur()
      window.removeEventListener('keydown', keyDown, true)
      window.removeEventListener('keyup', keyUp, true)
      window.removeEventListener('pointerdown', cancelModifier, true)
      window.removeEventListener('wheel', cancelModifier, true)
      window.removeEventListener('blur', blur)
    }
  }, [findActiveAction, hasActiveBinding])

  const value = useMemo(
    () => ({
      bindings,
      assignBinding,
      resetBindings,
      registerHandler,
      setCaptureMode,
      hasActiveBinding
    }),
    [bindings, assignBinding, resetBindings, registerHandler, setCaptureMode, hasActiveBinding]
  )
  return (
    <KeyboardShortcutContext.Provider value={value}>{children}</KeyboardShortcutContext.Provider>
  )
}

export function useKeyboardShortcuts(): KeyboardShortcutContextValue {
  const context = useContext(KeyboardShortcutContext)
  if (!context) throw new Error('useKeyboardShortcuts must be used inside KeyboardShortcutProvider')
  return context
}

export function useKeyboardShortcut(
  actionId: KeyboardShortcutActionId,
  handler: (event: KeyboardEvent) => void,
  enabled = true
): void {
  const { registerHandler } = useKeyboardShortcuts()
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])
  useEffect(() => {
    if (!enabled) return
    return registerHandler(actionId, (event) => handlerRef.current(event))
  }, [actionId, enabled, registerHandler])
}

export function useHeldKeyboardShortcut(
  actionId: KeyboardShortcutActionId,
  handler: (event: KeyboardEvent) => void,
  onRelease: (event: KeyboardEvent) => void,
  enabled = true
): void {
  const { registerHandler } = useKeyboardShortcuts()
  const handlerRef = useRef(handler)
  const releaseRef = useRef(onRelease)
  useEffect(() => {
    handlerRef.current = handler
    releaseRef.current = onRelease
  }, [handler, onRelease])
  useEffect(() => {
    if (!enabled) return
    return registerHandler(
      actionId,
      (event) => handlerRef.current(event),
      (event) => releaseRef.current(event)
    )
  }, [actionId, enabled, registerHandler])
}
