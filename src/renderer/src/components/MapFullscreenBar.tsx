import { useLanguage } from '../data/i18n'

type MapFullscreenBarProps = {
  title: string
  onOpenStatistics: () => void
  onExit: () => void
}

export function MapFullscreenBar({
  title,
  onOpenStatistics,
  onExit
}: MapFullscreenBarProps): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <header className="map-fullscreen-bar">
      <strong>{title}</strong>
      <div className="map-fullscreen-bar-actions">
        <button className="map-fullscreen-action" type="button" onClick={onOpenStatistics}>
          {t('Statistiques')}
        </button>
        <button className="map-fullscreen-exit" type="button" onClick={onExit}>
          {t('Quitter le plein écran')}
        </button>
      </div>
    </header>
  )
}
