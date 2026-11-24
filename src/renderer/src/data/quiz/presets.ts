import { quizRegions } from './countryContinents.ts'
import { supplementalQuizFactOptions } from './quizTypes.ts'
import { isQuizPreset, type QuizPreset } from './quizPresetValidation'
export type { QuizPreset } from './quizPresetValidation'

const STORAGE_KEY = 'world-atlas:quiz-presets:v1'
const DEFAULT_PRESET_STORAGE_KEY = 'world-atlas:quiz-default-preset:v1'
const supplementalContentIds = supplementalQuizFactOptions.map(({ id }) => id)

export function loadDefaultQuizPresetId(): string {
  try {
    return localStorage.getItem(DEFAULT_PRESET_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDefaultQuizPresetId(presetId: string): boolean {
  try {
    if (presetId) localStorage.setItem(DEFAULT_PRESET_STORAGE_KEY, presetId)
    else localStorage.removeItem(DEFAULT_PRESET_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function loadQuizPresets(): QuizPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed)
      ? parsed.filter((value) =>
          isQuizPreset(
            value,
            quizRegions.map(({ id }) => id),
            supplementalContentIds
          )
        )
      : []
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
