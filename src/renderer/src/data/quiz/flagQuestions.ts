export type FlagQuestion = {
  sourceFeatureId: number
  countryName: string
  flag: string
}

// Premier lot de questions embarqué : disponible sans connexion Internet.
export const flagQuestions: FlagQuestion[] = [
  { sourceFeatureId: 392, countryName: 'Japan', flag: '🇯🇵' },
  { sourceFeatureId: 250, countryName: 'France', flag: '🇫🇷' },
  { sourceFeatureId: 124, countryName: 'Canada', flag: '🇨🇦' },
  { sourceFeatureId: 76, countryName: 'Brazil', flag: '🇧🇷' },
  { sourceFeatureId: 356, countryName: 'India', flag: '🇮🇳' },
  { sourceFeatureId: 380, countryName: 'Italy', flag: '🇮🇹' },
  { sourceFeatureId: 818, countryName: 'Egypt', flag: '🇪🇬' },
  { sourceFeatureId: 36, countryName: 'Australia', flag: '🇦🇺' },
  { sourceFeatureId: 840, countryName: 'United States of America', flag: '🇺🇸' },
  { sourceFeatureId: 710, countryName: 'South Africa', flag: '🇿🇦' }
]
