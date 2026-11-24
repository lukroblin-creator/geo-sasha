import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../data/i18n'
import type { KeyboardShortcutActionId } from '../data/keyboardShortcuts'
import { useSkin } from '../data/skin'
import { SettingsMenu } from './SettingsMenu'

export type AppPrimaryMode = 'quiz' | 'exploration' | 'country-select' | 'comparator'

type AppModeSwitcherProps = {
  active: AppPrimaryMode | null
  onChange: (mode: AppPrimaryMode) => void
  pageTitle?: string
  onOpenStatistics?: () => void
  onToggleFullscreen?: () => void
  pageActions?: ReactNode
  collapsible?: boolean
}

const modes: {
  id: AppPrimaryMode
  label: string
  shortcutAction: KeyboardShortcutActionId
}[] = [
  { id: 'quiz', label: 'Quizz monde', shortcutAction: 'app.mode.quiz' },
  { id: 'exploration', label: 'Exploration', shortcutAction: 'app.mode.exploration' },
  { id: 'country-select', label: 'Quiz pays', shortcutAction: 'app.mode.countryQuiz' },
  { id: 'comparator', label: 'Comparateur', shortcutAction: 'app.mode.comparator' }
]

export function SkinSelector({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { t } = useLanguage()
  const { skin, setSkin } = useSkin()

  return (
    <label
      className={`app-mode-skin${compact ? ' app-mode-skin-compact' : ''}`}
      title={t('Choisir l’apparence du logiciel')}
    >
      <span>{t('Skin')}</span>
      <select
        value={skin}
        onChange={(event) => setSkin(event.target.value as typeof skin)}
        aria-label={t('Choisir l’apparence du logiciel')}
      >
        <option value="gpt">GPT</option>
        <option value="minimal">Minimal</option>
        <option value="matrix">Matrix</option>
      </select>
    </label>
  )
}

export function AppModeSwitcher({
  active,
  onChange,
  pageTitle,
  onOpenStatistics,
  onToggleFullscreen,
  pageActions,
  collapsible = false
}: AppModeSwitcherProps): React.JSX.Element {
  const { t } = useLanguage()
  const { skin } = useSkin()
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPinned, setMenuPinned] = useState(false)
  const menuRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!menuOpen || !menuPinned) return

    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
        setMenuPinned(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setMenuPinned(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen, menuPinned])

  const closeMenu = (): void => {
    setMenuOpen(false)
    setMenuPinned(false)
  }

  const modeButtons = (
    <div className="app-mode-buttons">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={active === mode.id ? 'active' : undefined}
          type="button"
          data-shortcut-action={mode.shortcutAction}
          aria-current={active === mode.id ? 'page' : undefined}
          onClick={() => {
            closeMenu()
            onChange(mode.id)
          }}
        >
          {t(mode.label)}
        </button>
      ))}
    </div>
  )
  return (
    <nav
      className={`app-mode-switcher${skin === 'minimal' ? ' is-minimal' : skin === 'matrix' ? ' is-matrix' : ''}${collapsible ? ' is-collapsible' : ''}${toolbarCollapsed ? ' is-collapsed' : ''}`}
      aria-label={t('Modes de l’application')}
    >
      {collapsible && (
        <button
          className="app-mode-collapse"
          type="button"
          aria-label={t(toolbarCollapsed ? 'Déplier la barre supérieure' : 'Replier la barre supérieure')}
          title={t(toolbarCollapsed ? 'Déplier la barre supérieure' : 'Replier la barre supérieure')}
          aria-expanded={!toolbarCollapsed}
          onClick={() => setToolbarCollapsed((collapsed) => !collapsed)}
        >
          <span aria-hidden="true">{toolbarCollapsed ? '⌄' : '⌃'}</span>
        </button>
      )}
      <div className="app-mode-primary">
        <details
          className="app-mode-menu"
          ref={menuRef}
          open={menuOpen}
          onMouseEnter={() => {
            if (!menuPinned) setMenuOpen(true)
          }}
          onMouseLeave={() => {
            if (!menuPinned) setMenuOpen(false)
          }}
          onBlur={(event) => {
            if (!menuPinned && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setMenuOpen(false)
            }
          }}
        >
          <summary
            aria-label={t('Navigation')}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.preventDefault()
              const nextOpen = !menuPinned
              setMenuPinned(nextOpen)
              setMenuOpen(nextOpen)
            }}
            onFocus={() => {
              if (!menuPinned) setMenuOpen(true)
            }}
          >
            {t('Navigation')} <span aria-hidden="true">⌄</span>
          </summary>
          <div className="app-mode-menu-content">{modeButtons}</div>
        </details>
        {pageTitle && <h1 className="app-mode-page-title">{pageTitle}</h1>}
      </div>

      <div className="app-mode-system-controls">
        {onOpenStatistics && (
          <button
            className="app-mode-statistics"
            type="button"
            data-shortcut-action="app.mode.statistics"
            onClick={onOpenStatistics}
          >
            {t('Statistiques')}
          </button>
        )}
        {onToggleFullscreen && (
          <button className="app-mode-fullscreen" type="button" onClick={onToggleFullscreen}>
            {t('Plein écran')}
          </button>
        )}
        {pageActions}
        <div className="app-mode-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{t('Application locale')}</span>
        </div>
        <SkinSelector />
        <SettingsMenu />
      </div>
    </nav>
  )
}
