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

type CountryQuizLanguage = 'fr' | 'en' | 'es'

type CountryKnowledgeCopy = {
  capital: string
  geographicReference: string
  city: string
  largestCity: string
  mountain: string
  capitalPrompt: (country: string) => string
  continentPrompt: (country: string) => string
  cityPrompt: (country: string) => string
  largestCityPrompt: (country: string) => string
  mountainPrompt: (country: string) => string
  capitalExplanation: (capital: string, country: string) => string
  continentExplanation: (country: string, continent: string) => string
  cityExplanation: (city: string, country: string) => string
  largestCityExplanation: (city: string) => string
  mountainExplanation: (mountain: string, country: string, height: string) => string
  height: (meters: number) => string
  continents: Record<string, string>
}

const knowledgeCopy: Record<CountryQuizLanguage, CountryKnowledgeCopy> = {
  fr: {
    capital: 'Capitale',
    geographicReference: 'Repère géographique',
    city: 'Ville',
    largestCity: 'Grande ville',
    mountain: 'Montagne',
    capitalPrompt: (country) => `Quelle est la capitale de ${country} ?`,
    continentPrompt: (country) => `Sur quel continent se trouve ${country} ?`,
    cityPrompt: (country) => `Laquelle de ces villes se trouve en ${country} ?`,
    largestCityPrompt: (country) => `Parmi ces grandes villes, laquelle est la plus peuplée de ${country} ?`,
    mountainPrompt: (country) => `Quel relief se trouve en ${country} ?`,
    capitalExplanation: (capital, country) => `${capital} est la capitale enregistrée pour ${country}.`,
    continentExplanation: (country, continent) => `${country} se trouve en ${continent}.`,
    cityExplanation: (city, country) => `${city} est répertoriée parmi les principales villes de ${country}.`,
    largestCityExplanation: (city) => `Selon les estimations de population des villes répertoriées par Natural Earth, ${city} arrive en tête des propositions.`,
    mountainExplanation: (mountain, country, height) => `${mountain} est répertorié en ${country}${height}.`,
    height: (meters) => `, à ${meters.toLocaleString('fr-FR')} m d’altitude`,
    continents: {
      Afrique: 'Afrique',
      'Amérique du Nord': 'Amérique du Nord',
      'Amérique du Sud': 'Amérique du Sud',
      Asie: 'Asie',
      Europe: 'Europe',
      Océanie: 'Océanie'
    }
  },
  en: {
    capital: 'Capital',
    geographicReference: 'Geographic reference',
    city: 'City',
    largestCity: 'Major city',
    mountain: 'Mountain',
    capitalPrompt: (country) => `What is the capital of ${country}?`,
    continentPrompt: (country) => `Which continent is ${country} in?`,
    cityPrompt: (country) => `Which of these cities is in ${country}?`,
    largestCityPrompt: (country) => `Which of these major cities is the most populous in ${country}?`,
    mountainPrompt: (country) => `Which landform is in ${country}?`,
    capitalExplanation: (capital, country) => `${capital} is listed as the capital of ${country}.`,
    continentExplanation: (country, continent) => `${country} is in ${continent}.`,
    cityExplanation: (city, country) => `${city} is listed among the major cities of ${country}.`,
    largestCityExplanation: (city) => `According to Natural Earth's population estimates for listed cities, ${city} has the highest population among these options.`,
    mountainExplanation: (mountain, country, height) => `${mountain} is listed in ${country}${height}.`,
    height: (meters) => `, at ${meters.toLocaleString('en')} m elevation`,
    continents: {
      Afrique: 'Africa',
      'Amérique du Nord': 'North America',
      'Amérique du Sud': 'South America',
      Asie: 'Asia',
      Europe: 'Europe',
      Océanie: 'Oceania'
    }
  },
  es: {
    capital: 'Capital',
    geographicReference: 'Referencia geográfica',
    city: 'Ciudad',
    largestCity: 'Ciudad principal',
    mountain: 'Montaña',
    capitalPrompt: (country) => `¿Cuál es la capital de ${country}?`,
    continentPrompt: (country) => `¿En qué continente se encuentra ${country}?`,
    cityPrompt: (country) => `¿Cuál de estas ciudades está en ${country}?`,
    largestCityPrompt: (country) => `¿Cuál de estas ciudades principales tiene más población en ${country}?`,
    mountainPrompt: (country) => `¿Qué relieve se encuentra en ${country}?`,
    capitalExplanation: (capital, country) => `${capital} figura como la capital de ${country}.`,
    continentExplanation: (country, continent) => `${country} está en ${continent}.`,
    cityExplanation: (city, country) => `${city} figura entre las principales ciudades de ${country}.`,
    largestCityExplanation: (city) => `Según las estimaciones de población de las ciudades registradas por Natural Earth, ${city} tiene la población más alta entre estas opciones.`,
    mountainExplanation: (mountain, country, height) => `${mountain} figura en ${country}${height}.`,
    height: (meters) => `, a ${meters.toLocaleString('es')} m de altitud`,
    continents: {
      Afrique: 'África',
      'Amérique du Nord': 'América del Norte',
      'Amérique du Sud': 'América del Sur',
      Asie: 'Asia',
      Europe: 'Europa',
      Océanie: 'Oceanía'
    }
  }
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

function countryNameFor(alpha2: string, fallback: string, language: CountryQuizLanguage): string {
  return new Intl.DisplayNames([language], { type: 'region' }).of(alpha2) ?? fallback
}

export function createCountryKnowledgeQuestions(
  alpha2: string,
  language: CountryQuizLanguage = 'fr'
): CountryKnowledgeQuestion[] {
  const code = alpha2.toUpperCase()
  const country = countryByAlpha2.get(code)
  if (!country) return []

  const displayName = countryNameFor(code, country.countryName, language)
  const copy = knowledgeCopy[language]
  const continentChoices = quizRegions
    .filter((region) => region.id !== 'world')
    .map((region) => copy.continents[region.label] ?? region.label)
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
      copy.capital,
      copy.capitalPrompt(displayName),
      capital.capitalName,
      capitalNames,
      language === 'fr' && capital.note
        ? capital.note
        : copy.capitalExplanation(capital.capitalName, displayName)
    )
  }

  const continent = getContinentLabelForCountry(code)
  if (continent) {
    createQuestion(
      'continent',
      copy.geographicReference,
      copy.continentPrompt(displayName),
      copy.continents[continent] ?? continent,
      continentChoices,
      copy.continentExplanation(displayName, copy.continents[continent] ?? continent)
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
        copy.city,
        copy.cityPrompt(displayName),
        city,
        otherCityNames,
        copy.cityExplanation(city, displayName)
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
        copy.largestCity,
        copy.largestCityPrompt(displayName),
        largestCity.name,
        choices,
        copy.largestCityExplanation(largestCity.name)
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
        ? copy.height(mountain.elevationMeters)
        : ''
      createQuestion(
        'mountain',
        copy.mountain,
        copy.mountainPrompt(displayName),
        mountain.name,
        otherMountainNames,
        copy.mountainExplanation(mountain.name, displayName, height)
      )
    }
  }

  return shuffleItems(questions)
}

export function getCountryKnowledgeCountry(alpha2: string): CountryCatalogEntry | undefined {
  return countryByAlpha2.get(alpha2.toUpperCase())
}
