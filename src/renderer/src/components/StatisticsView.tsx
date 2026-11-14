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
import { useLanguage, type AppLanguage } from '../data/i18n'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'

type StatisticsViewProps = {
  countryStats: CountryQuizStatsByAlpha2
  quizProgress: QuizProgress
  globeMode: boolean
  onToggleGlobeMode: () => void
  onReturn: () => void
  onOpenCountryQuiz: (alpha2: string) => void
  onModeChange: (mode: AppPrimaryMode) => void
}

type CountryRow = {
  alpha2: string
  sourceFeatureId: number
  name: string
  continent: string
  answered: number
  correct: number
  pointsEarned: number
  pointsPossible: number
  rate: number | null
}

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

function getCountryRows(stats: CountryQuizStatsByAlpha2, language: AppLanguage): CountryRow[] {
  const countryNames = new Intl.DisplayNames([language], { type: 'region' })
  return countryCatalog.map((country) => {
    const countryStats = stats[country.alpha2]
    const answered = countryStats?.answered ?? 0
    const correct = countryStats?.correct ?? 0
    const pointsEarned = countryStats?.pointsEarned ?? correct
    const pointsPossible = countryStats?.pointsPossible ?? answered
    return {
      alpha2: country.alpha2,
      sourceFeatureId: country.sourceFeatureId,
      name: countryNames.of(country.alpha2) ?? country.countryName,
      continent: getContinentLabelForCountry(country.alpha2) ?? 'Autre',
      answered,
      correct,
      pointsEarned,
      pointsPossible,
      rate: pointsPossible ? pointsEarned / pointsPossible : null
    }
  })
}

export function StatisticsView({
  countryStats,
  quizProgress,
  globeMode,
  onToggleGlobeMode,
  onReturn,
  onOpenCountryQuiz,
  onModeChange
}: StatisticsViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [selectedAlpha2, setSelectedAlpha2] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<QuizRegion | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'lowest' | 'highest'>('lowest')
  const [showAdvancedStatistics, setShowAdvancedStatistics] = useState(false)

  const rows = useMemo(() => getCountryRows(countryStats, language), [countryStats, language])
  const playedRows = rows.filter((country) => country.answered > 0)
  const totalAnswered = playedRows.reduce((sum, country) => sum + country.answered, 0)
  const totalCorrect = playedRows.reduce((sum, country) => sum + country.correct, 0)
  const totalPointsEarned = playedRows.reduce((sum, country) => sum + country.pointsEarned, 0)
  const totalPointsPossible = playedRows.reduce((sum, country) => sum + country.pointsPossible, 0)
  const overallRate = totalPointsPossible ? totalPointsEarned / totalPointsPossible : null
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
    .filter((country) => country.name.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language)))
    .sort((first, second) => {
      if (sort === 'lowest') {
        return (first.rate ?? 2) - (second.rate ?? 2) || first.name.localeCompare(second.name, language)
      }
      if (sort === 'highest') {
        return (second.rate ?? -1) - (first.rate ?? -1) || first.name.localeCompare(second.name, language)
      }
      return first.name.localeCompare(second.name, language)
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
          <div className="breadcrumb">{t('VOTRE PROGRESSION / MONDE')}</div>
          <h1>{t('Statistiques')}</h1>
          <p>{t('Retrouve tes résultats par quiz et par pays.')}</p>
        </div>
        <div className="statistics-actions">
          <button
            className="quiz-start-button"
            type="button"
            onClick={() => setShowAdvancedStatistics((current) => !current)}
          >
            {showAdvancedStatistics ? t('Statistiques essentielles') : t('Statistiques avancées')}
          </button>
          <button className="quiz-start-button" type="button" onClick={onReturn}>{t('Retour')}</button>
        </div>
      </header>

      <AppModeSwitcher active={null} onChange={onModeChange} />

      <div className="statistics-content">
        <section className="statistics-summary" aria-label={t('Résumé des résultats')}>
          <article className="statistics-card">
            <span>{t('Parties terminées')}</span>
            <strong>{totalCompletedSessions}</strong>
            <small>{t('Tous les types de quiz')}</small>
          </article>
          <article className="statistics-card">
            <span>{t('Pays travaillés')}</span>
            <strong>{playedRows.length} <small>/ {rows.length}</small></strong>
            <small>{t('Au moins une réponse enregistrée')}</small>
          </article>
          <article className="statistics-card">
            <span>{t('Questions évaluées')}</span>
            <strong>{totalAnswered}</strong>
            <small>{totalCorrect} {t('questions entièrement réussies')}</small>
          </article>
          <article className="statistics-card statistics-card-highlight">
            <span>{t('Réussite globale')}</span>
            <strong>{percent(overallRate)}</strong>
            <small>{t('Points obtenus selon les essais')}</small>
          </article>
        </section>

        {showAdvancedStatistics && <section className="statistics-mode-grid" aria-label={t('Résultats par type de quiz')}>
          {quizModes.map((mode) => {
            const modeStats = Object.values(countryStats).reduce(
              (sum, country) => ({
                answered: sum.answered + country.byMode[mode].answered,
                correct: sum.correct + country.byMode[mode].correct,
                pointsEarned: sum.pointsEarned + country.byMode[mode].pointsEarned,
                pointsPossible: sum.pointsPossible + country.byMode[mode].pointsPossible
              }),
              { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 }
            )
            return (
              <article className="statistics-mode-card" key={mode}>
                <span>{t(modeLabels[mode])}</span>
                <strong>{percent(modeStats.pointsPossible ? modeStats.pointsEarned / modeStats.pointsPossible : null)}</strong>
                <small>
                  {modeStats.correct} {t('questions entièrement réussies sur')} {modeStats.answered} · {quizProgress[mode].completedSessions} {t('parties')}
                </small>
              </article>
            )
          })}
        </section>}

        <section className={`statistics-map-layout${showAdvancedStatistics ? '' : ' statistics-map-layout-basic'}`}>
          <div className="statistics-map-panel">
            <div className="statistics-section-heading">
              <div>
                <h2>{t('Réussite par pays')}</h2>
                <p>{t('La carte montre les points acquis, en tenant compte des essais.')}</p>
              </div>
            </div>
            <div className="statistics-map-canvas">
              <WorldMap
                showBorders
                showLabels
                globeMode={globeMode}
                onToggleGlobeMode={onToggleGlobeMode}
                countryAccuracyByAlpha2={countryStats}
                onCountrySelected={showAdvancedStatistics
                  ? (sourceFeatureId) => {
                      const alpha2 = countryBySourceId.get(Number(sourceFeatureId))
                      if (alpha2) selectCountry(alpha2)
                    }
                  : undefined}
                onCountryDeselected={showAdvancedStatistics ? () => setSelectedAlpha2(null) : undefined}
              />
            </div>
            <div className="statistics-map-legend" aria-label={t('Légende du taux de réussite')}>
              <span>{t('Pas encore joué')}</span>
              <i className="statistics-no-data-swatch" />
              <span>0 %</span>
              <i className="statistics-gradient-swatch" />
              <span>100 %</span>
            </div>
          </div>

          {showAdvancedStatistics && <aside className="statistics-country-panel" aria-live="polite">
            {selectedCountry ? (
              <>
                <div className="section-label">{t('FICHE DE PROGRESSION')}</div>
                <h2>{selectedCountry.name}</h2>
                <div className="statistics-country-rate">
                  <strong>{percent(selectedCountry.rate)}</strong>
                  <span>{selectedCountry.correct} {t('questions entièrement réussies sur')} {selectedCountry.answered}</span>
                  <small>{formatPoints(selectedCountry.pointsEarned, language)} / {formatPoints(selectedCountry.pointsPossible, language)} {t('points')}</small>
                </div>
                <div className="statistics-country-modes">
                  {quizModes.map((mode) => {
                    const modeStats = selectedStats?.byMode[mode]
                    const rate = modeStats?.pointsPossible
                      ? modeStats.pointsEarned / modeStats.pointsPossible
                      : null
                    return (
                      <div key={mode}>
                        <span>{t(modeLabels[mode])}</span>
                        <strong>{percent(rate)}</strong>
                        <small>{modeStats?.correct ?? 0} / {modeStats?.answered ?? 0} · {formatPoints(modeStats?.pointsEarned ?? 0, language)} / {formatPoints(modeStats?.pointsPossible ?? 0, language)} {t('points')}</small>
                      </div>
                    )
                  })}
                </div>
                {selectedStats && Object.keys(selectedStats.byAnswer).length > 0 && (
                  <div className="statistics-country-answers">
                    <h3>{t('Résultats par élément')}</h3>
                    {Object.entries(selectedStats.byAnswer).map(([id, answerStats]) => (
                      <div key={id}>
                        <span>{t(getAnswerDimensionLabel(id))}</span>
                        <strong>{percent(answerStats.pointsPossible
                          ? answerStats.pointsEarned / answerStats.pointsPossible
                          : null)}</strong>
                        <small>{answerStats.correct} / {answerStats.answered} · {formatPoints(answerStats.pointsEarned, language)} / {formatPoints(answerStats.pointsPossible, language)} {t('points')}</small>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="quiz-start-button"
                  type="button"
                  onClick={() => onOpenCountryQuiz(selectedCountry.alpha2)}
                >
                  {t('Lancer un quiz pays')}
                </button>
              </>
            ) : (
              <div className="statistics-empty-selection">
                <div className="section-label">{t('FICHE DE PROGRESSION')}</div>
                <h2>{t('Choisis un pays')}</h2>
                <p>{t('Clique sur un pays de la carte ou de la liste pour voir le détail de tes réponses.')}</p>
              </div>
            )}
          </aside>}
        </section>

        {showAdvancedStatistics && <section className="statistics-ranking-grid">
          <CountryRanking title="À retravailler" rows={weakestCountries} onSelect={selectCountry} />
          <CountryRanking title="Bien maîtrisés" rows={strongestCountries} onSelect={selectCountry} />
        </section>}

        {showAdvancedStatistics && <section className="statistics-table-panel">
          <div className="statistics-section-heading">
            <div>
              <h2>{t('Tous les pays')}</h2>
              <p>{t('Filtre et trie l’historique de tes réponses.')}</p>
            </div>
            <div className="statistics-table-filters">
              <input
                type="search"
                aria-label={t('Chercher un pays dans les statistiques')}
                placeholder={t('Chercher un pays')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label={t('Filtrer par continent')}
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value as QuizRegion | 'all')}
              >
                <option value="all">{t('Tous les continents')}</option>
                {quizRegions.filter((region) => region.id !== 'world').map((region) => (
                  <option key={region.id} value={region.id}>{t(region.label)}</option>
                ))}
              </select>
              <select
                aria-label={t('Trier les pays')}
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="lowest">{t('Réussite la plus basse')}</option>
                <option value="highest">{t('Réussite la plus haute')}</option>
                <option value="name">{t('Ordre alphabétique')}</option>
              </select>
            </div>
          </div>
          <div className="statistics-table-scroll">
            <table className="statistics-table">
              <thead>
                <tr><th>{t('Pays')}</th><th>{t('Continent')}</th><th>{t('Questions entièrement réussies')}</th><th>{t('Réussite')}</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((country) => (
                  <tr key={country.alpha2} className={country.alpha2 === selectedAlpha2 ? 'selected' : ''}>
                    <td>
                      <button type="button" onClick={() => selectCountry(country.alpha2)}>{country.name}</button>
                    </td>
                    <td>{t(country.continent)}</td>
                    <td>{country.correct} / {country.answered} · {formatPoints(country.pointsEarned, language)} / {formatPoints(country.pointsPossible, language)}</td>
                    <td>{percent(country.rate)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={4}>{t('Aucun pays ne correspond à cette recherche.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>}
      </div>
    </main>
  )
}

function formatPoints(points: number, language: AppLanguage): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(points)
}

function getAnswerDimensionLabel(id: string): string {
  const labels: Record<string, string> = {
    countryOnMap: 'Territoire sur la carte',
    countryName: 'Nom du pays',
    capital: 'Capitale',
    flag: 'Drapeau',
    'knowledge:capital': 'Quiz pays · Capitale',
    'knowledge:continent': 'Quiz pays · Référence géographique',
    'knowledge:city': 'Quiz pays · Ville',
    'knowledge:largest-city': 'Quiz pays · Grande ville',
    'knowledge:mountain': 'Quiz pays · Montagne'
  }
  return labels[id] ?? id
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
  const { t } = useLanguage()
  return (
    <section className="statistics-ranking-panel">
      <h2>{t(title)}</h2>
      {rows.length ? rows.map((country) => (
        <button type="button" key={country.alpha2} onClick={() => onSelect(country.alpha2)}>
          <span>{country.name}</span>
          <span>{percent(country.rate)} <small>({country.correct}/{country.answered})</small></span>
        </button>
      )) : <p>{t('Les résultats apparaîtront après quelques questions.')}</p>}
    </section>
  )
}
