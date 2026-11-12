import { useState } from 'react'
import WorldMap from './WorldMap'
import { getExplorationDetails, type ExplorationDetails } from '../data/geography/exploration'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import { useLanguage } from '../data/i18n'

type ExplorationViewProps = {
  onBack: () => void
}

export function ExplorationView({ onBack }: ExplorationViewProps): React.JSX.Element {
  const { t } = useLanguage()
  const [showBorders, setShowBorders] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<ExplorationDetails | null>(null)

  const handlePlaceSelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): void => {
    setSelectedPlace(getExplorationDetails(sourceFeatureId, name, entityId))
  }

  return (
    <div className="exploration-screen">
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
          <button className="home-back-button" type="button" onClick={onBack}>
            {t('← Accueil')}
          </button>
        </div>
      </header>

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
          </div>
        </section>

        <aside className="exploration-details-panel" aria-live="polite">
          <ExplorationPlaceDetails place={selectedPlace} />
        </aside>
      </main>
    </div>
  )
}
