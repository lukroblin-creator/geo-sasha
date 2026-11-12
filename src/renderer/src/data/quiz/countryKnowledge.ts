import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
import countryKnowledgeData from './countryKnowledgeData.json'
import { quizRegions, getContinentLabelForCountry } from './countryContinents'
import { normalizeQuizAnswer } from './countryQuiz'
import { shuffleItems } from './useQuizSession'

export type CountryKnowledgeQuestionKind =
  'capital' | 'continent' | 'city' | 'largest-city' | 'mountain'

export type CountryKnowledgeQuestion = {
  id: string
  alpha2: string
  sourceFeatureId: number
  kind: CountryKnowledgeQuestionKind
  category: string
  prompt: string
  answer: string
  choices: string[]
  explanation: string
}

type CountryKnowledgeRecord = {
  alpha2: string
  cities: { name: string; population: number }[]
  mountains: { name: string; elevationMeters: number | null }[]
}

type CountryCatalogEntry = {
  alpha2: string
  sourceFeatureId: number
  countryName: string
}

type CapitalRecord = {
  sourceFeatureId: number
  capitalName: string
  note?: string
}

const countryByAlpha2 = new Map<string, CountryCatalogEntry>(
  (countryCatalog as CountryCatalogEntry[]).map((country) => [country.alpha2, country])
)
const capitalBySourceId = new Map<number, CapitalRecord>(
  (countryCapitals as CapitalRecord[]).map((capital) => [capital.sourceFeatureId, capital])
)
const knowledgeByAlpha2 = new Map<string, CountryKnowledgeRecord>(
  (countryKnowledgeData as CountryKnowledgeRecord[]).map((record) => [record.alpha2, record])
)
const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })
const continentChoices = quizRegions
  .filter((region) => region.id !== 'world')
  .map((region) => region.label)

function uniqueByAnswer(values: readonly string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = normalizeQuizAnswer(value)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function createChoices(answer: string, candidates: readonly string[]): string[] | null {
  const distinctCandidates = uniqueByAnswer(candidates).filter(
    (candidate) => normalizeQuizAnswer(candidate) !== normalizeQuizAnswer(answer)
  )
  if (distinctCandidates.length < 3) return null

  return shuffleItems([answer, ...shuffleItems(distinctCandidates).slice(0, 3)])
}

function countryNameFor(alpha2: string, fallback: string): string {
  return countryNames.of(alpha2) ?? fallback
}

export function createCountryKnowledgeQuestions(alpha2: string): CountryKnowledgeQuestion[] {
  const code = alpha2.toUpperCase()
  const country = countryByAlpha2.get(code)
  if (!country) return []

  const displayName = countryNameFor(code, country.countryName)
  const record = knowledgeByAlpha2.get(code)
  const questions: CountryKnowledgeQuestion[] = []
  const createQuestion = (
    kind: CountryKnowledgeQuestionKind,
    category: string,
    prompt: string,
    answer: string,
    candidates: readonly string[],
    explanation: string
  ): void => {
    const choices = createChoices(answer, candidates)
    if (!choices) return

    questions.push({
      id: `${code}:${kind}:${normalizeQuizAnswer(answer)}`,
      alpha2: code,
      sourceFeatureId: country.sourceFeatureId,
      kind,
      category,
      prompt,
      answer,
      choices,
      explanation
    })
  }

  const capital = capitalBySourceId.get(country.sourceFeatureId)
  if (capital) {
    const capitalNames = (countryCapitals as CapitalRecord[]).map((item) => item.capitalName)
    createQuestion(
      'capital',
      'Capitale',
      `Quelle est la capitale de ${displayName} ?`,
      capital.capitalName,
      capitalNames,
      capital.note ?? `${capital.capitalName} est la capitale enregistrée pour ${displayName}.`
    )
  }

  const continent = getContinentLabelForCountry(code)
  if (continent) {
    createQuestion(
      'continent',
      'Repère géographique',
      `Sur quel continent se trouve ${displayName} ?`,
      continent,
      continentChoices,
      `${displayName} se trouve en ${continent}.`
    )
  }

  if (record?.cities.length) {
    const capitalName = capital?.capitalName
    const countryCities = record.cities.filter(
      (city) => normalizeQuizAnswer(city.name) !== normalizeQuizAnswer(capitalName ?? '')
    )
    const allCountryCityNames = record.cities.map((city) => city.name)
    const otherCityNames = [...knowledgeByAlpha2.values()]
      .filter((otherCountry) => otherCountry.alpha2 !== code)
      .flatMap((otherCountry) => otherCountry.cities.map((city) => city.name))
      .filter(
        (cityName) =>
          !allCountryCityNames.some(
            (countryCity) => normalizeQuizAnswer(countryCity) === normalizeQuizAnswer(cityName)
          )
      )

    const cityQuestions = shuffleItems(
      uniqueByAnswer(countryCities.map((city) => city.name))
    ).slice(0, 2)
    for (const city of cityQuestions) {
      createQuestion(
        'city',
        'Ville',
        `Laquelle de ces villes se trouve en ${displayName} ?`,
        city,
        otherCityNames,
        `${city} est répertoriée parmi les principales villes de ${displayName}.`
      )
    }

    const rankedCities = [...record.cities]
      .filter((city) => city.population > 0)
      .sort((first, second) => second.population - first.population)
    if (rankedCities.length >= 4) {
      const largestCity = rankedCities[0]
      const choices = shuffleItems(rankedCities.slice(1).map((city) => city.name)).slice(0, 3)
      createQuestion(
        'largest-city',
        'Grande ville',
        `Parmi ces grandes villes, laquelle est la plus peuplée de ${displayName} ?`,
        largestCity.name,
        choices,
        `Selon les estimations de population des villes répertoriées par Natural Earth, ${largestCity.name} arrive en tête des propositions.`
      )
    }
  }

  if (record?.mountains.length) {
    const allCountryMountainNames = record.mountains.map((mountain) => mountain.name)
    const otherMountainNames = [...knowledgeByAlpha2.entries()]
      .filter(([otherAlpha2]) => otherAlpha2 !== code)
      .flatMap(([, otherCountry]) => otherCountry.mountains.map((mountain) => mountain.name))
      .filter(
        (mountainName) =>
          !allCountryMountainNames.some(
            (countryMountain) =>
              normalizeQuizAnswer(countryMountain) === normalizeQuizAnswer(mountainName)
          )
      )
    const mountainQuestions = shuffleItems(record.mountains).slice(0, 2)

    for (const mountain of mountainQuestions) {
      const height = mountain.elevationMeters
        ? `, à ${mountain.elevationMeters.toLocaleString('fr-FR')} m d’altitude`
        : ''
      createQuestion(
        'mountain',
        'Montagne',
        `Quel relief se trouve en ${displayName} ?`,
        mountain.name,
        otherMountainNames,
        `${mountain.name} est répertorié en ${displayName}${height}.`
      )
    }
  }

  return shuffleItems(questions)
}

export function getCountryKnowledgeCountry(alpha2: string): CountryCatalogEntry | undefined {
  return countryByAlpha2.get(alpha2.toUpperCase())
}
