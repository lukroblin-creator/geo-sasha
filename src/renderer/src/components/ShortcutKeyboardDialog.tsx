import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../data/i18n'
import {
  formatShortcutBinding,
  keyboardShortcutActions,
  shortcutBindingFromEvent,
  useKeyboardShortcuts
} from '../data/keyboardShortcuts'
import type { KeyboardShortcutActionId, ShortcutModifier } from '../data/keyboardShortcuts'
import { shortcutMatchesKey } from '../data/shortcutKeys'
import {
  keyboardKeyPair,
  keyboardRows,
  keyLegends,
  keypadRows,
  navigationRows,
  optionCharacter
} from './shortcutKeyboardLayout'
import type { KeyboardLayoutName } from './shortcutKeyboardLayout'
import '../assets/shortcutKeyboard.css'

const modifierButtons = [
  { key: 'Meta', label: '⌘ Cmd' },
  { key: 'Alt', label: '⌥ Option' },
  { key: 'Control', label: '⌃ Ctrl' },
  { key: 'Shift', label: '⇧ Shift' }
] as const
const keyCodes = [...keyboardRows.flat(), ...navigationRows.flat(), ...keypadRows.flat()]
const layoutPreference = 'world-atlas:visual-keyboard-layout'

function initialLayout(language: string): KeyboardLayoutName {
  try {
    const saved = localStorage.getItem(layoutPreference)
    if (saved === 'AZERTY' || saved === 'QWERTY') return saved
  } catch {
    /* Storage can be unavailable when opening the app. */
  }
  return language === 'fr' ? 'AZERTY' : 'QWERTY'
}

type InspectedKey = {
  base: string
  shifted: string
  label: string
  key: string
  layer: ShortcutModifier[]
  actions: (typeof keyboardShortcutActions)[number][]
}

export function ShortcutKeyboardDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t, language } = useLanguage()
  const { bindings, assignBinding, setCaptureMode } = useKeyboardShortcuts()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [layout, setLayout] = useState<KeyboardLayoutName>(() => initialLayout(language))
  const [pinned, setPinned] = useState<ShortcutModifier[]>([])
  const [held, setHeld] = useState<ShortcutModifier[]>([])
  const modifiers = modifierButtons
    .map((item) => item.key)
    .filter((key) => pinned.includes(key) || held.includes(key))
  const [selectedCode, setSelectedCode] = useState('KeyC')
  const [focusCode, setFocusCode] = useState('KeyC')
  const [recordingAction, setRecordingAction] = useState<KeyboardShortcutActionId | null>(null)
  const [captureMessage, setCaptureMessage] = useState('')
  const shift = modifiers.includes('Shift')
  const isSoloModifier = (key: string): boolean => modifierButtons.some((item) => item.key === key)
  const sameLayer = (
    keys: readonly ShortcutModifier[],
    filter: readonly ShortcutModifier[]
  ): boolean => keys.length === filter.length && keys.every((key) => filter.includes(key))

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    setCaptureMode(true)
    const syncHeld = (event: KeyboardEvent): void => {
      const keys = modifierButtons
        .filter(({ key }) => event.getModifierState(key))
        .map(({ key }) => key)
      setHeld((current) =>
        current.length === keys.length && keys.every((key) => current.includes(key))
          ? current
          : keys
      )
    }
    const clearHeld = (): void => setHeld([])
    window.addEventListener('keydown', syncHeld, true)
    window.addEventListener('keyup', syncHeld, true)
    window.addEventListener('blur', clearHeld)
    return () => {
      window.removeEventListener('keydown', syncHeld, true)
      window.removeEventListener('keyup', syncHeld, true)
      window.removeEventListener('blur', clearHeld)
      element.close()
      setCaptureMode(false)
    }
  }, [setCaptureMode])

  const inspect = (code: string): InspectedKey => {
    const [base, shifted] = keyboardKeyPair(code, layout)
    const key =
      modifiers.includes('Alt') && /^Digit[0-9]$/.test(code)
        ? code.slice(-1)
        : shift
          ? shifted
          : base
    const label = keyLegends[key] ?? key.toLocaleUpperCase()
    // With Shift held, the Shift key itself still refers to a standalone Shift assignment.
    const layer = isSoloModifier(base) ? modifiers.filter((mod) => mod !== base) : modifiers
    const eventKey = modifiers.includes('Alt') ? (optionCharacter(code, layout, shift) ?? key) : key
    const actions = keyboardShortcutActions.filter(({ id }) => {
      const binding = bindings[id]
      return binding && shortcutMatchesKey(binding, code, eventKey, layer, base)
    })
    return { base, shifted, label, key, layer, actions }
  }
  const selected = inspect(selectedCode)
  const selectedBinding = formatShortcutBinding({ key: selected.key, modifiers: selected.layer })
  const layerActions = keyboardShortcutActions.filter(({ id }) => {
    const binding = bindings[id]
    return binding && sameLayer(binding.modifiers, modifiers)
  })

  const navigateKeys = (event: React.KeyboardEvent<HTMLButtonElement>, code: string): void => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1]
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    const from = event.currentTarget.getBoundingClientRect()
    const [x, y] = direction
    let destination: HTMLButtonElement | undefined
    let best = Infinity
    for (const button of dialog.current?.querySelectorAll<HTMLButtonElement>('[data-key-code]') ??
      []) {
      if (button.dataset.keyCode === code) continue
      const rect = button.getBoundingClientRect()
      const dx = (rect.left + rect.right - from.left - from.right) / 2
      const dy = (rect.top + rect.bottom - from.top - from.bottom) / 2
      const forward = dx * x + dy * y
      const across = Math.abs(dx * y - dy * x)
      if (forward < 1 || across > forward) continue
      const score = forward + across * 4
      if (score < best) {
        best = score
        destination = button
      }
    }
    destination?.focus()
  }

  const renderRows = (rows: string[][]): React.JSX.Element[] =>
    rows.map((row, index) => (
      <div className="shortcut-board-row" key={row[0]} data-row={index}>
        {row
          .filter((code) => code !== 'IntlBackslash' || layout === 'AZERTY')
          .map((code) => {
            const { actions, label, base, shifted } = inspect(code)
            const status = actions.length ? t('Touche attribuée') : t('Touche libre')
            const other = label === shifted.toLocaleUpperCase() ? base : shifted
            const sublabel =
              base !== shifted && base.toLocaleUpperCase() !== shifted.toLocaleUpperCase()
                ? other
                : ''
            const keyName = keyLegends[base] && base !== 'Space' ? base : label
            return (
              <button
                type="button"
                className="shortcut-board-key"
                key={code}
                data-key-code={code}
                data-assigned={actions.length > 0}
                tabIndex={code === focusCode ? 0 : -1}
                aria-pressed={code === selectedCode}
                aria-label={keyName + ' · ' + status}
                title={
                  keyName + ' · ' + (actions.map((action) => t(action.label)).join(' / ') || status)
                }
                onFocus={() => {
                  setFocusCode(code)
                  setSelectedCode(code)
                }}
                onClick={() => {
                  setFocusCode(code)
                  setSelectedCode(code)
                }}
                onKeyDown={(event) => navigateKeys(event, code)}
              >
                <span>{label}</span>
                {sublabel && <small aria-hidden="true">{sublabel}</small>}
                {actions.length > 0 && <i aria-hidden="true" />}
              </button>
            )
          })}
      </div>
    ))
  return (
    <dialog
      ref={dialog}
      className="shortcut-board"
      data-shortcut-dialog=""
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDownCapture={(event) => {
        if (recordingAction) {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setRecordingAction(null)
            setCaptureMessage(t('Modification annulée.'))
            return
          }
          if (event.key === 'Tab' || isSoloModifier(event.key)) return
          event.preventDefault()
          event.stopPropagation()
          const displaced = assignBinding(
            recordingAction,
            shortcutBindingFromEvent(event.nativeEvent)
          )
          setRecordingAction(null)
          setSelectedCode(event.code)
          setCaptureMessage(
            displaced.length
              ? t('Raccourci enregistré. Les commandes en conflit ont été libérées.')
              : t('Raccourci enregistré.')
          )
          return
        }
        const command = event.ctrlKey || event.altKey || event.metaKey
        if (!command && (!event.shiftKey || event.key === 'Tab')) return
        if (isSoloModifier(event.key) || !keyCodes.includes(event.code)) return
        event.preventDefault()
        event.stopPropagation()
        setSelectedCode(event.code)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        }
        if (
          !['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(
            event.key
          ) &&
          keyCodes.includes(event.code) &&
          event.target instanceof HTMLElement &&
          event.target.tagName !== 'SELECT'
        ) {
          event.preventDefault()
          setSelectedCode(event.code)
        }
        event.stopPropagation()
      }}
      onKeyUp={(event) => {
        if (recordingAction && isSoloModifier(event.key)) {
          const displaced = assignBinding(recordingAction, {
            key: event.key,
            modifiers: []
          })
          setRecordingAction(null)
          setCaptureMessage(
            displaced.length
              ? t('Raccourci enregistré. Les commandes en conflit ont été libérées.')
              : t('Raccourci enregistré.')
          )
        }
        event.stopPropagation()
      }}
    >
      <div className="shortcut-board-body">
        <header className="shortcut-board-header">
          <h2 id={titleId}>{t('Clavier des raccourcis')}</h2>
          <button
            type="button"
            autoFocus
            aria-label={t('Fermer')}
            title={t('Fermer')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="shortcut-board-toolbar">
          <div className="shortcut-board-modifiers" role="group" aria-label={t('Modificateurs')}>
            <button type="button" aria-pressed={!modifiers.length} onClick={() => setPinned([])}>
              {t('Sans modificateur')}
            </button>
            {modifierButtons.map(({ key, label }) => (
              <button
                type="button"
                aria-pressed={modifiers.includes(key)}
                key={key}
                onClick={() =>
                  setPinned((current) =>
                    current.includes(key) ? current.filter((mod) => mod !== key) : [...current, key]
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label={t('Disposition du clavier')}
            value={layout}
            onChange={(event) => {
              const value = event.target.value as KeyboardLayoutName
              setLayout(value)
              try {
                localStorage.setItem(layoutPreference, value)
              } catch {
                /* Keep this choice for this window. */
              }
            }}
          >
            <option value="AZERTY">AZERTY · FR</option>
            <option value="QWERTY">QWERTY · US</option>
          </select>
        </div>
        <p className="shortcut-board-help">
          {t(
            'Maintiens ou active les modificateurs pour afficher leurs combinaisons. Sélectionne une touche pour voir ses commandes.'
          )}
        </p>
        <div className="shortcut-board-scroll">
          <div className="shortcut-board-geometry">
            <div className="shortcut-board-main">{renderRows(keyboardRows)}</div>
            <div className="shortcut-board-navigation">{renderRows(navigationRows)}</div>
            <div className="shortcut-board-keypad" role="group" aria-label={t('Pavé numérique')}>
              {renderRows(keypadRows)}
            </div>
          </div>
        </div>
        <div className="shortcut-board-legend">
          <span>
            <i />
            {t('Touche libre')}
          </span>
          <span>
            <i className="assigned" />
            {t('Touche attribuée')}
          </span>
          <small>{t('Seuls les raccourcis configurables sont affichés.')}</small>
        </div>
        <div className="shortcut-board-details">
          <section aria-live="polite">
            <h3>{t('Touche sélectionnée')}</h3>
            <kbd>{selectedBinding}</kbd>
            {captureMessage && <p role="status">{captureMessage}</p>}
            {recordingAction && (
              <p className="shortcut-board-capture-status" role="status">
                {t('Appuie sur la nouvelle touche ou combinaison. Échap annule.')}
              </p>
            )}
            {selected.actions.length > 0 ? (
              <ul>
                {selected.actions.map((action) => (
                  <li key={action.id}>
                    <span>
                      {t(action.label)} <small>{t(action.category)}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordingAction(action.id)
                        setCaptureMessage('')
                        setCaptureMode(true)
                      }}
                    >
                      {t(recordingAction === action.id ? 'Écoute…' : 'Modifier')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('Touche libre')}</p>
            )}
          </section>
          <section>
            <h3>
              {t('Combinaisons attribuées')} <span>{layerActions.length}</span>
            </h3>
            <ul className="shortcut-board-commands">
              {layerActions.map((action) => (
                <li key={action.id}>
                  <span>{t(action.label)}</span>
                  <kbd>{formatShortcutBinding(bindings[action.id])}</kbd>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingAction(action.id)
                      setCaptureMessage('')
                      setCaptureMode(true)
                    }}
                  >
                    {t(recordingAction === action.id ? 'Écoute…' : 'Modifier')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </dialog>
  )
}
