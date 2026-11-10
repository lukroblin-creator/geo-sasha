import countryCapitals from './countryCapitals.json'
import countryCatalog from './countryCatalog.json'
import { shuffleItems } from './useQuizSession'

type CapitalRecord = {
  sourceFeatureId: number
  capitalName: string
  note?: string
}

export type CountryCapitalQuestion = CapitalRecord & {
  kind: 'capitals'
  countryName: string
  choices: string[]
}

const capitalByCountryId = new Map(
  (countryCapitals as CapitalRecord[]).map((capital) => [
    capital.sourceFeatureId,
    capital
  ])
)

const capitalChoices = [
  ...new Set(
    (countryCapitals as CapitalRecord[]).map((capital) => capital.capitalName)
  )
]

export function createCountryCapitalQuestions(): CountryCapitalQuestion[] {
  return countryCatalog.map((country) => {
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
