import type { QuizMode } from './progress'

export type QuizHistoryQuestion = {
  alpha2: string | null
  countryName: string
  prompt: string
  answer: string
  selectedAnswer: string
  correct: boolean
  revealed: boolean
  attempts: number
  points: number
}

export type QuizHistoryEntry = {
  id: string
  completedAt: string
  mode: QuizMode
  score: number
  total: number
  presetId: string | null
  presetName: string | null
  region: string
  settings: string[]
  questions: QuizHistoryQuestion[]
}

export type QuizHistorySourceRow = {
  question: unknown
  correct: boolean
  revealed: boolean
  selectedAnswer: string | null
  answerAttempts: Record<string, number>
  answerPoints: Record<string, number>
}

export function summarizeQuizHistoryQuestions(
  rows: readonly QuizHistorySourceRow[],
  language: string
): QuizHistoryQuestion[] {
  const localizedNames = new Intl.DisplayNames([language], { type: 'region' })
  return rows.map((row) => {
    const question = row.question as {
      alpha2?: string
      countryName?: string
      frenchCountryName?: string
      prompt?: string
      answer?: string
      capitalName?: string
      countryAnswerGroup?: { alpha2: string; name: string }[]
    }
    const alpha2 = question.alpha2?.toUpperCase() ?? null
    const countryName = alpha2
      ? (localizedNames.of(alpha2) ?? question.frenchCountryName ?? question.countryName ?? alpha2)
      : (question.frenchCountryName ?? question.countryName ?? '')
    return {
      alpha2,
      countryName,
      prompt: question.prompt ?? 'Pays à retrouver',
      answer:
        question.answer ??
        ((question.countryAnswerGroup?.length ?? 0) > 1
          ? question.countryAnswerGroup?.map(({ name }) => name).join(', ')
          : [question.frenchCountryName ?? question.countryName, question.capitalName]
              .filter(Boolean)
              .join(' · ')) ??
        '',
      selectedAnswer: row.selectedAnswer ?? '',
      correct: row.correct,
      revealed: row.revealed,
      attempts: Math.max(0, ...Object.values(row.answerAttempts)),
      points: Object.values(row.answerPoints).reduce((sum, points) => sum + points, 0)
    }
  })
}

const STORAGE_KEY = 'world-atlas:quiz-history:v1'
const HISTORY_LIMIT = 500
const quizModes: QuizMode[] = [
  'flags',
  'capitals',
  'custom',
  'knowledge',
  'estimation',
  'draw-borders'
]

function isHistoryQuestion(value: unknown): value is QuizHistoryQuestion {
  if (!value || typeof value !== 'object') return false
  const question = value as Record<string, unknown>
  return (
    (question.alpha2 === null || typeof question.alpha2 === 'string') &&
    typeof question.countryName === 'string' &&
    typeof question.prompt === 'string' &&
    typeof question.answer === 'string' &&
    typeof question.selectedAnswer === 'string' &&
    typeof question.correct === 'boolean' &&
    typeof question.revealed === 'boolean' &&
    typeof question.attempts === 'number' &&
    typeof question.points === 'number'
  )
}

function isHistoryEntry(value: unknown): value is QuizHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    typeof entry.completedAt === 'string' &&
    typeof entry.mode === 'string' &&
    quizModes.includes(entry.mode as QuizMode) &&
    typeof entry.score === 'number' &&
    Number.isFinite(entry.score) &&
    typeof entry.total === 'number' &&
    Number.isFinite(entry.total) &&
    (entry.presetId === null || typeof entry.presetId === 'string') &&
    (entry.presetName === null || typeof entry.presetName === 'string') &&
    typeof entry.region === 'string' &&
    Array.isArray(entry.settings) &&
    entry.settings.every((setting) => typeof setting === 'string') &&
    Array.isArray(entry.questions) &&
    entry.questions.every(isHistoryQuestion)
  )
}

export function loadQuizHistory(): QuizHistoryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

export function saveQuizHistoryEntry(entry: QuizHistoryEntry): QuizHistoryEntry[] {
  const updated = [entry, ...loadQuizHistory()].slice(0, HISTORY_LIMIT)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Keep the current session usable if local storage is full or unavailable.
  }
  return updated
}
