import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
import flagMetadata from './flagMetadata.json'
import countryProfileFacts from './countryProfileFacts.json'
import countryExplorationData from './countryExplorationData.json'
import countryCultureData from '../geography/countryCultureData.json'
import { getAcceptedCapitalNames, getLocalizedCapitalName } from './capitalNames'
import type { AppLanguage } from '../i18n'
import { shuffleItems } from './useQuizSession'
import type { SupplementalQuizFactId } from './quizTypes'
export { supplementalQuizFactOptions } from './quizTypes'
export type {
  QuizAnswers,
  QuizClues,
  SupplementalQuizFactId,
  SupplementalQuizFactSettings
} from './quizTypes'

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
  supplementalFacts: Partial<Record<SupplementalQuizFactId, string>>
  supplementalAnswerValues: Partial<Record<SupplementalQuizFactId, string[]>>
  supplementalFactKeys: Partial<Record<SupplementalQuizFactId, string[]>>
  countryAnswerGroup: { alpha2: string; sourceFeatureId: number; name: string }[]
}

type SupplementalCountryFactSources = {
  culture: {
    officialLanguages: { canonicalCode: string; name: string; status: string }[]
    currencies: { code: string; name: string }[]
    webDomains: string[]
  }
  exploration: { cities: { name: string; population: number }[] }
  profile: {
    highestPoint?: { name: { en: string; fr: string }; elevationMeters: number | null }
    rivers?: { en: string; fr: string; rank?: number }[]
  }
}

const supplementalFactSources = {
  culture: (
    countryCultureData as { byAlpha2: Record<string, SupplementalCountryFactSources['culture']> }
  ).byAlpha2,
  exploration: new Map(
    (
      countryExplorationData as {
        countries: {
          alpha2: string
          cities: SupplementalCountryFactSources['exploration']['cities']
        }[]
      }
    ).countries.map((country) => [country.alpha2, country])
  ),
  profile: (
    countryProfileFacts as { byAlpha2: Record<string, SupplementalCountryFactSources['profile']> }
  ).byAlpha2
}

function getSupplementalCountryFacts(
  alpha2: string,
  language: AppLanguage
): {
  facts: Partial<Record<SupplementalQuizFactId, string>>
  answerValues: Partial<Record<SupplementalQuizFactId, string[]>>
  factKeys: Partial<Record<SupplementalQuizFactId, string[]>>
} {
  const culture = supplementalFactSources.culture[alpha2]
  const exploration = supplementalFactSources.exploration.get(alpha2)
  const profile = supplementalFactSources.profile[alpha2]
  const languageNames = new Intl.DisplayNames([language], { type: 'language' })
  const currencyNames = new Intl.DisplayNames([language], { type: 'currency' })
  const officialLanguages =
    culture?.officialLanguages.filter((item) => item.status === 'official') ?? []
  const currencies = culture?.currencies ?? []
  const domains = culture?.webDomains.filter((item) => /^\.[a-z0-9-]+$/i.test(item)) ?? []
  const highestPointName = profile?.highestPoint?.name[language === 'fr' ? 'fr' : 'en']
  const highestPoint = highestPointName
    ? `${highestPointName}${profile.highestPoint?.elevationMeters ? ` · ${profile.highestPoint.elevationMeters.toLocaleString(language)} m` : ''}`
    : undefined
  const cities = exploration?.cities
    .filter((city) => city.name.trim())
    .sort((first, second) => second.population - first.population)
    .slice(0, 5)
    .map((city) => city.name)
  const rivers = profile?.rivers
    ?.slice()
    .sort((first, second) => (first.rank ?? 99) - (second.rank ?? 99))
    .map((river) => river[language === 'fr' ? 'fr' : 'en'])
    .filter((name, index, all) => Boolean(name) && all.indexOf(name) === index)
    .slice(0, 5)
  let localizedLanguages = officialLanguages.map((item) => item.name)
  let localizedCurrencies = currencies.map((item) => item.name)
  try {
    localizedLanguages = officialLanguages.map(
      (item) => languageNames.of(item.canonicalCode) ?? item.name
    )
    localizedCurrencies = currencies.map((item) => currencyNames.of(item.code) ?? item.name)
  } catch {
    // Keep the source label when a runtime does not recognize a locale code.
  }

  const answerValues: Partial<Record<SupplementalQuizFactId, string[]>> = {
    ...(localizedLanguages.length ? { officialLanguage: localizedLanguages } : {}),
    ...(currencies.length
      ? {
          currency: currencies.map(
            (item, index) => `${localizedCurrencies[index] ?? item.name} (${item.code})`
          )
        }
      : {}),
    ...(domains.length ? { webDomain: domains } : {}),
    ...(highestPoint ? { highestPoint: [highestPoint] } : {}),
    ...(cities?.length ? { majorCities: cities } : {}),
    ...(rivers?.length ? { majorRivers: rivers } : {})
  }
  const factKeys: Partial<Record<SupplementalQuizFactId, string[]>> = {
    ...(officialLanguages.length
      ? { officialLanguage: officialLanguages.map((item) => item.canonicalCode.toLowerCase()) }
      : {}),
    ...(currencies.length ? { currency: currencies.map((item) => item.code.toUpperCase()) } : {}),
    ...(domains.length ? { webDomain: domains.map((item) => item.toLowerCase()) } : {}),
    ...(highestPoint ? { highestPoint: [normalizeQuizAnswer(highestPointName ?? '')] } : {}),
    ...(cities?.length ? { majorCities: cities.map(normalizeQuizAnswer) } : {}),
    ...(rivers?.length ? { majorRivers: rivers.map(normalizeQuizAnswer) } : {})
  }
  const facts = Object.fromEntries(
    Object.entries(answerValues).map(([id, values]) => [id, values.join(', ')])
  ) as Partial<Record<SupplementalQuizFactId, string>>
  return { facts, answerValues, factKeys }
}

export function supplementalQuizAnswerMatches(answer: string, expected: string): boolean {
  const normalize = (value: string): string => normalizeQuizAnswer(value)
  const expectedVariants = [
    expected,
    ...expected.split('·'),
    expected.replace(/\s*\([^)]*\)/g, ''),
    ...[...expected.matchAll(/\(([^)]+)\)/g)].map((match) => match[1])
  ]
  if (expectedVariants.some((variant) => normalize(answer) === normalize(variant))) return true
  const expectedParts = expected
    .split(/\s*[;,]\s*/)
    .map(normalize)
    .filter(Boolean)
  const answerParts = answer
    .split(/\s*[;,]\s*/)
    .map(normalize)
    .filter(Boolean)
  return (
    expectedParts.length > 1 &&
    expectedParts.length === answerParts.length &&
    expectedParts.every((part) => answerParts.includes(part))
  )
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
        ? [
            [
              country.sourceFeatureId,
              getLocalizedCapitalName(country.alpha2, capital.capitalName, language)
            ] as const
          ]
        : []
    })
  )
  const capitalNames = [
    ...new Set(
      capitalRecords.map(
        (record) => localizedCapitalByCountryId.get(record.sourceFeatureId) ?? record.capitalName
      )
    )
  ]

  return countryCatalog.flatMap((country) => {
    const capital = capitalByCountryId.get(country.sourceFeatureId)
    if (!capital) return []

    const displayCapitalName =
      localizedCapitalByCountryId.get(country.sourceFeatureId) ?? capital.capitalName
    const capitalChoices = shuffleItems(
      capitalNames.filter((name) => name !== displayCapitalName)
    ).slice(0, 3)
    return [
      {
        sourceFeatureId: country.sourceFeatureId,
        alpha2: country.alpha2,
        countryName: country.countryName,
        frenchCountryName: countryNamesInFrench.of(country.alpha2) ?? country.countryName,
        capitalName: displayCapitalName,
        acceptedCapitalNames: getAcceptedCapitalNames(country.alpha2, capital.capitalName),
        ...(capital.note ? { capitalNote: capital.note } : {}),
        capitalChoices: shuffleItems([...capitalChoices, displayCapitalName]),
        flagChoices: allFlagChoices,
        ...(() => {
          const supplemental = getSupplementalCountryFacts(country.alpha2, language)
          return {
            supplementalFacts: supplemental.facts,
            supplementalAnswerValues: supplemental.answerValues,
            supplementalFactKeys: supplemental.factKeys,
            countryAnswerGroup: [
              {
                alpha2: country.alpha2,
                sourceFeatureId: country.sourceFeatureId,
                name: countryNamesInFrench.of(country.alpha2) ?? country.countryName
              }
            ]
          }
        })()
      }
    ]
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
        firstIndex > 1 &&
        secondIndex > 1 &&
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
    const similarity =
      1 - getCapitalTypoDistance(compactAnswer, compactAccepted) / longestNameLength
    if (similarity >= 0.75) {
      return displayedCapital
    }
  }

  return null
}
