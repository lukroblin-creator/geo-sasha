import { quizRegions, type ContinentId, type QuizRegion } from './countryContinents'
import {
  supplementalQuizFactOptions,
  type QuizAnswers,
  type QuizClues,
  type SupplementalQuizFactSettings
} from './countryQuiz'

export type QuizPreset = {
  id: string
  name: string
  region: QuizRegion
  questionCount: number
  clues: QuizClues
  answers: QuizAnswers
  supplementalClues?: SupplementalQuizFactSettings
  supplementalAnswers?: SupplementalQuizFactSettings
  gameMode?: 'base' | 'estimation' | 'draw-borders'
  estimationRegion?: QuizRegion
  estimationAlpha2s?: string[]
  drawContinents?: ContinentId[]
  drawCountryAlpha2?: string | null
}

const STORAGE_KEY = 'world-atlas:quiz-presets:v1'
const DEFAULT_PRESET_STORAGE_KEY = 'world-atlas:quiz-default-preset:v1'
const contentIds = ['countryOnMap', 'flag', 'countryName', 'capital'] as const
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

function isBooleanRecord(value: unknown): value is QuizClues {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return contentIds.every((id) => typeof record[id] === 'boolean')
}

function isSupplementalBooleanRecord(value: unknown): value is SupplementalQuizFactSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([id, enabled]) =>
      supplementalContentIds.includes(id as (typeof supplementalContentIds)[number]) &&
      typeof enabled === 'boolean'
  )
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
    isBooleanRecord(preset.answers) &&
    (preset.supplementalClues === undefined ||
      isSupplementalBooleanRecord(preset.supplementalClues)) &&
    (preset.supplementalAnswers === undefined ||
      isSupplementalBooleanRecord(preset.supplementalAnswers)) &&
    (preset.gameMode === undefined ||
      ['base', 'estimation', 'draw-borders'].includes(String(preset.gameMode))) &&
    (preset.estimationRegion === undefined ||
      quizRegions.some((region) => region.id === preset.estimationRegion)) &&
    (preset.estimationAlpha2s === undefined ||
      (Array.isArray(preset.estimationAlpha2s) &&
        preset.estimationAlpha2s.every(
          (code) => typeof code === 'string' && /^[A-Z]{2}$/.test(code)
        ))) &&
    (preset.drawContinents === undefined ||
      (Array.isArray(preset.drawContinents) &&
        preset.drawContinents.every((continent) =>
          quizRegions.some((region) => region.id === continent && region.id !== 'world')
        ))) &&
    (preset.drawCountryAlpha2 === undefined ||
      preset.drawCountryAlpha2 === null ||
      (typeof preset.drawCountryAlpha2 === 'string' && /^[A-Z]{2}$/.test(preset.drawCountryAlpha2)))
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
