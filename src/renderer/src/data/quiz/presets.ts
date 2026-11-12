import { quizRegions, type QuizRegion } from './countryContinents'
import type { QuizAnswers, QuizClues } from './countryQuiz'

export type QuizPreset = {
  id: string
  name: string
  region: QuizRegion
  questionCount: number
  clues: QuizClues
  answers: QuizAnswers
}

const STORAGE_KEY = 'world-atlas:quiz-presets:v1'
const contentIds = ['countryOnMap', 'flag', 'countryName', 'capital'] as const

function isBooleanRecord(value: unknown): value is QuizClues {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return contentIds.every((id) => typeof record[id] === 'boolean')
}

function isQuizPreset(value: unknown): value is QuizPreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Record<string, unknown>
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    preset.name.trim().length > 0 &&
    quizRegions.some((region) => region.id === preset.region) &&
    typeof preset.questionCount === 'number' &&
    Number.isInteger(preset.questionCount) &&
    preset.questionCount > 0 &&
    isBooleanRecord(preset.clues) &&
    isBooleanRecord(preset.answers)
  )
}

export function loadQuizPresets(): QuizPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isQuizPreset) : []
  } catch {
    return []
  }
}

export function saveQuizPresets(presets: QuizPreset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    return true
  } catch {
    return false
  }
}
