import countryCatalog from '../quiz/countryCatalog.json'
import countryCapitals from '../quiz/countryCapitals.json'
import { additionalMapFlagRegions } from '../quiz/additionalMapFlagRegions'
import { getContinentLabelForCountry } from '../quiz/countryContinents'
import { getEntityById, getEntityDisplayName } from './registry'

type CountryCatalogEntry = {
  sourceFeatureId: number
  alpha2: string
  countryName: string
}

type CapitalEntry = {
  sourceFeatureId: number
  capitalName: string
}

export type ExplorationDetails = {
  name: string
  flagAlpha2: string | null
  flagName: string
  capital: string | null
  continent: string | null
  sovereignName: string | null
  isTerritory: boolean
}

const catalogBySourceId = new Map<string, CountryCatalogEntry>(
  (countryCatalog as CountryCatalogEntry[]).map((entry) => [String(entry.sourceFeatureId), entry])
)

const capitalBySourceId = new Map<string, CapitalEntry>(
  (countryCapitals as CapitalEntry[]).map((entry) => [String(entry.sourceFeatureId), entry])
)

const alpha2ByExtraSourceId = new Map(
  additionalMapFlagRegions.map((region) => [String(region.sourceFeatureId), region.alpha2])
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
  const sourceId = String(sourceFeatureId)
  const catalogEntry = catalogBySourceId.get(sourceId)
  const entity = entityId ? getEntityById(entityId) : undefined
  const sovereign = entity?.sovereignEntityId ? getEntityById(entity.sovereignEntityId) : undefined
  const extraAlpha2 = alpha2ByExtraSourceId.get(sourceId)
  const alpha2 =
    (entity?.kind === 'territory'
      ? entity.flagAlpha2 ?? sovereign?.alpha2
      : entity?.alpha2) ??
    (entity ? undefined : extraAlpha2) ??
    catalogEntry?.alpha2 ??
    null
  const territoryInfo =
    entity?.kind === 'territory' && entityId ? territoryDetails[entityId] : undefined
  const capital = territoryInfo
    ? territoryInfo.capital
    : (capitalBySourceId.get(sourceId)?.capitalName ?? null)
  const continent = territoryInfo
    ? territoryInfo.continent
    : alpha2
      ? (getContinentLabelForCountry(alpha2) ?? null)
      : null
  const name = entityId
    ? (getEntityDisplayName(entityId) ?? fallbackName)
    : ((alpha2 ? frenchNames.of(alpha2) : undefined) ?? catalogEntry?.countryName ?? fallbackName)
  const flagName = entity?.kind === 'territory'
    ? (entity.flagAlpha2 ? entity.name : sovereign?.name ?? name)
    : name

  return {
    name,
    flagAlpha2: alpha2,
    flagName,
    capital,
    continent,
    sovereignName: sovereign?.name ?? null,
    isTerritory: entity?.kind === 'territory'
  }
}
