import type { QuizMode } from './progress'

export type CountryModeStats = {
  answered: number
  correct: number
}

export type CountryQuizStats = {
  answered: number
  correct: number
  byMode: Record<QuizMode, CountryModeStats>
}

export type CountryQuizStatsByAlpha2 = Record<string, CountryQuizStats>

const STORAGE_KEY = 'world-atlas:country-quiz-stats:v1'
const quizModes: QuizMode[] = ['flags', 'capitals', 'custom', 'knowledge']

function emptyModeStats(): Record<QuizMode, CountryModeStats> {
  return {
    flags: { answered: 0, correct: 0 },
    capitals: { answered: 0, correct: 0 },
    custom: { answered: 0, correct: 0 },
    knowledge: { answered: 0, correct: 0 }
  }
}

function readCounter(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null
}

function parseCountryStats(value: unknown): CountryQuizStats | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const answered = readCounter(raw.answered)
  const correct = readCounter(raw.correct)
  if (answered === null || correct === null || correct > answered) return null

  const rawModes = raw.byMode && typeof raw.byMode === 'object'
    ? raw.byMode as Record<string, unknown>
    : {}
  const byMode = emptyModeStats()

  for (const mode of quizModes) {
    const modeValue = rawModes[mode]
    if (!modeValue || typeof modeValue !== 'object') continue
    const modeStats = modeValue as Record<string, unknown>
    const modeAnswered = readCounter(modeStats.answered)
    const modeCorrect = readCounter(modeStats.correct)
    if (
      modeAnswered !== null &&
      modeCorrect !== null &&
      modeCorrect <= modeAnswered
    ) {
      byMode[mode] = { answered: modeAnswered, correct: modeCorrect }
    }
  }

  return { answered, correct, byMode }
}

export function loadCountryQuizStats(): CountryQuizStatsByAlpha2 {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.entries(parsed).reduce<CountryQuizStatsByAlpha2>(
      (stats, [alpha2, value]) => {
        const countryStats = parseCountryStats(value)
        if (/^[A-Z]{2}$/.test(alpha2.toUpperCase()) && countryStats) {
          stats[alpha2.toUpperCase()] = countryStats
        }
        return stats
      },
      {}
    )
  } catch {
    return {}
  }
}

export function updateCountryQuizStats(
  previous: CountryQuizStatsByAlpha2,
  alpha2: string,
  mode: QuizMode,
  isCorrect: boolean
): CountryQuizStatsByAlpha2 {
  const code = alpha2.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return previous

  const previousCountry = previous[code] ?? {
    answered: 0,
    correct: 0,
    byMode: emptyModeStats()
  }
  const previousMode = previousCountry.byMode[mode] ?? { answered: 0, correct: 0 }

  return {
    ...previous,
    [code]: {
      answered: previousCountry.answered + 1,
      correct: previousCountry.correct + (isCorrect ? 1 : 0),
      byMode: {
        ...previousCountry.byMode,
        [mode]: {
          answered: previousMode.answered + 1,
          correct: previousMode.correct + (isCorrect ? 1 : 0)
        }
      }
    }
  }
}

export function saveCountryQuizStats(stats: CountryQuizStatsByAlpha2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // Les quiz restent jouables si le stockage local est indisponible.
  }
}
