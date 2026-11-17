import { useLanguage } from '../data/i18n'
import { useSkin } from '../data/skin'
import { SettingsMenu } from './SettingsMenu'

export type AppPrimaryMode = 'quiz' | 'exploration' | 'country-select' | 'comparator'

type AppModeSwitcherProps = {
  active: AppPrimaryMode | null
  onChange: (mode: AppPrimaryMode) => void
}

const modes: { id: AppPrimaryMode; label: string }[] = [
  { id: 'quiz', label: 'Quizz monde' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'country-select', label: 'Quiz pays' },
  { id: 'comparator', label: 'Comparateur' }
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

export function AppModeSwitcher({ active, onChange }: AppModeSwitcherProps): React.JSX.Element {
  const { t } = useLanguage()
  const { skin } = useSkin()
  const activeModeLabel = modes.find((mode) => mode.id === active)?.label ?? 'Navigation'
  const modeButtons = (
    <div className="app-mode-buttons">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={active === mode.id ? 'active' : undefined}
          type="button"
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
      className={`app-mode-switcher${skin === 'minimal' ? ' is-minimal' : skin === 'matrix' ? ' is-matrix' : ''}`}
      aria-label={t('Modes de l’application')}
    >
      {skin === 'minimal' ? (
        <details className="app-mode-menu">
          <summary>{t(activeModeLabel)}</summary>
          <div className="app-mode-menu-content">
            {modeButtons}
          </div>
        </details>
      ) : (
        <>
          {modeButtons}
        </>
      )}

      <div className="app-mode-system-controls">
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
