import { useMemo, useState } from 'react'
import WorldMap from './WorldMap'
import countryCatalog from '../data/quiz/countryCatalog.json'
import { getFlagImageSource } from '../data/quiz/flagAssets'
import { useLanguage } from '../data/i18n'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'
import { MapFullscreenBar } from './MapFullscreenBar'

type CountryQuizSelectionViewProps = {
  globeMode: boolean
  onToggleGlobeMode: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenStatistics: () => void
  onStart: (alpha2: string) => void
  onModeChange: (mode: AppPrimaryMode) => void
}

export function CountryQuizSelectionView({
  onStart,
  onModeChange,
  globeMode,
  onToggleGlobeMode,
  isFullscreen,
  onToggleFullscreen,
  onOpenStatistics
}: CountryQuizSelectionViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [selectedAlpha2, setSelectedAlpha2] = useState<string | null>(null)
  const countries = useMemo(() => {
    const countryNames = new Intl.DisplayNames([language], { type: 'region' })
    return countryCatalog
      .map((country) => ({
        alpha2: country.alpha2,
        name: countryNames.of(country.alpha2) ?? country.countryName,
        sourceFeatureId: country.sourceFeatureId
      }))
      .sort((first, second) => first.name.localeCompare(second.name, language))
  }, [language])
  const selectedCountry = countries.find((country) => country.alpha2 === selectedAlpha2)

  return (
    <main className={`country-quiz-selection-screen${isFullscreen ? ' map-fullscreen-screen country-select-map-fullscreen' : ''}`}>
      {isFullscreen && (
        <MapFullscreenBar
          title={t('Quiz pays')}
          onOpenStatistics={onOpenStatistics}
          onExit={onToggleFullscreen}
        />
      )}
      <header className="statistics-header">
        <div>
          <div className="breadcrumb">{t('APPRENTISSAGE / QUIZ PAYS')}</div>
          <h1>{t('Choisir un pays à travailler')}</h1>
          <p>{t('Utilise la recherche ou sélectionne un pays sur la carte.')}</p>
        </div>
        <div className="statistics-actions">
          <button className="home-back-button" type="button" onClick={onOpenStatistics}>
            {t('Statistiques')}
          </button>
          <button className="home-back-button" type="button" onClick={onToggleFullscreen}>
            {t('Plein écran')}
          </button>
        </div>
      </header>

      <AppModeSwitcher active="country-select" onChange={onModeChange} />

      <div className="country-quiz-selection-content">
        <section className="country-quiz-selection-map">
          <WorldMap
            showBorders
            showLabels
            globeMode={globeMode}
            onToggleGlobeMode={onToggleGlobeMode}
            onCountrySelected={(sourceFeatureId) => {
              const country = countries.find(
                (item) => item.sourceFeatureId === Number(sourceFeatureId)
              )
              if (country) setSelectedAlpha2(country.alpha2)
            }}
            onCountryDeselected={() => setSelectedAlpha2(null)}
          />
        </section>

        <aside className={`country-quiz-selection-card${selectedCountry ? ' is-selected' : ''}`}>
          <div className="section-label">{t('Quiz pays')}</div>
          {selectedCountry ? (
            <>
              <img
                className="country-quiz-selection-flag"
                src={getFlagImageSource(selectedCountry.alpha2)}
                alt={`${t('Drapeau de')} ${selectedCountry.name}`}
              />
              <h2>{selectedCountry.name}</h2>
              <p>
                {t('Réponds à des questions mélangées sur sa capitale, ses grandes villes, ses montagnes et son continent. Les questions de relief apparaissent lorsque les données locales en proposent.')}
              </p>
              <button
                className="quiz-start-button"
                type="button"
                onClick={() => onStart(selectedCountry.alpha2)}
              >
                {t('Commencer le quiz pays')}
              </button>
            </>
          ) : (
            <div className="statistics-empty-selection">
              <h2>{t('Sélectionne un pays')}</h2>
              <p>{t('Les 195 pays du quiz sont disponibles.')}</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
