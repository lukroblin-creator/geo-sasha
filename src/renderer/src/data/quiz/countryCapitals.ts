import countryCapitals from './countryCapitals.json'
import countryCatalog from './countryCatalog.json'
import {
  buildCapitalQuestions,
  type CapitalRecord,
  type CountryCapitalQuestion
} from './buildCapitalQuestions'

export type { CountryCapitalQuestion } from './buildCapitalQuestions'

export function createCountryCapitalQuestions(): CountryCapitalQuestion[] {
  return buildCapitalQuestions(
    countryCatalog,
    countryCapitals as CapitalRecord[]
  )
}
