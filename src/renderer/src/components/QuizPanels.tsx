import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../data/i18n'
import countryCatalog from '../data/quiz/countryCatalog.json'
import type { CountryFlagQuestion } from '../data/quiz/countryQuestions'
import { flagEmojiFromAlpha2 } from '../data/quiz/flagEmoji'
import type { CountryCapitalQuestion } from '../data/quiz/countryCapitals'
import { formatQuizScore, type QuizSession } from '../data/quiz/useQuizSession'
import {
  flagHasAllColorFilters,
  flagNamedColorOptions,
  flagOutlineMatches,
  getFlagAspectRatio,
  getFlagBandCounts,
  getFlagImageSource,
  getFlagOutline,
  type FlagColorFilter,
  type FlagNamedColorFilterId,
  type FlagPolygonDrawing,
  type FlagRatioRange
} from '../data/quiz/flagAssets'
import { FlagRatioFilter } from './FlagRatioFilter'
import { SkinSelector } from './AppModeSwitcher'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import type { ExplorationDetails } from '../data/geography/exploration'
import {
  supplementalQuizAnswerMatches,
  type CountryQuizQuestion,
  getCapitalAnswerCorrection,
  normalizeQuizAnswer
} from '../data/quiz/countryQuiz'
import {
  supplementalQuizFactOptions,
  type QuizAnswers,
  type QuizClues,
  type SupplementalQuizFactSettings
} from '../data/quiz/quizTypes'
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
  onSelectReviewCountry?: (alpha2: string) => void
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
      <span className="quiz-correct-banner-icon" aria-hidden="true">
        ✓
      </span>
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
  onSelectReviewCountry,
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
                {t('QUESTION')}{' '}
                {String(Math.min(session.questionIndex + 1, total)).padStart(2, '0')} / {total}
              </div>
              <div className="quiz-progress-count">
                {answeredCount} {t(answeredCount > 1 ? 'terminées' : 'terminée')}
              </div>
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
            <QuizReview session={session} onSelectCountry={onSelectReviewCountry} />
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
                  <button className="quiz-reveal-button" onClick={onRevealAnswer}>
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

export function QuizReview<Question>({
  session,
  onSelectCountry
}: {
  session: QuizSession<Question>
  onSelectCountry?: (alpha2: string) => void
}): React.JSX.Element {
  const { t } = useLanguage()
  const rows = session.questionHistory
  return (
    <section className="quiz-review" aria-label={t('Révision des réponses')}>
      <h3>{t('Révision des réponses')}</h3>
      <ol>
        {rows.map((row, index) => {
          const question = row.question as {
            prompt?: string
            answer?: string
            countryName?: string
            frenchCountryName?: string
            capitalName?: string
            countryAnswerGroup?: { alpha2: string; name: string }[]
            alpha2?: string
          }
          const prompt =
            question.prompt ??
            (question.frenchCountryName && question.capitalName
              ? t('Pays à retrouver')
              : question.capitalName && question.countryName
                ? `${t('Capitale de')} ${question.countryName}`
                : question.frenchCountryName
                  ? t('Pays à retrouver')
                  : question.countryName
                    ? t('Drapeau à reconnaître')
                    : `${t('Question')} ${index + 1}`)
          const answer = question.prompt
            ? (question.answer ?? '—')
            : (question.countryAnswerGroup?.length ?? 0) > 1
              ? question.countryAnswerGroup?.map(({ name }) => name).join(', ')
              : question.frenchCountryName && question.capitalName
                ? `${question.frenchCountryName} · ${question.capitalName}`
                : (question.capitalName ??
                  question.frenchCountryName ??
                  question.countryName ??
                  question.answer ??
                  '—')
          let submitted = row.selectedAnswer ?? ''
          if (submitted.startsWith('{')) {
            try {
              const outcomes = JSON.parse(submitted) as Record<string, unknown>
              if (Array.isArray(outcomes.foundValues)) {
                submitted = (outcomes.foundValues as string[]).join(', ')
              } else {
                const labels: Record<string, string> = {
                  countryOnMap: 'Territoire sur la carte',
                  countryName: 'Nom du pays',
                  capital: 'Capitale',
                  flag: 'Drapeau',
                  ...Object.fromEntries(
                    supplementalQuizFactOptions.map(({ id, label }) => [id, label])
                  )
                }
                submitted = Object.entries(outcomes)
                  .map(([key, value]) => `${t(labels[key] ?? key)} ${value ? '✓' : '×'}`)
                  .join(' · ')
              }
            } catch {
              // Keep the original answer if a historical entry cannot be parsed.
            }
          }
          const status = row.correct
            ? t('Réussi')
            : row.revealed
              ? t('Solution consultée')
              : t('À revoir')
          const attempts = Math.max(0, ...Object.values(row.answerAttempts))
          const hue = Math.max(0, 145 - Math.max(0, attempts - 1) * 72.5)
          return (
            <li
              key={`${index}:${prompt}`}
              className={`${row.correct ? 'is-correct' : 'is-incorrect'}${onSelectCountry && question.alpha2 ? ' is-clickable' : ''}`}
              style={{ '--quiz-review-hue': hue } as React.CSSProperties}
            >
              {onSelectCountry && question.alpha2 ? (
                <button
                  className="quiz-review-row-button"
                  type="button"
                  onClick={() => onSelectCountry(question.alpha2!)}
                  aria-label={`${prompt} · ${answer}`}
                >
                  <span className="quiz-review-number">{index + 1}</span>
                  <span className="quiz-review-copy">
                    <strong>{prompt}</strong>
                    <span>
                      {t('Réponse correcte')} : {answer}
                    </span>
                    {submitted && (
                      <span>
                        {t('Ta réponse')} : {submitted}
                      </span>
                    )}
                  </span>
                  <small>
                    {attempts} {t(attempts === 1 ? 'essai' : 'essais')} · {status}
                  </small>
                </button>
              ) : (
                <>
                  <span className="quiz-review-number">{index + 1}</span>
                  <div>
                    <strong>{prompt}</strong>
                    <span>
                      {t('Réponse correcte')} : {answer}
                    </span>
                    {submitted && (
                      <span>
                        {t('Ta réponse')} : {submitted}
                      </span>
                    )}
                  </div>
                  <small>
                    {attempts} {t(attempts === 1 ? 'essai' : 'essais')} · {status}
                  </small>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function QuizReviewCountryCard({
  place,
  onClose
}: {
  place: ExplorationDetails
  onClose: () => void
}): React.JSX.Element {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`quiz-reveal-country-card${expanded ? ' is-expanded' : ''}`}>
      <div className="quiz-review-country-card-controls">
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {t(expanded ? 'Replier la fiche' : 'Déplier la fiche')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('Fermer la fiche')}>
          ×
        </button>
      </div>
      <ExplorationPlaceDetails place={place} compact showExtended={expanded} />
    </div>
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
      <h2>
        {t('Quelle est la capitale de')} {question.countryName} ?
      </h2>
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
  supplementalAnswers?: SupplementalQuizFactSettings
  selectedMapAnswerAlpha2s: string[]
  selectedMapCountry: SelectedMapCountry
  mapProximity: MapProximityResult | null
  showPanelActions?: boolean
  onAnswer: (outcomes: Record<string, boolean>) => void
  onMultiAnswer: (
    key: string,
    fractionEarned: number,
    outcome: 'progress' | 'correct' | 'incorrect',
    submittedValues: readonly string[],
    foundValues: readonly string[]
  ) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onSelectReviewCountry?: (alpha2: string) => void
}

export function QuizCluesInline({
  session,
  clues,
  supplementalClues = {}
}: {
  session: QuizSession<CountryQuizQuestion>
  clues: QuizClues
  supplementalClues?: SupplementalQuizFactSettings
}): React.JSX.Element {
  const { t } = useLanguage()
  const total = session.questionOrder.length
  const question = total
    ? session.questionOrder[Math.min(session.questionIndex, total - 1)]
    : undefined

  if (!question) {
    return (
      <div className="quiz-clues-inline quiz-empty-state">{t('Aucune question à afficher.')}</div>
    )
  }

  return (
    <div className="quiz-clues-inline" aria-label={t('Indices de la question')}>
      {clues.countryOnMap && (
        <div className="quiz-clue-card quiz-map-clue">
          <span className="quiz-clue-icon" aria-hidden="true">
            ⌖
          </span>
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
              alt={`${t('Drapeau de')} ${question.frenchCountryName}`}
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
      {supplementalQuizFactOptions
        .filter(({ id }) => supplementalClues[id])
        .map((option) => (
          <div className="quiz-clue-card" key={option.id}>
            <span>{t(option.label)}</span>
            <strong>{question.supplementalFacts[option.id]}</strong>
          </div>
        ))}
      {!Object.values(clues).some(Boolean) &&
        !supplementalQuizFactOptions.some(({ id }) => supplementalClues[id]) && (
          <div className="quiz-empty-state">
            {t('Aucun indice n’est configuré. Reviens au contenu du quiz pour en choisir un.')}
          </div>
        )}
    </div>
  )
}

function CountryQuizAnswerForm({
  question,
  session,
  answers,
  supplementalAnswers,
  selectedMapAnswerAlpha2s,
  selectedMapCountry,
  mapProximity,
  countryIsHighlighted,
  onMultiAnswer,
  onAnswer
}: {
  question: CountryQuizQuestion
  session: QuizSession<CountryQuizQuestion>
  answers: QuizAnswers
  supplementalAnswers: SupplementalQuizFactSettings
  selectedMapAnswerAlpha2s: string[]
  selectedMapCountry: SelectedMapCountry
  mapProximity: MapProximityResult | null
  countryIsHighlighted: boolean
  onMultiAnswer: CountryQuizPanelProps['onMultiAnswer']
  onAnswer: CountryQuizPanelProps['onAnswer']
}): React.JSX.Element {
  const { language, t } = useLanguage()
  const [countryName, setCountryName] = useState('')
  const [countryNameSuggestionsOpen, setCountryNameSuggestionsOpen] = useState(false)
  const [capital, setCapital] = useState('')
  const [multiAnswerRows, setMultiAnswerRows] = useState<Record<string, string[]>>({})
  const [multiAnswerFound, setMultiAnswerFound] = useState<Record<string, string[]>>({})
  const [flagAlpha2, setFlagAlpha2] = useState<string | null>(null)
  const [flagColorDraft, setFlagColorDraft] = useState('#e53935')
  const [flagColorFilters, setFlagColorFilters] = useState<string[]>([])
  const [flagNamedColorFilters, setFlagNamedColorFilters] = useState<FlagNamedColorFilterId[]>([])
  const [flagBandCount, setFlagBandCount] = useState(0)
  const [flagHorizontalBandsOnly, setFlagHorizontalBandsOnly] = useState(false)
  const [flagVerticalBandsOnly, setFlagVerticalBandsOnly] = useState(false)
  const [flagObliqueBandsOnly, setFlagObliqueBandsOnly] = useState(false)
  const [flagAspectRatioRange, setFlagAspectRatioRange] = useState<FlagRatioRange | null>(null)
  const [flagPolygonDrawing, setFlagPolygonDrawing] = useState<FlagPolygonDrawing | null>(null)
  const questionDisabled = session.answerCorrect === true || session.answerRevealed
  const multiCountryAnswer = question.countryAnswerGroup.length > 1
  const localizedCountryNames = new Intl.DisplayNames([language], { type: 'region' })
  const countryAnswerText = multiCountryAnswer
    ? question.countryAnswerGroup.map(({ name }) => name).join(', ')
    : (localizedCountryNames.of(question.alpha2) ?? question.countryName)
  const answerDisclosureDependencies: Record<string, readonly string[]> = {
    countryOnMap: ['countryName'],
    countryName: ['countryOnMap']
  }
  const isAnswerChecked = (key: string): boolean => {
    if (
      session.answerRevealed ||
      session.answerCorrect === true ||
      !(key in session.answerWeights)
    ) {
      return true
    }
    const result = session.answerResults[key]
    return (result !== null && result !== undefined) || (session.answerPoints[key] ?? 0) > 0
  }
  const canRevealAnswerValues = (key: string): boolean =>
    (answerDisclosureDependencies[key] ?? []).every(isAnswerChecked)
  const countryNameAnswerChecked = isAnswerChecked('countryName')
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
    !answers.flag &&
    !multiCountryAnswer &&
    !supplementalQuizFactOptions.some(({ id }) => supplementalAnswers[id])

  const getRows = (key: string): string[] => multiAnswerRows[key] ?? ['']
  const setRowValue = (key: string, index: number, value: string): void => {
    setMultiAnswerRows((current) => {
      const rows = current[key] ?? ['']
      return { ...current, [key]: rows.map((row, rowIndex) => (rowIndex === index ? value : row)) }
    })
  }
  const addAnswerRow = (key: string): void => {
    setMultiAnswerRows((current) => ({ ...current, [key]: [...(current[key] ?? ['']), ''] }))
  }
  const removeAnswerRow = (key: string, index: number): void => {
    setMultiAnswerRows((current) => {
      const rows = current[key] ?? ['']
      return {
        ...current,
        [key]: rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : ['']
      }
    })
  }
  const submitMultiAnswerGroup = (
    key: string,
    expectedValues: readonly string[],
    submittedValues: readonly string[],
    resolveValue: (value: string) => string | undefined,
    displayValue: (value: string) => string = (value) => value
  ): void => {
    const submitted = submittedValues.map((value) => value.trim()).filter(Boolean)
    if (submitted.length === 0 || expectedValues.length === 0) return
    const normalizedExpected = [...new Set(expectedValues)]
    const resolved = submitted.map(resolveValue)
    if (resolved.some((value) => !value || !normalizedExpected.includes(value))) {
      setMultiAnswerFound((current) => ({ ...current, [key]: [] }))
      onMultiAnswer(key, 0, 'incorrect', submitted, [])
      return
    }

    const previousFound = multiAnswerFound[key] ?? []
    const nextFound = [
      ...new Set([...previousFound, ...resolved.filter((value): value is string => Boolean(value))])
    ]
    const newlyFoundCount = nextFound.length - previousFound.length
    if (newlyFoundCount === 0) return
    const isComplete = normalizedExpected.every((value) => nextFound.includes(value))
    setMultiAnswerFound((current) => ({ ...current, [key]: nextFound }))
    setMultiAnswerRows((current) => ({ ...current, [key]: [''] }))
    onMultiAnswer(
      key,
      newlyFoundCount / normalizedExpected.length,
      isComplete ? 'correct' : 'progress',
      submitted,
      nextFound.map(displayValue)
    )
  }

  const renderMultiAnswerFeedback = (
    key: string,
    expectedValues: readonly string[],
    displayValue: (value: string) => string = (value) => value
  ): React.ReactNode => {
    const uniqueExpectedValues = [...new Set(expectedValues)]
    const found = multiAnswerFound[key] ?? []
    const incorrect = session.answerResults[key] === false
    const complete = session.answerResults[key] === true
    const missing = uniqueExpectedValues.filter((value) => !found.includes(value))
    const answerWeight = session.answerWeights[key] ?? 1
    const showAnswerValues = canRevealAnswerValues(key)
    const hasDisclosureDependency = (answerDisclosureDependencies[key]?.length ?? 0) > 0
    if (incorrect && (!hasDisclosureDependency || !showAnswerValues)) {
      return (
        <span className="country-answer-field-error">
          {t('Réponse incorrecte')} · 0 {t('point')}
        </span>
      )
    }
    if (incorrect) {
      return (
        <div className="quiz-multi-answer-feedback" aria-live="polite">
          <strong className="country-answer-field-error">
            {t('Réponse incorrecte')} · 0 {t('point')}
          </strong>
          {hasDisclosureDependency && showAnswerValues && (
            <span>
              {t('Bonnes réponses')} : {uniqueExpectedValues.map(displayValue).join(', ')}
            </span>
          )}
        </div>
      )
    }
    if (complete) {
      if (!hasDisclosureDependency || !showAnswerValues) return null
      return (
        <div className="quiz-multi-answer-feedback" aria-live="polite">
          <span>
            {t('Bonnes réponses')} : {found.map(displayValue).join(', ')}
          </span>
        </div>
      )
    }
    if (found.length === 0) return null
    return (
      <div className="quiz-multi-answer-feedback" aria-live="polite">
        <strong>
          {formatQuizScore((found.length / uniqueExpectedValues.length) * answerWeight, language)} /{' '}
          {formatQuizScore(answerWeight, language)} {t('point')} {t('gagné')}
        </strong>
        {showAnswerValues && (
          <span>
            {t('Bonnes réponses')} : {found.map(displayValue).join(', ')}
          </span>
        )}
        {showAnswerValues && (
          <span>
            {t('Réponses manquantes')} : {missing.map(displayValue).join(', ')}
          </span>
        )}
      </div>
    )
  }

  const availableFlagRatios = [
    ...new Map(
      question.flagChoices.flatMap((choice) => {
        if (getFlagOutline(choice.alpha2)) return []
        const ratio = getFlagAspectRatio(choice.alpha2)
        return ratio ? [[ratio.ratio, ratio] as const] : []
      })
    ).values()
  ].sort((first, second) => first.ratio - second.ratio)

  const availablePolygonShapes = [
    ...new Map(
      question.flagChoices.flatMap((choice) => {
        const outline = getFlagOutline(choice.alpha2)
        return outline
          ? [
              [
                choice.alpha2,
                {
                  name: localizedCountryNames.of(choice.alpha2) ?? choice.frenchName,
                  vertexCount: outline.length
                }
              ] as const
            ]
          : []
      })
    ).values()
  ]

  const maximumFlagBandCount = Math.max(
    1,
    ...question.flagChoices.map((choice) => {
      const bands = getFlagBandCounts(choice.alpha2)
      return Math.max(bands.horizontal, bands.vertical, bands.oblique)
    })
  )

  const activeFlagColorFilters: FlagColorFilter[] = [
    ...flagColorFilters.map((color) => ({ kind: 'wheel' as const, color })),
    ...flagNamedColorFilters.map((id) => ({ kind: 'named' as const, id }))
  ]

  const filteredFlagChoices = question.flagChoices
    .filter((choice) => {
      const matchesColors = flagHasAllColorFilters(choice.alpha2, activeFlagColorFilters)
      const bands = getFlagBandCounts(choice.alpha2)
      const selectedBandDirections = [
        ...(flagHorizontalBandsOnly ? ['horizontal' as const] : []),
        ...(flagVerticalBandsOnly ? ['vertical' as const] : []),
        ...(flagObliqueBandsOnly ? ['oblique' as const] : [])
      ]
      const matchesBandCount = selectedBandDirections.length
        ? selectedBandDirections.every((direction) =>
            flagBandCount === 0 ? bands[direction] > 1 : bands[direction] === flagBandCount
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
    ? countryNameChoices.filter(
        (choice) =>
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
    ].some((name) => normalizeQuizAnswer(countryName) === normalizeQuizAnswer(name))
  const capitalCorrectionSuggestion = getCapitalAnswerCorrection(
    capital,
    question.acceptedCapitalNames,
    question.capitalName
  )
  const capitalMatches =
    !answers.capital ||
    question.acceptedCapitalNames.some(
      (name) => normalizeQuizAnswer(capital) === normalizeQuizAnswer(name)
    ) ||
    capitalCorrectionSuggestion !== null
  const countryNameIsCorrect = session.answerResults.countryName === true
  const capitalIsCorrect = session.answerResults.capital === true
  const flagIsCorrect = session.answerResults.flag === true
  const mapAnswerIsCorrect = session.answerResults.countryOnMap === true
  const hasSubmittableAnswer =
    (answers.countryName &&
      (multiCountryAnswer
        ? getRows('countryName').some((value) => value.trim().length > 0) &&
          session.answerResults.countryName !== true
        : countryName.trim().length > 0 && !countryNameIsCorrect)) ||
    (answers.countryOnMap &&
      multiCountryAnswer &&
      selectedMapAnswerAlpha2s.length > 0 &&
      session.answerResults.countryOnMap !== true) ||
    (answers.capital && capital.trim().length > 0 && !capitalIsCorrect) ||
    (answers.flag && flagAlpha2 !== null && !flagIsCorrect) ||
    supplementalQuizFactOptions.some(
      ({ id }) =>
        supplementalAnswers[id] &&
        getRows(id).some((value) => value.trim().length > 0) &&
        session.answerResults[id] !== true
    )
  const submitAnswers = (): void => {
    const outcomes: Record<string, boolean> = {}
    if (answers.countryName && multiCountryAnswer && session.answerResults.countryName !== true) {
      const expected = question.countryAnswerGroup.map(({ alpha2 }) => alpha2)
      submitMultiAnswerGroup(
        'countryName',
        expected,
        getRows('countryName'),
        (value) => {
          const match = question.countryAnswerGroup.find((country) => {
            const alternateName = countryNameChoices.find(
              (choice) => choice.alpha2 === country.alpha2
            )?.alternateName
            return [country.name, alternateName ?? ''].some(
              (name) => normalizeQuizAnswer(name) === normalizeQuizAnswer(value)
            )
          })
          return match?.alpha2
        },
        (alpha2) =>
          question.countryAnswerGroup.find((country) => country.alpha2 === alpha2)?.name ?? alpha2
      )
    } else if (answers.countryName && countryName.trim() && !countryNameIsCorrect) {
      outcomes.countryName = countryNameMatches
    }
    if (
      answers.countryOnMap &&
      multiCountryAnswer &&
      selectedMapAnswerAlpha2s.length > 0 &&
      session.answerResults.countryOnMap !== true
    ) {
      submitMultiAnswerGroup(
        'countryOnMap',
        question.countryAnswerGroup.map(({ alpha2 }) => alpha2),
        selectedMapAnswerAlpha2s,
        (value) => value,
        (alpha2) =>
          question.countryAnswerGroup.find((country) => country.alpha2 === alpha2)?.name ?? alpha2
      )
    }
    if (answers.capital && capital.trim() && !capitalIsCorrect) {
      outcomes.capital = capitalMatches
    }
    if (answers.flag && flagAlpha2 && !flagIsCorrect) {
      outcomes.flag = flagAlpha2 === question.alpha2
    }
    supplementalQuizFactOptions.forEach(({ id }) => {
      const expected = question.supplementalAnswerValues[id] ?? []
      if (supplementalAnswers[id] && expected.length > 0 && session.answerResults[id] !== true) {
        submitMultiAnswerGroup(
          id,
          expected,
          getRows(id),
          (value) => expected.find((candidate) => supplementalQuizAnswerMatches(value, candidate)),
          (value) => value
        )
      }
    })
    if (Object.keys(outcomes).length > 0) onAnswer(outcomes)
  }
  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || questionDisabled || mapOnly || !hasSubmittableAnswer) return
    event.preventDefault()
    submitAnswers()
  }
  const autoAnswerSentRef = useRef<{
    questionOrder: QuizSession<CountryQuizQuestion>['questionOrder']
    questionIndex: number
    answers: Set<string>
  } | null>(null)

  useEffect(() => {
    if (questionDisabled || mapOnly) return
    if (
      autoAnswerSentRef.current?.questionOrder !== session.questionOrder ||
      autoAnswerSentRef.current?.questionIndex !== session.questionIndex
    ) {
      autoAnswerSentRef.current = {
        questionOrder: session.questionOrder,
        questionIndex: session.questionIndex,
        answers: new Set()
      }
    }
    const autoAnswerState = autoAnswerSentRef.current
    if (!autoAnswerState) return
    const outcomes: Record<string, boolean> = {}

    if (
      answers.countryName &&
      countryName.trim() &&
      countryNameMatches &&
      session.answerResults.countryName !== true &&
      !autoAnswerState.answers.has('countryName')
    ) {
      outcomes.countryName = true
      autoAnswerState.answers.add('countryName')
    }
    if (
      answers.capital &&
      capital.trim() &&
      capitalMatches &&
      session.answerResults.capital !== true &&
      !autoAnswerState.answers.has('capital')
    ) {
      outcomes.capital = true
      autoAnswerState.answers.add('capital')
    }
    if (
      answers.flag &&
      flagAlpha2 === question.alpha2 &&
      session.answerResults.flag !== true &&
      !autoAnswerState.answers.has('flag')
    ) {
      outcomes.flag = true
      autoAnswerState.answers.add('flag')
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
    session.questionIndex,
    session.questionOrder,
    questionDisabled,
    mapOnly,
    onAnswer,
    session.answerResults
  ])

  return (
    <div className="country-quiz-answer-form">
      {answers.countryOnMap && multiCountryAnswer && (
        <div
          className={`country-answer-map-selection${session.answerResults.countryOnMap === true ? ' is-correct' : session.answerResults.countryOnMap === false ? ' is-incorrect' : ''}`}
        >
          <span className="answer-placeholder-icon">⌖</span>
          <div className="country-answer-map-selection-content">
            <strong>{t('Sélectionne les pays sur la carte')}</strong>
            <span>
              {selectedMapAnswerAlpha2s.length
                ? countryNameAnswerChecked
                  ? selectedMapAnswerAlpha2s
                      .map((alpha2) => localizedCountryNames.of(alpha2) ?? alpha2)
                      .join(', ')
                  : `${selectedMapAnswerAlpha2s.length} ${t(selectedMapAnswerAlpha2s.length === 1 ? 'territoire sélectionné' : 'territoires sélectionnés')}`
                : t('Aucun pays sélectionné')}
            </span>
            {renderMultiAnswerFeedback(
              'countryOnMap',
              question.countryAnswerGroup.map(({ alpha2 }) => alpha2),
              (alpha2) =>
                question.countryAnswerGroup.find((country) => country.alpha2 === alpha2)?.name ??
                alpha2
            )}
          </div>
          {session.answerResults.countryOnMap === true && (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          )}
        </div>
      )}
      {answers.countryOnMap && !multiCountryAnswer && (
        <div
          className={`country-answer-map-selection${mapAnswerIsCorrect ? ' is-correct' : ''}`}
          aria-live="polite"
        >
          <span className="answer-placeholder-icon">⌖</span>
          <div className="country-answer-map-selection-content">
            <span>
              {selectedMapCountry
                ? !canRevealAnswerValues('countryOnMap')
                  ? t('Territoire sélectionné')
                  : `${t('Pays sélectionné')} : ${selectedMapCountry.name}`
                : t('Sélectionne un pays sur la carte.')}
            </span>
            {mapProximity !== null && (
              <div className="country-answer-map-proximity" aria-live="polite">
                <strong>
                  {t('Précision du clic :')} {mapProximity.score} %
                </strong>
                {mapProximity.distanceKm !== null && (
                  <span>
                    {t('Distance estimée jusqu’au centre du pays cible :')}{' '}
                    {mapProximity.distanceKm.toLocaleString(language)} km
                  </span>
                )}
                <small>
                  {t('Indice pour ton prochain clic · sans effet sur le score du quiz.')}
                </small>
              </div>
            )}
          </div>
          {mapAnswerIsCorrect && (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          )}
        </div>
      )}

      {answers.countryName && multiCountryAnswer && (
        <div
          className={`country-answer-field${session.answerResults.countryName === true ? ' is-correct' : session.answerResults.countryName === false ? ' is-incorrect' : ''}`}
        >
          <label>{t('Nom du pays')}</label>
          {getRows('countryName').map((value, index) => (
            <div className="quiz-multi-answer-row" key={`countryName:${index}`}>
              <input
                className="country-answer-text-input"
                type="text"
                autoComplete="off"
                list="quiz-multi-country-options"
                value={value}
                onChange={(event) => setRowValue('countryName', index, event.target.value)}
                onKeyDown={handleAnswerKeyDown}
                disabled={questionDisabled || session.answerResults.countryName === true}
                placeholder={t('Écris le nom du pays')}
              />
              <button
                type="button"
                onClick={() => removeAnswerRow('countryName', index)}
                aria-label={t('Supprimer cette réponse')}
              >
                −
              </button>
            </div>
          ))}
          <datalist id="quiz-multi-country-options">
            {countryNameChoices.map((choice) => (
              <option key={choice.alpha2} value={choice.name} />
            ))}
          </datalist>
          <button
            className="quiz-multi-answer-add"
            type="button"
            onClick={() => addAnswerRow('countryName')}
            disabled={questionDisabled || session.answerResults.countryName === true}
          >
            ＋ {t('Ajouter une réponse')}
          </button>
          {session.answerResults.countryName === true && (
            <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
          )}
          {renderMultiAnswerFeedback(
            'countryName',
            question.countryAnswerGroup.map(({ alpha2 }) => alpha2),
            (alpha2) =>
              question.countryAnswerGroup.find((country) => country.alpha2 === alpha2)?.name ??
              alpha2
          )}
        </div>
      )}
      {answers.countryName && !multiCountryAnswer && (
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
              onKeyDown={handleAnswerKeyDown}
              disabled={questionDisabled || countryNameIsCorrect}
              placeholder={
                countryIsHighlighted
                  ? t('Écris le nom du pays sur la carte')
                  : t('Écris le nom du pays')
              }
              aria-autocomplete="list"
              aria-expanded={countryNameSuggestionsOpen && countryNameSuggestions.length > 0}
              aria-controls="quiz-country-name-suggestions"
            />
            {countryNameSuggestionsOpen &&
              countryNameSuggestions.length > 0 &&
              !questionDisabled &&
              !countryNameIsCorrect && (
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
        <div
          className={`country-answer-field${capitalIsCorrect ? ' is-correct' : session.answerResults.capital === false ? ' is-incorrect' : ''}`}
        >
          <label htmlFor="quiz-capital-answer">{t('Capitale')}</label>
          <input
            id="quiz-capital-answer"
            className="country-answer-text-input"
            type="text"
            autoComplete="off"
            value={capital}
            onChange={(event) => setCapital(event.target.value)}
            onKeyDown={handleAnswerKeyDown}
            disabled={questionDisabled || capitalIsCorrect}
            placeholder={t('Écris le nom de la capitale')}
          />
          {capitalIsCorrect ? (
            <>
              <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
              {capitalCorrectionSuggestion && (
                <span className="country-answer-field-correction">
                  {t('Orthographe corrigée :')} {capitalCorrectionSuggestion}
                </span>
              )}
            </>
          ) : session.answerResults.capital === false ? (
            <span className="country-answer-field-error">{t('Essaie encore.')}</span>
          ) : capitalCorrectionSuggestion ? (
            <span className="country-answer-field-correction" role="status">
              {t('Orthographe suggérée :')} {capitalCorrectionSuggestion}
            </span>
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
                onClick={() =>
                  setFlagColorFilters((current) =>
                    current.includes(flagColorDraft) ? current : [...current, flagColorDraft]
                  )
                }
                disabled={
                  questionDisabled || flagIsCorrect || flagColorFilters.includes(flagColorDraft)
                }
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
                    onClick={() =>
                      setFlagColorFilters((current) => current.filter((item) => item !== color))
                    }
                    disabled={questionDisabled || flagIsCorrect}
                  />
                ))}
              </div>
              <div className="country-flag-named-color-filter">
                <div className="country-flag-named-color-heading">
                  <span>{t('Couleurs par nom')}</span>
                  <small>{t('Toutes les couleurs sélectionnées sont requises.')}</small>
                </div>
                <div className="country-flag-named-color-options">
                  {flagNamedColorOptions.map((option) => {
                    const isSelected = flagNamedColorFilters.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`country-flag-named-color-button${isSelected ? ' is-active' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          setFlagNamedColorFilters((current) =>
                            isSelected
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id]
                          )
                        }
                        disabled={questionDisabled || flagIsCorrect}
                      >
                        <span
                          className="country-flag-named-color-swatch"
                          style={{ backgroundColor: option.swatch }}
                          aria-hidden="true"
                        />
                        {t(option.label)}
                      </button>
                    )
                  })}
                </div>
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

      {supplementalQuizFactOptions
        .filter(({ id }) => supplementalAnswers[id])
        .map((option) => {
          const answerCorrect = session.answerResults[option.id] === true
          const answerIncorrect = session.answerResults[option.id] === false
          const expectedValues = question.supplementalAnswerValues[option.id] ?? []
          return (
            <div
              className={`country-answer-field${answerCorrect ? ' is-correct' : answerIncorrect ? ' is-incorrect' : ''}`}
              key={option.id}
            >
              <label>{t(option.label)}</label>
              {getRows(option.id).map((value, index) => (
                <div className="quiz-multi-answer-row" key={`${option.id}:${index}`}>
                  <input
                    className="country-answer-text-input"
                    type="text"
                    autoComplete="off"
                    value={value}
                    onChange={(event) => setRowValue(option.id, index, event.target.value)}
                    onKeyDown={handleAnswerKeyDown}
                    disabled={questionDisabled || answerCorrect}
                    placeholder={t(option.label)}
                  />
                  <button
                    type="button"
                    onClick={() => removeAnswerRow(option.id, index)}
                    aria-label={t('Supprimer cette réponse')}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                className="quiz-multi-answer-add"
                type="button"
                onClick={() => addAnswerRow(option.id)}
                disabled={questionDisabled || answerCorrect}
              >
                ＋ {t('Ajouter une réponse')}
              </button>
              {answerCorrect ? (
                <span className="country-answer-field-status">✓ {t('Bonne réponse !')}</span>
              ) : null}
              {expectedValues.length > 0 && renderMultiAnswerFeedback(option.id, expectedValues)}
            </div>
          )
        })}

      {!questionDisabled && !mapOnly && hasSubmittableAnswer && (
        <button className="quiz-check-answers-button" type="button" onClick={submitAnswers}>
          {t('Vérifier mes réponses')}
        </button>
      )}

      {session.answerCorrect === true && (
        <CorrectAnswerBanner>
          <span>
            {t('Territoire sur la carte')} : {countryAnswerText}
          </span>
          <span>
            {t('Nom du pays')} : {countryAnswerText}
          </span>
          <span>
            {t('Capitale')} : {question.capitalName}
          </span>
          {supplementalQuizFactOptions
            .filter(({ id }) => supplementalAnswers[id])
            .map((option) => (
              <span key={option.id}>
                {t(option.label)} : {question.supplementalFacts[option.id]}
              </span>
            ))}
          <span className="quiz-correct-answer-flag-row">
            {t('Drapeau')} :{' '}
            <img
              src={getFlagImageSource(question.alpha2)}
              alt={`${t('Drapeau de')} ${localizedCountryNames.of(question.alpha2) ?? question.countryName}`}
            />
          </span>
        </CorrectAnswerBanner>
      )}
      {session.answerCorrect === false && !session.answerRevealed && (
        <div className="quiz-feedback quiz-feedback-incorrect" aria-live="polite">
          <strong>
            {t('Essai')} {session.attemptCount}.
          </strong>{' '}
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
  supplementalAnswers = {},
  selectedMapAnswerAlpha2s,
  selectedMapCountry,
  mapProximity,
  showPanelActions = true,
  onAnswer,
  onMultiAnswer,
  onRevealAnswer,
  onNext,
  onRestart,
  onSelectReviewCountry
}: CountryQuizPanelProps): React.JSX.Element {
  const { t } = useLanguage()
  const question = session.questionOrder[session.questionIndex]
  const countryAnswerText =
    question.countryAnswerGroup.length > 1
      ? question.countryAnswerGroup.map(({ name }) => name).join(', ')
      : question.frenchCountryName
  const revealText = [
    countryAnswerText,
    question.capitalName,
    flagEmojiFromAlpha2(question.alpha2),
    ...supplementalQuizFactOptions
      .filter(({ id }) => supplementalAnswers[id])
      .map(({ id, label }) => `${t(label)} : ${question.supplementalFacts[id]}`)
  ]
    .filter(Boolean)
    .join(' · ')

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
      onSelectReviewCountry={onSelectReviewCountry}
    >
      <CountryQuizAnswerForm
        key={`${question.sourceFeatureId}:${session.questionIndex}`}
        question={question}
        session={session}
        answers={answers}
        supplementalAnswers={supplementalAnswers}
        selectedMapAnswerAlpha2s={selectedMapAnswerAlpha2s}
        selectedMapCountry={selectedMapCountry}
        mapProximity={mapProximity}
        countryIsHighlighted={clues.countryOnMap}
        onMultiAnswer={onMultiAnswer}
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
  supplementalClues?: SupplementalQuizFactSettings
  supplementalAnswers?: SupplementalQuizFactSettings
  regionLabel: string
  onExit: () => void
  onStop: () => void
  onOpenAnswers: () => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onSelectReviewCountry?: (alpha2: string) => void
}

export function QuizFullscreenBar({
  session,
  clues,
  answers,
  supplementalClues = {},
  supplementalAnswers = {},
  regionLabel,
  onExit,
  onStop,
  onOpenAnswers,
  onRevealAnswer,
  onNext,
  onRestart,
  onSelectReviewCountry
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
    answers.flag ? t('Drapeau') : null,
    ...supplementalQuizFactOptions
      .filter(({ id }) => supplementalAnswers[id])
      .map(({ label }) => t(label))
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
          <span>
            {t('Score :')} {formatQuizScore(session.score, language)} / {total}
          </span>
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
          {session.completed && (
            <QuizReview session={session} onSelectCountry={onSelectReviewCountry} />
          )}
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
          {!session.completed &&
            supplementalQuizFactOptions
              .filter(({ id }) => supplementalClues[id])
              .map((option) => (
                <div className="quiz-fullscreen-text-clue" key={option.id}>
                  <span>{t(option.label)}</span>
                  <strong>{question.supplementalFacts[option.id]}</strong>
                </div>
              ))}
          {answerIsShown && !session.completed && (
            <div
              className={`quiz-fullscreen-revealed-answer${session.answerCorrect === true ? ' is-correct' : ''}`}
              aria-live="polite"
            >
              <strong>{t(session.answerCorrect === true ? 'Bonne réponse !' : 'Réponse')}</strong>
              <span>
                {t('Territoire sur la carte')} :{' '}
                {question.countryAnswerGroup.length > 1
                  ? question.countryAnswerGroup.map(({ name }) => name).join(', ')
                  : question.frenchCountryName}
              </span>
              <span>
                {t('Nom du pays')} :{' '}
                {question.countryAnswerGroup.length > 1
                  ? question.countryAnswerGroup.map(({ name }) => name).join(', ')
                  : question.frenchCountryName}
              </span>
              <span>
                {t('Capitale')} : {question.capitalName}
              </span>
              <span className="quiz-fullscreen-answer-flag">
                {t('Drapeau')} : <img src={getFlagImageSource(question.alpha2)} alt="" />
              </span>
            </div>
          )}
        </div>
      )}

      <div className="quiz-fullscreen-actions">
        <SkinSelector compact />
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
              <span className="quiz-fullscreen-map-instruction">
                {t('Clique le territoire sur la carte')}
              </span>
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
