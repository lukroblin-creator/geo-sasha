import { useLanguage } from '../data/i18n'
import { SkinSelector } from './AppModeSwitcher'
import { SettingsMenu } from './SettingsMenu'

type MapFullscreenBarProps = {
  title: string
  onOpenStatistics: () => void
  onExit: () => void
  showSettings?: boolean
}

export function MapFullscreenBar({
  title,
  onOpenStatistics,
  onExit,
  showSettings = true
}: MapFullscreenBarProps): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <header className="map-fullscreen-bar">
      <strong>{title}</strong>
      <div className="map-fullscreen-bar-actions">
        <SkinSelector compact />
        {showSettings && <SettingsMenu />}
        <button
          className="map-fullscreen-action"
          type="button"
          data-shortcut-action="app.mode.statistics"
          onClick={onOpenStatistics}
        >
          {t('Statistiques')}
        </button>
        <button className="map-fullscreen-exit" type="button" onClick={onExit}>
          {t('Quitter le plein écran')}
        </button>
      </div>
    </header>
  )
}
