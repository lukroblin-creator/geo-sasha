import { useState } from 'react'
import WorldMap from './WorldMap'
import countryCatalog from '../data/quiz/countryCatalog.json'
import { getFlagImageSource } from '../data/quiz/flagAssets'

type CountryQuizSelectionViewProps = {
  onBack: () => void
  onStart: (alpha2: string) => void
}

type SelectableCountry = {
  alpha2: string
  name: string
  sourceFeatureId: number
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })
const countries: SelectableCountry[] = countryCatalog
  .map((country) => ({
    alpha2: country.alpha2,
    name: countryNames.of(country.alpha2) ?? country.countryName,
    sourceFeatureId: country.sourceFeatureId
  }))
  .sort((first, second) => first.name.localeCompare(second.name, 'fr'))

export function CountryQuizSelectionView({
  onBack,
  onStart
}: CountryQuizSelectionViewProps): React.JSX.Element {
  const [selectedAlpha2, setSelectedAlpha2] = useState<string | null>(null)
  const selectedCountry = countries.find((country) => country.alpha2 === selectedAlpha2)

  return (
    <main className="country-quiz-selection-screen">
      <header className="statistics-header">
        <div>
          <div className="breadcrumb">APPRENTISSAGE / QUIZ PAYS</div>
          <h1>Choisis un pays à travailler</h1>
          <p>Utilise la recherche ou sélectionne un pays sur la carte.</p>
        </div>
        <button className="home-back-button" type="button" onClick={onBack}>← Accueil</button>
      </header>

      <div className="country-quiz-selection-content">
        <section className="country-quiz-selection-map">
          <WorldMap
            showBorders
            showLabels
            onCountrySelected={(sourceFeatureId) => {
              const country = countries.find(
                (item) => item.sourceFeatureId === Number(sourceFeatureId)
              )
              if (country) setSelectedAlpha2(country.alpha2)
            }}
          />
        </section>

        <aside className="country-quiz-selection-card">
          <div className="section-label">QUIZ PAYS</div>
          {selectedCountry ? (
            <>
              <img
                className="country-quiz-selection-flag"
                src={getFlagImageSource(selectedCountry.alpha2)}
                alt={`Drapeau de ${selectedCountry.name}`}
              />
              <h2>{selectedCountry.name}</h2>
              <p>
                Une partie dédiée à ce pays utilise les indices et les réponses
                choisis dans le contenu du quiz.
              </p>
              <button
                className="quiz-start-button"
                type="button"
                onClick={() => onStart(selectedCountry.alpha2)}
              >
                Commencer le quiz pays
              </button>
            </>
          ) : (
            <div className="statistics-empty-selection">
              <h2>Sélectionne un pays</h2>
              <p>Les 195 pays du quiz sont disponibles.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
