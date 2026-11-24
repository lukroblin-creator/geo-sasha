import { useState } from 'react'
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
  autoReveal?: boolean
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
  autoReveal = false
}: AppModeSwitcherProps): React.JSX.Element {
  const { t } = useLanguage()
  const { skin } = useSkin()
  const [manuallyRevealed, setManuallyRevealed] = useState(false)
  const modeButtons = (
    <div className="app-mode-buttons">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={active === mode.id ? 'active' : undefined}
          type="button"
          data-shortcut-action={mode.shortcutAction}
          aria-current={active === mode.id ? 'page' : undefined}
          onClick={() => onChange(mode.id)}
        >
          {t(mode.label)}
        </button>
      ))}
    </div>
  )
  return (
    <nav
      className={`app-mode-switcher${skin === 'minimal' ? ' is-minimal' : skin === 'matrix' ? ' is-matrix' : ''}${autoReveal ? ' is-auto-reveal' : ''}${manuallyRevealed ? ' is-manually-revealed' : ''}`}
      aria-label={t('Modes de l’application')}
    >
      {autoReveal && (
        <button
          className="app-mode-reveal"
          type="button"
          aria-expanded={manuallyRevealed}
          onClick={() => setManuallyRevealed((shown) => !shown)}
        >
          {t('Navigation')}
        </button>
      )}
      <div className="app-mode-primary">
        <details
          className="app-mode-menu"
          onMouseEnter={(event) => {
            event.currentTarget.open = true
          }}
          onMouseLeave={(event) => {
            if (!event.currentTarget.matches(':focus-within')) event.currentTarget.open = false
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              event.currentTarget.open = false
            }
          }}
        >
          <summary
            aria-label={t('Navigation')}
            onFocus={(event) => {
              const menu = event.currentTarget.closest('details')
              if (menu) menu.open = true
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
