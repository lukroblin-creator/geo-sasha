export type QuizMode = 'flags' | 'capitals' | 'custom'

export type QuizStats = {
  completedSessions: number
  bestScore: number
  lastScore: number
}

export type QuizProgress = Record<QuizMode, QuizStats>

const STORAGE_KEY = 'world-atlas:quiz-progress:v3'
const PREVIOUS_STORAGE_KEYS = [
  'world-atlas:quiz-progress:v2',
  'world-atlas:quiz-progress:v1'
]

function emptyStats(): QuizStats {
  return { completedSessions: 0, bestScore: 0, lastScore: 0 }
}

function emptyProgress(): QuizProgress {
  return { flags: emptyStats(), capitals: emptyStats(), custom: emptyStats() }
}

function toStats(value: unknown): QuizStats | null {
  if (!value || typeof value !== 'object') return null

  const stats = value as Record<string, unknown>
  const completedSessions = stats.completedSessions
  const bestScore = stats.bestScore
  const lastScore = stats.lastScore
  if (
    !Number.isInteger(completedSessions) ||
    !Number.isInteger(bestScore) ||
    !Number.isInteger(lastScore)
  ) {
    return null
  }

  return {
    completedSessions: Math.max(0, completedSessions as number),
    bestScore: Math.max(0, bestScore as number),
    lastScore: Math.max(0, lastScore as number)
  }
}

function migratePreviousProgress(value: unknown): QuizProgress | null {
  if (!value || typeof value !== 'object') return null

  const previous = value as Record<string, unknown>
  const flags = toStats({
    completedSessions:
      previous.completedCountryFlagSessions ?? previous.completedFlagSessions,
    bestScore: previous.bestCountryFlagScore ?? previous.bestFlagScore,
    lastScore: previous.lastCountryFlagScore ?? previous.lastFlagScore
  })

  return flags
    ? { flags, capitals: emptyStats(), custom: emptyStats() }
    : null
}

export function loadQuizProgress(): QuizProgress {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) {
      const value: unknown = JSON.parse(current)
      if (value && typeof value === 'object') {
        const progress = value as Record<string, unknown>
        const flags = toStats(progress.flags)
        const capitals = toStats(progress.capitals)
        const custom = toStats(progress.custom) ?? emptyStats()
        if (flags && capitals) return { flags, capitals, custom }
      }
    }

    for (const key of PREVIOUS_STORAGE_KEYS) {
      const previous = localStorage.getItem(key)
      if (!previous) continue

      const migrated = migratePreviousProgress(JSON.parse(previous))
      if (migrated) return migrated
    }
  } catch {
    // Une progression absente ou illisible n'empêche pas les quiz de fonctionner.
  }

  return emptyProgress()
}

export function saveCompletedQuiz(
  mode: QuizMode,
  score: number
): QuizProgress {
  const previous = loadQuizProgress()
  const updated: QuizProgress = {
    ...previous,
    [mode]: {
      completedSessions: previous[mode].completedSessions + 1,
      bestScore: Math.max(previous[mode].bestScore, score),
      lastScore: score
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Les quiz restent jouables si le stockage local est indisponible.
  }

  return updated
}
