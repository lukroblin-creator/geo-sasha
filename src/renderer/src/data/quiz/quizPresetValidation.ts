import type { ContinentId, QuizRegion } from './countryContinents'
import type { QuizAnswers, QuizClues, SupplementalQuizFactSettings } from './quizTypes'
import { isQuizTimingSettings, type QuizTimingSettings } from './quizTiming.ts'

export type QuizPreset = {
  id: string
  name: string
  region: QuizRegion
  questionCount: number
  clues: QuizClues
  answers: QuizAnswers
  supplementalClues?: SupplementalQuizFactSettings
  supplementalAnswers?: SupplementalQuizFactSettings
  timing?: QuizTimingSettings
  gameMode?: 'base' | 'estimation' | 'draw-borders'
  estimationRegion?: QuizRegion
  estimationAlpha2s?: string[]
  drawContinents?: ContinentId[]
  drawCountryAlpha2?: string | null
}

const contentIds = ['countryOnMap', 'flag', 'countryName', 'capital'] as const

function isBooleanRecord(value: unknown): value is QuizClues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return contentIds.every((id) => typeof record[id] === 'boolean')
}

function isSupplementalBooleanRecord(
  value: unknown,
  allowedIds: readonly string[]
): value is SupplementalQuizFactSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([id, enabled]) => allowedIds.includes(id) && typeof enabled === 'boolean'
  )
}

export function isQuizPreset(
  value: unknown,
  regions: readonly string[],
  supplementalContentIds: readonly string[]
): value is QuizPreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Record<string, unknown>
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    preset.name.trim().length > 0 &&
    regions.includes(String(preset.region)) &&
    typeof preset.questionCount === 'number' &&
    Number.isInteger(preset.questionCount) &&
    preset.questionCount > 0 &&
    isBooleanRecord(preset.clues) &&
    isBooleanRecord(preset.answers) &&
    (preset.supplementalClues === undefined ||
      isSupplementalBooleanRecord(preset.supplementalClues, supplementalContentIds)) &&
    (preset.supplementalAnswers === undefined ||
      isSupplementalBooleanRecord(preset.supplementalAnswers, supplementalContentIds)) &&
    (preset.timing === undefined || isQuizTimingSettings(preset.timing)) &&
    (preset.gameMode === undefined ||
      ['base', 'estimation', 'draw-borders'].includes(String(preset.gameMode))) &&
    (preset.estimationRegion === undefined || regions.includes(String(preset.estimationRegion))) &&
    (preset.estimationAlpha2s === undefined ||
      (Array.isArray(preset.estimationAlpha2s) &&
        preset.estimationAlpha2s.every(
          (code) => typeof code === 'string' && /^[A-Z]{2}$/.test(code)
        ))) &&
    (preset.drawContinents === undefined ||
      (Array.isArray(preset.drawContinents) &&
        preset.drawContinents.every(
          (continent) => regions.includes(String(continent)) && String(continent) !== 'world'
        ))) &&
    (preset.drawCountryAlpha2 === undefined ||
      preset.drawCountryAlpha2 === null ||
      (typeof preset.drawCountryAlpha2 === 'string' && /^[A-Z]{2}$/.test(preset.drawCountryAlpha2)))
  )
}
