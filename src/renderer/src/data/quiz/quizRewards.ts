import type { QuizHistoryEntry } from './quizHistory'
import type { QuizMode } from './progress'

export const quizAchievementDefinitions = [
  {
    id: 'first-game',
    titleKey: 'Premier tour',
    descriptionKey: 'Termine une première partie de quiz.',
    categoryKey: 'Découverte',
    target: 1,
    unit: 'count'
  },
  {
    id: 'versatile-player',
    titleKey: 'Esprit polyvalent',
    descriptionKey: 'Termine des quiz dans trois modes différents.',
    categoryKey: 'Découverte',
    target: 3,
    unit: 'count'
  },
  {
    id: 'precision',
    titleKey: 'Précision confirmée',
    descriptionKey: 'Atteins au moins 90 % des points sur une partie terminée.',
    categoryKey: 'Maîtrise',
    target: 90,
    unit: 'percent'
  },
  {
    id: 'long-quiz',
    titleKey: 'Endurance géographique',
    descriptionKey: 'Termine une partie contenant au moins 25 questions.',
    categoryKey: 'Maîtrise',
    target: 25,
    unit: 'questions'
  },
  {
    id: 'clean-streak',
    titleKey: 'Série appliquée',
    descriptionKey: 'Réussis cinq réponses de suite du premier coup, sans révéler la solution.',
    categoryKey: 'Régularité',
    target: 5,
    unit: 'count'
  },
  {
    id: 'personal-best',
    titleKey: 'Nouveau record',
    descriptionKey: 'Améliore ton score sur une configuration déjà jouée.',
    categoryKey: 'Progression',
    target: 1,
    unit: 'count'
  },
  {
    id: 'quick-and-accurate',
    titleKey: 'Rapide et précis',
    descriptionKey:
      'Termine un quiz chronométré avec au moins 85 % des points et en 15 secondes par question en moyenne.',
    categoryKey: 'Contre-la-montre',
    target: 1,
    unit: 'count'
  }
] as const

export type QuizAchievementId = (typeof quizAchievementDefinitions)[number]['id']
export type QuizAchievementUnit = 'count' | 'percent' | 'questions'

export type QuizAchievementProgress = {
  id: QuizAchievementId
  titleKey: string
  descriptionKey: string
  categoryKey: string
  current: number
  target: number
  unit: QuizAchievementUnit
  unlocked: boolean
  unlockedAt: string | null
}

type AchievementState = {
  current: number
  unlocked: boolean
  unlockedAt: string | null
}

const cleanStreakTarget = 5
const minimumPrecisionPercent = 90
const longQuizQuestionTarget = 25
const minimumTimedQuizPrecision = 0.85
const maximumAverageTimedQuestionMilliseconds = 15_000

function chronologicalHistory(history: readonly QuizHistoryEntry[]): QuizHistoryEntry[] {
  return history
    .map((entry, originalIndex) => ({
      entry,
      originalIndex,
      timestamp: Date.parse(entry.completedAt)
    }))
    .sort((first, second) => {
      const firstTime = Number.isFinite(first.timestamp) ? first.timestamp : 0
      const secondTime = Number.isFinite(second.timestamp) ? second.timestamp : 0
      return (
        firstTime - secondTime ||
        first.entry.id.localeCompare(second.entry.id) ||
        first.originalIndex - second.originalIndex
      )
    })
    .map(({ entry }) => entry)
}

function isPerformanceEligible(entry: QuizHistoryEntry): boolean {
  const questionBasedMode = entry.mode !== 'estimation' && entry.mode !== 'draw-borders'
  return (
    entry.total > 0 &&
    Number.isFinite(entry.score) &&
    Number.isFinite(entry.total) &&
    (!questionBasedMode || entry.questions.length === entry.total) &&
    !entry.timing?.expired &&
    !entry.questions.some(({ status }) => status === 'timed-out' || status === 'not-reached')
  )
}

function getScoreRate(entry: QuizHistoryEntry): number | null {
  if (!isPerformanceEligible(entry) || entry.total <= 0) return null
  return Math.max(0, Math.min(1, entry.score / entry.total))
}

function formatProgress(
  states: Record<QuizAchievementId, AchievementState>
): QuizAchievementProgress[] {
  return quizAchievementDefinitions.map((definition) => {
    const state = states[definition.id]
    const current = Math.min(definition.target, Math.max(0, state.current))
    return {
      ...definition,
      current,
      unlocked: state.unlocked,
      unlockedAt: state.unlockedAt
    }
  })
}

function getAchievementDate(entry: QuizHistoryEntry): string | null {
  return Number.isFinite(Date.parse(entry.completedAt)) ? entry.completedAt : null
}

function unlock(state: AchievementState, entry: QuizHistoryEntry): void {
  if (state.unlocked) return
  state.unlocked = true
  state.unlockedAt = getAchievementDate(entry)
}

export function calculateQuizAchievements(
  history: readonly QuizHistoryEntry[]
): QuizAchievementProgress[] {
  const orderedHistory = chronologicalHistory(history)
  const eligibleHistory = orderedHistory.filter(isPerformanceEligible)
  const states: Record<QuizAchievementId, AchievementState> = {
    'first-game': {
      current: Math.min(1, eligibleHistory.length),
      unlocked: false,
      unlockedAt: null
    },
    'versatile-player': { current: 0, unlocked: false, unlockedAt: null },
    precision: { current: 0, unlocked: false, unlockedAt: null },
    'long-quiz': { current: 0, unlocked: false, unlockedAt: null },
    'clean-streak': { current: 0, unlocked: false, unlockedAt: null },
    'personal-best': { current: 0, unlocked: false, unlockedAt: null },
    'quick-and-accurate': { current: 0, unlocked: false, unlockedAt: null }
  }

  if (eligibleHistory.length) unlock(states['first-game'], eligibleHistory[0])

  const seenModes = new Set<QuizMode>()
  let bestScorePercent = 0
  const bestScoreByConfiguration = new Map<string, number>()
  let streak = 0
  let longestStreak = 0

  for (const entry of orderedHistory) {
    if (!isPerformanceEligible(entry)) {
      // Invalid, incomplete, and expired sessions cannot extend a clean streak.
      streak = 0
      continue
    }
    seenModes.add(entry.mode)
    states['versatile-player'].current = Math.min(3, seenModes.size)
    if (seenModes.size >= 3) unlock(states['versatile-player'], entry)

    const scoreRate = getScoreRate(entry) ?? 0
    const scorePercent = scoreRate * 100
    bestScorePercent = Math.max(bestScorePercent, scorePercent)
    states.precision.current = Math.min(minimumPrecisionPercent, bestScorePercent)
    if (scoreRate >= minimumPrecisionPercent / 100) unlock(states.precision, entry)

    if (entry.mode !== 'estimation' && entry.mode !== 'draw-borders') {
      states['long-quiz'].current = Math.max(
        states['long-quiz'].current,
        Math.min(longQuizQuestionTarget, entry.total)
      )
      if (entry.total >= longQuizQuestionTarget) unlock(states['long-quiz'], entry)
    }

    if (entry.comparisonKey) {
      const previousBest = bestScoreByConfiguration.get(entry.comparisonKey)
      if (
        previousBest !== undefined &&
        scoreRate > previousBest &&
        !states['personal-best'].unlocked
      ) {
        states['personal-best'].current = 1
        unlock(states['personal-best'], entry)
      }
      bestScoreByConfiguration.set(entry.comparisonKey, Math.max(previousBest ?? 0, scoreRate))
    }

    if (
      entry.timing &&
      entry.timing.settings.mode !== 'none' &&
      entry.questions.length > 0 &&
      Number.isFinite(entry.timing.elapsedMilliseconds) &&
      entry.timing.elapsedMilliseconds >= 0 &&
      scoreRate >= minimumTimedQuizPrecision &&
      entry.timing.elapsedMilliseconds / entry.questions.length <=
        maximumAverageTimedQuestionMilliseconds &&
      !states['quick-and-accurate'].unlocked
    ) {
      states['quick-and-accurate'].current = 1
      unlock(states['quick-and-accurate'], entry)
    }

    if (entry.questions.length === 0) {
      // Some special modes persist a score without answer-level detail.
      streak = 0
      continue
    }

    for (const question of entry.questions) {
      if (question.status === 'timed-out' || question.status === 'not-reached') {
        streak = 0
        continue
      }
      if (question.correct && !question.revealed && question.attempts === 1) {
        streak += 1
        longestStreak = Math.max(longestStreak, streak)
        if (streak >= cleanStreakTarget) unlock(states['clean-streak'], entry)
      } else {
        streak = 0
      }
    }
  }

  states['clean-streak'].current = Math.min(cleanStreakTarget, longestStreak)
  return formatProgress(states)
}
