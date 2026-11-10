import countryCatalog from './countryCatalog.json'

export type CountryCatalogEntry = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
}

export type CountryFlagQuestion = CountryCatalogEntry & {
  kind: 'flags'
}

export const countryFlagQuestions: CountryFlagQuestion[] = countryCatalog.map(
  (country) => ({ ...country, kind: 'flags' as const })
)
