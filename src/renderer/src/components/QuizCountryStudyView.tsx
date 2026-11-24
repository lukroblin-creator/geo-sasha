import { useRef, useState } from 'react'
import WorldMap from './WorldMapLoader'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import {
  getExplorationDetailsForTerritory,
  type ExplorationDetails
} from '../data/geography/exploration'
import { useLanguage } from '../data/i18n'
import { MapFullscreenBar } from './MapFullscreenBar'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'

type QuizCountryStudyViewProps = {
  place: ExplorationDetails
  sourceFeatureId: string | number
  globeMode: boolean
  onToggleGlobeMode: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenStatistics: () => void
  onModeChange: (mode: AppPrimaryMode) => void
  onReturnToQuiz: () => void
}

export function QuizCountryStudyView({
  place,
  sourceFeatureId,
  globeMode,
  onToggleGlobeMode,
  isFullscreen,
  onToggleFullscreen,
  onOpenStatistics,
  onModeChange,
  onReturnToQuiz
}: QuizCountryStudyViewProps): React.JSX.Element {
  const { t } = useLanguage()
  const [selectedPlace, setSelectedPlace] = useState(place)
  const [focusEntityRequest, setFocusEntityRequest] = useState<{
    entityId: string
    sequence: number
  } | null>(null)
  const focusSequenceRef = useRef(0)

  const handleTerritorySelected = (entityId: string): void => {
    const territoryDetails = getExplorationDetailsForTerritory(entityId)
    if (!territoryDetails) return

    setSelectedPlace(territoryDetails)
    focusSequenceRef.current += 1
    setFocusEntityRequest({ entityId, sequence: focusSequenceRef.current })
  }

  return (
    <div
      className={`exploration-screen quiz-country-study-screen${isFullscreen ? ' map-fullscreen-screen quiz-study-map-fullscreen' : ''}`}
    >
      {isFullscreen && (
        <MapFullscreenBar
          title={selectedPlace.name}
          onOpenStatistics={onOpenStatistics}
          onExit={onToggleFullscreen}
          showSettings={false}
        />
      )}
      {!isFullscreen && (
        <AppModeSwitcher
          active="quiz"
          onChange={onModeChange}
          pageTitle={`${t('Découvrir')} ${selectedPlace.name}`}
          onOpenStatistics={onOpenStatistics}
          onToggleFullscreen={onToggleFullscreen}
          collapsible
          pageActions={
            <button className="app-mode-statistics" type="button" onClick={onReturnToQuiz}>
              {t('← Retour au quiz')}
            </button>
          }
        />
      )}

      <main className="exploration-workspace">
        <section
          className="exploration-map-panel"
          aria-label={`${t('Carte')} ${selectedPlace.name}`}
        >
          <div className="exploration-map-toolbar">
            <div>
              <div className="map-title">{t('Carte mondiale')}</div>
              <div className="map-subtitle">
                {t('Le pays révélé est sélectionné sur la carte.')}
              </div>
            </div>
          </div>

          <div className="exploration-map-frame">
            <WorldMap
              showBorders
              showLabels={false}
              globeMode={globeMode}
              onToggleGlobeMode={onToggleGlobeMode}
              quizTargetFeatureId={sourceFeatureId}
              focusEntityRequest={focusEntityRequest}
              interactionResetKey={`quiz-study:${sourceFeatureId}`}
            />
          </div>
        </section>

        <aside className="exploration-details-panel" aria-live="polite">
          <ExplorationPlaceDetails
            place={selectedPlace}
            showExtended
            onSelectTerritory={handleTerritorySelected}
          />
        </aside>
      </main>
    </div>
  )
}
