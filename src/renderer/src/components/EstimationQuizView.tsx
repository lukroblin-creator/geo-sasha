import { useKeyboardShortcut } from '../data/keyboardShortcuts'
import { useCallback, useEffect, useRef, useState } from 'react'
import WorldMap from './WorldMapLoader'
import { SkinSelector } from './AppModeSwitcher'
import { useLanguage } from '../data/i18n'
import { formatQuizScore } from '../data/quiz/useQuizSession'
import {
  formatDuration,
  type QuizTimingOutcome,
  type QuizTimingSettings
} from '../data/quiz/quizTiming'
import { getEstimationPrecision, type EstimationQuestion } from '../data/quiz/estimationQuiz'
import { useAdvanceQuestionOnEnter } from './useAdvanceQuestionOnEnter'

type EstimationQuizViewProps = {
  questions: EstimationQuestion[]
  onStop: () => void
  onRestart: () => void
  onCompleted: (score: number, outcome?: QuizTimingOutcome) => void
  globeMode: boolean
  onToggleGlobeMode: () => void
  timing: QuizTimingSettings
  timerMilliseconds: number
  timeExpired: boolean
}

export function EstimationQuizView({
  questions,
  onStop,
  onRestart,
  onCompleted,
  globeMode,
  onToggleGlobeMode,
  timing,
  timerMilliseconds,
  timeExpired
}: EstimationQuizViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [precision, setPrecision] = useState<number | null>(null)
  const [totalPrecision, setTotalPrecision] = useState(0)
  const [completedScore, setCompletedScore] = useState<number | null>(null)
  const [timedOutQuestionIndices, setTimedOutQuestionIndices] = useState<number[]>([])
  const [questionRemainingMs, setQuestionRemainingMs] = useState(0)
  const questionStartedAtRef = useRef(0)
  const timedOutQuestionIndicesRef = useRef(new Set<number>())
  const question = questions[index]
  const questionTimedOut = timedOutQuestionIndices.includes(index)
  const answeredCount = index + (precision === null ? 0 : 1)
  const score = completedScore ?? (answeredCount ? (totalPrecision / answeredCount) * 100 : 0)

  const finishByTimeout = useCallback((): void => {
    if (completedScore !== null) return
    const finalScore = questions.length ? (totalPrecision / questions.length) * 100 : 0
    setCompletedScore(finalScore)
    onCompleted(finalScore, {
      timedOutQuestions: timedOutQuestionIndicesRef.current.size,
      notReachedQuestions: Math.max(
        0,
        questions.length - answeredCount - timedOutQuestionIndicesRef.current.size
      ),
      expired: true
    })
  }, [answeredCount, completedScore, onCompleted, questions.length, totalPrecision])

  useEffect(() => {
    if (!timeExpired) return
    const timeout = window.setTimeout(finishByTimeout, 0)
    return () => window.clearTimeout(timeout)
  }, [finishByTimeout, timeExpired])

  useEffect(() => {
    questionStartedAtRef.current = performance.now()
    if (
      timing.mode !== 'countdown' ||
      timing.scope !== 'question' ||
      precision !== null ||
      questionTimedOut
    )
      return
    const deadline = questionStartedAtRef.current + timing.limitSeconds * 1000
    const tick = (): void => {
      const now = performance.now()
      const remaining = Math.max(0, deadline - now)
      setQuestionRemainingMs(remaining)
      if (remaining === 0 && !timedOutQuestionIndicesRef.current.has(index)) {
        timedOutQuestionIndicesRef.current.add(index)
        setTimedOutQuestionIndices((current) => [...current, index])
      }
    }
    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [index, precision, questionTimedOut, timing])

  const submit = (): void => {
    const answer = Number(input.replace(',', '.'))
    if (
      !question ||
      !Number.isFinite(answer) ||
      answer <= 0 ||
      precision !== null ||
      questionTimedOut
    )
      return
    if (
      timing.mode === 'countdown' &&
      timing.scope === 'question' &&
      performance.now() >= questionStartedAtRef.current + timing.limitSeconds * 1000
    ) {
      if (!timedOutQuestionIndicesRef.current.has(index)) {
        timedOutQuestionIndicesRef.current.add(index)
        setTimedOutQuestionIndices((current) => [...current, index])
      }
      return
    }
    const nextPrecision = getEstimationPrecision(answer, question.actualValue)
    setPrecision(nextPrecision)
    const nextTotal = totalPrecision + nextPrecision
    setTotalPrecision(nextTotal)
    if (index === questions.length - 1) {
      const finalScore = questions.length ? (nextTotal / questions.length) * 100 : 0
      setCompletedScore(finalScore)
      onCompleted(finalScore, {
        timedOutQuestions: timedOutQuestionIndicesRef.current.size,
        notReachedQuestions: 0,
        expired: false
      })
    }
  }

  const nextQuestion = (): void => {
    if ((!questionTimedOut && precision === null) || index >= questions.length - 1) return
    setIndex((current) => current + 1)
    setInput('')
    setPrecision(null)
  }

  useKeyboardShortcut('quiz.stop', onStop)
  useKeyboardShortcut('quiz.restart', onRestart, completedScore !== null)
  useKeyboardShortcut(
    'quiz.verify',
    submit,
    Boolean(question) && precision === null && Number(input.replace(',', '.')) > 0
  )
  useAdvanceQuestionOnEnter(
    precision !== null && completedScore === null && index < questions.length - 1,
    nextQuestion
  )

  return (
    <main className="special-quiz-screen estimation-quiz-screen">
      <header className="special-quiz-header">
        <div>
          <span>{t('QUIZ MONDE / ESTIMATION')}</span>
          <h1>{t('Mode estimation')}</h1>
          <p>
            {completedScore === null
              ? `${t('Question')} ${index + 1} / ${questions.length}`
              : t('Partie terminée')}
          </p>
        </div>
        {timing.mode !== 'none' && timing.scope === 'session' && (
          <strong className="special-quiz-timer">
            {t(timing.mode === 'stopwatch' ? 'Chrono' : 'Temps restant')} ·{' '}
            {formatDuration(timerMilliseconds, language)}
          </strong>
        )}
        <div className="special-quiz-header-actions">
          <SkinSelector compact />
          <button type="button" data-shortcut-action="quiz.stop" onClick={onStop}>
            {t('Quitter la partie')}
          </button>
        </div>
      </header>

      <div className="special-quiz-layout">
        <section className="special-quiz-map-panel">
          <WorldMap
            showBorders
            showLabels={false}
            globeMode={globeMode}
            onToggleGlobeMode={onToggleGlobeMode}
            showResources={false}
          />
        </section>
        <section className="estimation-question-panel" aria-live="polite">
          {completedScore === null && question ? (
            <>
              {timing.mode === 'countdown' && timing.scope === 'question' && (
                <span className="special-quiz-timer">
                  {t('Temps restant')} · {formatDuration(questionRemainingMs, language)}
                </span>
              )}
              <span className="special-quiz-kicker">{question.metricLabel}</span>
              <h2>{question.prompt}</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                <label>
                  <span>{t('Ta estimation')}</span>
                  <div className="estimation-answer-field">
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="any"
                      value={input}
                      disabled={precision !== null || questionTimedOut}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="0"
                    />
                    <span>{question.unit}</span>
                  </div>
                </label>
                {precision === null && !questionTimedOut ? (
                  <button
                    className="quiz-start-button"
                    type="submit"
                    data-shortcut-action="quiz.verify"
                    disabled={!input || Number(input) <= 0}
                  >
                    {t('Valider mon estimation')}
                  </button>
                ) : questionTimedOut ? (
                  <div className="estimation-feedback">
                    <strong>{t('Temps écoulé')}</strong>
                    <span>
                      {t('Valeur attendue')} : {question.actualValue.toLocaleString(language)}{' '}
                      {question.unit}
                    </span>
                    {index < questions.length - 1 ? (
                      <button className="quiz-start-button" type="button" onClick={nextQuestion}>
                        {t('Question suivante')}
                      </button>
                    ) : (
                      <button className="quiz-start-button" type="button" onClick={finishByTimeout}>
                        {t('Voir le résultat')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="estimation-feedback">
                    <strong>
                      {formatQuizScore((precision ?? 0) * 100, language)} % {t('de précision')}
                    </strong>
                    <span>
                      {t('Valeur attendue')} : {question.actualValue.toLocaleString(language)}{' '}
                      {question.unit}
                    </span>
                    {index < questions.length - 1 ? (
                      <button
                        className="quiz-start-button"
                        type="button"
                        data-shortcut-action="quiz.nextQuestion"
                        onClick={nextQuestion}
                      >
                        {t('Question suivante')}
                      </button>
                    ) : (
                      <button className="quiz-start-button" type="button" onClick={onStop}>
                        {t('Retour aux réglages')}
                      </button>
                    )}
                  </div>
                )}
              </form>
            </>
          ) : completedScore !== null ? (
            <div className="special-quiz-finish">
              <span className="special-quiz-kicker">{t('Score moyen')}</span>
              <strong>{formatQuizScore(completedScore, language)} %</strong>
              <p>{t('Ta précision moyenne sur les estimations de cette partie.')}</p>
              <button
                className="quiz-start-button"
                type="button"
                data-shortcut-action="quiz.restart"
                onClick={onRestart}
              >
                {t('Rejouer')}
              </button>
              <button type="button" onClick={onStop}>
                {t('Quitter la partie')}
              </button>
            </div>
          ) : (
            <div className="special-quiz-finish">
              <h2>{t('Aucune estimation disponible pour cette zone.')}</h2>
              <button type="button" onClick={onStop}>
                {t('Retour aux réglages')}
              </button>
            </div>
          )}
          {completedScore === null && questions.length > 0 && (
            <div className="special-quiz-score-line">
              {t('Précision cumulée')} : {formatQuizScore(score, language)} %
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
