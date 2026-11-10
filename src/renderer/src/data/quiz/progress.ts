const STORAGE_KEY = 'world-atlas:quiz-progress:v1'

export type QuizProgress = {
  completedFlagSessions: number
  bestFlagScore: number
  lastFlagScore: number
}

const emptyProgress: QuizProgress = {
  completedFlagSessions: 0,
  bestFlagScore: 0,
  lastFlagScore: 0
}

export function loadQuizProgress(): QuizProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return emptyProgress

    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object') return emptyProgress

    const progress = value as Partial<QuizProgress>
    if (
      !Number.isInteger(progress.completedFlagSessions) ||
      !Number.isInteger(progress.bestFlagScore) ||
      !Number.isInteger(progress.lastFlagScore)
    ) {
      return emptyProgress
    }

    return {
      completedFlagSessions: Math.max(0, progress.completedFlagSessions!),
      bestFlagScore: Math.max(0, progress.bestFlagScore!),
      lastFlagScore: Math.max(0, progress.lastFlagScore!)
    }
  } catch {
    return emptyProgress
  }
}

export function saveCompletedFlagQuiz(score: number): QuizProgress {
  const previous = loadQuizProgress()
  const updated = {
    completedFlagSessions: previous.completedFlagSessions + 1,
    bestFlagScore: Math.max(previous.bestFlagScore, score),
    lastFlagScore: score
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Le quiz reste jouable même si le stockage local est indisponible.
  }

  return updated
}
