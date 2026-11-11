import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { CountryFlagQuestion } from '../data/quiz/countryQuestions'
import { flagEmojiFromAlpha2 } from '../data/quiz/flagEmoji'
import type { CountryCapitalQuestion } from '../data/quiz/countryCapitals'
import type { QuizSession } from '../data/quiz/useQuizSession'
import {
  flagHasColorNear,
  flagShapes,
  getFlagImageSource,
  getFlagShape,
  type FlagShapeId
} from '../data/quiz/flagAssets'
import {
  type CountryQuizQuestion,
  type QuizAnswers,
  type QuizClues,
  normalizeQuizAnswer
} from '../data/quiz/countryQuiz'

type QuizPanelFrameProps<Question> = {
  description: string
  nextStepTitle: string
  nextStepDescription: string
  session: QuizSession<Question>
  total: number
  onRevealAnswer: () => void
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
  onRevealAnswer,
  onNext,
  onRestart,
  children
}: QuizPanelFrameProps<Question>): React.JSX.Element {
  const questionSettled =
    session.answerCorrect !== null || session.answerRevealed
  const answeredCount = session.questionIndex + (questionSettled ? 1 : 0)

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
            {session.answerCorrect !== true && !session.answerRevealed && (
              <button
                className="quiz-reveal-button"
                onClick={onRevealAnswer}
              >
                Voir la réponse
              </button>
            )}
            {questionSettled && (
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
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
}

export function FlagsQuizPanel({
  session,
  onRevealAnswer,
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
      onRevealAnswer={onRevealAnswer}
      onNext={onNext}
      onRestart={onRestart}
    >
      <h2>Quel pays possède ce drapeau ?</h2>
      <div className="flag-container">
        <div className="flag">{flagEmojiFromAlpha2(question.alpha2)}</div>
      </div>
      <div className="question-instruction">
        Sélectionnez le pays correspondant sur la carte.
      </div>
      <div className="answer-placeholder" aria-live="polite">
        {session.answerCorrect === null && !session.answerRevealed ? (
          <>
            <span className="answer-placeholder-icon">⌖</span>
            <span>En attente de sélection sur la carte</span>
          </>
        ) : (
          <span>
            {session.answerCorrect
              ? `Bonne réponse : ${question.countryName} !`
              : session.answerRevealed
                ? `Réponse : ${question.countryName}.`
                : 'Mauvaise réponse. Réessaie ou passe à la suite.'}
          </span>
        )}
      </div>
    </QuizPanelFrame>
  )
}

type CapitalsQuizPanelProps = {
  session: QuizSession<CountryCapitalQuestion>
  onAnswer: (isCorrect: boolean, selectedAnswer: string) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
}

export function CapitalsQuizPanel({
  session,
  onAnswer,
  onRevealAnswer,
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
      onRevealAnswer={onRevealAnswer}
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
              disabled={session.answerCorrect === true || session.answerRevealed}
              aria-pressed={selected}
            >
              {choice}
            </button>
          )
        })}
      </div>
      <div className="answer-placeholder" aria-live="polite">
        {session.answerCorrect === null && !session.answerRevealed ? (
          <span>Choisis une réponse parmi les quatre propositions.</span>
        ) : (
          <span>
            {session.answerCorrect
              ? `Bonne réponse : ${question.capitalName} !`
              : session.answerRevealed
                ? `Réponse : ${question.capitalName}.`
                : 'Pas tout à fait. Réessaie ou passe à la suite.'}
          </span>
        )}
      </div>
      {(session.answerCorrect === true || session.answerRevealed) && question.note && (
        <p className="capital-note">{question.note}</p>
      )}
    </QuizPanelFrame>
  )
}

type SelectedMapCountry = {
  sourceFeatureId: string | number
  name: string
} | null

type CountryQuizPanelProps = {
  session: QuizSession<CountryQuizQuestion>
  clues: QuizClues
  answers: QuizAnswers
  selectedMapCountry: SelectedMapCountry
  onAnswer: (answers: {
    countryName: string
    capital: string
    flagAlpha2: string | null
  }) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
}

function CountryQuizAnswerForm({
  question,
  session,
  answers,
  selectedMapCountry,
  countryIsHighlighted,
  onAnswer
}: {
  question: CountryQuizQuestion
  session: QuizSession<CountryQuizQuestion>
  answers: QuizAnswers
  selectedMapCountry: SelectedMapCountry
  countryIsHighlighted: boolean
  onAnswer: CountryQuizPanelProps['onAnswer']
}): React.JSX.Element {
  const [countryName, setCountryName] = useState('')
  const [capital, setCapital] = useState('')
  const [flagAlpha2, setFlagAlpha2] = useState<string | null>(null)
  const [flagSearch, setFlagSearch] = useState('')
  const [flagColorDraft, setFlagColorDraft] = useState('#e53935')
  const [flagColorFilters, setFlagColorFilters] = useState<string[]>([])
  const [flagShapeFilters, setFlagShapeFilters] = useState<FlagShapeId[]>([])
  const disabled = session.answerCorrect === true || session.answerRevealed
  const mapOnly =
    answers.countryOnMap &&
    !answers.countryName &&
    !answers.capital &&
    !answers.flag

  const filteredFlagChoices = question.flagChoices
    .filter((choice) => {
      const query = normalizeQuizAnswer(flagSearch)
      const matchesName = !query || normalizeQuizAnswer(choice.frenchCountryName).includes(query)
      const matchesColors = flagColorFilters.every((color) => flagHasColorNear(choice.alpha2, color))
      const matchesShape =
        flagShapeFilters.length === 0 || flagShapeFilters.includes(getFlagShape(choice.alpha2))
      return matchesName && matchesColors && matchesShape
    })
    .sort((first, second) =>
      first.frenchCountryName.localeCompare(second.frenchCountryName, 'fr')
    )

  const canSubmit =
    (!answers.countryOnMap || selectedMapCountry !== null) &&
    (!answers.countryName || countryName.trim().length > 0) &&
    (!answers.capital || capital.trim().length > 0) &&
    (!answers.flag || flagAlpha2 !== null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onAnswer({ countryName, capital, flagAlpha2 })
  }

  return (
    <form className="country-quiz-answer-form" onSubmit={handleSubmit}>
      {answers.countryOnMap && (
        <div className="country-answer-map-selection" aria-live="polite">
          <span className="answer-placeholder-icon">⌖</span>
          <span>
            {selectedMapCountry
              ? `Pays sélectionné : ${selectedMapCountry.name}`
              : 'Sélectionne un pays sur la carte.'}
          </span>
        </div>
      )}

      {answers.countryName && (
        <label className="country-answer-field">
          <span>{countryIsHighlighted ? 'Nom du pays mis en évidence' : 'Nom du pays'}</span>
          <input
            type="text"
            autoComplete="off"
            value={countryName}
            onChange={(event) => setCountryName(event.target.value)}
            disabled={disabled}
            placeholder={countryIsHighlighted
              ? 'Écris le nom du pays sur la carte'
              : 'Écris le nom du pays'}
          />
        </label>
      )}

      {answers.capital && (
        <label className="country-answer-field">
          <span>Capitale</span>
          <input
            type="text"
            autoComplete="off"
            value={capital}
            onChange={(event) => setCapital(event.target.value)}
            disabled={disabled}
            placeholder="Écris le nom de la capitale"
          />
        </label>
      )}

      {answers.flag && (
        <div className="country-answer-field">
          <span>Choisis le drapeau correspondant</span>
          <input
            className="country-flag-search"
            type="search"
            value={flagSearch}
            onChange={(event) => setFlagSearch(event.target.value)}
            placeholder="Chercher un pays"
            aria-label="Chercher un drapeau par pays"
            disabled={disabled}
          />
          <div className="country-flag-filters">
            <div className="country-flag-color-filter">
              <label htmlFor="flag-color-picker">Couleur du drapeau</label>
              <input
                id="flag-color-picker"
                type="color"
                value={flagColorDraft}
                onChange={(event) => setFlagColorDraft(event.target.value)}
                aria-label="Choisir une couleur de drapeau"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => setFlagColorFilters((current) =>
                  current.includes(flagColorDraft)
                    ? current
                    : [...current, flagColorDraft]
                )}
                disabled={disabled || flagColorFilters.includes(flagColorDraft)}
              >
                Ajouter
              </button>
              <div className="country-flag-color-chips">
                {flagColorFilters.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="country-flag-color-chip"
                    style={{ backgroundColor: color }}
                    title={`Retirer le filtre ${color}`}
                    aria-label={`Retirer le filtre de couleur ${color}`}
                    onClick={() => setFlagColorFilters((current) => current.filter((item) => item !== color))}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
            <div className="country-flag-shape-filters" aria-label="Filtrer par forme">
              <span>Forme</span>
              {flagShapes.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  className={`country-flag-shape-filter${flagShapeFilters.includes(shape.id) ? ' selected' : ''}`}
                  aria-pressed={flagShapeFilters.includes(shape.id)}
                  onClick={() => setFlagShapeFilters((current) =>
                    current.includes(shape.id)
                      ? current.filter((item) => item !== shape.id)
                      : [...current, shape.id]
                  )}
                  disabled={disabled}
                >
                  <img
                    src={getFlagImageSource(shape.exampleAlpha2)}
                    className={`country-flag-shape-preview ${shape.kind}`}
                    style={{ width: `${Math.min(48, Math.max(17, shape.ratio * 20))}px` }}
                    alt=""
                  />
                  {shape.label}
                </button>
              ))}
            </div>
          </div>
          <div className="country-flag-choices" role="group" aria-label="Choisir un drapeau">
            {filteredFlagChoices.map((choice) => (
              <button
                key={choice.alpha2}
                className={`country-flag-choice${flagAlpha2 === choice.alpha2 ? ' selected' : ''}`}
                type="button"
                onClick={() => setFlagAlpha2(choice.alpha2)}
                disabled={disabled}
                aria-label={`Drapeau de ${choice.frenchCountryName}`}
                title={choice.frenchCountryName}
                aria-pressed={flagAlpha2 === choice.alpha2}
              >
                <img src={getFlagImageSource(choice.alpha2)} alt="" />
                <span>{choice.frenchCountryName}</span>
              </button>
            ))}
            {filteredFlagChoices.length === 0 && (
              <p className="country-flag-no-results">Aucun drapeau ne correspond à ces filtres.</p>
            )}
          </div>
        </div>
      )}

      {!mapOnly && !disabled && (
        <button className="quiz-next-button" type="submit" disabled={!canSubmit}>
          Vérifier mes réponses
        </button>
      )}

      {session.answerCorrect === true && (
        <div className="answer-placeholder" aria-live="polite">
          Bonne réponse !
        </div>
      )}
      {session.answerCorrect === false && !session.answerRevealed && (
        <div className="answer-placeholder" aria-live="polite">
          Il y a au moins une erreur. Corrige tes réponses ou regarde la solution.
        </div>
      )}
    </form>
  )
}

export function CountryQuizPanel({
  session,
  clues,
  answers,
  selectedMapCountry,
  onAnswer,
  onRevealAnswer,
  onNext,
  onRestart
}: CountryQuizPanelProps): React.JSX.Element {
  const question = session.questionOrder[session.questionIndex]
  const hasClue = Object.values(clues).some(Boolean)
  const revealText = [
    question.frenchCountryName,
    question.capitalName,
    flagEmojiFromAlpha2(question.alpha2)
  ].join(' · ')

  return (
    <QuizPanelFrame
      description="Retrouve les informations demandées à partir des indices."
      nextStepTitle="Personnaliser le quiz"
      nextStepDescription="Choisis les indices et les réponses"
      session={session}
      total={session.questionOrder.length}
      onRevealAnswer={onRevealAnswer}
      onNext={onNext}
      onRestart={onRestart}
    >
      <h2>{hasClue ? 'Observe les indices' : 'Choisis au moins un indice'}</h2>
      {clues.countryOnMap && (
        <div className="answer-placeholder">
          Le pays à reconnaître est mis en évidence sur la carte.
        </div>
      )}
      {clues.flag && (
        <div className="flag-container">
          <img
            className="flag flag-svg"
            src={getFlagImageSource(question.alpha2)}
            alt={`Drapeau de ${question.frenchCountryName}`}
          />
        </div>
      )}
      {clues.countryName && (
        <div className="quiz-clue-card">
          <span>Nom du pays</span>
          <strong>{question.frenchCountryName}</strong>
        </div>
      )}
      {clues.capital && (
        <div className="quiz-clue-card">
          <span>Capitale</span>
          <strong>{question.capitalName}</strong>
        </div>
      )}
      {hasClue && (
        <CountryQuizAnswerForm
          key={`${question.sourceFeatureId}:${session.questionIndex}`}
          question={question}
          session={session}
          answers={answers}
          selectedMapCountry={selectedMapCountry}
          countryIsHighlighted={clues.countryOnMap}
          onAnswer={onAnswer}
        />
      )}
      {session.answerRevealed && (
        <div className="answer-placeholder" aria-live="polite">
          Réponse : {revealText}
        </div>
      )}
    </QuizPanelFrame>
  )
}
