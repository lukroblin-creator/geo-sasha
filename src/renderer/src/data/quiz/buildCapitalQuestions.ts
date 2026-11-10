import { shuffleItems } from './useQuizSession.ts'

export type CapitalCatalogEntry = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
}

export type CapitalRecord = {
  sourceFeatureId: number
  capitalName: string
  note?: string
}

export type CountryCapitalQuestion = CapitalRecord & {
  kind: 'capitals'
  countryName: string
  choices: string[]
}

export function buildCapitalQuestions(
  catalog: readonly CapitalCatalogEntry[],
  records: readonly CapitalRecord[]
): CountryCapitalQuestion[] {
  const capitalByCountryId = new Map(
    records.map((capital) => [capital.sourceFeatureId, capital])
  )
  const capitalChoices = [...new Set(records.map((capital) => capital.capitalName))]

  return catalog.map((country) => {
    const capital = capitalByCountryId.get(country.sourceFeatureId)
    if (!capital) {
      throw new Error(`Missing capital for ${country.countryName}`)
    }

    const distractors = shuffleItems(
      capitalChoices.filter((choice) => choice !== capital.capitalName)
    ).slice(0, 3)

    return {
      ...capital,
      kind: 'capitals',
      countryName: country.countryName,
      choices: shuffleItems([capital.capitalName, ...distractors])
    }
  })
}
