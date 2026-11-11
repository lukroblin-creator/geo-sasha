import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
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
  sourceFeatureId: number
  alpha2: string
  countryName: string
}

export type CountryQuizQuestion = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
  frenchCountryName: string
  capitalName: string
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

export function createCountryQuizQuestions(): CountryQuizQuestion[] {
  const capitalNames = [...new Set(
    (countryCapitals as CapitalRecord[]).map((record) => record.capitalName)
  )]

  return countryCatalog.flatMap((country) => {
    const capital = capitalByCountryId.get(country.sourceFeatureId)
    if (!capital) return []

    const capitalChoices = shuffleItems(
      capitalNames.filter((name) => name !== capital.capitalName)
    ).slice(0, 3)
    const flagChoices = shuffleItems(
      countryCatalog.filter((candidate) => candidate.sourceFeatureId !== country.sourceFeatureId)
    )
      .slice(0, 3)
      .map((candidate) => ({
        sourceFeatureId: candidate.sourceFeatureId,
        alpha2: candidate.alpha2,
        countryName: candidate.countryName
      }))

    return [{
      sourceFeatureId: country.sourceFeatureId,
      alpha2: country.alpha2,
      countryName: country.countryName,
      frenchCountryName:
        countryNamesInFrench.of(country.alpha2) ?? country.countryName,
      capitalName: capital.capitalName,
      ...(capital.note ? { capitalNote: capital.note } : {}),
      capitalChoices: shuffleItems([...capitalChoices, capital.capitalName]),
      flagChoices: shuffleItems([
        ...flagChoices,
        {
          sourceFeatureId: country.sourceFeatureId,
          alpha2: country.alpha2,
          countryName: country.countryName
        }
      ])
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
