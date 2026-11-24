import { useMemo } from 'react'
import type { QuizHistoryEntry } from '../data/quiz/quizHistory'
import { calculateQuizAchievements, type QuizAchievementProgress } from '../data/quiz/quizRewards'
import { useLanguage } from '../data/i18n'

type QuizRewardsPanelProps = {
  history: QuizHistoryEntry[]
}

function formatAchievementDate(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date)
}

function formatAchievementProgress(
  achievement: QuizAchievementProgress,
  language: string,
  t: (value: string) => string
): string {
  if (achievement.unit === 'percent') {
    const percent = new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
    return `${percent.format(achievement.current)} % / ${percent.format(achievement.target)} %`
  }
  if (achievement.unit === 'questions') {
    const count = new Intl.NumberFormat(language)
    return `${count.format(achievement.current)} / ${count.format(achievement.target)} ${t('questions')}`
  }
  return `${achievement.current} / ${achievement.target}`
}

function AchievementCard({
  achievement,
  language,
  t
}: {
  achievement: QuizAchievementProgress
  language: string
  t: (value: string) => string
}): React.JSX.Element {
  const progressPercent = Math.round((achievement.current / achievement.target) * 100)

  return (
    <article
      className={`quiz-achievement-card${achievement.unlocked ? ' is-unlocked' : ''}`}
      aria-label={`${t(achievement.titleKey)} · ${formatAchievementProgress(achievement, language, t)}`}
    >
      <div className="quiz-achievement-card-topline">
        <span className="quiz-achievement-symbol" aria-hidden="true">
          {achievement.unlocked ? '✦' : '◇'}
        </span>
        <span className="quiz-achievement-category">{t(achievement.categoryKey)}</span>
      </div>
      <h3>{t(achievement.titleKey)}</h3>
      <p>{t(achievement.descriptionKey)}</p>
      <div
        className="quiz-achievement-progress-track"
        role="progressbar"
        aria-label={t(achievement.titleKey)}
        aria-valuemin={0}
        aria-valuemax={achievement.target}
        aria-valuenow={achievement.current}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="quiz-achievement-card-footer">
        <strong>{formatAchievementProgress(achievement, language, t)}</strong>
        {achievement.unlockedAt ? (
          <span>
            {t('Obtenu le')} {formatAchievementDate(achievement.unlockedAt, language)}
          </span>
        ) : (
          <span>{t('À débloquer')}</span>
        )}
      </div>
    </article>
  )
}

export function QuizRewardsPanel({ history }: QuizRewardsPanelProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const achievements = useMemo(() => calculateQuizAchievements(history), [history])
  const unlocked = achievements.filter(({ unlocked }) => unlocked)
  const inProgress = achievements.filter(({ unlocked }) => !unlocked)

  return (
    <section className="quiz-history-page quiz-rewards-page">
      <div className="statistics-section-heading">
        <div>
          <h2>{t('Récompenses et progression')}</h2>
          <p>{t('Les accomplissements reflètent tes parties terminées et leurs résultats.')}</p>
        </div>
        <div className="quiz-rewards-count">
          <strong>
            {unlocked.length} / {achievements.length}
          </strong>
          <span>{t('accomplissements obtenus')}</span>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="statistics-empty-selection quiz-rewards-empty">
          <h2>{t('Aucune progression à afficher')}</h2>
          <p>
            {t('Termine une partie de quiz pour voir apparaître tes premiers accomplissements.')}
          </p>
        </div>
      ) : (
        <>
          {unlocked.length > 0 && (
            <section className="quiz-achievement-section" aria-labelledby="quiz-rewards-unlocked">
              <h3 id="quiz-rewards-unlocked">{t('Obtenus')}</h3>
              <div className="quiz-achievement-grid">
                {unlocked.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    language={language}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}
          {inProgress.length > 0 && (
            <section className="quiz-achievement-section" aria-labelledby="quiz-rewards-progress">
              <h3 id="quiz-rewards-progress">{t('À découvrir')}</h3>
              <div className="quiz-achievement-grid">
                {inProgress.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    language={language}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}
          <p className="quiz-rewards-note">
            {t(
              'Les récompenses complètent les statistiques et ne remplacent pas tes scores détaillés. Elles décrivent des réussites dans World Atlas, pas tout ton niveau géographique.'
            )}
          </p>
        </>
      )}
    </section>
  )
}
