import { useState } from 'react'
import WorldMap from './WorldMap'
import { getExplorationDetails, type ExplorationDetails } from '../data/geography/exploration'
import { getFlagImageSource } from '../data/quiz/flagAssets'

type ExplorationViewProps = {
  onBack: () => void
}

export function ExplorationView({ onBack }: ExplorationViewProps): React.JSX.Element {
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
            <div className="brand-subtitle">EXPLORATION</div>
          </div>
        </div>

        <div className="exploration-heading">
          <div className="breadcrumb">EXPLORATION / MONDE</div>
          <h1>Explorer le monde</h1>
        </div>

        <div className="exploration-header-actions">
          <span className="status-dot" />
          <span className="status-text">Application locale</span>
          <button className="home-back-button" type="button" onClick={onBack}>
            ← Accueil
          </button>
        </div>
      </header>

      <main className="exploration-workspace">
        <section className="exploration-map-panel" aria-label="Carte interactive">
          <div className="exploration-map-toolbar">
            <div>
              <div className="map-title">Carte mondiale</div>
              <div className="map-subtitle">
                Clique sur un pays ou un territoire pour afficher sa fiche.
              </div>
            </div>
          </div>

          <div className="exploration-map-frame">
            <WorldMap
              showBorders={showBorders}
              showLabels={showLabels}
              onCountrySelected={handlePlaceSelected}
            />
          </div>

          <div className="exploration-layer-controls" aria-label="Affichage de la carte">
            <span className="settings-heading">AFFICHAGE CARTOGRAPHIQUE</span>
            <label className="setting-item">
              <input
                type="checkbox"
                checked={showBorders}
                onChange={(event) => setShowBorders(event.target.checked)}
              />
              <span>Frontières</span>
            </label>
            <label className="setting-item">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
              />
              <span>Noms des pays</span>
            </label>
          </div>
        </section>

        <aside className="exploration-details-panel" aria-live="polite">
          <div className="exploration-details-eyebrow">FICHE GÉOGRAPHIQUE</div>
          {selectedPlace ? (
            <>
              <h2>{selectedPlace.name}</h2>
              {selectedPlace.isTerritory && selectedPlace.sovereignName && (
                <p className="exploration-place-kind">
                  Territoire de {selectedPlace.sovereignName}
                </p>
              )}

              {selectedPlace.flagAlpha2 ? (
                <div className="exploration-flag-card">
                  <img
                    src={getFlagImageSource(selectedPlace.flagAlpha2)}
                    alt={`Drapeau de ${selectedPlace.flagName}`}
                  />
                  <span>Drapeau de {selectedPlace.flagName}</span>
                </div>
              ) : (
                <div className="exploration-missing-flag">Drapeau non disponible</div>
              )}

              <dl className="exploration-facts">
                <div>
                  <dt>Capitale</dt>
                  <dd>{selectedPlace.capital ?? 'Non renseignée'}</dd>
                </div>
                <div>
                  <dt>Continent</dt>
                  <dd>{selectedPlace.continent ?? 'Non renseigné'}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="exploration-empty-state">
              <span aria-hidden="true">⌖</span>
              <p>
                Sélectionne un pays sur la carte pour découvrir son drapeau, sa capitale et son
                continent.
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
