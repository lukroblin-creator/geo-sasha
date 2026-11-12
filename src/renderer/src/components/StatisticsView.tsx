import { useMemo, useState } from 'react'
import WorldMap from './WorldMap'
import countryCatalog from '../data/quiz/countryCatalog.json'
import {
  getContinentLabelForCountry,
  quizRegions,
  type QuizRegion
} from '../data/quiz/countryContinents'
import type { QuizMode, QuizProgress } from '../data/quiz/progress'
import type { CountryQuizStatsByAlpha2 } from '../data/quiz/countryQuizStats'

type StatisticsViewProps = {
  countryStats: CountryQuizStatsByAlpha2
  quizProgress: QuizProgress
  onBack: () => void
  onOpenQuiz: () => void
  onOpenCountryQuiz: (alpha2: string) => void
}

type CountryRow = {
  alpha2: string
  sourceFeatureId: number
  name: string
  continent: string
  answered: number
  correct: number
  rate: number | null
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })
const modeLabels: Record<QuizMode, string> = {
  flags: 'Drapeaux',
  capitals: 'Capitales',
  custom: 'Quiz personnalisé',
  knowledge: 'Quiz pays'
}
const quizModes: QuizMode[] = ['flags', 'capitals', 'custom', 'knowledge']

function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`
}

function getCountryRows(stats: CountryQuizStatsByAlpha2): CountryRow[] {
  return countryCatalog.map((country) => {
    const countryStats = stats[country.alpha2]
    const answered = countryStats?.answered ?? 0
    const correct = countryStats?.correct ?? 0
    return {
      alpha2: country.alpha2,
      sourceFeatureId: country.sourceFeatureId,
      name: countryNames.of(country.alpha2) ?? country.countryName,
      continent: getContinentLabelForCountry(country.alpha2) ?? 'Autre',
      answered,
      correct,
      rate: answered ? correct / answered : null
    }
  })
}

export function StatisticsView({
  countryStats,
  quizProgress,
  onBack,
  onOpenQuiz,
  onOpenCountryQuiz
}: StatisticsViewProps): React.JSX.Element {
  const [selectedAlpha2, setSelectedAlpha2] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<QuizRegion | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'lowest' | 'highest'>('lowest')

  const rows = useMemo(() => getCountryRows(countryStats), [countryStats])
  const playedRows = rows.filter((country) => country.answered > 0)
  const totalAnswered = playedRows.reduce((sum, country) => sum + country.answered, 0)
  const totalCorrect = playedRows.reduce((sum, country) => sum + country.correct, 0)
  const overallRate = totalAnswered ? totalCorrect / totalAnswered : null
  const totalCompletedSessions = Object.values(quizProgress).reduce(
    (sum, mode) => sum + mode.completedSessions,
    0
  )
  const selectedCountry = selectedAlpha2
    ? rows.find((country) => country.alpha2 === selectedAlpha2) ?? null
    : null
  const selectedStats = selectedAlpha2 ? countryStats[selectedAlpha2] : undefined
  const countryBySourceId = new Map(
    countryCatalog.map((country) => [country.sourceFeatureId, country.alpha2])
  )

  const filteredRows = rows
    .filter((country) => selectedRegion === 'all' || country.continent ===
      quizRegions.find((region) => region.id === selectedRegion)?.label)
    .filter((country) => country.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))
    .sort((first, second) => {
      if (sort === 'lowest') {
        return (first.rate ?? 2) - (second.rate ?? 2) || first.name.localeCompare(second.name, 'fr')
      }
      if (sort === 'highest') {
        return (second.rate ?? -1) - (first.rate ?? -1) || first.name.localeCompare(second.name, 'fr')
      }
      return first.name.localeCompare(second.name, 'fr')
    })

  const weakestCountries = [...playedRows]
    .sort((first, second) => (first.rate ?? 0) - (second.rate ?? 0))
    .slice(0, 5)
  const strongestCountries = [...playedRows]
    .sort((first, second) => (second.rate ?? 0) - (first.rate ?? 0))
    .slice(0, 5)

  const selectCountry = (alpha2: string): void => setSelectedAlpha2(alpha2)

  return (
    <main className="statistics-screen">
      <header className="statistics-header">
        <div>
          <div className="breadcrumb">VOTRE PROGRESSION / MONDE</div>
          <h1>Statistiques</h1>
          <p>Retrouve tes résultats par quiz et par pays.</p>
        </div>
        <div className="statistics-actions">
          <button className="home-back-button" type="button" onClick={onBack}>← Accueil</button>
          <button className="quiz-start-button" type="button" onClick={onOpenQuiz}>Retour au quiz</button>
        </div>
      </header>

      <div className="statistics-content">
        <section className="statistics-summary" aria-label="Résumé des résultats">
          <article className="statistics-card">
            <span>Parties terminées</span>
            <strong>{totalCompletedSessions}</strong>
            <small>Tous les types de quiz</small>
          </article>
          <article className="statistics-card">
            <span>Pays travaillés</span>
            <strong>{playedRows.length} <small>/ {rows.length}</small></strong>
            <small>Au moins une réponse enregistrée</small>
          </article>
          <article className="statistics-card">
            <span>Réponses évaluées</span>
            <strong>{totalAnswered}</strong>
            <small>{totalCorrect} bonnes réponses</small>
          </article>
          <article className="statistics-card statistics-card-highlight">
            <span>Réussite globale</span>
            <strong>{percent(overallRate)}</strong>
            <small>Sur les questions terminées</small>
          </article>
        </section>

        <section className="statistics-mode-grid" aria-label="Résultats par type de quiz">
          {quizModes.map((mode) => {
            const modeStats = Object.values(countryStats).reduce(
              (sum, country) => ({
                answered: sum.answered + country.byMode[mode].answered,
                correct: sum.correct + country.byMode[mode].correct
              }),
              { answered: 0, correct: 0 }
            )
            return (
              <article className="statistics-mode-card" key={mode}>
                <span>{modeLabels[mode]}</span>
                <strong>{percent(modeStats.answered ? modeStats.correct / modeStats.answered : null)}</strong>
                <small>
                  {modeStats.correct} bonnes réponses sur {modeStats.answered} · {quizProgress[mode].completedSessions} parties
                </small>
              </article>
            )
          })}
        </section>

        <section className="statistics-map-layout">
          <div className="statistics-map-panel">
            <div className="statistics-section-heading">
              <div>
                <h2>Réussite par pays</h2>
                <p>La carte montre le taux de bonnes réponses des questions terminées.</p>
              </div>
            </div>
            <div className="statistics-map-canvas">
              <WorldMap
                showBorders
                showLabels
                countryAccuracyByAlpha2={countryStats}
                onCountrySelected={(sourceFeatureId) => {
                  const alpha2 = countryBySourceId.get(Number(sourceFeatureId))
                  if (alpha2) selectCountry(alpha2)
                }}
              />
            </div>
            <div className="statistics-map-legend" aria-label="Légende du taux de réussite">
              <span>Pas encore joué</span>
              <i className="statistics-no-data-swatch" />
              <span>0 %</span>
              <i className="statistics-gradient-swatch" />
              <span>100 %</span>
            </div>
          </div>

          <aside className="statistics-country-panel" aria-live="polite">
            {selectedCountry ? (
              <>
                <div className="section-label">FICHE DE PROGRESSION</div>
                <h2>{selectedCountry.name}</h2>
                <div className="statistics-country-rate">
                  <strong>{percent(selectedCountry.rate)}</strong>
                  <span>{selectedCountry.correct} bonnes réponses sur {selectedCountry.answered}</span>
                </div>
                <div className="statistics-country-modes">
                  {quizModes.map((mode) => {
                    const modeStats = selectedStats?.byMode[mode]
                    const rate = modeStats?.answered
                      ? modeStats.correct / modeStats.answered
                      : null
                    return (
                      <div key={mode}>
                        <span>{modeLabels[mode]}</span>
                        <strong>{percent(rate)}</strong>
                        <small>{modeStats?.correct ?? 0} / {modeStats?.answered ?? 0}</small>
                      </div>
                    )
                  })}
                </div>
                <button
                  className="quiz-start-button"
                  type="button"
                  onClick={() => onOpenCountryQuiz(selectedCountry.alpha2)}
                >
                  Lancer un quiz pays
                </button>
              </>
            ) : (
              <div className="statistics-empty-selection">
                <div className="section-label">FICHE DE PROGRESSION</div>
                <h2>Choisis un pays</h2>
                <p>Clique sur un pays de la carte ou de la liste pour voir le détail de tes réponses.</p>
              </div>
            )}
          </aside>
        </section>

        <section className="statistics-ranking-grid">
          <CountryRanking title="À retravailler" rows={weakestCountries} onSelect={selectCountry} />
          <CountryRanking title="Bien maîtrisés" rows={strongestCountries} onSelect={selectCountry} />
        </section>

        <section className="statistics-table-panel">
          <div className="statistics-section-heading">
            <div>
              <h2>Tous les pays</h2>
              <p>Filtre et trie l’historique de tes réponses.</p>
            </div>
            <div className="statistics-table-filters">
              <input
                type="search"
                aria-label="Chercher un pays dans les statistiques"
                placeholder="Chercher un pays"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filtrer par continent"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value as QuizRegion | 'all')}
              >
                <option value="all">Tous les continents</option>
                {quizRegions.filter((region) => region.id !== 'world').map((region) => (
                  <option key={region.id} value={region.id}>{region.label}</option>
                ))}
              </select>
              <select
                aria-label="Trier les pays"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="lowest">Réussite la plus basse</option>
                <option value="highest">Réussite la plus haute</option>
                <option value="name">Ordre alphabétique</option>
              </select>
            </div>
          </div>
          <div className="statistics-table-scroll">
            <table className="statistics-table">
              <thead>
                <tr><th>Pays</th><th>Continent</th><th>Bonnes réponses</th><th>Réussite</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((country) => (
                  <tr key={country.alpha2} className={country.alpha2 === selectedAlpha2 ? 'selected' : ''}>
                    <td>
                      <button type="button" onClick={() => selectCountry(country.alpha2)}>{country.name}</button>
                    </td>
                    <td>{country.continent}</td>
                    <td>{country.correct} / {country.answered}</td>
                    <td>{percent(country.rate)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={4}>Aucun pays ne correspond à cette recherche.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

function CountryRanking({
  title,
  rows,
  onSelect
}: {
  title: string
  rows: CountryRow[]
  onSelect: (alpha2: string) => void
}): React.JSX.Element {
  return (
    <section className="statistics-ranking-panel">
      <h2>{title}</h2>
      {rows.length ? rows.map((country) => (
        <button type="button" key={country.alpha2} onClick={() => onSelect(country.alpha2)}>
          <span>{country.name}</span>
          <span>{percent(country.rate)} <small>({country.correct}/{country.answered})</small></span>
        </button>
      )) : <p>Les résultats apparaîtront après quelques questions.</p>}
    </section>
  )
}
