import { useState } from 'react'
import WorldMap from './WorldMapLoader'
import { SkinSelector } from './AppModeSwitcher'
import { useLanguage } from '../data/i18n'
import { formatQuizScore } from '../data/quiz/useQuizSession'
import { getEstimationPrecision, type EstimationQuestion } from '../data/quiz/estimationQuiz'
import { useAdvanceQuestionOnEnter } from './useAdvanceQuestionOnEnter'

type EstimationQuizViewProps = {
  questions: EstimationQuestion[]
  onStop: () => void
  onRestart: () => void
  onCompleted: (score: number) => void
  globeMode: boolean
  onToggleGlobeMode: () => void
}

export function EstimationQuizView({
  questions,
  onStop,
  onRestart,
  onCompleted,
  globeMode,
  onToggleGlobeMode
}: EstimationQuizViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [precision, setPrecision] = useState<number | null>(null)
  const [totalPrecision, setTotalPrecision] = useState(0)
  const [completedScore, setCompletedScore] = useState<number | null>(null)
  const question = questions[index]
  const answeredCount = index + (precision === null ? 0 : 1)
  const score = completedScore ?? (answeredCount ? (totalPrecision / answeredCount) * 100 : 0)

  const submit = (): void => {
    const answer = Number(input.replace(',', '.'))
    if (!question || !Number.isFinite(answer) || answer <= 0 || precision !== null) return
    const nextPrecision = getEstimationPrecision(answer, question.actualValue)
    setPrecision(nextPrecision)
    const nextTotal = totalPrecision + nextPrecision
    setTotalPrecision(nextTotal)
    if (index === questions.length - 1) {
      const finalScore = questions.length ? (nextTotal / questions.length) * 100 : 0
      setCompletedScore(finalScore)
      onCompleted(finalScore)
    }
  }

  const nextQuestion = (): void => {
    if (precision === null || index >= questions.length - 1) return
    setIndex((current) => current + 1)
    setInput('')
    setPrecision(null)
  }

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
        <div className="special-quiz-header-actions">
          <SkinSelector compact />
          <button type="button" onClick={onStop}>
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
                      disabled={precision !== null}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="0"
                    />
                    <span>{question.unit}</span>
                  </div>
                </label>
                {precision === null ? (
                  <button
                    className="quiz-start-button"
                    type="submit"
                    disabled={!input || Number(input) <= 0}
                  >
                    {t('Valider mon estimation')}
                  </button>
                ) : (
                  <div className="estimation-feedback">
                    <strong>
                      {formatQuizScore(precision * 100, language)} % {t('de précision')}
                    </strong>
                    <span>
                      {t('Valeur attendue')} : {question.actualValue.toLocaleString(language)}{' '}
                      {question.unit}
                    </span>
                    {index < questions.length - 1 ? (
                      <button className="quiz-start-button" type="button" onClick={nextQuestion}>
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
              <button className="quiz-start-button" type="button" onClick={onRestart}>
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
