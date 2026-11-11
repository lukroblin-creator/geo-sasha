
import { useState } from 'react'
import WorldMap from './components/WorldMap'
import { ExplorationView } from './components/ExplorationView'
import { CountryQuizPanel } from './components/QuizPanels'
import { useQuizSession } from './data/quiz/useQuizSession'
import {
  createCountryQuizQuestions,
  normalizeQuizAnswer,
  type QuizAnswers,
  type QuizClues,
  type CountryQuizQuestion
} from './data/quiz/countryQuiz'
import {
  getAvailableQuizQuestionCount,
  getQuizQuestionsForRegion,
  quizRegions,
  type QuizQuestionCount,
  type QuizRegion
} from './data/quiz/countryContinents'
import {
  loadQuizProgress,
  saveCompletedQuiz,
  type QuizMode
} from './data/quiz/progress'

type Mode = {
  id: QuizMode | 'countries' | 'physical'
  name: string
  description: string
  icon: string
  available: boolean
}

type MapLayerId = 'borders' | 'rivers' | 'mountains' | 'labels'
type MapLayerVisibility = Record<MapLayerId, boolean>

const mapLayerOptions: {
  id: MapLayerId
  label: string
  available: boolean
}[] = [
  { id: 'borders', label: 'Frontières', available: true },
  { id: 'rivers', label: 'Fleuves · bientôt', available: false },
  { id: 'mountains', label: 'Montagnes · bientôt', available: false },
  { id: 'labels', label: 'Noms des pays', available: true }
]

const modes: Mode[] = [
  {
    id: 'flags',
    name: 'Drapeaux',
    description: 'Reconnaître un pays à partir de son drapeau',
    icon: '⚑',
    available: true
  },
  {
    id: 'capitals',
    name: 'Capitales',
    description: 'Retrouver la capitale d’un pays',
    icon: '⌖',
    available: true
  },
  {
    id: 'custom',
    name: 'Personnalisé',
    description: 'Choisir les indices et les réponses',
    icon: '⚙',
    available: true
  },
  {
    id: 'countries',
    name: 'Territoires',
    description: 'Identifier les pays sur la carte',
    icon: '▧',
    available: false
  },
  {
    id: 'physical',
    name: 'Géographie physique',
    description: 'Explorer les éléments naturels',
    icon: '⌁',
    available: false
  }
]

const flagPresetClues: QuizClues = {
  countryOnMap: false,
  flag: true,
  countryName: false,
  capital: false
}
const flagPresetAnswers: QuizAnswers = {
  countryOnMap: true,
  countryName: false,
  capital: false,
  flag: false
}
const capitalPresetClues: QuizClues = {
  countryOnMap: false,
  flag: false,
  countryName: true,
  capital: false
}
const capitalPresetAnswers: QuizAnswers = {
  countryOnMap: false,
  countryName: false,
  capital: true,
  flag: false
}

const quizContentOptions: { id: keyof QuizClues; label: string }[] = [
  { id: 'flag', label: 'Drapeau' },
  { id: 'countryName', label: 'Nom du pays' },
  { id: 'capital', label: 'Capitale' },
  { id: 'countryOnMap', label: 'Territoire sur la carte' }
]

function App(): React.JSX.Element {
  const [activeMode, setActiveMode] = useState<Mode['id']>('flags')
  const [appView, setAppView] = useState<'home' | 'quiz' | 'exploration'>('home')
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [contentSettingsOpen, setContentSettingsOpen] = useState(false)
  const [mapLayers, setMapLayers] = useState<MapLayerVisibility>({
    borders: true,
    rivers: false,
    mountains: false,
    labels: false
  })
  const [quizRegion, setQuizRegion] = useState<QuizRegion>('world')
  const [quizQuestionCount, setQuizQuestionCount] = useState<QuizQuestionCount>(10)
  const [quizClues, setQuizClues] = useState<QuizClues>(flagPresetClues)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>(flagPresetAnswers)
  const [activeQuizClues, setActiveQuizClues] = useState<QuizClues>(flagPresetClues)
  const [activeQuizAnswers, setActiveQuizAnswers] = useState<QuizAnswers>(flagPresetAnswers)
  const [sessionMode, setSessionMode] = useState<QuizMode>('flags')
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [selectedMapCountry, setSelectedMapCountry] = useState<{
    sourceFeatureId: string | number
    name: string
    entityId: string | null
  } | null>(null)
  const [quizProgress, setQuizProgress] = useState(loadQuizProgress)

  const selectedMode = modes.find((mode) => mode.id === activeMode)!
  const maxQuizQuestionCount = getAvailableQuizQuestionCount(quizRegion)

  const recordCompletedQuiz = (mode: QuizMode, score: number): void => {
    setQuizProgress(saveCompletedQuiz(mode, score))
  }

  const quiz = useQuizSession<CountryQuizQuestion>({
    mode: sessionMode,
    questionBank: () =>
      getQuizQuestionsForRegion(
        createCountryQuizQuestions(),
        quizRegion,
        quizQuestionCount
      ),
    onCompleted: recordCompletedQuiz
  })

  const handleQuizRegionChange = (region: QuizRegion): void => {
    setQuizRegion(region)
    setQuizQuestionCount((current) =>
      Math.min(current, getAvailableQuizQuestionCount(region))
    )
  }

  const startNewQuiz = (): void => {
    if (!Object.values(quizClues).some(Boolean) || !Object.values(quizAnswers).some(Boolean)) {
      return
    }

    setContentSettingsOpen(false)
    const nextMode: QuizMode =
      activeMode === 'flags' || activeMode === 'capitals' ? activeMode : 'custom'
    setSessionMode(nextMode)
    setActiveQuizClues(quizClues)
    setActiveQuizAnswers(quizAnswers)
    setSessionGeneration((current) => current + 1)
    setSelectedMapCountry(null)
    quiz.restart()
  }

  const selectMode = (mode: Mode): void => {
    if (!mode.available) return

    setActiveMode(mode.id)
    if (mode.id === 'flags') {
      setQuizClues(flagPresetClues)
      setQuizAnswers(flagPresetAnswers)
    } else if (mode.id === 'capitals') {
      setQuizClues(capitalPresetClues)
      setQuizAnswers(capitalPresetAnswers)
    }
    setModeMenuOpen(false)
  }

  const selectQuizContent = (
    id: keyof QuizClues,
    side: 'clue' | 'answer',
    checked: boolean
  ): void => {
    setActiveMode('custom')
    if (side === 'clue') {
      setQuizClues((current) => ({ ...current, [id]: checked }))
      if (checked) setQuizAnswers((current) => ({ ...current, [id]: false }))
      return
    }

    setQuizAnswers((current) => ({ ...current, [id]: checked }))
    if (checked) setQuizClues((current) => ({ ...current, [id]: false }))
  }

  const snapQuestionCountToMark = (value: number): number => {
    const marks = [10, 25, 50, maxQuizQuestionCount].filter(
      (mark, index, allMarks) => mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
    )
    return marks.find((mark) => Math.abs(value - mark) <= 1) ?? value
  }

  const handleCountrySelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): void => {
    setSelectedMapCountry({ sourceFeatureId, name, entityId })

    if (
      activeQuizAnswers.countryOnMap &&
      !activeQuizAnswers.countryName &&
      !activeQuizAnswers.capital &&
      !activeQuizAnswers.flag
    ) {
      const question = quiz.session.questionOrder[quiz.session.questionIndex]

      if (question) {
        quiz.answer(
          Number(sourceFeatureId) === question.sourceFeatureId,
          name
        )
      }
    }
  }

  const submitCountryQuizAnswers = (answers: {
    countryName: string
    capital: string
    flagAlpha2: string | null
  }): void => {
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (!question) return

    const correct =
      (!activeQuizAnswers.countryOnMap ||
        Number(selectedMapCountry?.sourceFeatureId) === question.sourceFeatureId) &&
      (!activeQuizAnswers.countryName ||
        [question.countryName, question.frenchCountryName].some(
          (name) => normalizeQuizAnswer(answers.countryName) === normalizeQuizAnswer(name)
        )) &&
      (!activeQuizAnswers.capital ||
        normalizeQuizAnswer(answers.capital) === normalizeQuizAnswer(question.capitalName)) &&
      (!activeQuizAnswers.flag || answers.flagAlpha2 === question.alpha2)

    quiz.answer(correct, JSON.stringify(answers))
  }

  const nextQuizQuestion = (): void => {
    setSelectedMapCountry(null)
    quiz.next()
  }

  const activeStats = quizProgress[sessionMode]

if (appView === 'home') {
  return (
    <div className="home-screen">
      <div className="home-brand">
        <div className="brand-icon">W</div>
        <div>
          <div className="brand-name">WORLD ATLAS</div>
          <div className="brand-subtitle">GEOGRAPHY TRAINER</div>
        </div>
      </div>

      <div className="home-content">
        <div className="home-eyebrow">VOTRE ATLAS DU MONDE</div>
        <h1>Explorez. Apprenez. Découvrez.</h1>
        <p className="home-description">
          Parcourez le monde à votre rythme ou mettez vos connaissances
          géographiques à l&apos;épreuve.
        </p>

        <div className="home-mode-grid">
          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('quiz')}
          >
            <span className="home-mode-icon">⌖</span>
            <span className="home-mode-title">Quiz</span>
            <span className="home-mode-description">
              Testez vos connaissances avec les drapeaux, les capitales
              et des questionnaires personnalisés.
            </span>
            <span className="home-mode-action">Choisir un quiz →</span>
          </button>

          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('exploration')}
          >
            <span className="home-mode-icon">◎</span>
            <span className="home-mode-title">Exploration</span>
            <span className="home-mode-description">
              Parcourez librement la carte et découvrez les informations
              détaillées de chaque pays.
            </span>
            <span className="home-mode-action">Explorer le monde →</span>
          </button>
        </div>
      </div>

      <div className="home-footer">
        WORLD ATLAS · APPLICATION LOCALE · V0.1
      </div>
    </div>
  )
}

if (appView === 'exploration') {
  return <ExplorationView onBack={() => setAppView('home')} />
}

return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">W</div>
          <div>
            <div className="brand-name">WORLD ATLAS</div>
            <div className="brand-subtitle">GEOGRAPHY TRAINER</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-label">VOTRE PROGRESSION</div>

          <div className="progress-card">
            <div className="progress-heading">
              <span>Pays au programme</span>
              <span className="progress-number">195</span>
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: '100%' }} />
            </div>

            <div className="progress-caption">Catalogue intégré hors ligne</div>
            <div className="progress-caption">
              Quiz terminés : {activeStats.completedSessions}
            </div>
            <div className="progress-caption">
              Meilleur score : {activeStats.bestScore}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="profile-indicator" />
          <div>
            <div className="footer-title">Mode personnel</div>
            <div className="footer-subtitle">Progression locale</div>
            <div
              className="footer-subtitle"
              title="GeoNames sous licence CC BY 4.0 ; Natural Earth dans le domaine public"
            >
              Sources cartographiques : GeoNames et Natural Earth
            </div>
          </div>
          <span className="footer-version">v0.1</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">APPRENTISSAGE / MONDE</div>
            <h1>{selectedMode.name}</h1>
          </div>

          <div className="topbar-right">
            <button
              className="home-back-button"
              type="button"
              onClick={() => {
                quiz.restart()
                setSelectedMapCountry(null)
                setModeMenuOpen(false)
                setAppView('home')
              }}
            >
              ← Accueil
            </button>

            <span className="status-dot" />
            <span className="status-text">Application locale</span>
          </div>
        </header>

        <section className="quiz-toolbar" aria-label="Réglages de la partie">
          <div
            className="mode-picker"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setModeMenuOpen(false)
            }}
          >
            <button
              className="mode-picker-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              onClick={() => setModeMenuOpen((open) => !open)}
            >
              <span className="mode-picker-caption">MODE DE JEU</span>
              <span className="mode-picker-selected">
                <span className="mode-picker-icon" aria-hidden="true">{selectedMode.icon}</span>
                <span>{selectedMode.name}</span>
                <span className="mode-picker-chevron" aria-hidden="true">⌄</span>
              </span>
            </button>
            {modeMenuOpen && (
              <div className="mode-picker-menu" role="menu" aria-label="Choisir un mode">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`mode-picker-option${activeMode === mode.id ? ' active' : ''}`}
                    type="button"
                    role="menuitem"
                    disabled={!mode.available}
                    onClick={() => selectMode(mode)}
                  >
                    <span className="mode-picker-icon" aria-hidden="true">{mode.icon}</span>
                    <span className="mode-picker-option-copy">
                      <span>{mode.name}</span>
                      <small>{mode.available ? mode.description : 'Bientôt disponible'}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="quiz-region-field">
            <span>RÉGION</span>
            <select
              value={quizRegion}
              onChange={(event) => {
                const region = quizRegions.find((item) => item.id === event.target.value)
                if (region) handleQuizRegionChange(region.id)
              }}
            >
              {quizRegions.map((region) => (
                <option key={region.id} value={region.id}>{region.label}</option>
              ))}
            </select>
          </label>

          <div className="quiz-count-control">
            <label className="quiz-count-value">
              <span>À deviner</span>
              <span className="quiz-count-number-row">
                <input
                  aria-label="Nombre exact de pays à deviner"
                  type="number"
                  min={1}
                  max={maxQuizQuestionCount}
                  value={quizQuestionCount}
                  onChange={(event) => {
                    if (!event.target.value) return
                    const nextCount = Number(event.target.value)
                    if (Number.isFinite(nextCount)) {
                      setQuizQuestionCount(
                        Math.max(1, Math.min(maxQuizQuestionCount, Math.round(nextCount)))
                      )
                    }
                  }}
                />
                <span>pays</span>
              </span>
            </label>
            <div className="quiz-count-slider">
              <input
                type="range"
                aria-label="Nombre de pays à deviner"
                min={1}
                max={maxQuizQuestionCount}
                step={1}
                value={Math.min(quizQuestionCount, maxQuizQuestionCount)}
                onChange={(event) =>
                  setQuizQuestionCount(
                    snapQuestionCountToMark(Number(event.target.value))
                  )
                }
                onPointerUp={(event) =>
                  setQuizQuestionCount(
                    snapQuestionCountToMark(Number(event.currentTarget.value))
                  )
                }
                onKeyUp={(event) => {
                  if (event.key.startsWith('Arrow')) {
                    setQuizQuestionCount((current) => snapQuestionCountToMark(current))
                  }
                }}
              />
              <div className="quiz-count-marks" aria-hidden="true">
                {[10, 25, 50, maxQuizQuestionCount]
                  .filter((mark, index, allMarks) =>
                    mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
                  )
                  .map((mark) => (
                    <span
                      key={mark}
                      className={`quiz-count-mark${Math.abs(quizQuestionCount - mark) <= 1 ? ' active' : ''}`}
                      style={{ left: `${((mark - 1) / (maxQuizQuestionCount - 1)) * 100}%` }}
                    >
                      <i />
                      <small>{mark === maxQuizQuestionCount ? 'Max' : mark}</small>
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <button
            className="quiz-start-button"
            type="button"
            onClick={startNewQuiz}
            disabled={
              !Object.values(quizClues).some(Boolean) ||
              !Object.values(quizAnswers).some(Boolean)
            }
          >
            Nouvelle partie
          </button>

          <div className="quiz-content-picker">
            <button
              className="quiz-content-picker-button"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={contentSettingsOpen}
              onClick={() => setContentSettingsOpen((open) => !open)}
            >
              <span className="quiz-content-picker-caption">CONTENU DU QUIZ</span>
              <span className="quiz-content-picker-value">
                Choisir indices et réponses <span aria-hidden="true">⌄</span>
              </span>
            </button>
            {contentSettingsOpen && (
              <div className="quiz-content-settings" role="dialog" aria-label="Choisir les indices et les réponses">
                <div className="quiz-content-settings-columns">
                  <fieldset>
                    <legend>Indices donnés par le jeu</legend>
                    {quizContentOptions.map((option) => {
                      const blocked = quizAnswers[option.id]
                      return (
                        <label
                          key={option.id}
                          className={`quiz-content-setting${blocked ? ' quiz-content-setting-blocked' : ''}`}
                          title={blocked ? 'Déjà utilisé comme réponse' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={quizClues[option.id]}
                            disabled={blocked}
                            onChange={(event) =>
                              selectQuizContent(option.id, 'clue', event.target.checked)
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                  <fieldset>
                    <legend>Réponses à donner</legend>
                    {quizContentOptions.map((option) => {
                      const blocked = quizClues[option.id]
                      return (
                        <label
                          key={option.id}
                          className={`quiz-content-setting${blocked ? ' quiz-content-setting-blocked' : ''}`}
                          title={blocked ? 'Déjà utilisé comme indice' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={quizAnswers[option.id]}
                            disabled={blocked}
                            onChange={(event) =>
                              selectQuizContent(option.id, 'answer', event.target.checked)
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                </div>
                <p className="quiz-content-settings-help">
                  Chaque élément peut être un indice ou une réponse. Coche au moins une ligne dans chaque colonne, puis démarre une nouvelle partie.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="workspace">
          <section className="map-section">
            <div className="map-toolbar">
              <div>
                <div className="map-title">Carte mondiale</div>
                <div className="map-subtitle">
                  Explorez le monde et apprenez à le reconnaître
                </div>
              </div>

            </div>

            <div className="map-canvas">
              <WorldMap
                showBorders={mapLayers.borders}
                showLabels={mapLayers.labels}
                quizTargetFeatureId={activeQuizClues.countryOnMap
                  ? quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? null
                  : null}
                interactionResetKey={`${sessionMode}:${sessionGeneration}:${quiz.session.questionIndex}:${quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? ''}`}
                onCountrySelected={handleCountrySelected}
              />

              <div className="map-legend">
                <span className="legend-dot" />
                <span>Monde entier</span>
              </div>
            </div>

            <div className="map-settings">
              <div className="settings-heading">AFFICHAGE CARTOGRAPHIQUE</div>

              {mapLayerOptions.map((layer) => (
                <label
                  key={layer.id}
                  className={`setting-item${layer.available ? '' : ' setting-item-disabled'}`}
                  title={layer.available ? undefined : 'Cette couche sera ajoutée plus tard'}
                >
                  <input
                    type="checkbox"
                    checked={mapLayers[layer.id]}
                    disabled={!layer.available}
                    onChange={(event) =>
                      setMapLayers((current) => ({
                        ...current,
                        [layer.id]: event.target.checked
                      }))
                    }
                  />
                  <span>{layer.label}</span>
                </label>
              ))}
            </div>
          </section>

          <CountryQuizPanel
            session={quiz.session}
            clues={activeQuizClues}
            answers={activeQuizAnswers}
            selectedMapCountry={selectedMapCountry}
            onAnswer={submitCountryQuizAnswers}
            onRevealAnswer={quiz.revealAnswer}
            onNext={nextQuizQuestion}
            onRestart={startNewQuiz}
          />
        </div>
      </main>
    </div>
  )
}

export default App
