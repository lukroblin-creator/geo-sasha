import WorldMap from './WorldMap'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import type { ExplorationDetails } from '../data/geography/exploration'
import { useLanguage } from '../data/i18n'

type QuizCountryStudyViewProps = {
  place: ExplorationDetails
  sourceFeatureId: string | number
  onReturnToQuiz: () => void
}

export function QuizCountryStudyView({
  place,
  sourceFeatureId,
  onReturnToQuiz
}: QuizCountryStudyViewProps): React.JSX.Element {
  const { t } = useLanguage()
  return (
    <div className="exploration-screen quiz-country-study-screen">
      <header className="exploration-header">
        <div className="exploration-brand">
          <div className="brand-icon">W</div>
          <div>
            <div className="brand-name">WORLD ATLAS</div>
            <div className="brand-subtitle">{t('APPRENTISSAGE')}</div>
          </div>
        </div>

        <div className="exploration-heading">
          <div className="breadcrumb">{t('APPRENTISSAGE / QUIZ')}</div>
          <h1>{t('Découvrir')} {place.name}</h1>
        </div>

        <div className="exploration-header-actions">
          <button
            className="quiz-study-return-button"
            type="button"
            onClick={onReturnToQuiz}
          >
            {t('← Retour au quiz')}
          </button>
        </div>
      </header>

      <main className="exploration-workspace">
        <section className="exploration-map-panel" aria-label={`${t('Carte')} ${place.name}`}>
          <div className="exploration-map-toolbar">
            <div>
              <div className="map-title">{t('Carte mondiale')}</div>
              <div className="map-subtitle">{t('Le pays révélé est sélectionné sur la carte.')}</div>
            </div>
          </div>

          <div className="exploration-map-frame">
            <WorldMap
              showBorders
              showLabels={false}
              quizTargetFeatureId={sourceFeatureId}
              interactionResetKey={`quiz-study:${sourceFeatureId}`}
            />
          </div>
        </section>

        <aside className="exploration-details-panel" aria-live="polite">
          <ExplorationPlaceDetails place={place} />
        </aside>
      </main>
    </div>
  )
}
