import countryCatalog from './countryCatalog.json'
import countryCapitals from './countryCapitals.json'
import countryKnowledgeData from './countryKnowledgeData.json'
import countryCultureData from '../geography/countryCultureData.json'
import { quizRegions, getContinentLabelForCountry } from './countryContinents'
import { normalizeQuizAnswer } from './countryQuiz'
import { shuffleItems } from './useQuizSession'

export type CountryKnowledgeQuestionKind =
  | 'capital'
  | 'continent'
  | 'city'
  | 'largest-city'
  | 'mountain'
  | 'currency'
  | 'language'
  | 'alphabet'
  | 'web-domain'

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

type CountryCultureRecord = {
  officialLanguages: { canonicalCode: string; name: string }[]
  currencies: { code: string; name: string; symbol: string | null }[]
  webDomains: string[]
  writingSystems: {
    scriptCode: string
    characters: string
    example: string
    exampleLanguageCode: string | null
  }[]
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
  currency: string
  officialLanguage: string
  alphabet: string
  webDomain: string
  capitalPrompt: (country: string) => string
  continentPrompt: (country: string) => string
  cityPrompt: (country: string) => string
  largestCityPrompt: (country: string) => string
  mountainPrompt: (country: string) => string
  currencyPrompt: (country: string) => string
  languagePrompt: (country: string) => string
  alphabetPrompt: (country: string) => string
  webDomainPrompt: (country: string) => string
  capitalExplanation: (capital: string, country: string) => string
  continentExplanation: (country: string, continent: string) => string
  cityExplanation: (city: string, country: string) => string
  largestCityExplanation: (city: string) => string
  mountainExplanation: (mountain: string, country: string, height: string) => string
  currencyExplanation: (currency: string, country: string) => string
  languageExplanation: (language: string, country: string) => string
  alphabetExplanation: (script: string, country: string, characters: string, example: string) => string
  webDomainExplanation: (domain: string, country: string) => string
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
    currency: 'Devise',
    officialLanguage: 'Langue officielle',
    alphabet: 'Alphabet et écriture',
    webDomain: 'Domaine web',
    capitalPrompt: (country) => `Quelle est la capitale de ${country} ?`,
    continentPrompt: (country) => `Sur quel continent se trouve ${country} ?`,
    cityPrompt: (country) => `Laquelle de ces villes se trouve en ${country} ?`,
    largestCityPrompt: (country) => `Parmi ces grandes villes, laquelle est la plus peuplée de ${country} ?`,
    mountainPrompt: (country) => `Quel relief se trouve en ${country} ?`,
    currencyPrompt: (country) => `Quelle devise est utilisée en ${country} ?`,
    languagePrompt: (country) => `Quelle langue a un statut officiel en ${country} ?`,
    alphabetPrompt: (country) => `Quel système d’écriture est utilisé en ${country} ?`,
    webDomainPrompt: (country) => `Quelle extension internet est associée à ${country} ?`,
    capitalExplanation: (capital, country) => `${capital} est la capitale enregistrée pour ${country}.`,
    continentExplanation: (country, continent) => `${country} se trouve en ${continent}.`,
    cityExplanation: (city, country) => `${city} est répertoriée parmi les principales villes de ${country}.`,
    largestCityExplanation: (city) => `Selon les estimations de population des villes répertoriées par Natural Earth, ${city} arrive en tête des propositions.`,
    mountainExplanation: (mountain, country, height) => `${mountain} est répertorié en ${country}${height}.`,
    currencyExplanation: (currency, country) => `${currency} est une devise officielle de ${country}.`,
    languageExplanation: (language, country) => `${language} est une langue officielle de ${country}.`,
    alphabetExplanation: (script, country, characters, example) =>
      `Le système ${script} est utilisé en ${country}. Caractères : ${characters || 'ND'}. Exemple : ${example || 'ND'}.`,
    webDomainExplanation: (domain, country) => `${domain} est une extension de domaine associée à ${country}.`,
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
    currency: 'Currency',
    officialLanguage: 'Official language',
    alphabet: 'Alphabet and writing system',
    webDomain: 'Web domain',
    capitalPrompt: (country) => `What is the capital of ${country}?`,
    continentPrompt: (country) => `Which continent is ${country} in?`,
    cityPrompt: (country) => `Which of these cities is in ${country}?`,
    largestCityPrompt: (country) => `Which of these major cities is the most populous in ${country}?`,
    mountainPrompt: (country) => `Which landform is in ${country}?`,
    currencyPrompt: (country) => `Which currency is used in ${country}?`,
    languagePrompt: (country) => `Which language has official status in ${country}?`,
    alphabetPrompt: (country) => `Which writing system is used in ${country}?`,
    webDomainPrompt: (country) => `Which internet domain extension is associated with ${country}?`,
    capitalExplanation: (capital, country) => `${capital} is listed as the capital of ${country}.`,
    continentExplanation: (country, continent) => `${country} is in ${continent}.`,
    cityExplanation: (city, country) => `${city} is listed among the major cities of ${country}.`,
    largestCityExplanation: (city) => `According to Natural Earth's population estimates for listed cities, ${city} has the highest population among these options.`,
    mountainExplanation: (mountain, country, height) => `${mountain} is listed in ${country}${height}.`,
    currencyExplanation: (currency, country) => `${currency} is an official currency of ${country}.`,
    languageExplanation: (language, country) => `${language} is an official language of ${country}.`,
    alphabetExplanation: (script, country, characters, example) =>
      `The ${script} writing system is used in ${country}. Characters: ${characters || 'ND'}. Example: ${example || 'ND'}.`,
    webDomainExplanation: (domain, country) => `${domain} is a domain extension associated with ${country}.`,
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
    currency: 'Moneda',
    officialLanguage: 'Idioma oficial',
    alphabet: 'Alfabeto y escritura',
    webDomain: 'Dominio web',
    capitalPrompt: (country) => `¿Cuál es la capital de ${country}?`,
    continentPrompt: (country) => `¿En qué continente se encuentra ${country}?`,
    cityPrompt: (country) => `¿Cuál de estas ciudades está en ${country}?`,
    largestCityPrompt: (country) => `¿Cuál de estas ciudades principales tiene más población en ${country}?`,
    mountainPrompt: (country) => `¿Qué relieve se encuentra en ${country}?`,
    currencyPrompt: (country) => `¿Qué moneda se utiliza en ${country}?`,
    languagePrompt: (country) => `¿Qué idioma tiene carácter oficial en ${country}?`,
    alphabetPrompt: (country) => `¿Qué sistema de escritura se utiliza en ${country}?`,
    webDomainPrompt: (country) => `¿Qué extensión de internet se asocia con ${country}?`,
    capitalExplanation: (capital, country) => `${capital} figura como la capital de ${country}.`,
    continentExplanation: (country, continent) => `${country} está en ${continent}.`,
    cityExplanation: (city, country) => `${city} figura entre las principales ciudades de ${country}.`,
    largestCityExplanation: (city) => `Según las estimaciones de población de las ciudades registradas por Natural Earth, ${city} tiene la población más alta entre estas opciones.`,
    mountainExplanation: (mountain, country, height) => `${mountain} figura en ${country}${height}.`,
    currencyExplanation: (currency, country) => `${currency} es una moneda oficial de ${country}.`,
    languageExplanation: (language, country) => `${language} es un idioma oficial de ${country}.`,
    alphabetExplanation: (script, country, characters, example) =>
      `El sistema de escritura ${script} se utiliza en ${country}. Caracteres: ${characters || 'ND'}. Ejemplo: ${example || 'ND'}.`,
    webDomainExplanation: (domain, country) => `${domain} es una extensión de dominio asociada con ${country}.`,
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
const cultureByAlpha2 = (countryCultureData as {
  byAlpha2: Record<string, CountryCultureRecord>
}).byAlpha2
const allCultureRecords = Object.values(cultureByAlpha2)
function uniqueByAnswer(values: readonly string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = normalizeQuizAnswer(value)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function excludeCorrectAnswers(candidates: readonly string[], correctAnswers: readonly string[]): string[] {
  const correct = new Set(correctAnswers.map(normalizeQuizAnswer))
  return candidates.filter((candidate) => !correct.has(normalizeQuizAnswer(candidate)))
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

function localizedLanguageName(
  code: string,
  fallback: string,
  language: CountryQuizLanguage
): string {
  if (code === 'tzm') return fallback
  return new Intl.DisplayNames([language], { type: 'language' }).of(code) ?? fallback
}

function localizedCurrencyName(
  code: string,
  fallback: string,
  language: CountryQuizLanguage
): string {
  const localized = new Intl.DisplayNames([language], { type: 'currency' }).of(code)
  return localized && localized.toUpperCase() !== code ? localized : fallback
}

function localizedScriptName(code: string, language: CountryQuizLanguage): string {
  return new Intl.DisplayNames([language], { type: 'script' }).of(code) ?? code
}

function primaryWebDomain(record: CountryCultureRecord): string | null {
  return record.webDomains.find((domain) => /^\.[a-z0-9-]+$/i.test(domain)) ?? record.webDomains[0] ?? null
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
  const culture = cultureByAlpha2[code]
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

  if (culture?.currencies.length) {
    const formatCurrency = (currency: CountryCultureRecord['currencies'][number]): string =>
      `${localizedCurrencyName(currency.code, currency.name, language)} (${currency.code})`
    const currency = shuffleItems(culture.currencies)[0]
    if (currency) {
      const currencyAnswer = formatCurrency(currency)
      const allCountryCurrencyAnswers = culture.currencies.map(formatCurrency)
      const currencyChoices = excludeCorrectAnswers(
        allCultureRecords.flatMap((item) => item.currencies.map(formatCurrency)),
        allCountryCurrencyAnswers
      )
      createQuestion(
        'currency',
        copy.currency,
        copy.currencyPrompt(displayName),
        currencyAnswer,
        currencyChoices,
        copy.currencyExplanation(currencyAnswer, displayName)
      )
    }
  }

  if (culture?.officialLanguages.length) {
    const formatLanguage = (item: CountryCultureRecord['officialLanguages'][number]): string =>
      localizedLanguageName(item.canonicalCode, item.name, language)
    const officialLanguage = shuffleItems(culture.officialLanguages)[0]
    if (officialLanguage) {
      const languageAnswer = formatLanguage(officialLanguage)
      const allCountryLanguageAnswers = culture.officialLanguages.map(formatLanguage)
      const languageChoices = excludeCorrectAnswers(
        allCultureRecords.flatMap((item) => item.officialLanguages.map(formatLanguage)),
        allCountryLanguageAnswers
      )
      createQuestion(
        'language',
        copy.officialLanguage,
        copy.languagePrompt(displayName),
        languageAnswer,
        languageChoices,
        copy.languageExplanation(languageAnswer, displayName)
      )
    }
  }

  if (culture?.writingSystems.length) {
    const writingSystem = shuffleItems(culture.writingSystems)[0]
    if (writingSystem) {
      const scriptAnswer = localizedScriptName(writingSystem.scriptCode, language)
      const allCountryScriptAnswers = culture.writingSystems.map((system) =>
        localizedScriptName(system.scriptCode, language)
      )
      const scriptChoices = excludeCorrectAnswers(
        allCultureRecords.flatMap((item) =>
          item.writingSystems.map((system) => localizedScriptName(system.scriptCode, language))
        ),
        allCountryScriptAnswers
      )
      createQuestion(
        'alphabet',
        copy.alphabet,
        copy.alphabetPrompt(displayName),
        scriptAnswer,
        scriptChoices,
        copy.alphabetExplanation(
          scriptAnswer,
          displayName,
          writingSystem.characters.replace(/\s+/g, ' ').trim(),
          writingSystem.example
        )
      )
    }
  }

  const domain = culture ? primaryWebDomain(culture) : null
  if (domain) {
    const domainChoices = allCultureRecords
      .map(primaryWebDomain)
      .filter((item): item is string => item !== null)
    createQuestion(
      'web-domain',
      copy.webDomain,
      copy.webDomainPrompt(displayName),
      domain,
      domainChoices,
      copy.webDomainExplanation(domain, displayName)
    )
  }

  return shuffleItems(questions)
}

export function getCountryKnowledgeCountry(alpha2: string): CountryCatalogEntry | undefined {
  return countryByAlpha2.get(alpha2.toUpperCase())
}
