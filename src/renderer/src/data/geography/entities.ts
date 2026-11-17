import type { GeographicEntity } from './types'
import countryCatalog from '../quiz/countryCatalog.json'
import explorationData from '../quiz/countryExplorationData.json'

type CountryCatalogEntry = { alpha2: string; countryName: string }
type ExplorationTerritoryRecord = {
  id: string
  name: string
  alpha2: string | null
  flagAlpha2: string | null
  sovereignAlpha2: string
}

const frenchRegionNames = new Intl.DisplayNames(['fr'], { type: 'region' })

export function getCountryEntityId(alpha2: string): string {
  return alpha2.toUpperCase() === 'FR'
    ? 'country:france'
    : `country:${alpha2.toLowerCase()}`
}

// Registre central des entités géographiques de World Atlas.
const curatedGeographicEntities: GeographicEntity[] = [
  {
    id: 'country:france',
    name: 'France',
    kind: 'country',
    alpha2: 'FR'
  },
  {
    id: 'territory:guyane',
    name: 'Guyane',
    kind: 'territory',
    alpha2: 'GF',
    flagAlpha2: 'GF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:guadeloupe',
    name: 'Guadeloupe',
    kind: 'territory',
    alpha2: 'GP',
    flagAlpha2: 'GP',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:martinique',
    name: 'Martinique',
    kind: 'territory',
    alpha2: 'MQ',
    flagAlpha2: 'MQ',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:reunion',
    name: 'La Réunion',
    kind: 'territory',
    alpha2: 'RE',
    flagAlpha2: 'RE',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:mayotte',
    name: 'Mayotte',
    kind: 'territory',
    alpha2: 'YT',
    flagAlpha2: 'YT',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-pierre-et-miquelon',
    name: 'Saint-Pierre-et-Miquelon',
    kind: 'territory',
    alpha2: 'PM',
    flagAlpha2: 'PM',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-barthelemy',
    name: 'Saint-Barthélemy',
    kind: 'territory',
    alpha2: 'BL',
    flagAlpha2: 'BL',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-martin',
    name: 'Saint-Martin',
    kind: 'territory',
    alpha2: 'MF',
    flagAlpha2: 'MF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:polynesie-francaise',
    name: 'Polynésie française',
    kind: 'territory',
    alpha2: 'PF',
    flagAlpha2: 'PF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:nouvelle-caledonie',
    name: 'Nouvelle-Calédonie',
    kind: 'territory',
    alpha2: 'NC',
    flagAlpha2: 'NC',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:wallis-et-futuna',
    name: 'Wallis-et-Futuna',
    kind: 'territory',
    alpha2: 'WF',
    flagAlpha2: 'WF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:taaf',
    name: 'Terres australes et antarctiques françaises',
    kind: 'territory',
    alpha2: 'TF',
    flagAlpha2: 'TF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:clipperton',
    name: 'Clipperton',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  }
]

const countryEntities = (countryCatalog as CountryCatalogEntry[]).map((country) => ({
  id: getCountryEntityId(country.alpha2),
  name: frenchRegionNames.of(country.alpha2) ?? country.countryName,
  kind: 'country' as const,
  alpha2: country.alpha2
}))

const generatedTerritoryEntities = (
  explorationData.territories as ExplorationTerritoryRecord[]
).map((territory) => ({
  id: territory.id,
  name: territory.name,
  kind: 'territory' as const,
  ...(territory.alpha2 ? { alpha2: territory.alpha2 } : {}),
  ...(territory.flagAlpha2 ? { flagAlpha2: territory.flagAlpha2 } : {}),
  sovereignEntityId: getCountryEntityId(territory.sovereignAlpha2)
}))

const curatedIds = new Set(curatedGeographicEntities.map((entity) => entity.id))

export const geographicEntities: GeographicEntity[] = [
  ...curatedGeographicEntities,
  ...countryEntities.filter((entity) => !curatedIds.has(entity.id)),
  ...generatedTerritoryEntities.filter((entity) => !curatedIds.has(entity.id))
]
