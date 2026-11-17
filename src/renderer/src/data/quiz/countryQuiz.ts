import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
import flagMetadata from './flagMetadata.json'
import { getAcceptedCapitalNames, getLocalizedCapitalName } from './capitalNames'
import type { AppLanguage } from '../i18n'
import { shuffleItems } from './useQuizSession'

export type QuizClues = {
  countryOnMap: boolean
  flag: boolean
  countryName: boolean
  capital: boolean
}

export type QuizAnswers = {
  countryOnMap: boolean
  countryName: boolean
  capital: boolean
  flag: boolean
}

export type CountryFlagChoice = {
  alpha2: string
  frenchName: string
}

export type CountryQuizQuestion = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
  frenchCountryName: string
  capitalName: string
  acceptedCapitalNames: string[]
  capitalNote?: string
  capitalChoices: string[]
  flagChoices: CountryFlagChoice[]
}

type CapitalRecord = {
  sourceFeatureId: number
  capitalName: string
  note?: string
}

const capitalByCountryId = new Map<number, CapitalRecord>(
  (countryCapitals as CapitalRecord[]).map((record) => [record.sourceFeatureId, record])
)
const countryNamesInFrench = new Intl.DisplayNames(['fr'], { type: 'region' })
const flagNameOverrides: Record<string, string> = {
  AN: 'Antilles néerlandaises (ancien)'
}
const allFlagChoices: CountryFlagChoice[] = (flagMetadata as { alpha2: string }[]).map(
  ({ alpha2 }) => ({
    alpha2,
    frenchName: flagNameOverrides[alpha2] ?? countryNamesInFrench.of(alpha2) ?? alpha2
  })
)

export function createCountryQuizQuestions(language: AppLanguage = 'fr'): CountryQuizQuestion[] {
  const capitalRecords = countryCapitals as CapitalRecord[]
  const localizedCapitalByCountryId = new Map(
    countryCatalog.flatMap((country) => {
      const capital = capitalByCountryId.get(country.sourceFeatureId)
      return capital
        ? [[country.sourceFeatureId, getLocalizedCapitalName(country.alpha2, capital.capitalName, language)] as const]
        : []
    })
  )
  const capitalNames = [...new Set(
    capitalRecords.map((record) => localizedCapitalByCountryId.get(record.sourceFeatureId) ?? record.capitalName)
  )]

  return countryCatalog.flatMap((country) => {
    const capital = capitalByCountryId.get(country.sourceFeatureId)
    if (!capital) return []

    const displayCapitalName = localizedCapitalByCountryId.get(country.sourceFeatureId) ?? capital.capitalName
    const capitalChoices = shuffleItems(capitalNames.filter((name) => name !== displayCapitalName)).slice(0, 3)
    return [{
      sourceFeatureId: country.sourceFeatureId,
      alpha2: country.alpha2,
      countryName: country.countryName,
      frenchCountryName:
        countryNamesInFrench.of(country.alpha2) ?? country.countryName,
      capitalName: displayCapitalName,
      acceptedCapitalNames: getAcceptedCapitalNames(country.alpha2, capital.capitalName),
      ...(capital.note ? { capitalNote: capital.note } : {}),
      capitalChoices: shuffleItems([...capitalChoices, displayCapitalName]),
      flagChoices: allFlagChoices
    }]
  })
}

export function normalizeQuizAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function getCapitalTypoDistance(first: string, second: string): number {
  const distances = Array.from({ length: first.length + 1 }, () =>
    Array<number>(second.length + 1).fill(0)
  )

  for (let firstIndex = 0; firstIndex <= first.length; firstIndex += 1) {
    distances[firstIndex][0] = firstIndex
  }
  for (let secondIndex = 0; secondIndex <= second.length; secondIndex += 1) {
    distances[0][secondIndex] = secondIndex
  }

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1
      distances[firstIndex][secondIndex] = Math.min(
        distances[firstIndex - 1][secondIndex] + 1,
        distances[firstIndex][secondIndex - 1] + 1,
        distances[firstIndex - 1][secondIndex - 1] + substitutionCost
      )

      if (
        firstIndex > 1 && secondIndex > 1 &&
        first[firstIndex - 1] === second[secondIndex - 2] &&
        first[firstIndex - 2] === second[secondIndex - 1]
      ) {
        distances[firstIndex][secondIndex] = Math.min(
          distances[firstIndex][secondIndex],
          distances[firstIndex - 2][secondIndex - 2] + 1
        )
      }
    }
  }

  return distances[first.length][second.length]
}

/** Returns a correction when the normalized spelling is at least 75% similar. */
export function getCapitalAnswerCorrection(
  answer: string,
  acceptedAnswers: readonly string[],
  displayedCapital: string
): string | null {
  const normalizedAnswer = normalizeQuizAnswer(answer)
  if (!normalizedAnswer) return null

  for (const acceptedAnswer of acceptedAnswers) {
    const normalizedAccepted = normalizeQuizAnswer(acceptedAnswer)
    if (!normalizedAccepted || normalizedAccepted === normalizedAnswer) continue

    const compactAnswer = normalizedAnswer.replace(/\s/g, '')
    const compactAccepted = normalizedAccepted.replace(/\s/g, '')
    if (!compactAccepted) continue

    if (compactAnswer === compactAccepted) return displayedCapital

    const longestNameLength = Math.max(compactAnswer.length, compactAccepted.length)
    const similarity = 1 - getCapitalTypoDistance(compactAnswer, compactAccepted) / longestNameLength
    if (similarity >= 0.75) {
      return displayedCapital
    }
  }

  return null
}
