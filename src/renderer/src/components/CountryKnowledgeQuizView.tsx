import WorldMap from './WorldMap'
import { getFlagImageSource } from '../data/quiz/flagAssets'
import {
  getCountryKnowledgeCountry,
  type CountryKnowledgeQuestion
} from '../data/quiz/countryKnowledge'
import type { QuizSession } from '../data/quiz/useQuizSession'

type CountryKnowledgeQuizViewProps = {
  alpha2: string
  session: QuizSession<CountryKnowledgeQuestion>
  onAnswer: (answer: string) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onStop: () => void
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })

export function CountryKnowledgeQuizView({
  alpha2,
  session,
  onAnswer,
  onRevealAnswer,
  onNext,
  onRestart,
  onStop
}: CountryKnowledgeQuizViewProps): React.JSX.Element {
  const country = getCountryKnowledgeCountry(alpha2)
  const countryName = countryNames.of(alpha2) ?? country?.countryName ?? alpha2
  const question = session.questionOrder[session.questionIndex]
  const total = session.questionOrder.length
  const questionSettled = session.answerCorrect !== null || session.answerRevealed
  const completedCount = session.questionIndex + (questionSettled ? 1 : 0)
  const progress = total ? (completedCount / total) * 100 : 0

  return (
    <main className="country-knowledge-screen">
      <header className="statistics-header">
        <div>
          <div className="breadcrumb">APPRENTISSAGE / QUIZ PAYS</div>
          <h1>À la découverte de {countryName}</h1>
          <p>Réponds à des questions sur ses villes, ses reliefs, sa capitale et sa géographie.</p>
        </div>
        <button className="home-back-button" type="button" onClick={onStop}>
          Arrêter le quiz
        </button>
      </header>

      <div className="country-knowledge-content">
        <section className="country-knowledge-map" aria-label={`Carte de ${countryName}`}>
          <WorldMap
            showBorders
            showLabels={false}
            quizTargetFeatureId={country?.sourceFeatureId ?? null}
          />
          <div className="country-knowledge-country-card">
            <img src={getFlagImageSource(alpha2)} alt={`Drapeau de ${countryName}`} />
            <div>
              <span>PAYS ÉTUDIÉ</span>
              <strong>{countryName}</strong>
            </div>
          </div>
        </section>

        <section className="country-knowledge-question-panel" aria-live="polite">
          {session.completed ? (
            <div className="country-knowledge-complete">
              <div className="section-label">QUIZ TERMINÉ</div>
              <h2>Bien joué !</h2>
              <p>
                Tu as obtenu{' '}
                <strong>
                  {session.score} bonne{session.score > 1 ? 's' : ''} réponse
                  {session.score > 1 ? 's' : ''}
                </strong>{' '}
                sur {total}.
              </p>
              <div className="country-knowledge-complete-actions">
                <button className="quiz-start-button" type="button" onClick={onRestart}>
                  Rejouer ce pays
                </button>
                <button className="home-back-button" type="button" onClick={onStop}>
                  Choisir un autre pays
                </button>
              </div>
            </div>
          ) : question ? (
            <>
              <div className="country-knowledge-progress">
                <div className="quiz-progress-row">
                  <span className="quiz-step">
                    QUESTION {String(session.questionIndex + 1).padStart(2, '0')} / {total}
                  </span>
                  <span className="country-knowledge-score">Score : {session.score}</span>
                </div>
                <div
                  className="quiz-progress-track"
                  role="progressbar"
                  aria-label="Progression du quiz pays"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={completedCount}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="country-knowledge-question">
                <span className="country-knowledge-category">{question.category}</span>
                <h2>{question.prompt}</h2>
                <div
                  className="country-knowledge-choices"
                  role="group"
                  aria-label="Choisir une réponse"
                >
                  {question.choices.map((choice) => {
                    const selected = session.selectedAnswer === choice
                    const resultClass = selected
                      ? session.answerCorrect
                        ? ' country-knowledge-choice-correct'
                        : ' country-knowledge-choice-incorrect'
                      : ''

                    return (
                      <button
                        key={choice}
                        className={`country-knowledge-choice${resultClass}`}
                        type="button"
                        onClick={() => onAnswer(choice)}
                        disabled={questionSettled}
                        aria-pressed={selected}
                      >
                        {choice}
                      </button>
                    )
                  })}
                </div>

                <div className="country-knowledge-feedback" aria-live="polite">
                  {!questionSettled ? (
                    <span>Choisis une réponse parmi les propositions.</span>
                  ) : session.answerCorrect ? (
                    <span>Bonne réponse ! {question.explanation}</span>
                  ) : session.answerRevealed ? (
                    <span>
                      Réponse : <strong>{question.answer}</strong>. {question.explanation}
                    </span>
                  ) : (
                    <span>
                      Ce n’est pas la bonne réponse. Tu peux voir la solution ou passer à la suite.
                    </span>
                  )}
                </div>
              </div>

              <div className="country-knowledge-actions">
                {!session.answerCorrect && !session.answerRevealed && (
                  <button className="quiz-reveal-button" type="button" onClick={onRevealAnswer}>
                    Voir la réponse
                  </button>
                )}
                {questionSettled && (
                  <button className="quiz-next-button" type="button" onClick={onNext}>
                    {session.questionIndex === total - 1 ? 'Voir le résultat' : 'Question suivante'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="country-knowledge-complete">
              <h2>Aucune question disponible</h2>
              <button className="home-back-button" type="button" onClick={onStop}>
                Retour aux pays
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
