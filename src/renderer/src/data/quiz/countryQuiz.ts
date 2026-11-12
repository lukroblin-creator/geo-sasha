import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
import flagMetadata from './flagMetadata.json'
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
    return [{
      sourceFeatureId: country.sourceFeatureId,
      alpha2: country.alpha2,
      countryName: country.countryName,
      frenchCountryName:
        countryNamesInFrench.of(country.alpha2) ?? country.countryName,
      capitalName: capital.capitalName,
      ...(capital.note ? { capitalNote: capital.note } : {}),
      capitalChoices: shuffleItems([...capitalChoices, capital.capitalName]),
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
