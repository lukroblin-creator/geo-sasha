import type { QuizMode } from './progress'
import {
  supplementalQuizFactOptions,
  type QuizAnswers,
  type QuizClues,
  type SupplementalQuizFactSettings
} from './quizTypes'
import {
  getAvailableQuizQuestionCount,
  quizRegions,
  type QuizQuestionCount,
  type QuizRegion
} from './countryContinents'
import type { CountryQuizQuestionResult } from './countryQuizStats'

export type QuizSetup = {
  region: QuizRegion
  questionCount: QuizQuestionCount
  clues: QuizClues
  answers: QuizAnswers
  supplementalClues?: SupplementalQuizFactSettings
  supplementalAnswers?: SupplementalQuizFactSettings
}

export type QuizGameMode = 'base' | 'estimation' | 'draw-borders'

export const flagPresetClues: QuizClues = {
  countryOnMap: false,
  flag: true,
  countryName: false,
  capital: false
}

export const flagPresetAnswers: QuizAnswers = {
  countryOnMap: true,
  countryName: false,
  capital: false,
  flag: false
}

export const idleQuizClues: QuizClues = {
  countryOnMap: false,
  flag: false,
  countryName: false,
  capital: false
}

export const idleQuizAnswers: QuizAnswers = {
  countryOnMap: false,
  countryName: false,
  capital: false,
  flag: false
}

export const capitalPresetClues: QuizClues = {
  countryOnMap: false,
  flag: false,
  countryName: true,
  capital: false
}

export const capitalPresetAnswers: QuizAnswers = {
  countryOnMap: false,
  countryName: false,
  capital: true,
  flag: false
}

export const quizContentOptions: { id: keyof QuizClues; label: string }[] = [
  { id: 'flag', label: 'Drapeau' },
  { id: 'countryName', label: 'Nom du pays' },
  { id: 'capital', label: 'Capitale' },
  { id: 'countryOnMap', label: 'Territoire sur la carte' }
]

export function matchesQuizConfiguration(
  clues: QuizClues,
  answers: QuizAnswers,
  expectedClues: QuizClues,
  expectedAnswers: QuizAnswers
): boolean {
  return quizContentOptions.every(
    ({ id }) => clues[id] === expectedClues[id] && answers[id] === expectedAnswers[id]
  )
}

export function matchesSupplementalQuizSettings(
  first: SupplementalQuizFactSettings = {},
  second: SupplementalQuizFactSettings = {}
): boolean {
  return supplementalQuizFactOptions.every(({ id }) => Boolean(first[id]) === Boolean(second[id]))
}

export function getQuizModeForContent(clues: QuizClues, answers: QuizAnswers): QuizMode {
  if (matchesQuizConfiguration(clues, answers, flagPresetClues, flagPresetAnswers)) {
    return 'flags'
  }
  if (matchesQuizConfiguration(clues, answers, capitalPresetClues, capitalPresetAnswers)) {
    return 'capitals'
  }
  return 'custom'
}

export function getQuizAnswerWeights(
  answers: QuizAnswers,
  supplementalAnswers: SupplementalQuizFactSettings = {}
): Record<string, number> {
  const enabledAnswers = [
    ...Object.entries(answers),
    ...Object.entries(supplementalAnswers)
  ].filter(([, enabled]) => enabled)
  const weight = enabledAnswers.length > 0 ? 1 / enabledAnswers.length : 1
  return Object.fromEntries(enabledAnswers.map(([id]) => [id, weight]))
}

export function getCountryQuizQuestionResult(
  answerWeights: Record<string, number>,
  answerResults: Record<string, boolean | null>,
  answerPoints: Record<string, number>
): CountryQuizQuestionResult {
  const answers = Object.entries(answerWeights).map(([id]) => ({
    id,
    correct: answerResults[id] === true,
    pointsEarned: answerResults[id] === true ? (answerPoints[id] ?? 0) : 0
  }))
  const pointsEarned = answers.reduce(
    (sum, answer) => sum + (answerWeights[answer.id] ?? 0) * answer.pointsEarned,
    0
  )
  return { pointsEarned, answers }
}

export function getContentLabels(
  settings: QuizClues | QuizAnswers,
  translate: (text: string) => string
): string {
  return quizContentOptions
    .filter(({ id }) => settings[id])
    .map(({ label }) => translate(label))
    .join(', ')
}

export function createRandomQuizSetup(): QuizSetup {
  const region = quizRegions[Math.floor(Math.random() * quizRegions.length)].id
  const maximumQuestionCount = getAvailableQuizQuestionCount(region)
  const questionCount = Math.floor(Math.random() * maximumQuestionCount) + 1
  const contentRoles = quizContentOptions.map(({ id }) => ({
    id,
    role: Math.floor(Math.random() * 3) as 0 | 1 | 2
  }))

  if (!contentRoles.some(({ role }) => role === 0)) {
    contentRoles[Math.floor(Math.random() * contentRoles.length)].role = 0
  }
  if (!contentRoles.some(({ role }) => role === 1)) {
    const eligible = contentRoles.filter(({ role }) => role !== 0)
    const chosen = eligible.length
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : contentRoles[Math.floor(Math.random() * contentRoles.length)]
    chosen.role = 1
  }

  const clues = Object.fromEntries(
    contentRoles.map(({ id, role }) => [id, role === 0])
  ) as QuizClues
  const answers = Object.fromEntries(
    contentRoles.map(({ id, role }) => [id, role === 1])
  ) as QuizAnswers

  return { region, questionCount, clues, answers }
}
