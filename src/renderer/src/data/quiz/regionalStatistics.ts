import { getContinentIdForCountry, type ContinentId, type QuizRegion } from './countryContinents.ts'
import type { CountryQuizStatsByAlpha2 } from './countryQuizStats'
import type { QuizHistoryEntry } from './quizHistory'
import type { QuizMode } from './progress'

type StoredConfiguration = {
  gameMode?: string
  region?: string
  alpha2s?: unknown
  continents?: unknown
  countryAlpha2?: unknown
}

const continentIds: ContinentId[] = [
  'africa',
  'north-america',
  'south-america',
  'asia',
  'europe',
  'oceania'
]

function getStoredConfiguration(entry: QuizHistoryEntry): StoredConfiguration | null {
  if (!entry.comparisonKey) return null
  try {
    const parsed: unknown = JSON.parse(entry.comparisonKey)
    if (!parsed || typeof parsed !== 'object') return null
    const configuration = (parsed as Record<string, unknown>).configuration
    return configuration && typeof configuration === 'object'
      ? (configuration as StoredConfiguration)
      : null
  } catch {
    return null
  }
}

function specialModeBelongsToContinent(entry: QuizHistoryEntry, continent: ContinentId): boolean {
  const configuration = getStoredConfiguration(entry)
  if (!configuration || configuration.gameMode !== entry.mode) return false

  if (entry.mode === 'estimation') {
    if (!Array.isArray(configuration.alpha2s)) return false
    const selectedCountries = configuration.alpha2s.filter(
      (alpha2): alpha2 is string => typeof alpha2 === 'string'
    )
    if (selectedCountries.length > 0) {
      return selectedCountries.every((alpha2) => getContinentIdForCountry(alpha2) === continent)
    }
    return configuration.region === continent
  }

  if (entry.mode === 'draw-borders') {
    if (typeof configuration.countryAlpha2 === 'string') {
      return getContinentIdForCountry(configuration.countryAlpha2) === continent
    }
    if (!Array.isArray(configuration.continents)) return false
    const selectedContinents = configuration.continents.filter(
      (region): region is ContinentId =>
        typeof region === 'string' && continentIds.includes(region as ContinentId)
    )
    return selectedContinents.length === 1 && selectedContinents[0] === continent
  }

  return false
}

export function countHistorySessionsByMode(
  history: readonly QuizHistoryEntry[]
): Record<QuizMode, number> {
  const counts: Record<QuizMode, number> = {
    flags: 0,
    capitals: 0,
    custom: 0,
    knowledge: 0,
    estimation: 0,
    'draw-borders': 0
  }
  for (const entry of history) counts[entry.mode] += 1
  return counts
}

export function getCountryStatsForRegion(
  stats: CountryQuizStatsByAlpha2,
  region: QuizRegion
): CountryQuizStatsByAlpha2 {
  if (region === 'world') return stats
  return Object.fromEntries(
    Object.entries(stats).filter(([alpha2]) => getContinentIdForCountry(alpha2) === region)
  )
}

export function getQuizHistoryForContinent(
  history: readonly QuizHistoryEntry[],
  continent: ContinentId
): QuizHistoryEntry[] {
  return history.filter((entry) => {
    if (entry.mode === 'estimation' || entry.mode === 'draw-borders') {
      return specialModeBelongsToContinent(entry, continent)
    }
    if (
      entry.questions.some(
        ({ alpha2 }) => alpha2 !== null && getContinentIdForCountry(alpha2) === continent
      )
    ) {
      return true
    }
    return false
  })
}
