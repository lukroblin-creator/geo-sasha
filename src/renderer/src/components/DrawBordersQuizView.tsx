import { useKeyboardShortcut } from '../data/keyboardShortcuts'
import { useCallback, useEffect, useState } from 'react'
import WorldMap from './WorldMapLoader'
import { SkinSelector } from './AppModeSwitcher'
import { useLanguage } from '../data/i18n'
import { scoreDrawnBorders } from '../data/quiz/drawBordersQuiz'
import { quizRegions, type ContinentId } from '../data/quiz/countryContinents'
import {
  formatDuration,
  type QuizTimingOutcome,
  type QuizTimingSettings
} from '../data/quiz/quizTiming'

type DrawBordersQuizViewProps = {
  continents: ContinentId[]
  countryAlpha2: string | null
  onStop: () => void
  onRestart: () => void
  onCompleted: (score: number, outcome?: QuizTimingOutcome) => void
  globeMode: boolean
  onToggleGlobeMode: () => void
  timing: QuizTimingSettings
  timerMilliseconds: number
  timeExpired: boolean
}

export function DrawBordersQuizView({
  continents,
  countryAlpha2,
  onStop,
  onRestart,
  onCompleted,
  globeMode,
  onToggleGlobeMode,
  timing,
  timerMilliseconds,
  timeExpired
}: DrawBordersQuizViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [strokes, setStrokes] = useState<[number, number][][]>([])
  const [tool, setTool] = useState<'draw' | 'erase' | 'pan'>('draw')
  const [score, setScore] = useState<number | null>(null)

  const finish = useCallback((): void => {
    if (score !== null) return
    const nextScore = scoreDrawnBorders(strokes, continents, countryAlpha2)
    setScore(nextScore)
    onCompleted(
      nextScore,
      timeExpired ? { timedOutQuestions: 0, notReachedQuestions: 1, expired: true } : undefined
    )
  }, [continents, countryAlpha2, onCompleted, score, strokes, timeExpired])

  useEffect(() => {
    if (!timeExpired) return
    const timeout = window.setTimeout(finish, 0)
    return () => window.clearTimeout(timeout)
  }, [finish, timeExpired])

  useKeyboardShortcut('quiz.stop', onStop)
  useKeyboardShortcut('quiz.restart', onRestart, score !== null)
  useKeyboardShortcut('quiz.verify', finish, score === null)

  return (
    <main className="special-quiz-screen draw-borders-quiz-screen">
      <header className="special-quiz-header">
        <div>
          <span>{t('QUIZ MONDE / FRONTIÈRES')}</span>
          <h1>{t('Dessine les frontières')}</h1>
          <p>
            {countryAlpha2
              ? (new Intl.DisplayNames([language], { type: 'region' }).of(countryAlpha2) ??
                countryAlpha2)
              : continents.length === 0
                ? t('Monde entier')
                : continents
                    .map((id) => t(quizRegions.find((region) => region.id === id)?.label ?? id))
                    .join(' · ')}
          </p>
        </div>
        {timing.mode !== 'none' && (
          <strong className="special-quiz-timer">
            {timing.mode === 'stopwatch' ? t('Chrono') : t('Temps restant')} ·{' '}
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

      <section className="draw-borders-workspace">
        <div className="draw-borders-toolbar" aria-label={t('Outils de dessin')}>
          <div className="draw-borders-tools">
            <button
              type="button"
              disabled={score !== null}
              className={tool === 'draw' ? 'is-active' : ''}
              onClick={() => setTool('draw')}
            >
              ✎ {t('Tracer')}
            </button>
            <button
              type="button"
              disabled={score !== null}
              className={tool === 'erase' ? 'is-active' : ''}
              onClick={() => setTool('erase')}
            >
              ⌫ {t('Gomme')}
            </button>
            <button
              type="button"
              disabled={score !== null}
              className={tool === 'pan' ? 'is-active' : ''}
              onClick={() => setTool('pan')}
            >
              ✋ {t('Déplacer la carte')}
            </button>
            <button
              type="button"
              disabled={!strokes.length}
              onClick={() => setStrokes((current) => current.slice(0, -1))}
            >
              ↶ {t('Annuler le dernier trait')}
            </button>
            <button type="button" disabled={!strokes.length} onClick={() => setStrokes([])}>
              {t('Tout effacer')}
            </button>
          </div>
          {score === null ? (
            <button
              className="quiz-start-button"
              type="button"
              data-shortcut-action="quiz.verify"
              onClick={finish}
            >
              {t('Terminer et calculer le score')}
            </button>
          ) : (
            <div className="draw-borders-result" role="status">
              <strong>
                {t('Précision')} : {score.toLocaleString(language)} %
              </strong>
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
          )}
        </div>

        <div className={`draw-borders-map tool-${tool}`}>
          <WorldMap
            showBorders={false}
            showLabels={false}
            globeMode={globeMode}
            onToggleGlobeMode={onToggleGlobeMode}
            drawingStrokes={strokes}
            drawingTool={score === null ? tool : null}
            onDrawingStrokesChange={setStrokes}
          />
        </div>
      </section>
    </main>
  )
}
