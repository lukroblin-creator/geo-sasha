import WorldMap from './WorldMap'
import { getFlagImageSource } from '../data/quiz/flagAssets'
import {
  getCountryKnowledgeCountry,
  type CountryKnowledgeQuestion
} from '../data/quiz/countryKnowledge'
import { formatQuizScore, type QuizSession } from '../data/quiz/useQuizSession'
import { useLanguage } from '../data/i18n'
import { CorrectAnswerBanner } from './QuizPanels'
import { MapFullscreenBar } from './MapFullscreenBar'

type CountryKnowledgeQuizViewProps = {
  alpha2: string
  globeMode: boolean
  onToggleGlobeMode: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenStatistics: () => void
  session: QuizSession<CountryKnowledgeQuestion>
  onAnswer: (answer: string) => void
  onRevealAnswer: () => void
  onNext: () => void
  onRestart: () => void
  onStop: () => void
}

export function CountryKnowledgeQuizView({
  alpha2,
  globeMode,
  onToggleGlobeMode,
  isFullscreen,
  onToggleFullscreen,
  onOpenStatistics,
  session,
  onAnswer,
  onRevealAnswer,
  onNext,
  onRestart,
  onStop
}: CountryKnowledgeQuizViewProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const country = getCountryKnowledgeCountry(alpha2)
  const countryNames = new Intl.DisplayNames([language], { type: 'region' })
  const countryName = countryNames.of(alpha2) ?? country?.countryName ?? alpha2
  const question = session.questionOrder[session.questionIndex]
  const total = session.questionOrder.length
  const questionSettled = session.answerCorrect === true || session.answerRevealed
  const completedCount = session.questionIndex + (questionSettled ? 1 : 0)
  const progress = total ? (completedCount / total) * 100 : 0

  return (
    <main className={`country-knowledge-screen${isFullscreen ? ' map-fullscreen-screen country-knowledge-map-fullscreen' : ''}`}>
      {isFullscreen && (
        <MapFullscreenBar
          title={`${t('Quiz pays')} · ${countryName}`}
          onOpenStatistics={onOpenStatistics}
          onExit={onToggleFullscreen}
        />
      )}
      <header className="statistics-header">
        <div>
          <div className="breadcrumb">{t('APPRENTISSAGE / QUIZ PAYS')}</div>
          <h1>{t('À la découverte de')} {countryName}</h1>
          <p>{t('Réponds à des questions sur ses villes, ses reliefs, sa capitale et sa géographie.')}</p>
        </div>
        <div className="statistics-actions">
          <button className="home-back-button" type="button" onClick={onOpenStatistics}>
            {t('Statistiques')}
          </button>
          <button className="home-back-button" type="button" onClick={onStop}>
            {t('Arrêter le quiz')}
          </button>
          <button className="home-back-button" type="button" onClick={onToggleFullscreen}>
            {t(isFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
          </button>
        </div>
      </header>

      <div className="country-knowledge-content">
        <section className="country-knowledge-map" aria-label={`${t('Carte')} ${countryName}`}>
          <WorldMap
            showBorders
            showLabels={false}
            globeMode={globeMode}
            onToggleGlobeMode={onToggleGlobeMode}
            quizTargetFeatureId={country?.sourceFeatureId ?? null}
          />
          <div className="country-knowledge-country-card">
            <img src={getFlagImageSource(alpha2)} alt={`${t('Drapeau de')} ${countryName}`} />
            <div>
                <span>{t('PAYS ÉTUDIÉ')}</span>
              <strong>{countryName}</strong>
            </div>
          </div>
        </section>

        <section className="country-knowledge-question-panel" aria-live="polite">
          {session.completed ? (
            <div className="country-knowledge-complete">
              <div className="section-label">{t('QUIZ TERMINÉ')}</div>
              <h2>{t('Bien joué !')}</h2>
              <p>
                {t('Score :')}{' '}
                <strong>{formatQuizScore(session.score, language)} / {total}</strong>
              </p>
              <div className="country-knowledge-complete-actions">
                <button className="quiz-start-button" type="button" onClick={onRestart}>
                  {t('Rejouer ce pays')}
                </button>
                <button className="home-back-button" type="button" onClick={onStop}>
                  {t('Choisir un autre pays')}
                </button>
              </div>
            </div>
          ) : question ? (
            <>
              <div className="country-knowledge-progress">
                <div className="quiz-progress-row">
                  <span className="quiz-step">
                    {t('QUESTION')} {String(session.questionIndex + 1).padStart(2, '0')} / {total}
                  </span>
                  <span className="country-knowledge-score">
                    {t('Score :')} {formatQuizScore(session.score, language)}
                  </span>
                </div>
                <div
                  className="quiz-progress-track"
                  role="progressbar"
                  aria-label={t('Progression du quiz pays')}
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
                  aria-label={t('Choisir une réponse')}
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

                {session.answerCorrect ? (
                  <CorrectAnswerBanner answer={question.answer}>
                    <span>{question.explanation}</span>
                  </CorrectAnswerBanner>
                ) : (
                  <div className="country-knowledge-feedback" aria-live="polite">
                    {!questionSettled ? (
                      <span>
                        {session.answerCorrect === false
                          ? `${t('Essai')} ${session.attemptCount} · ${t('Essaie encore.')}`
                          : t('Choisis une réponse parmi les propositions.')}
                      </span>
                    ) : session.answerRevealed ? (
                      <span>
                        {t('Réponse')} : <strong>{question.answer}</strong>. {question.explanation}
                      </span>
                    ) : (
                      <span>
                        {t('Ce n’est pas la bonne réponse. Tu peux voir la solution ou passer à la suite.')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="country-knowledge-actions">
                {!session.answerCorrect && !session.answerRevealed && (
                  <button className="quiz-reveal-button" type="button" onClick={onRevealAnswer}>
                    {t('Voir la réponse')}
                  </button>
                )}
                {questionSettled && (
                  <button className="quiz-next-button" type="button" onClick={onNext}>
                    {t(session.questionIndex === total - 1 ? 'Voir le résultat' : 'Question suivante')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="country-knowledge-complete">
              <h2>{t('Aucune question disponible')}</h2>
              <button className="home-back-button" type="button" onClick={onStop}>
                {t('Retour aux pays')}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
