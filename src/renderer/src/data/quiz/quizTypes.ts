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

export const supplementalQuizFactOptions = [
  { id: 'officialLanguage', label: 'Langue officielle' },
  { id: 'currency', label: 'Devise' },
  { id: 'webDomain', label: 'Extension web' },
  { id: 'highestPoint', label: 'Point culminant' },
  { id: 'majorCities', label: 'Grandes villes recensées' },
  { id: 'majorRivers', label: 'Fleuves majeurs' }
] as const

export type SupplementalQuizFactId = (typeof supplementalQuizFactOptions)[number]['id']
export type SupplementalQuizFactSettings = Partial<Record<SupplementalQuizFactId, boolean>>
