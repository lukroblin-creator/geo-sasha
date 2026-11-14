import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../data/i18n'
import countryCatalog from '../data/quiz/countryCatalog.json'
import type { CountryFlagQuestion } from '../data/quiz/countryQuestions'
import { flagEmojiFromAlpha2 } from '../data/quiz/flagEmoji'
import type { CountryCapitalQuestion } from '../data/quiz/countryCapitals'
import { formatQuizScore, type QuizSession } from '../data/quiz/useQuizSession'
import {
  flagHasColorNear,
  flagOutlineMatches,
  getFlagAspectRatio,
  getFlagBandCounts,
  getFlagImageSource,
  getFlagOutline,
  type FlagPolygonDrawing,
  type FlagRatioRange
} from '../data/quiz/flagAssets'
import { FlagRatioFilter } from './FlagRatioFilter'
import {
  type CountryQuizQuestion,
  type QuizAnswers,
  type QuizClues,
  normalizeQuizAnswer
} from '../data/quiz/countryQuiz'
import type { MapProximityResult } from '../data/quiz/mapProximity'

type QuizPanelFrameProps<Question> = {
  heading?: string
  description: string
  session: QuizSession<Question>
  total: number
  showProgress?: boolean
  showScore?: boolean
  showStop?: boolean
  showActions?: boolean
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onStop?: () => void
  children: ReactNode
}

export function CorrectAnswerBanner({
  answer,
  children
}: {
  answer?: string
  children?: ReactNode
}): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="quiz-correct-banner" role="status" aria-live="polite">
      <span className="quiz-correct-banner-icon" aria-hidden="true">✓</span>
      <div className="quiz-correct-banner-content">
        <strong className="quiz-correct-banner-title">{t('Bonne réponse !')}</strong>
        {answer && <span className="quiz-correct-banner-answer">{answer}</span>}
        {children && <div className="quiz-correct-answer-details">{children}</div>}
      </div>
    </div>
  )
}

function QuizPanelFrame<Question>({
  heading = 'QUIZ EN COURS',
  description,
  session,
  total,
  showProgress = true,
  showScore = true,
  showStop = true,
  showActions = true,
  onRevealAnswer,
  onNext,
  onRestart,
  onStop,
  children
}: QuizPanelFrameProps<Question>): React.JSX.Element {
  const { language, t } = useLanguage()
  const questionSettled = session.answerCorrect === true || session.answerRevealed
  const answeredCount = session.questionIndex + (questionSettled ? 1 : 0)
  const progress = total > 0 ? (answeredCount / total) * 100 : 0

  return (
    <aside className="quiz-panel">
      <div className="quiz-header">
        <div className="quiz-header-topline">
          <div className="section-label">{t(heading)}</div>
          {showStop && onStop && !session.completed && (
            <button
              className="quiz-stop-button"
              type="button"
              onClick={onStop}
              aria-label={t('Arrêter la partie et revenir à l’accueil')}
            >
              {t('Arrêter')}
            </button>
          )}
        </div>
        {showProgress && (
          <>
            <div className="quiz-progress-row">
              <div className="quiz-step">
                {t('QUESTION')} {String(Math.min(session.questionIndex + 1, total)).padStart(2, '0')} / {total}
              </div>
              <div className="quiz-progress-count">{answeredCount} {t(answeredCount > 1 ? 'terminées' : 'terminée')}</div>
            </div>
            <div
              className="quiz-progress-track"
              role="progressbar"
              aria-label={t('Progression du quiz')}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answeredCount}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="quiz-content">
        <div className="quiz-mode-label">{t(description)}</div>

        {session.completed ? (
          <>
            <h2>{t('Quiz terminé !')}</h2>
            <div className="answer-placeholder" aria-live="polite">
              {t('Ton score')} : {formatQuizScore(session.score, language)} / {total}
            </div>
            {showActions && (
              <button className="quiz-next-button" onClick={onRestart}>
                {t('Rejouer le quiz')}
              </button>
            )}
          </>
        ) : (
          <>
            {children}
            {showActions && (
              <div className="quiz-panel-actions">
                {session.answerCorrect !== true && !session.answerRevealed && (
                  <button
                    className="quiz-reveal-button"
                    onClick={onRevealAnswer}
                  >
                    {t('Voir la réponse')}
                  </button>
                )}
                {questionSettled && (
                  <button className="quiz-next-button" onClick={onNext}>
                    {session.questionIndex === total - 1
                      ? t('Voir le résultat')
                      : t('Question suivante')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {showScore && (
        <div className="quiz-footer">
          <div className="score-label">{t('SCORE DE LA SESSION')}</div>
          <div className="score-value">
            {formatQuizScore(session.score, language)} <span>/ {total}</span>
          </div>
        </div>
      )}
    </aside>
  )
}

type FlagsQuizPanelProps = {
  session: QuizSession<CountryFlagQuestion>
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onStop: () => void
}

export function FlagsQuizPanel({
  session,
  onRevealAnswer,
  onNext,
  onRestart,
  onStop
}: FlagsQuizPanelProps): React.JSX.Element {
  const { t } = useLanguage()
  const question = session.questionOrder[session.questionIndex]

  return (
    <QuizPanelFrame
      description="Reconnaître un pays à partir de son drapeau"
      session={session}
      total={session.questionOrder.length}
      onRevealAnswer={onRevealAnswer}
      onNext={onNext}
      onRestart={onRestart}
      onStop={onStop}
    >
      <h2>{t('Quel pays possède ce drapeau ?')}</h2>
      <div className="flag-container">
        <div className="flag">{flagEmojiFromAlpha2(question.alpha2)}</div>
      </div>
      <div className="question-instruction">
        {t('Sélectionnez le pays correspondant sur la carte.')}
      </div>
      {session.answerCorrect ? (
        <CorrectAnswerBanner answer={question.countryName} />
      ) : (
        <div className="answer-placeholder" aria-live="polite">
          {session.answerCorrect === null && !session.answerRevealed ? (
            <>
              <span className="answer-placeholder-icon">⌖</span>
              <span>{t('En attente de sélection sur la carte')}</span>
            </>
          ) : (
            <span>
              {session.answerRevealed
                ? `${t('Réponse')} : ${question.countryName}.`
                : `${t('Essai')} ${session.attemptCount} · ${t('Essaie encore.')}`}
            </span>
          )}
        </div>
      )}
    </QuizPanelFrame>
  )
}

type CapitalsQuizPanelProps = {
  session: QuizSession<CountryCapitalQuestion>
  onAnswer: (isCorrect: boolean, selectedAnswer: string) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onStop: () => void
}

export function CapitalsQuizPanel({
  session,
  onAnswer,
  onRevealAnswer,
  onNext,
  onRestart,
  onStop
}: CapitalsQuizPanelProps): React.JSX.Element {
  const { t } = useLanguage()
  const question = session.questionOrder[session.questionIndex]

  return (
    <QuizPanelFrame
      description="Retrouver la capitale d’un pays"
      session={session}
      total={session.questionOrder.length}
      onRevealAnswer={onRevealAnswer}
      onNext={onNext}
      onRestart={onRestart}
      onStop={onStop}
    >
      <h2>{t('Quelle est la capitale de')} {question.countryName} ?</h2>
      <div className="capital-choices" role="group" aria-label={t('Choisir une capitale')}>
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
      {session.answerCorrect ? (
        <CorrectAnswerBanner answer={question.capitalName} />
      ) : (
        <div className="answer-placeholder" aria-live="polite">
          {session.answerCorrect === null && !session.answerRevealed ? (
            <span>{t('Choisis une réponse parmi les quatre propositions.')}</span>
          ) : (
            <span>
              {session.answerRevealed
                ? `${t('Réponse')} : ${question.capitalName}.`
              : `${t('Essai')} ${session.attemptCount} · ${t('Essaie encore.')}`}
            </span>
          )}
        </div>
      )}
      {(session.answerCorrect === true || session.answerRevealed) && question.note && (
        <p className="capital-note">{question.note}</p>
      )}
    </QuizPanelFrame>
  )
}

type SelectedMapCountry = {
  sourceFeatureId: string | number
  name: string
  revealed?: boolean
} | null

type CountryQuizPanelProps = {
  session: QuizSession<CountryQuizQuestion>
  clues: QuizClues
  answers: QuizAnswers
  selectedMapCountry: SelectedMapCountry
  mapProximity: MapProximityResult | null
  showPanelActions?: boolean
  onAnswer: (outcomes: Record<string, boolean>) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
}

export function QuizCluesSidebar({
  session,
  clues
}: {
  session: QuizSession<CountryQuizQuestion>
  clues: QuizClues
}): React.JSX.Element {
  const { language, t } = useLanguage()
  const total = session.questionOrder.length
  const questionIndex = Math.min(session.questionIndex, total - 1)
  const question = session.questionOrder[questionIndex]
  const questionSettled = session.answerCorrect === true || session.answerRevealed
  const answeredCount = Math.min(total, session.questionIndex + (questionSettled ? 1 : 0))
  const progress = total > 0 ? (answeredCount / total) * 100 : 0

  if (!question) {
    return (
      <aside className="sidebar quiz-clue-sidebar" aria-label={t('Indices du quiz')}>
        <div className="quiz-clue-sidebar-header">
          <div className="section-label">{t('INDICES')}</div>
          <h2>{t('Indices de la question')}</h2>
        </div>
        <div className="quiz-empty-state">{t('Aucune question à afficher.')}</div>
      </aside>
    )
  }

  return (
    <aside className="sidebar quiz-clue-sidebar" aria-label={t('Indices du quiz')}>
      <div className="quiz-clue-sidebar-header">
        <div className="section-label">{t('INDICES')}</div>
        <h2>{session.completed ? t('Quiz terminé') : `${t('Question')} ${String(session.questionIndex + 1).padStart(2, '0')}`}</h2>
        <div className="quiz-clue-sidebar-count">
          {answeredCount} {t(answeredCount > 1 ? 'réponses' : 'réponse')} {t('sur')} {total}
        </div>
        <div
          className="quiz-progress-track"
          role="progressbar"
          aria-label={t('Progression du quiz')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="quiz-clue-sidebar-content">
        <div className="quiz-clues-list">
          {clues.countryOnMap && (
            <div className="quiz-clue-card quiz-map-clue">
              <span className="quiz-clue-icon" aria-hidden="true">⌖</span>
              <div>
              <span>{t('Sur la carte')}</span>
              <strong>{t('Le pays à reconnaître est mis en évidence.')}</strong>
              </div>
            </div>
          )}
          {clues.flag && (
            <div className="quiz-clue-card quiz-flag-clue">
              <span className="quiz-clue-title">{t('Drapeau')}</span>
              <div className="flag-container">
                <img
                  className="flag flag-svg"
                  src={getFlagImageSource(question.alpha2)}
                  alt={`Drapeau de ${question.frenchCountryName}`}
                />
              </div>
            </div>
          )}
          {clues.countryName && (
            <div className="quiz-clue-card">
              <span>{t('Nom du pays')}</span>
              <strong>{question.frenchCountryName}</strong>
            </div>
          )}
          {clues.capital && (
            <div className="quiz-clue-card">
              <span>{t('Capitale')}</span>
              <strong>{question.capitalName}</strong>
            </div>
          )}
          {!Object.values(clues).some(Boolean) && (
            <div className="quiz-empty-state">
              {t('Aucun indice n’est configuré. Reviens au contenu du quiz pour en choisir un.')}
            </div>
          )}
        </div>
      </div>

      <div className="quiz-clue-sidebar-footer">
        <div className="score-label">{t('SCORE DE LA SESSION')}</div>
        <div className="score-value">
            {formatQuizScore(session.score, language)} <span>/ {total}</span>
        </div>
      </div>
    </aside>
  )
}

function CountryQuizAnswerForm({
  question,
  session,
  answers,
  selectedMapCountry,
  mapProximity,
  countryIsHighlighted,
  onAnswer
}: {
  question: CountryQuizQuestion
  session: QuizSession<CountryQuizQuestion>
  answers: QuizAnswers
  selectedMapCountry: SelectedMapCountry
  mapProximity: MapProximityResult | null
  countryIsHighlighted: boolean
  onAnswer: CountryQuizPanelProps['onAnswer']
}): React.JSX.Element {
  const { language, t } = useLanguage()
  const [countryName, setCountryName] = useState('')
  const [countryNameSuggestionsOpen, setCountryNameSuggestionsOpen] = useState(false)
  const [capital, setCapital] = useState('')
  const [flagAlpha2, setFlagAlpha2] = useState<string | null>(null)
  const [flagColorDraft, setFlagColorDraft] = useState('#e53935')
  const [flagColorFilters, setFlagColorFilters] = useState<string[]>([])
  const [flagBandCount, setFlagBandCount] = useState(0)
  const [flagHorizontalBandsOnly, setFlagHorizontalBandsOnly] = useState(false)
  const [flagVerticalBandsOnly, setFlagVerticalBandsOnly] = useState(false)
  const [flagObliqueBandsOnly, setFlagObliqueBandsOnly] = useState(false)
  const [flagAspectRatioRange, setFlagAspectRatioRange] = useState<FlagRatioRange | null>(null)
  const [flagPolygonDrawing, setFlagPolygonDrawing] = useState<FlagPolygonDrawing | null>(null)
  const questionDisabled = session.answerCorrect === true || session.answerRevealed
  const localizedCountryNames = new Intl.DisplayNames([language], { type: 'region' })
  const countryNameChoices = useMemo(() => {
    const names = new Intl.DisplayNames([language], { type: 'region' })
    return countryCatalog
      .map((country) => ({
        alpha2: country.alpha2,
        name: names.of(country.alpha2) ?? country.countryName,
        alternateName: country.countryName
      }))
      .sort((first, second) => first.name.localeCompare(second.name, language))
  }, [language])
  const mapOnly =
    answers.countryOnMap &&
    !answers.countryName &&
    !answers.capital &&
    !answers.flag

  const availableFlagRatios = [...new Map(
    question.flagChoices.flatMap((choice) => {
      if (getFlagOutline(choice.alpha2)) return []
      const ratio = getFlagAspectRatio(choice.alpha2)
      return ratio ? [[ratio.ratio, ratio] as const] : []
    })
  ).values()].sort((first, second) => first.ratio - second.ratio)

  const availablePolygonShapes = [...new Map(
    question.flagChoices.flatMap((choice) => {
      const outline = getFlagOutline(choice.alpha2)
      return outline ? [[choice.alpha2, { name: localizedCountryNames.of(choice.alpha2) ?? choice.frenchName, vertexCount: outline.length }] as const] : []
    })
  ).values()]

  const maximumFlagBandCount = Math.max(
    1,
    ...question.flagChoices.map((choice) => {
      const bands = getFlagBandCounts(choice.alpha2)
      return Math.max(bands.horizontal, bands.vertical, bands.oblique)
    })
  )

  const filteredFlagChoices = question.flagChoices
    .filter((choice) => {
      const matchesColors = flagColorFilters.every((color) => flagHasColorNear(choice.alpha2, color))
      const bands = getFlagBandCounts(choice.alpha2)
      const selectedBandDirections = [
        ...(flagHorizontalBandsOnly ? ['horizontal' as const] : []),
        ...(flagVerticalBandsOnly ? ['vertical' as const] : []),
        ...(flagObliqueBandsOnly ? ['oblique' as const] : [])
      ]
      const matchesBandCount = selectedBandDirections.length
        ? selectedBandDirections.every((direction) =>
            flagBandCount === 0
              ? bands[direction] > 1
              : bands[direction] === flagBandCount
          )
        : flagBandCount === 0 ||
          Math.max(bands.horizontal, bands.vertical, bands.oblique) === flagBandCount
      const choiceRatio = getFlagAspectRatio(choice.alpha2)?.ratio
      const matchesShape = flagPolygonDrawing
        ? flagOutlineMatches(choice.alpha2, flagPolygonDrawing)
        : flagAspectRatioRange === null ||
          (!getFlagOutline(choice.alpha2) &&
            choiceRatio !== undefined &&
            choiceRatio >= flagAspectRatioRange.minimum &&
            choiceRatio <= flagAspectRatioRange.maximum)
      return matchesColors && matchesShape && matchesBandCount
    })
    .sort((first, second) =>
      (localizedCountryNames.of(first.alpha2) ?? first.frenchName).localeCompare(
        localizedCountryNames.of(second.alpha2) ?? second.frenchName,
        language
      )
    )

  const normalizedCountryNameQuery = normalizeQuizAnswer(countryName)
  const countryNameSuggestions = normalizedCountryNameQuery
    ? countryNameChoices.filter((choice) =>
        normalizeQuizAnswer(choice.name).includes(normalizedCountryNameQuery) ||
        normalizeQuizAnswer(choice.alternateName).includes(normalizedCountryNameQuery)
      )
    : []

  const countryNameMatches =
    !answers.countryName ||
    [
      question.countryName,
      question.frenchCountryName,
      localizedCountryNames.of(question.alpha2) ?? ''
    ].some(
      (name) => normalizeQuizAnswer(countryName) === normalizeQuizAnswer(name)
    )
  const capitalMatches =
    !answers.capital || normalizeQuizAnswer(capital) === normalizeQuizAnswer(question.capitalName)
  const countryNameIsCorrect = session.answerResults.countryName === true
  const capitalIsCorrect = session.answerResults.capital === true
  const flagIsCorrect = session.answerResults.flag === true
  const mapAnswerIsCorrect = session.answerResults.countryOnMap === true
  const hasSubmittableAnswer =
    (answers.countryName && countryName.trim().length > 0 && !countryNameIsCorrect) ||
    (answers.capital && capital.trim().length > 0 && !capitalIsCorrect) ||
    (answers.flag && flagAlpha2 !== null && !flagIsCorrect)
  const autoAnswerSentRef = useRef(new Set<string>())

  useEffect(() => {
    if (questionDisabled || mapOnly) return
    const outcomes: Record<string, boolean> = {}

    if (
      answers.countryName && countryName.trim() && countryNameMatches &&
      session.answerResults.countryName !== true &&
      !autoAnswerSentRef.current.has('countryName')
    ) {
      outcomes.countryName = true
      autoAnswerSentRef.current.add('countryName')
    }
    if (
      answers.capital && capital.trim() && capitalMatches &&
      session.answerResults.capital !== true &&
      !autoAnswerSentRef.current.has('capital')
    ) {
      outcomes.capital = true
      autoAnswerSentRef.current.add('capital')
    }
    if (
      answers.flag && flagAlpha2 === question.alpha2 &&
      session.answerResults.flag !== true &&
      !autoAnswerSentRef.current.has('flag')
    ) {
      outcomes.flag = true
      autoAnswerSentRef.current.add('flag')
    }

    if (Object.keys(outcomes).length > 0) onAnswer(outcomes)
  }, [
    answers.capital,
    answers.countryName,
    answers.flag,
    capital,
    capitalMatches,
    countryName,
    countryNameMatches,
    flagAlpha2,
    question.alpha2,
    questionDisabled,
    mapOnly,
    onAnswer,
    session.answerResults
  ])

  return (
    <div className="country-quiz-answer-form">
      {answers.countryOnMap && (
        <div
          className={`country-answer-map-selection${mapAnswerIsCorrect ? ' is-correct' : ''}`}
          aria-live="polite"
        >
          <span className="answer-placeholder-icon">⌖</span>
          <div className="country-answer-map-selection-content">
            <span>
              {selectedMapCountry
                ? `${t('Pays sélectionné')} : ${selectedMapCountry.name}`
                : t('Sélectionne un pays sur la carte.')}
            </span>
            {mapProximity !== null && (
              <div className="country-answer-map-proximity" aria-live="polite">
                <strong>{t('Précision du clic :')} {mapProximity.score} %</strong>
                {mapProximity.distanceKm !== null && (
                  <span>
                    {t('Distance estimée jusqu’au centre du pays cible :')}{' '}
                    {mapProximity.distanceKm.toLocaleString(language)} km
                  </span>
                )}
                <small>{t('Indice pour ton prochain clic · sans effet sur le score du quiz.')}</small>
              </div>
            )}
          </div>
          {mapAnswerIsCorrect && (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          )}
        </div>
      )}

      {answers.countryName && (
        <div
          className={`country-answer-field${countryNameIsCorrect ? ' is-correct' : session.answerResults.countryName === false ? ' is-incorrect' : ''}`}
        >
          <label htmlFor="quiz-country-name-answer">
            {t(countryIsHighlighted ? 'Nom du pays mis en évidence' : 'Nom du pays')}
          </label>
          <div className="country-answer-input-wrap">
            <input
              id="quiz-country-name-answer"
              className="country-answer-text-input"
              type="text"
              autoComplete="off"
              value={countryName}
              onFocus={() => setCountryNameSuggestionsOpen(true)}
              onBlur={() => setCountryNameSuggestionsOpen(false)}
              onChange={(event) => {
                setCountryName(event.target.value)
                setCountryNameSuggestionsOpen(true)
              }}
              disabled={questionDisabled || countryNameIsCorrect}
              placeholder={countryIsHighlighted
                ? t('Écris le nom du pays sur la carte')
                : t('Écris le nom du pays')}
              aria-autocomplete="list"
              aria-expanded={countryNameSuggestionsOpen && countryNameSuggestions.length > 0}
              aria-controls="quiz-country-name-suggestions"
            />
            {countryNameSuggestionsOpen && countryNameSuggestions.length > 0 && !questionDisabled && !countryNameIsCorrect && (
              <div
                id="quiz-country-name-suggestions"
                className="country-answer-suggestions"
                role="listbox"
              >
                {countryNameSuggestions.map((choice) => (
                  <button
                    key={choice.alpha2}
                    type="button"
                    className="country-answer-suggestion"
                    role="option"
                    aria-selected={false}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setCountryName(choice.name)
                      setCountryNameSuggestionsOpen(false)
                    }}
                  >
                    <span>{choice.name}</span>
                    {!answers.flag && <img src={getFlagImageSource(choice.alpha2)} alt="" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {countryNameIsCorrect ? (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          ) : session.answerResults.countryName === false ? (
            <span className="country-answer-field-error">{t('Essaie encore.')}</span>
          ) : null}
        </div>
      )}

      {answers.capital && (
        <div className={`country-answer-field${capitalIsCorrect ? ' is-correct' : session.answerResults.capital === false ? ' is-incorrect' : ''}`}>
          <label htmlFor="quiz-capital-answer">{t('Capitale')}</label>
          <input
            id="quiz-capital-answer"
            className="country-answer-text-input"
            type="text"
            autoComplete="off"
            value={capital}
            onChange={(event) => setCapital(event.target.value)}
            disabled={questionDisabled || capitalIsCorrect}
            placeholder={t('Écris le nom de la capitale')}
          />
          {capitalIsCorrect ? (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          ) : session.answerResults.capital === false ? (
            <span className="country-answer-field-error">{t('Essaie encore.')}</span>
          ) : null}
        </div>
      )}

      {answers.flag && (
        <div
          className={`country-answer-field country-flag-answer-field${flagIsCorrect ? ' is-correct' : session.answerResults.flag === false ? ' is-incorrect' : ''}`}
        >
          <span>{t('Choisis le drapeau correspondant')}</span>
          {flagIsCorrect ? (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          ) : session.answerResults.flag === false ? (
            <span className="country-answer-field-error">{t('Essaie encore.')}</span>
          ) : null}
          <div className="country-flag-filters">
            <div className="country-flag-color-filter">
              <label htmlFor="flag-color-picker">{t('Couleur du drapeau')}</label>
              <input
                id="flag-color-picker"
                type="color"
                value={flagColorDraft}
                onChange={(event) => setFlagColorDraft(event.target.value)}
                aria-label={t('Choisir une couleur de drapeau')}
                disabled={questionDisabled || flagIsCorrect}
              />
              <button
                type="button"
                onClick={() => setFlagColorFilters((current) =>
                  current.includes(flagColorDraft)
                    ? current
                    : [...current, flagColorDraft]
                )}
                disabled={questionDisabled || flagIsCorrect || flagColorFilters.includes(flagColorDraft)}
              >
                {t('Ajouter')}
              </button>
              <div className="country-flag-color-chips">
                {flagColorFilters.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="country-flag-color-chip"
                    style={{ backgroundColor: color }}
                    title={`${t('Retirer le filtre')} ${color}`}
                    aria-label={`${t('Retirer le filtre de couleur')} ${color}`}
                    onClick={() => setFlagColorFilters((current) => current.filter((item) => item !== color))}
                    disabled={questionDisabled || flagIsCorrect}
                  />
                ))}
              </div>
            </div>
            <div className="country-flag-band-filter">
              <div className="country-flag-band-heading">
                <label htmlFor="flag-band-count">{t('Nombre de bandes')}</label>
                <output htmlFor="flag-band-count">
                  {flagBandCount === 0 ? t('Tous') : flagBandCount}
                </output>
              </div>
              <input
                id="flag-band-count"
                className="country-flag-band-slider"
                type="range"
                min={0}
                max={maximumFlagBandCount}
                step={1}
                value={flagBandCount}
                onChange={(event) => setFlagBandCount(Number(event.target.value))}
                aria-label={t('Nombre de bandes')}
                disabled={questionDisabled || flagIsCorrect}
              />
              <div className="country-flag-band-options">
                <label>
                  <input
                    type="checkbox"
                    checked={flagHorizontalBandsOnly}
                    onChange={(event) => setFlagHorizontalBandsOnly(event.target.checked)}
                    disabled={questionDisabled || flagIsCorrect}
                  />
                  {t('Horizontales')}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={flagVerticalBandsOnly}
                    onChange={(event) => setFlagVerticalBandsOnly(event.target.checked)}
                    disabled={questionDisabled || flagIsCorrect}
                  />
                  {t('Verticales')}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={flagObliqueBandsOnly}
                    onChange={(event) => setFlagObliqueBandsOnly(event.target.checked)}
                    disabled={questionDisabled || flagIsCorrect}
                  />
                  {t('Obliques')}
                </label>
              </div>
            </div>
            <FlagRatioFilter
              availableRatios={availableFlagRatios}
              availablePolygonShapes={availablePolygonShapes}
              selectedRatioRange={flagAspectRatioRange}
              selectedPolygon={flagPolygonDrawing}
              onRatioRangeChange={setFlagAspectRatioRange}
              onPolygonChange={setFlagPolygonDrawing}
              disabled={questionDisabled || flagIsCorrect}
            />
          </div>
          <div className="country-flag-choices" role="group" aria-label={t('Choisir un drapeau')}>
            {filteredFlagChoices.map((choice) => (
              <button
                key={choice.alpha2}
                className={`country-flag-choice${flagAlpha2 === choice.alpha2 ? ' selected' : ''}`}
                type="button"
                onClick={() => setFlagAlpha2(choice.alpha2)}
                disabled={questionDisabled || flagIsCorrect}
                aria-label={`${t('Choisir le drapeau')} ${localizedCountryNames.of(choice.alpha2) ?? choice.frenchName}`}
                aria-pressed={flagAlpha2 === choice.alpha2}
              >
                <img src={getFlagImageSource(choice.alpha2)} alt="" />
              </button>
            ))}
            {filteredFlagChoices.length === 0 && (
              <p className="country-flag-no-results">
                {t('Aucun drapeau ne correspond à ces filtres.')}
              </p>
            )}
          </div>
        </div>
      )}

      {!questionDisabled &&
        !mapOnly &&
        hasSubmittableAnswer && (
          <button
            className="quiz-check-answers-button"
            type="button"
            onClick={() => {
              const outcomes: Record<string, boolean> = {}
              if (answers.countryName && countryName.trim() && !countryNameIsCorrect) {
                outcomes.countryName = countryNameMatches
              }
              if (answers.capital && capital.trim() && !capitalIsCorrect) {
                outcomes.capital = capitalMatches
              }
              if (answers.flag && flagAlpha2 && !flagIsCorrect) {
                outcomes.flag = flagAlpha2 === question.alpha2
              }
              onAnswer(outcomes)
            }}
          >
            {t('Vérifier mes réponses')}
          </button>
        )}

      {session.answerCorrect === true && (
        <CorrectAnswerBanner>
          {answers.countryOnMap && (
            <span>
              {t('Territoire sur la carte')} :{' '}
              {localizedCountryNames.of(question.alpha2) ?? question.countryName}
            </span>
          )}
          {answers.countryName && (
            <span>
              {t('Nom du pays')} :{' '}
              {localizedCountryNames.of(question.alpha2) ?? question.countryName}
            </span>
          )}
          {answers.capital && <span>{t('Capitale')} : {question.capitalName}</span>}
          {answers.flag && (
            <span className="quiz-correct-answer-flag-row">
              {t('Drapeau')} :{' '}
              <img
                src={getFlagImageSource(question.alpha2)}
                alt={`${t('Drapeau de')} ${localizedCountryNames.of(question.alpha2) ?? question.countryName}`}
              />
            </span>
          )}
        </CorrectAnswerBanner>
      )}
      {session.answerCorrect === false && !session.answerRevealed && (
        <div className="quiz-feedback quiz-feedback-incorrect" aria-live="polite">
          <strong>{t('Essai')} {session.attemptCount}.</strong>{' '}
          {t('Il y a au moins une erreur. Corrige tes réponses ou regarde la solution.')}
        </div>
      )}
    </div>
  )
}

export function CountryQuizPanel({
  session,
  clues,
  answers,
  selectedMapCountry,
  mapProximity,
  showPanelActions = true,
  onAnswer,
  onRevealAnswer,
  onNext,
  onRestart
}: CountryQuizPanelProps): React.JSX.Element {
  const { t } = useLanguage()
  const question = session.questionOrder[session.questionIndex]
  const revealText = [
    question.frenchCountryName,
    question.capitalName,
    flagEmojiFromAlpha2(question.alpha2)
  ].join(' · ')

  return (
    <QuizPanelFrame
      heading="TES RÉPONSES"
      description="Complète les réponses demandées pour cette question."
      session={session}
      total={session.questionOrder.length}
      showProgress={false}
      showScore={false}
      showStop={false}
      showActions={showPanelActions}
      onRevealAnswer={onRevealAnswer}
      onNext={onNext}
      onRestart={onRestart}
    >
      <CountryQuizAnswerForm
        key={`${question.sourceFeatureId}:${session.questionIndex}`}
        question={question}
        session={session}
        answers={answers}
        selectedMapCountry={selectedMapCountry}
        mapProximity={mapProximity}
        countryIsHighlighted={clues.countryOnMap}
        onAnswer={onAnswer}
      />
      {session.answerRevealed && (
        <div className="quiz-feedback quiz-feedback-revealed" aria-live="polite">
          {t('Réponse')} : {revealText}
        </div>
      )}
    </QuizPanelFrame>
  )
}

type QuizFullscreenBarProps = {
  session: QuizSession<CountryQuizQuestion>
  clues: QuizClues
  answers: QuizAnswers
  regionLabel: string
  onExit: () => void
  onStop: () => void
  onOpenAnswers: () => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onToggleSettings: () => void
  settingsOpen: boolean
}

export function QuizFullscreenBar({
  session,
  clues,
  answers,
  regionLabel,
  onExit,
  onStop,
  onOpenAnswers,
  onRevealAnswer,
  onNext,
  onRestart,
  onToggleSettings,
  settingsOpen
}: QuizFullscreenBarProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const total = session.questionOrder.length
  const question = session.questionOrder[session.questionIndex]
  const questionSettled = session.answerCorrect === true || session.answerRevealed
  const completedCount = session.questionIndex + (questionSettled ? 1 : 0)
  const progress = total > 0 ? (completedCount / total) * 100 : 0
  const hasNonMapAnswer = answers.countryName || answers.capital || answers.flag
  const answerLabels = [
    answers.countryOnMap ? t('Territoire sur la carte') : null,
    answers.countryName ? t('Nom du pays') : null,
    answers.capital ? t('Capitale') : null,
    answers.flag ? t('Drapeau') : null
  ].filter((label): label is string => label !== null)
  const answerIsShown = session.answerCorrect === true || session.answerRevealed

  return (
    <header className="quiz-fullscreen-bar">
      <div className="quiz-fullscreen-session">
        <div className="quiz-fullscreen-progress-info">
          <strong>
            {session.completed
              ? t('Quiz terminé')
              : `${t('Question')} ${String(Math.min(session.questionIndex + 1, total)).padStart(2, '0')} / ${total}`}
          </strong>
          <span>{t('Score :')} {formatQuizScore(session.score, language)} / {total}</span>
          <span
            className="quiz-fullscreen-context"
            title={`${t(regionLabel)} · ${total} ${t('pays')} · ${t('Réponses')} : ${answerLabels.join(', ')}`}
          >
            {t(regionLabel)} · {total} {t('pays')} · {t('Réponses')} : {answerLabels.join(', ')}
          </span>
          <div
            className="quiz-fullscreen-progress-track"
            role="progressbar"
            aria-label={t('Progression du quiz')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completedCount}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {question && (
        <div className="quiz-fullscreen-clues" aria-label={t('Indices de la question')}>
          {!session.completed && clues.flag && (
            <div className="quiz-fullscreen-flag-clue">
              <span>{t('Drapeau')}</span>
              <img
                src={getFlagImageSource(question.alpha2)}
                alt={`${t('Drapeau indice de')} ${question.frenchCountryName}`}
              />
            </div>
          )}
          {!session.completed && clues.countryName && (
            <div className="quiz-fullscreen-text-clue">
              <span>{t('Nom du pays')}</span>
              <strong>{question.frenchCountryName}</strong>
            </div>
          )}
          {!session.completed && clues.capital && (
            <div className="quiz-fullscreen-text-clue">
              <span>{t('Capitale')}</span>
              <strong>{question.capitalName}</strong>
            </div>
          )}
          {!session.completed && clues.countryOnMap && (
            <div className="quiz-fullscreen-text-clue">
              <span>{t('Carte')}</span>
              <strong>{t('Territoire mis en évidence')}</strong>
            </div>
          )}
          {answerIsShown && !session.completed && (
            <div
              className={`quiz-fullscreen-revealed-answer${session.answerCorrect === true ? ' is-correct' : ''}`}
              aria-live="polite"
            >
              <strong>{t(session.answerCorrect === true ? 'Bonne réponse !' : 'Réponse')}</strong>
              {answers.countryOnMap && (
                <span>{t('Territoire sur la carte')} : {question.frenchCountryName}</span>
              )}
              {answers.countryName && (
                <span>{t('Nom du pays')} : {question.frenchCountryName}</span>
              )}
              {answers.capital && (
                <span>{t('Capitale')} : {question.capitalName}</span>
              )}
              {answers.flag && (
                <span className="quiz-fullscreen-answer-flag">
                  {t('Drapeau')} : <img src={getFlagImageSource(question.alpha2)} alt="" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="quiz-fullscreen-actions">
        <button
          className="quiz-fullscreen-settings"
          type="button"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
        >
          {t(settingsOpen ? 'Masquer les réglages' : 'Modifier les réglages')}
        </button>
        {session.completed ? (
          <button className="quiz-fullscreen-primary" type="button" onClick={onRestart}>
            {t('Rejouer')}
          </button>
        ) : (
          <>
            {hasNonMapAnswer && (
              <button className="quiz-fullscreen-primary" type="button" onClick={onOpenAnswers}>
                {t('Répondre')}
              </button>
            )}
            {!hasNonMapAnswer && answers.countryOnMap && !questionSettled && (
              <span className="quiz-fullscreen-map-instruction">{t('Clique le territoire sur la carte')}</span>
            )}
            {answerIsShown ? (
              <button className="quiz-fullscreen-primary" type="button" onClick={onNext}>
                {t(session.questionIndex === total - 1 ? 'Voir le résultat' : 'Question suivante')}
              </button>
            ) : (
              <button className="quiz-fullscreen-secondary" type="button" onClick={onRevealAnswer}>
                {t('Voir la réponse')}
              </button>
            )}
            <button className="quiz-fullscreen-stop" type="button" onClick={onStop}>
              {t('Arrêter')}
            </button>
          </>
        )}
        <button className="quiz-fullscreen-exit" type="button" onClick={onExit}>
          {t('Quitter le plein écran')}
        </button>
      </div>
    </header>
  )
}
