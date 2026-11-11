import countryCatalog from './countryCatalog.json'
import { shuffleItems } from './useQuizSession'

export type ContinentId =
  'africa' | 'north-america' | 'south-america' | 'asia' | 'europe' | 'oceania'

const continentLabels: Record<ContinentId, string> = {
  africa: 'Afrique',
  'north-america': 'Amérique du Nord',
  'south-america': 'Amérique du Sud',
  asia: 'Asie',
  europe: 'Europe',
  oceania: 'Océanie'
}

export type QuizRegion = 'world' | ContinentId
export type QuizQuestionCount = number

export const quizRegions: { id: QuizRegion; label: string }[] = [
  { id: 'world', label: 'Tous les continents' },
  { id: 'africa', label: 'Afrique' },
  { id: 'north-america', label: 'Amérique du Nord' },
  { id: 'south-america', label: 'Amérique du Sud' },
  { id: 'asia', label: 'Asie' },
  { id: 'europe', label: 'Europe' },
  { id: 'oceania', label: 'Océanie' }
]

// Country groupings follow the UN M49 geographic regions; the Americas are
// split using its Northern America, Central America, Caribbean, and South America subregions.
const alpha2CodesByContinent: Record<ContinentId, readonly string[]> = {
  africa: [
    'DZ',
    'AO',
    'BJ',
    'BW',
    'BF',
    'BI',
    'CV',
    'CM',
    'CF',
    'TD',
    'KM',
    'CG',
    'CD',
    'CI',
    'DJ',
    'EG',
    'GQ',
    'ER',
    'SZ',
    'ET',
    'GA',
    'GM',
    'GH',
    'GN',
    'GW',
    'KE',
    'LS',
    'LR',
    'LY',
    'MG',
    'MW',
    'ML',
    'MR',
    'MU',
    'MA',
    'MZ',
    'NA',
    'NE',
    'NG',
    'RW',
    'ST',
    'SN',
    'SC',
    'SL',
    'SO',
    'ZA',
    'SS',
    'SD',
    'TZ',
    'TG',
    'TN',
    'UG',
    'ZM',
    'ZW'
  ],
  'north-america': [
    'AG',
    'BS',
    'BB',
    'BZ',
    'CA',
    'CR',
    'CU',
    'DM',
    'DO',
    'SV',
    'GD',
    'GT',
    'HT',
    'HN',
    'JM',
    'MX',
    'NI',
    'PA',
    'KN',
    'LC',
    'VC',
    'TT',
    'US'
  ],
  'south-america': ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
  asia: [
    'AF',
    'AM',
    'AZ',
    'BH',
    'BD',
    'BT',
    'BN',
    'KH',
    'CN',
    'CY',
    'GE',
    'IN',
    'ID',
    'IR',
    'IQ',
    'IL',
    'JP',
    'JO',
    'KZ',
    'KW',
    'KG',
    'LA',
    'LB',
    'MY',
    'MV',
    'MN',
    'MM',
    'NP',
    'KP',
    'OM',
    'PK',
    'PS',
    'PH',
    'QA',
    'SA',
    'SG',
    'KR',
    'LK',
    'SY',
    'TJ',
    'TH',
    'TL',
    'TR',
    'TM',
    'AE',
    'UZ',
    'VN',
    'YE'
  ],
  europe: [
    'AL',
    'AD',
    'AT',
    'BY',
    'BE',
    'BA',
    'BG',
    'HR',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IS',
    'IE',
    'IT',
    'LV',
    'LI',
    'LT',
    'LU',
    'MT',
    'MD',
    'MC',
    'ME',
    'NL',
    'MK',
    'NO',
    'PL',
    'PT',
    'RO',
    'RU',
    'SM',
    'RS',
    'SK',
    'SI',
    'ES',
    'SE',
    'CH',
    'UA',
    'GB',
    'VA'
  ],
  oceania: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU']
}

const continentByAlpha2 = new Map<string, ContinentId>(
  Object.entries(alpha2CodesByContinent).flatMap(([continent, alpha2Codes]) =>
    alpha2Codes.map((alpha2) => [alpha2, continent as ContinentId] as const)
  )
)

const continentBySourceFeatureId = new Map<number, ContinentId>(
  countryCatalog.flatMap((country) => {
    const continent = continentByAlpha2.get(country.alpha2)
    return continent ? [[country.sourceFeatureId, continent] as const] : []
  })
)

export function getContinentLabelForCountry(alpha2: string): string | undefined {
  const continent = continentByAlpha2.get(alpha2.toUpperCase())
  return continent ? continentLabels[continent] : undefined
}

export function getAvailableQuizQuestionCount(region: QuizRegion): number {
  if (region === 'world') return countryCatalog.length

  return countryCatalog.filter(
    (country) => continentBySourceFeatureId.get(country.sourceFeatureId) === region
  ).length
}

export function getQuizQuestionsForRegion<Question extends { sourceFeatureId: number }>(
  questions: readonly Question[],
  region: QuizRegion,
  requestedCount: QuizQuestionCount
): Question[] {
  const availableQuestions =
    region === 'world'
      ? [...questions]
      : questions.filter(
          (question) => continentBySourceFeatureId.get(question.sourceFeatureId) === region
        )

  // Randomize before limiting so each short game gets a fresh sample.
  const randomizedQuestions = shuffleItems(availableQuestions)
  return randomizedQuestions.slice(0, requestedCount)
}
