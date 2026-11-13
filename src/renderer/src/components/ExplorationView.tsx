import { useState } from 'react'
import WorldMap from './WorldMap'
import { getExplorationDetails, type ExplorationDetails } from '../data/geography/exploration'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import { useLanguage } from '../data/i18n'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'
import { MapFullscreenBar } from './MapFullscreenBar'

type ExplorationViewProps = {
  globeMode: boolean
  onToggleGlobeMode: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenStatistics: () => void
  onModeChange: (mode: AppPrimaryMode) => void
}

export function ExplorationView({
  globeMode,
  onToggleGlobeMode,
  isFullscreen,
  onToggleFullscreen,
  onOpenStatistics,
  onModeChange
}: ExplorationViewProps): React.JSX.Element {
  const { t } = useLanguage()
  const [showBorders, setShowBorders] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showFlagTerritories, setShowFlagTerritories] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<ExplorationDetails | null>(null)

  const handlePlaceSelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): void => {
    setSelectedPlace(getExplorationDetails(sourceFeatureId, name, entityId))
  }

  return (
    <div className={`exploration-screen${isFullscreen ? ' map-fullscreen-screen exploration-map-fullscreen' : ''}`}>
      {isFullscreen && (
        <MapFullscreenBar
          title={t('Exploration')}
          onOpenStatistics={onOpenStatistics}
          onExit={onToggleFullscreen}
        />
      )}
      <header className="exploration-header">
        <div className="exploration-brand">
          <div className="brand-icon">W</div>
          <div>
            <div className="brand-name">WORLD ATLAS</div>
            <div className="brand-subtitle">{t('Exploration')}</div>
          </div>
        </div>

        <div className="exploration-heading">
          <div className="breadcrumb">{t('EXPLORATION / MONDE')}</div>
          <h1>{t('Explorer le monde')}</h1>
        </div>

        <div className="exploration-header-actions">
          <span className="status-dot" />
          <span className="status-text">{t('Application locale')}</span>
          <button className="home-back-button" type="button" onClick={onOpenStatistics}>
            {t('Statistiques')}
          </button>
          <button className="home-back-button" type="button" onClick={onToggleFullscreen}>
            {t(isFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
          </button>
        </div>
      </header>

      <AppModeSwitcher active="exploration" onChange={onModeChange} />

      <main className="exploration-workspace">
        <section className="exploration-map-panel" aria-label={t('Carte interactive')}>
          <div className="exploration-map-toolbar">
            <div>
              <div className="map-title">{t('Carte mondiale')}</div>
              <div className="map-subtitle">
                {t('Clique sur un pays ou un territoire pour afficher sa fiche.')}
              </div>
            </div>
          </div>

          <div className="exploration-map-frame">
            <WorldMap
              showBorders={showBorders}
              showLabels={showLabels}
              globeMode={globeMode}
              onToggleGlobeMode={onToggleGlobeMode}
              showFlagTerritories={showFlagTerritories}
              onCountrySelected={handlePlaceSelected}
              onCountryDeselected={() => setSelectedPlace(null)}
            />
          </div>

          <div className="exploration-layer-controls" aria-label={t('Affichage de la carte')}>
            <span className="settings-heading">{t('AFFICHAGE CARTOGRAPHIQUE')}</span>
            <label className="setting-item">
              <input
                type="checkbox"
                checked={showBorders}
                onChange={(event) => setShowBorders(event.target.checked)}
              />
              <span>{t('Frontières')}</span>
            </label>
            <label className="setting-item">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
              />
              <span>{t('Noms des pays')}</span>
            </label>
            <label
              className="setting-item"
              title={t('Intégrer le drapeau dans le contour des pays et territoires')}
            >
              <input
                type="checkbox"
                checked={showFlagTerritories}
                onChange={(event) => setShowFlagTerritories(event.target.checked)}
              />
              <span>{t('Drapeaux')}</span>
            </label>
          </div>
        </section>

        <aside
          className={`exploration-details-panel${selectedPlace ? ' has-selection' : ''}`}
          aria-live="polite"
        >
          <ExplorationPlaceDetails place={selectedPlace} />
        </aside>
      </main>
    </div>
  )
}
