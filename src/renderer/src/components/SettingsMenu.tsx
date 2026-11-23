import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShortcutKeyboardDialog } from './ShortcutKeyboardDialog'
import { useLanguage } from '../data/i18n'
import {
  formatShortcutBinding,
  keyboardShortcutActions,
  shortcutBindingFromEvent,
  useKeyboardShortcut,
  useKeyboardShortcuts
} from '../data/keyboardShortcuts'
import type { KeyboardShortcutActionId, ShortcutModifier } from '../data/keyboardShortcuts'

export function SettingsMenu({
  floating = false
}: {
  floating?: boolean
}): React.JSX.Element | null {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<'general' | 'shortcuts'>('general')
  const [shortcutSearch, setShortcutSearch] = useState('')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const keyboardTrigger = useRef<HTMLButtonElement>(null)
  const [recordingAction, setRecordingAction] = useState<KeyboardShortcutActionId | null>(null)
  const [shortcutMessage, setShortcutMessage] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const pendingModifiersRef = useRef<ShortcutModifier[]>([])
  const { bindings, assignBinding, resetBindings, setCaptureMode } = useKeyboardShortcuts()

  const closeMenu = (): void => {
    setOpen(false)
    setRecordingAction(null)
    setCaptureMode(false)
  }

  const toggleMenu = (): void => {
    if (open) {
      closeMenu()
    } else {
      setOpen(true)
    }
  }

  useKeyboardShortcut('settings.toggle', toggleMenu, !keyboardVisible)

  useEffect(() => {
    if (!open || keyboardVisible) return

    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        closeMenu()
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !recordingAction) closeMenu()
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, recordingAction, keyboardVisible])

  const handleSettingsTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const nextPanel = activePanel === 'general' ? 'shortcuts' : 'general'
    setActivePanel(nextPanel)
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-tab-${nextPanel}`)?.focus()
    })
  }

  const beginShortcutCapture = (actionId: KeyboardShortcutActionId): void => {
    pendingModifiersRef.current = []
    setRecordingAction(actionId)
    setCaptureMode(true)
    setShortcutMessage(
      t(
        'Presse une touche, ou combine-la avec un modificateur. Annuler et Effacer sont disponibles à côté.'
      )
    )
  }

  const handleShortcutCapture = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    actionId: KeyboardShortcutActionId
  ): void => {
    if (recordingAction !== actionId || event.key === 'Tab') return
    event.preventDefault()
    event.stopPropagation()
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
      const modifier = event.key as ShortcutModifier
      if (!pendingModifiersRef.current.includes(modifier)) {
        pendingModifiersRef.current = [...pendingModifiersRef.current, modifier]
      }
      setShortcutMessage(
        t(
          'Relâche cette touche pour l’utiliser seule, ou presse une autre touche pour créer une combinaison.'
        )
      )
      return
    }
    const displaced = assignBinding(actionId, shortcutBindingFromEvent(event.nativeEvent))
    pendingModifiersRef.current = []
    setRecordingAction(null)
    setCaptureMode(false)
    setShortcutMessage(
      displaced.length > 0
        ? t('Raccourci réattribué ; l’ancienne commande n’a plus de raccourci.')
        : t('Raccourci enregistré.')
    )
  }

  const cancelShortcutCapture = (): void => {
    pendingModifiersRef.current = []
    setRecordingAction(null)
    setCaptureMode(false)
    setShortcutMessage(t('Modification annulée.'))
  }

  const handleShortcutModifierRelease = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    actionId: KeyboardShortcutActionId
  ): void => {
    if (recordingAction !== actionId || !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key))
      return
    const modifier = event.key as ShortcutModifier
    if (!pendingModifiersRef.current.includes(modifier)) return
    if (pendingModifiersRef.current.length === 1) {
      const displaced = assignBinding(actionId, { key: modifier, modifiers: [] })
      setRecordingAction(null)
      setCaptureMode(false)
      setShortcutMessage(
        displaced.length > 0
          ? t('Raccourci réattribué ; l’ancienne commande n’a plus de raccourci.')
          : t('Raccourci enregistré.')
      )
    }
    pendingModifiersRef.current = pendingModifiersRef.current.filter((item) => item !== modifier)
  }

  const normalizedShortcutSearch = shortcutSearch.trim().toLocaleLowerCase()
  const filteredShortcutActions = keyboardShortcutActions.filter((action) =>
    `${t(action.category)} ${t(action.label)} ${formatShortcutBinding(bindings[action.id], t('Non attribué'))}`
      .toLocaleLowerCase()
      .includes(normalizedShortcutSearch)
  )

  if (typeof document === 'undefined') return null

  const menu = (
    <div className={`settings-menu-root${floating ? ' is-floating' : ''}`} ref={menuRef}>
      {floating && (
        <div className="settings-menu-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{t('Application locale')}</span>
        </div>
      )}
      <button
        className={`settings-menu-trigger${open ? ' is-open' : ''}`}
        type="button"
        data-shortcut-action="settings.toggle"
        aria-label={t('Paramètres')}
        aria-expanded={open}
        aria-controls="global-settings-menu"
        title={t('Paramètres')}
        onClick={toggleMenu}
      >
        <svg viewBox="0 0 24 24" fillRule="evenodd" aria-hidden="true">
          <path d="M19.14 12.94a7.8 7.8 0 0 0 .06-.94 7.8 7.8 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.49.49 0 0 0-.49-.42h-3.84a.49.49 0 0 0-.49.42L9.21 5.3a7.2 7.2 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.82a.5.5 0 0 0 .12.64l2.03 1.58a7.8 7.8 0 0 0-.06.96 7.8 7.8 0 0 0 .06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54c.03.24.24.42.49.42h3.84c.25 0 .46-.18.49-.42l.36-2.54a7.2 7.2 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
        </svg>
      </button>
      {open && (
        <section
          className={`settings-menu-popover${activePanel === 'shortcuts' ? ' is-shortcuts' : ''}`}
          id="global-settings-menu"
          aria-label={t('Paramètres')}
        >
          <h2>{activePanel === 'shortcuts' ? t('Raccourcis clavier') : t('Paramètres')}</h2>
          <div
            className="settings-menu-tabs"
            role="tablist"
            aria-label={t('Catégories de paramètres')}
          >
            <button
              id="settings-tab-general"
              type="button"
              role="tab"
              aria-selected={activePanel === 'general'}
              aria-controls="settings-panel-general"
              onClick={() => setActivePanel('general')}
              onKeyDown={handleSettingsTabKeyDown}
            >
              {t('Général')}
            </button>
            <button
              id="settings-tab-shortcuts"
              type="button"
              role="tab"
              aria-selected={activePanel === 'shortcuts'}
              aria-controls="settings-panel-shortcuts"
              onClick={() => setActivePanel('shortcuts')}
              onKeyDown={handleSettingsTabKeyDown}
            >
              {t('Raccourcis clavier')}
            </button>
          </div>
          {activePanel === 'general' ? (
            <div id="settings-panel-general" role="tabpanel" aria-labelledby="settings-tab-general">
              <label className="settings-language-field">
                <span>{t('Langue')}</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as typeof language)}
                  aria-label={t('Modifier la langue du logiciel')}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </label>
            </div>
          ) : (
            <div
              className="settings-shortcuts-panel"
              id="settings-panel-shortcuts"
              role="tabpanel"
              aria-labelledby="settings-tab-shortcuts"
            >
              <p className="settings-shortcuts-help">
                {t(
                  'Tabulation parcourt les commandes ; Entrée ou Espace les active. Dans une liste, utilise les flèches puis Entrée.'
                )}
                <br />
                {t(
                  'Sélectionne un raccourci au clavier, puis presse une touche ou une combinaison. Maj seule fonctionne aussi ; Tabulation permet d’annuler une capture.'
                )}
              </p>
              <button
                type="button"
                className="settings-shortcut-board-trigger"
                ref={keyboardTrigger}
                aria-haspopup="dialog"
                onClick={() => {
                  setRecordingAction(null)
                  pendingModifiersRef.current = []
                  setCaptureMode(false)
                  setKeyboardVisible(true)
                }}
              >
                <span aria-hidden="true">⌨</span> {t('Afficher le clavier')}
              </button>
              <input
                className="settings-shortcuts-search"
                type="search"
                value={shortcutSearch}
                onChange={(event) => setShortcutSearch(event.target.value)}
                placeholder={t('Rechercher une commande…')}
                aria-label={t('Rechercher une commande de raccourci')}
              />
              <div className="settings-shortcut-list">
                {filteredShortcutActions.map((action, index) => {
                  const isCapturing = recordingAction === action.id
                  const previousCategory = filteredShortcutActions[index - 1]?.category
                  return (
                    <div className="settings-shortcut-entry" key={action.id}>
                      {action.category !== previousCategory && <h3>{t(action.category)}</h3>}
                      <div className="settings-shortcut-row">
                        <span>{t(action.label)}</span>
                        <button
                          type="button"
                          className={`settings-shortcut-binding${isCapturing ? ' is-recording' : ''}`}
                          aria-pressed={isCapturing}
                          onClick={() => beginShortcutCapture(action.id)}
                          onKeyDown={(event) => handleShortcutCapture(event, action.id)}
                          onKeyUp={(event) => handleShortcutModifierRelease(event, action.id)}
                        >
                          {isCapturing
                            ? t('Appuie sur une touche…')
                            : formatShortcutBinding(bindings[action.id], t('Non attribué'))}
                        </button>
                        {isCapturing ? (
                          <button
                            className="settings-shortcut-action is-cancel"
                            type="button"
                            onClick={cancelShortcutCapture}
                          >
                            {t('Annuler')}
                          </button>
                        ) : (
                          <button
                            className="settings-shortcut-action is-clear"
                            type="button"
                            aria-label={`${t('Effacer le raccourci')} ${t(action.label)}`}
                            title={t('Effacer le raccourci')}
                            onClick={() => {
                              assignBinding(action.id, null)
                              setShortcutMessage(t('Raccourci supprimé.'))
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {filteredShortcutActions.length === 0 && (
                  <p className="settings-shortcuts-empty">{t('Aucune commande correspondante.')}</p>
                )}
              </div>
              <div className="settings-shortcuts-footer">
                <span role="status">{shortcutMessage}</span>
                <button
                  type="button"
                  onClick={() => {
                    resetBindings()
                    setRecordingAction(null)
                    setCaptureMode(false)
                    setShortcutMessage(t('Raccourcis par défaut restaurés.'))
                  }}
                >
                  {t('Restaurer les valeurs par défaut')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )

  return (
    <>
      {floating ? createPortal(menu, document.body) : menu}
      {keyboardVisible &&
        createPortal(
          <ShortcutKeyboardDialog
            onClose={() => {
              setKeyboardVisible(false)
              window.requestAnimationFrame(() => keyboardTrigger.current?.focus())
            }}
          />,
          document.body
        )}
    </>
  )
}
