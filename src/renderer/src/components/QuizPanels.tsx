import type { ReactNode } from 'react'
import type { CountryFlagQuestion } from '../data/quiz/countryQuestions'
import type { CountryCapitalQuestion } from '../data/quiz/countryCapitals'
import type { QuizSession } from '../data/quiz/useQuizSession'

type QuizPanelFrameProps<Question> = {
  description: string
  nextStepTitle: string
  nextStepDescription: string
  session: QuizSession<Question>
  total: number
  onNext: () => void
  onRestart: () => void
  children: ReactNode
}

function QuizPanelFrame<Question>({
  description,
  nextStepTitle,
  nextStepDescription,
  session,
  total,
  onNext,
  onRestart,
  children
}: QuizPanelFrameProps<Question>): React.JSX.Element {
  const answeredCount =
    session.questionIndex + (session.answerCorrect === null ? 0 : 1)

  return (
    <aside className="quiz-panel">
      <div className="quiz-header">
        <div className="section-label">SESSION D’APPRENTISSAGE</div>
        <div className="quiz-step">
          QUESTION {String(session.questionIndex + 1).padStart(2, '0')} / {total}
        </div>
      </div>

      <div className="quiz-content">
        <div className="quiz-mode-label">{description}</div>

        {session.completed ? (
          <>
            <h2>Quiz terminé !</h2>
            <div className="answer-placeholder" aria-live="polite">
              Ton score : {session.score} / {total}
            </div>
            <button className="quiz-next-button" onClick={onRestart}>
              Rejouer le quiz
            </button>
          </>
        ) : (
          <>
            {children}
            {session.answerCorrect !== null && (
              <button className="quiz-next-button" onClick={onNext}>
                {session.questionIndex === total - 1
                  ? 'Voir le résultat'
                  : 'Question suivante'}
              </button>
            )}
          </>
        )}

        <div className="quiz-divider" />

        <div className="quiz-information">
          <div className="info-label">ÉTAPE SUIVANTE</div>
          <div className="next-step">
            <span className="next-step-number">02</span>
            <div>
              <div className="next-step-title">{nextStepTitle}</div>
              <div className="next-step-description">
                {nextStepDescription}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="quiz-footer">
        <div className="score-label">SCORE DE LA SESSION</div>
        <div className="score-value">
          {session.score} <span>/ {answeredCount}</span>
        </div>
      </div>
    </aside>
  )
}

type FlagsQuizPanelProps = {
  session: QuizSession<CountryFlagQuestion>
  onNext: () => void
  onRestart: () => void
}

function flagFromAlpha2(alpha2: string): string {
  return String.fromCodePoint(
    ...alpha2.split('').map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  )
}

export function FlagsQuizPanel({
  session,
  onNext,
  onRestart
}: FlagsQuizPanelProps): React.JSX.Element {
  const question = session.questionOrder[session.questionIndex]

  return (
    <QuizPanelFrame
      description="Reconnaître un pays à partir de son drapeau"
      nextStepTitle="Connaître les capitales"
      nextStepDescription="Après avoir trouvé le pays"
      session={session}
      total={session.questionOrder.length}
      onNext={onNext}
      onRestart={onRestart}
    >
      <h2>Quel pays possède ce drapeau ?</h2>
      <div className="flag-container">
        <div className="flag">{flagFromAlpha2(question.alpha2)}</div>
      </div>
      <div className="question-instruction">
        Sélectionnez le pays correspondant sur la carte.
      </div>
      <div className="answer-placeholder" aria-live="polite">
        {session.answerCorrect === null ? (
          <>
            <span className="answer-placeholder-icon">⌖</span>
            <span>En attente de sélection sur la carte</span>
          </>
        ) : (
          <span>
            {session.answerCorrect
              ? `Bonne réponse : ${question.countryName} !`
              : `Ce n’est pas ${question.countryName}. Réessaie ou passe à la suite.`}
          </span>
        )}
      </div>
    </QuizPanelFrame>
  )
}

type CapitalsQuizPanelProps = {
  session: QuizSession<CountryCapitalQuestion>
  onAnswer: (isCorrect: boolean, selectedAnswer: string) => void
  onNext: () => void
  onRestart: () => void
}

export function CapitalsQuizPanel({
  session,
  onAnswer,
  onNext,
  onRestart
}: CapitalsQuizPanelProps): React.JSX.Element {
  const question = session.questionOrder[session.questionIndex]

  return (
    <QuizPanelFrame
      description="Retrouver la capitale d’un pays"
      nextStepTitle="Explorer les territoires"
      nextStepDescription="Après avoir appris les capitales"
      session={session}
      total={session.questionOrder.length}
      onNext={onNext}
      onRestart={onRestart}
    >
      <h2>Quelle est la capitale de {question.countryName} ?</h2>
      <div className="capital-choices" role="group" aria-label="Choisir une capitale">
        {question.choices.map((choice) => {
          const selected = session.selectedAnswer === choice
          const resultClass = selected
            ? session.answerCorrect
              ? ' capital-option-correct'
              : ' capital-option-incorrect'
            : ''

          return (
            <button
              key={choice}
              className={`capital-option${resultClass}`}
              onClick={() => onAnswer(choice === question.capitalName, choice)}
              disabled={session.answerCorrect === true}
              aria-pressed={selected}
            >
              {choice}
            </button>
          )
        })}
      </div>
      <div className="answer-placeholder" aria-live="polite">
        {session.answerCorrect === null ? (
          <span>Choisis une réponse parmi les quatre propositions.</span>
        ) : (
          <span>
            {session.answerCorrect
              ? `Bonne réponse : ${question.capitalName} !`
              : `Pas tout à fait. La capitale est ${question.capitalName}. Tu peux réessayer ou passer.`}
          </span>
        )}
      </div>
      {session.answerCorrect !== null && question.note && (
        <p className="capital-note">{question.note}</p>
      )}
    </QuizPanelFrame>
  )
}
