import type { QuizMode } from './progress'

export type CountryModeStats = {
  answered: number
  correct: number
  pointsEarned: number
  pointsPossible: number
}

export type CountryQuizStats = CountryModeStats & {
  byMode: Record<QuizMode, CountryModeStats>
  byAnswer: Record<string, CountryModeStats>
}

export type CountryQuizAnswerResult = {
  id: string
  correct: boolean
  pointsEarned: number
}

export type CountryQuizQuestionResult = {
  pointsEarned: number
  answers: CountryQuizAnswerResult[]
}

export type CountryQuizStatsByAlpha2 = Record<string, CountryQuizStats>

const STORAGE_KEY = 'world-atlas:country-quiz-stats:v1'
const quizModes: QuizMode[] = ['flags', 'capitals', 'custom', 'knowledge']

function emptyMetric(): CountryModeStats {
  return { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 }
}

function emptyModeStats(): Record<QuizMode, CountryModeStats> {
  return {
    flags: emptyMetric(),
    capitals: emptyMetric(),
    custom: emptyMetric(),
    knowledge: emptyMetric()
  }
}

function readCounter(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null
}

function readPoints(value: unknown, fallback: number): number | null {
  const points = typeof value === 'number' ? value : fallback
  return Number.isFinite(points) && points >= 0 ? points : null
}

function parseMetric(value: unknown, fallback?: CountryModeStats): CountryModeStats | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const answered = readCounter(raw.answered)
  const correct = readCounter(raw.correct)
  if (answered === null || correct === null || correct > answered) return null

  const pointsEarned = readPoints(raw.pointsEarned, fallback?.pointsEarned ?? correct)
  const pointsPossible = readPoints(raw.pointsPossible, fallback?.pointsPossible ?? answered)
  if (pointsEarned === null || pointsPossible === null || pointsEarned > pointsPossible + 1e-8) {
    return null
  }

  return { answered, correct, pointsEarned, pointsPossible }
}

function parseCountryStats(value: unknown): CountryQuizStats | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const answered = readCounter(raw.answered)
  const correct = readCounter(raw.correct)
  if (answered === null || correct === null || correct > answered) return null

  const legacyRoot = {
    answered,
    correct,
    pointsEarned: correct,
    pointsPossible: answered
  }
  const total = parseMetric(raw, legacyRoot)
  if (!total) return null

  const rawModes = raw.byMode && typeof raw.byMode === 'object'
    ? raw.byMode as Record<string, unknown>
    : {}
  const byMode = emptyModeStats()

  for (const mode of quizModes) {
    const modeValue = rawModes[mode]
    if (!modeValue || typeof modeValue !== 'object') continue
    const modeRaw = modeValue as Record<string, unknown>
    const modeAnswered = readCounter(modeRaw.answered)
    const modeCorrect = readCounter(modeRaw.correct)
    if (modeAnswered === null || modeCorrect === null || modeCorrect > modeAnswered) continue
    const parsed = parseMetric(modeRaw, {
      answered: modeAnswered,
      correct: modeCorrect,
      pointsEarned: modeCorrect,
      pointsPossible: modeAnswered
    })
    if (parsed) byMode[mode] = parsed
  }

  const byAnswer: Record<string, CountryModeStats> = {}
  const rawAnswers = raw.byAnswer && typeof raw.byAnswer === 'object'
    ? raw.byAnswer as Record<string, unknown>
    : {}
  for (const [id, answerStats] of Object.entries(rawAnswers)) {
    const parsed = parseMetric(answerStats)
    if (/^[a-z][a-zA-Z0-9:-]*$/.test(id) && parsed) byAnswer[id] = parsed
  }

  return { ...total, byMode, byAnswer }
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
  isCorrect: boolean,
  result?: CountryQuizQuestionResult
): CountryQuizStatsByAlpha2 {
  const code = alpha2.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return previous

  const previousCountry = previous[code] ?? {
    ...emptyMetric(),
    byMode: emptyModeStats(),
    byAnswer: {}
  }
  const previousMode = previousCountry.byMode[mode] ?? emptyMetric()
  const questionPoints = Math.max(0, Math.min(1, result?.pointsEarned ?? (isCorrect ? 1 : 0)))
  const byAnswer = { ...previousCountry.byAnswer }

  for (const answer of result?.answers ?? []) {
    if (!/^[a-z][a-zA-Z0-9:-]*$/.test(answer.id)) continue
    const previousAnswer = byAnswer[answer.id] ?? emptyMetric()
    const answerPoints = Math.max(0, Math.min(1, answer.pointsEarned))
    byAnswer[answer.id] = {
      answered: previousAnswer.answered + 1,
      correct: previousAnswer.correct + (answer.correct ? 1 : 0),
      pointsEarned: previousAnswer.pointsEarned + answerPoints,
      pointsPossible: previousAnswer.pointsPossible + 1
    }
  }

  return {
    ...previous,
    [code]: {
      answered: previousCountry.answered + 1,
      correct: previousCountry.correct + (isCorrect ? 1 : 0),
      pointsEarned: previousCountry.pointsEarned + questionPoints,
      pointsPossible: previousCountry.pointsPossible + 1,
      byMode: {
        ...previousCountry.byMode,
        [mode]: {
          answered: previousMode.answered + 1,
          correct: previousMode.correct + (isCorrect ? 1 : 0),
          pointsEarned: previousMode.pointsEarned + questionPoints,
          pointsPossible: previousMode.pointsPossible + 1
        }
      },
      byAnswer
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
