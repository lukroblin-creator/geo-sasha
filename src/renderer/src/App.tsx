
import { useState } from 'react'
import WorldMap from './components/WorldMap'
import { FlagsQuizPanel, CapitalsQuizPanel } from './components/QuizPanels'
import { countryFlagQuestions } from './data/quiz/countryQuestions'
import {
  createCountryCapitalQuestions,
  type CountryCapitalQuestion
} from './data/quiz/countryCapitals'
import { useQuizSession } from './data/quiz/useQuizSession'
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
}

const modes: Mode[] = [
  {
    id: 'flags',
    name: 'Drapeaux',
    description: 'Reconnaître un pays à partir de son drapeau',
    icon: '⚑'
  },
  {
    id: 'capitals',
    name: 'Capitales',
    description: 'Retrouver la capitale d’un pays',
    icon: '⌖'
  },
  {
    id: 'countries',
    name: 'Territoires',
    description: 'Identifier les pays sur la carte',
    icon: '▧'
  },
  {
    id: 'physical',
    name: 'Géographie physique',
    description: 'Explorer les éléments naturels',
    icon: '⌁'
  }
]

function App(): React.JSX.Element {
  const [activeMode, setActiveMode] = useState<Mode['id']>('flags')
  const [showBorders, setShowBorders] = useState(true)
  const [showRivers, setShowRivers] = useState(false)
  const [showMountains, setShowMountains] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [quizProgress, setQuizProgress] = useState(loadQuizProgress)

  const selectedMode = modes.find((mode) => mode.id === activeMode)!

  const recordCompletedQuiz = (
    mode: QuizMode,
    score: number
  ): void => {
    setQuizProgress(saveCompletedQuiz(mode, score))
  }

  const flagQuiz = useQuizSession({
    mode: 'flags',
    questionBank: () => countryFlagQuestions,
    onCompleted: recordCompletedQuiz
  })
  const capitalQuiz = useQuizSession<CountryCapitalQuestion>({
    mode: 'capitals',
    questionBank: createCountryCapitalQuestions,
    onCompleted: recordCompletedQuiz
  })

  const handleCountrySelected = (
    sourceFeatureId: string | number,
    name: string
  ): void => {
    if (
      activeMode !== 'flags' ||
      flagQuiz.session.answerCorrect === true ||
      flagQuiz.session.completed
    ) return
    const question =
      flagQuiz.session.questionOrder[flagQuiz.session.questionIndex]
    const isCorrect =
      Number(sourceFeatureId) === question.sourceFeatureId &&
      name === question.countryName
    flagQuiz.answer(isCorrect, name)
  }

  const activeStats =
    activeMode === 'capitals'
      ? quizProgress.capitals
      : quizProgress.flags
  const activeQuizLength = countryFlagQuestions.length

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
          <div className="section-label">APPRENTISSAGE</div>

          <nav className="navigation">
            {modes.map((mode) => (
              <button
                key={mode.id}
                className={`nav-item ${activeMode === mode.id ? 'active' : ''}`}
                onClick={() => setActiveMode(mode.id)}
              >
                <span className="nav-icon">{mode.icon}</span>
                <span>{mode.name}</span>
              </button>
            ))}
          </nav>
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
              Meilleur score : {activeStats.bestScore} / {activeQuizLength}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="profile-indicator" />
          <div>
            <div className="footer-title">Mode personnel</div>
            <div className="footer-subtitle">Progression locale</div>
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
            <span className="status-dot" />
            <span className="status-text">Application locale</span>
          </div>
        </header>

        <div className="workspace">
          <section className="map-section">
            <div className="map-toolbar">
              <div>
                <div className="map-title">Carte mondiale</div>
                <div className="map-subtitle">
                  Explorez le monde et apprenez à le reconnaître
                </div>
              </div>

              <div className="map-controls">
                <button className="map-control-button" title="Vue mondiale">
                  ◎
                </button>
                <button className="map-control-button" title="Zoom avant">
                  +
                </button>
                <button className="map-control-button" title="Zoom arrière">
                  −
                </button>
              </div>
            </div>

            <div className="map-canvas">
              <WorldMap
                showBorders={showBorders}
                showLabels={showLabels}
                onCountrySelected={handleCountrySelected}
              />

              <div className="map-legend">
                <span className="legend-dot" />
                <span>Monde entier</span>
              </div>
            </div>

            <div className="map-settings">
              <div className="settings-heading">AFFICHAGE CARTOGRAPHIQUE</div>

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
                  checked={showRivers}
                  onChange={(event) => setShowRivers(event.target.checked)}
                />
                <span>Fleuves</span>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={showMountains}
                  onChange={(event) => setShowMountains(event.target.checked)}
                />
                <span>Montagnes</span>
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

          {activeMode === 'flags' ? (
            <FlagsQuizPanel
              session={flagQuiz.session}
              onNext={flagQuiz.next}
              onRestart={flagQuiz.restart}
            />
          ) : activeMode === 'capitals' ? (
            <CapitalsQuizPanel
              session={capitalQuiz.session}
              onAnswer={capitalQuiz.answer}
              onNext={capitalQuiz.next}
              onRestart={capitalQuiz.restart}
            />
          ) : (
            <aside className="quiz-panel">
              <div className="quiz-header">
                <div className="section-label">SESSION D’APPRENTISSAGE</div>
              </div>
              <div className="quiz-content">
                <div className="quiz-mode-label">{selectedMode.description}</div>
                <div className="answer-placeholder">
                  Ce mode sera ajouté dans une prochaine étape.
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
