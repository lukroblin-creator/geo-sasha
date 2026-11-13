import { useLanguage } from '../data/i18n'

export type AppPrimaryMode = 'quiz' | 'exploration' | 'country-select'

type AppModeSwitcherProps = {
  active: AppPrimaryMode | null
  onChange: (mode: AppPrimaryMode) => void
}

const modes: { id: AppPrimaryMode; label: string }[] = [
  { id: 'quiz', label: 'Quiz' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'country-select', label: 'Quiz pays' }
]

export function AppModeSwitcher({ active, onChange }: AppModeSwitcherProps): React.JSX.Element {
  const { language, setLanguage, t } = useLanguage()

  return (
    <nav className="app-mode-switcher" aria-label={t('Modes de l’application')}>
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

      <label className="app-mode-language">
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
    </nav>
  )
}
