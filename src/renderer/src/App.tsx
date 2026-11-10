
import { useState } from 'react'
import WorldMap from './components/WorldMap'
import { flagQuestions } from './data/quiz/flagQuestions'

type Mode = {
  id: string
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
  const [activeMode, setActiveMode] = useState('flags')
  const [showBorders, setShowBorders] = useState(true)
  const [showRivers, setShowRivers] = useState(false)
  const [showMountains, setShowMountains] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [quizComplete, setQuizComplete] = useState(false)

  const selectedMode = modes.find((mode) => mode.id === activeMode)!
  const currentQuestion = flagQuestions[questionIndex]

  const handleCountrySelected = (sourceFeatureId: string | number) => {
    if (
      activeMode !== 'flags' ||
      answerCorrect === true ||
      quizComplete ||
      !currentQuestion
    ) return
    setAnswerCorrect(Number(sourceFeatureId) === currentQuestion.sourceFeatureId)
    if (Number(sourceFeatureId) === currentQuestion.sourceFeatureId) {
      setScore((currentScore) => currentScore + 1)
    }
  }

  const advanceQuestion = () => {
    if (questionIndex === flagQuestions.length - 1) {
      setQuizComplete(true)
    } else {
      setQuestionIndex((currentIndex) => currentIndex + 1)
      setAnswerCorrect(null)
    }
  }

  const restartQuiz = () => {
    setQuestionIndex(0)
    setScore(0)
    setAnswerCorrect(null)
    setQuizComplete(false)
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
              <span>Pays maîtrisés</span>
              <span className="progress-number">0 / 195</span>
            </div>

            <div className="progress-track">
              <div className="progress-fill" />
            </div>

            <div className="progress-caption">Commencez votre apprentissage</div>
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

          <aside className="quiz-panel">
            <div className="quiz-header">
              <div className="section-label">SESSION D'APPRENTISSAGE</div>
              <div className="quiz-step">QUESTION 01</div>
            </div>

            <div className="quiz-content">
              <div className="quiz-mode-label">{selectedMode.description}</div>

              {activeMode === 'flags' && quizComplete ? (
                <>
                  <h2>Quiz terminé !</h2>
                  <div className="answer-placeholder" aria-live="polite">
                    Ton score : {score} / {flagQuestions.length}
                  </div>
                  <button className="quiz-next-button" onClick={restartQuiz}>
                    Rejouer le quiz
                  </button>
                </>
              ) : activeMode === 'flags' ? (
                <>
                  <h2>Quel pays possède ce drapeau ?</h2>
                  <div className="quiz-step">
                    QUESTION {String(questionIndex + 1).padStart(2, '0')} / {flagQuestions.length}
                  </div>
                  <div className="flag-container">
                    <div className="flag">{currentQuestion.flag}</div>
                  </div>
                  <div className="question-instruction">
                    Sélectionnez le territoire correspondant sur la carte.
                  </div>
                  <div className="answer-placeholder" aria-live="polite">
                    {answerCorrect === null ? (
                      <>
                        <span className="answer-placeholder-icon">⌖</span>
                        <span>En attente de sélection sur la carte</span>
                      </>
                    ) : (
                      <span>
                        {answerCorrect
                          ? `Bonne réponse : ${currentQuestion.countryName} !`
                          : `Ce n’est pas ${currentQuestion.countryName}. Réessaie ou passe à la suite.`}
                      </span>
                    )}
                  </div>
                  {answerCorrect !== null && (
                    <button className="quiz-next-button" onClick={advanceQuestion}>
                      {questionIndex === flagQuestions.length - 1
                        ? 'Voir le résultat'
                        : 'Question suivante'}
                    </button>
                  )}
                </>
              ) : (
                <div className="answer-placeholder">
                  Ce mode sera ajouté après le premier quiz jouable.
                </div>
              )}

              <div className="quiz-divider" />

              <div className="quiz-information">
                <div className="info-label">ÉTAPE SUIVANTE</div>
                <div className="next-step">
                  <span className="next-step-number">02</span>
                  <div>
                    <div className="next-step-title">Identifier la capitale</div>
                    <div className="next-step-description">
                      Après avoir trouvé le pays
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="quiz-footer">
              <div className="score-label">SCORE DE LA SESSION</div>
              <div className="score-value">
                {score} <span>/ {quizComplete ? flagQuestions.length : questionIndex + (answerCorrect === null ? 0 : 1)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
