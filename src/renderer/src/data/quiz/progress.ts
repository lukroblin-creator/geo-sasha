const STORAGE_KEY = 'world-atlas:quiz-progress:v2'

export type QuizProgress = {
  completedCountryFlagSessions: number
  bestCountryFlagScore: number
  lastCountryFlagScore: number
}

const emptyProgress: QuizProgress = {
  completedCountryFlagSessions: 0,
  bestCountryFlagScore: 0,
  lastCountryFlagScore: 0
}

export function loadQuizProgress(): QuizProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return emptyProgress

    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object') return emptyProgress

    const progress = value as Partial<QuizProgress>
    if (
      !Number.isInteger(progress.completedCountryFlagSessions) ||
      !Number.isInteger(progress.bestCountryFlagScore) ||
      !Number.isInteger(progress.lastCountryFlagScore)
    ) {
      return emptyProgress
    }

    return {
      completedCountryFlagSessions: Math.max(0, progress.completedCountryFlagSessions!),
      bestCountryFlagScore: Math.max(0, progress.bestCountryFlagScore!),
      lastCountryFlagScore: Math.max(0, progress.lastCountryFlagScore!)
    }
  } catch {
    return emptyProgress
  }
}

export function saveCompletedCountryFlagQuiz(score: number): QuizProgress {
  const previous = loadQuizProgress()
  const updated = {
    completedCountryFlagSessions: previous.completedCountryFlagSessions + 1,
    bestCountryFlagScore: Math.max(previous.bestCountryFlagScore, score),
    lastCountryFlagScore: score
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Le quiz reste jouable même si le stockage local est indisponible.
  }

  return updated
}
