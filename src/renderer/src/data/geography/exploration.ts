import countryCatalog from '../quiz/countryCatalog.json'
import countryCapitals from '../quiz/countryCapitals.json'
import explorationData from '../quiz/countryExplorationData.json'
import countryProfileFacts from '../quiz/countryProfileFacts.json'
import countryCultureData from './countryCultureData.json'
import countryEconomicData from './countryEconomicData.json'
import { additionalMapFlagRegions } from '../quiz/additionalMapFlagRegions'
import { getContinentLabelForCountry } from '../quiz/countryContinents'
import { getEntityById, getEntityDisplayName } from './registry'
import { normalizeSourceFeatureId } from './sourceFeatureIds'
import { getResourceIndustryFactsForMapFeature, type ResourceIndustryFact } from './resources'

type CountryCatalogEntry = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
}

type CapitalEntry = {
  sourceFeatureId: number
  capitalName: string
}

type ExplorationDataRecord = {
  sourceFeatureId: number
  alpha2: string
  capital: string | null
  population: number | null
  populationYear: number | null
  populationSource?: string
  populationSourceUrl?: string
  metrics: {
    areaKm2: number
    perimeterKm: number
    northSouthKm: number
    eastWestKm: number
  } | null
  metricsScope: string
  metricsSource: string
  metricsSourceUrl?: string
  metricsSecondarySourceUrl?: string
  cities: { name: string; population: number }[]
  mountains: { name: string; elevationMeters: number | null }[]
}

type TerritoryExplorationRecord = {
  id: string
  name: string
  alpha2: string | null
  flagAlpha2: string | null
  sovereignAlpha2: string
  sourceFeatureId: number
  capital: string | null
  population: number | null
  populationYear: number | null
  populationSource: string
  populationSourceUrl?: string
  metrics: ExplorationDataRecord['metrics']
  metricsScope: string
  metricsSource: string
  metricsSourceUrl?: string
  metricsSecondarySourceUrl?: string
  cities: ExplorationDataRecord['cities']
  mountains: ExplorationDataRecord['mountains']
}

type ExplorationTerritorySummary = {
  id: string
  name: string
  flagAlpha2: string | null
}

export type ExplorationLocalizedText = { en: string; fr: string }

export type ExplorationProfileFacts = {
  terrain?: ExplorationLocalizedText
  terrainCharacter?: ExplorationLocalizedText
  highestPoint?: {
    name: ExplorationLocalizedText
    elevationMeters: number | null
  }
  lowestPoint?: {
    name: ExplorationLocalizedText
    elevationMeters: number | null
  }
  governmentType?: ExplorationLocalizedText
  governmentTypeYear?: number
  politicalRegime?: { label: string; sourceLabel: string; year: number } | null
  music?: {
    genre: string
    genreFr: string
    rank: number
    sharePercent: number | null
    secondGenre: string | null
    secondGenreFr: string | null
    secondRank: number | null
    secondSharePercent: number | null
    year: number
    measure?: 'streaming-chart' | 'apple-chart' | 'survey'
    snapshotDate?: string
    sourceUrl?: string
    sourceLabel?: ExplorationLocalizedText
    sourceNote?: ExplorationLocalizedText
  } | null
  funFacts: ExplorationLocalizedText[]
  historicalFact?: ExplorationLocalizedText | null
  rivers: Array<ExplorationLocalizedText & { rank: number; source?: string }>
  sourceUrl?: string | null
  additionalSources?: Array<{ label: ExplorationLocalizedText; url: string }>
}

export type CountryCultureLanguage = {
  code: string
  canonicalCode: string
  name: string
  status: 'official' | 'official_regional'
}

export type CountryCultureCurrency = {
  code: string
  name: string
  symbol: string | null
  euroPerUnit?: number | null
  exchangeRateDate?: string | null
}

export type CountryWritingSystem = {
  scriptCode: string
  characters: string
  example: string
  exampleLanguageCode: string | null
}

export type CountryCultureFacts = {
  officialLanguages: CountryCultureLanguage[]
  regionalLanguages: CountryCultureLanguage[]
  currencies: CountryCultureCurrency[]
  webDomains: string[]
  writingSystems: CountryWritingSystem[]
}

export type MedianMonthlyEarnings = {
  amount: number
  currencyCode: string
  year: number
  status: string | null
  sourceName?: string
  sourceUrl?: string
  definition?: string
  euroPerUnit: number | null
  exchangeRateDate: string | null
}

type CountryEconomicData = {
  metadata: {
    currencySourceUrl: string
    salarySourceUrl: string
    snapshotDate: string
  }
  ratesByCurrency: Record<string, { unitsPerEuro: number; date: string }>
  medianMonthlyEarningsByAlpha2: Record<
    string,
    {
      amount: number
      currencyCode: string
      year: number
      status: string | null
      sourceName?: string
      sourceUrl?: string
      definition?: string
    }
  >
}

const economicData = countryEconomicData as CountryEconomicData
const exchangeRatesByCurrency = economicData.ratesByCurrency
const medianEarningsByAlpha2 = economicData.medianMonthlyEarningsByAlpha2
export const explorationEconomicSources = {
  currencyRates: economicData.metadata.currencySourceUrl,
  medianEarnings: economicData.metadata.salarySourceUrl,
  snapshotDate: economicData.metadata.snapshotDate
}

function getEuroPerCurrencyUnit(currencyCode: string): number | null {
  if (currencyCode === 'EUR') return 1
  const unitsPerEuro = exchangeRatesByCurrency[currencyCode]?.unitsPerEuro
  return unitsPerEuro && unitsPerEuro > 0 ? 1 / unitsPerEuro : null
}

type CountryProfileFactsData = {
  byAlpha2: Record<string, ExplorationProfileFacts>
  byTerritoryId: Record<string, ExplorationProfileFacts>
}

export type ExplorationDetails = {
  name: string
  flagAlpha2: string | null
  flagName: string
  capital: string | null
  continent: string | null
  sovereignName: string | null
  isTerritory: boolean
  population: number | null
  populationYear: number | null
  metrics: ExplorationDataRecord['metrics']
  metricsScope: string | null
  cities: ExplorationDataRecord['cities']
  mountains: ExplorationDataRecord['mountains']
  profileFacts: ExplorationProfileFacts | null
  culture: CountryCultureFacts | null
  medianMonthlyEarnings: MedianMonthlyEarnings | null
  resources: ResourceIndustryFact[]
  populationSource: string
  populationSourceUrl: string | null
  metricsSource: string | null
  metricsSourceUrl: string | null
  metricsSecondarySourceUrl: string | null
  territories: ExplorationTerritorySummary[]
  unavailableReasons: Record<string, string>
}

const catalogBySourceId = new Map<string, CountryCatalogEntry>(
  (countryCatalog as CountryCatalogEntry[]).map((entry) => [
    normalizeSourceFeatureId(entry.sourceFeatureId),
    entry
  ])
)

const capitalBySourceId = new Map<string, CapitalEntry>(
  (countryCapitals as CapitalEntry[]).map((entry) => [
    normalizeSourceFeatureId(entry.sourceFeatureId),
    entry
  ])
)

const explorationByAlpha2 = new Map<string, ExplorationDataRecord>(
  (explorationData.countries as ExplorationDataRecord[]).map((entry) => [entry.alpha2, entry])
)

const territoryRecords = explorationData.territories as TerritoryExplorationRecord[]
const territoryById = new Map(territoryRecords.map((entry) => [entry.id, entry]))
const territoriesBySovereignAlpha2 = new Map<string, TerritoryExplorationRecord[]>()
for (const territory of territoryRecords) {
  const sovereignTerritories = territoriesBySovereignAlpha2.get(territory.sovereignAlpha2) ?? []
  sovereignTerritories.push(territory)
  territoriesBySovereignAlpha2.set(territory.sovereignAlpha2, sovereignTerritories)
}

const unavailableReasons = explorationData.unavailableReasons as Record<string, string>
const profileFactsByEntity = countryProfileFacts as CountryProfileFactsData
const cultureByAlpha2 = (
  countryCultureData as {
    byAlpha2: Record<string, CountryCultureFacts>
  }
).byAlpha2

const alpha2ByExtraSourceId = new Map(
  additionalMapFlagRegions.map((region) => [
    normalizeSourceFeatureId(region.sourceFeatureId),
    region.alpha2
  ])
)

const frenchNames = new Intl.DisplayNames(['fr'], { type: 'region' })

const territoryDetails: Record<string, { capital: string | null; continent: string | null }> = {
  'territory:guyane': { capital: 'Cayenne', continent: 'Amérique du Sud' },
  'territory:guadeloupe': { capital: 'Basse-Terre', continent: 'Amérique du Nord' },
  'territory:martinique': { capital: 'Fort-de-France', continent: 'Amérique du Nord' },
  'territory:reunion': { capital: 'Saint-Denis', continent: 'Afrique' },
  'territory:mayotte': { capital: 'Mamoudzou', continent: 'Afrique' },
  'territory:saint-pierre-et-miquelon': { capital: 'Saint-Pierre', continent: 'Amérique du Nord' },
  'territory:saint-barthelemy': { capital: 'Gustavia', continent: 'Amérique du Nord' },
  'territory:saint-martin': { capital: 'Marigot', continent: 'Amérique du Nord' },
  'territory:polynesie-francaise': { capital: 'Papeete', continent: 'Océanie' },
  'territory:nouvelle-caledonie': { capital: 'Nouméa', continent: 'Océanie' },
  'territory:wallis-et-futuna': { capital: 'Mata-Utu', continent: 'Océanie' },
  'territory:taaf': { capital: null, continent: 'Antarctique' },
  'territory:clipperton': { capital: null, continent: null }
}

export function getExplorationDetails(
  sourceFeatureId: string | number,
  fallbackName: string,
  entityId: string | null
): ExplorationDetails {
  const sourceId = normalizeSourceFeatureId(sourceFeatureId)
  const catalogEntry = catalogBySourceId.get(sourceId)
  const entity = entityId ? getEntityById(entityId) : undefined
  const sovereign = entity?.sovereignEntityId ? getEntityById(entity.sovereignEntityId) : undefined
  const territoryRecord = entity?.kind === 'territory' ? territoryById.get(entity.id) : undefined
  const extraAlpha2 = alpha2ByExtraSourceId.get(sourceId)
  const alpha2 =
    (entity?.kind === 'territory' ? (territoryRecord?.alpha2 ?? entity.alpha2) : entity?.alpha2) ??
    (entity ? undefined : extraAlpha2) ??
    catalogEntry?.alpha2 ??
    null
  const territoryInfo =
    entity?.kind === 'territory' && entityId ? territoryDetails[entityId] : undefined
  const capital = territoryInfo
    ? territoryInfo.capital
    : (territoryRecord?.capital ??
      explorationByAlpha2.get(alpha2 ?? '')?.capital ??
      capitalBySourceId.get(sourceId)?.capitalName ??
      null)
  const continent = territoryInfo
    ? territoryInfo.continent
    : alpha2
      ? (getContinentLabelForCountry(alpha2) ?? null)
      : null
  const explorationRecord = alpha2 ? explorationByAlpha2.get(alpha2) : undefined
  const name = entityId
    ? (getEntityDisplayName(entityId) ?? fallbackName)
    : ((alpha2 ? frenchNames.of(alpha2) : undefined) ?? catalogEntry?.countryName ?? fallbackName)
  const flagAlpha2 =
    entity?.kind === 'territory'
      ? (entity.flagAlpha2 ?? territoryRecord?.flagAlpha2 ?? null)
      : alpha2
  const flagName = entity?.kind === 'territory' ? entity.name : name
  const sovereignAlpha2 =
    territoryRecord?.sovereignAlpha2 ?? (entity?.kind === 'territory' ? entity.alpha2 : alpha2)
  const territories = sovereignAlpha2
    ? (territoriesBySovereignAlpha2.get(sovereignAlpha2) ?? [])
        .filter((territory) => getEntityById(territory.id))
        .map((territory) => ({
          id: territory.id,
          name: getEntityDisplayName(territory.id) ?? territory.name,
          flagAlpha2: territory.flagAlpha2
        }))
    : []
  const record = territoryRecord ?? explorationRecord
  const culture = alpha2 ? (cultureByAlpha2[alpha2] ?? null) : null
  const medianEarnings = alpha2 ? (medianEarningsByAlpha2[alpha2] ?? null) : null
  const medianEarningsRate = medianEarnings
    ? exchangeRatesByCurrency[medianEarnings.currencyCode]
    : undefined
  const profileFacts =
    entity?.kind === 'territory' && entityId
      ? (profileFactsByEntity.byTerritoryId[entityId] ?? null)
      : alpha2
        ? (profileFactsByEntity.byAlpha2[alpha2] ?? null)
        : null

  return {
    name,
    flagAlpha2,
    flagName,
    capital,
    continent,
    sovereignName: sovereign?.name ?? null,
    isTerritory: entity?.kind === 'territory',
    population: record?.population ?? null,
    populationYear: record?.populationYear ?? null,
    metrics: record?.metrics ?? null,
    metricsScope: record?.metricsScope ?? null,
    cities: record?.cities ?? [],
    mountains: record?.mountains ?? [],
    profileFacts,
    culture: culture
      ? {
          ...culture,
          currencies: culture.currencies.map((currency) => ({
            ...currency,
            euroPerUnit: getEuroPerCurrencyUnit(currency.code),
            exchangeRateDate: exchangeRatesByCurrency[currency.code]?.date ?? null
          }))
        }
      : null,
    medianMonthlyEarnings: medianEarnings
      ? {
          ...medianEarnings,
          euroPerUnit: getEuroPerCurrencyUnit(medianEarnings.currencyCode),
          exchangeRateDate:
            medianEarnings.currencyCode === 'EUR'
              ? economicData.metadata.snapshotDate
              : (medianEarningsRate?.date ?? null)
        }
      : null,
    resources: getResourceIndustryFactsForMapFeature(entityId, sourceId),
    populationSource:
      record?.populationSource ?? territoryRecord?.populationSource ?? 'Banque mondiale',
    populationSourceUrl: record?.populationSourceUrl ?? null,
    metricsSource: record?.metricsSource ?? null,
    metricsSourceUrl: record?.metricsSourceUrl ?? null,
    metricsSecondarySourceUrl: record?.metricsSecondarySourceUrl ?? null,
    territories,
    unavailableReasons
  }
}

export function getExplorationDetailsForTerritory(entityId: string): ExplorationDetails | null {
  const territory = territoryById.get(entityId)
  if (!territory) return null

  return getExplorationDetails(
    territory.sourceFeatureId,
    getEntityDisplayName(entityId) ?? territory.name,
    entityId
  )
}
