import type { FeatureCollection, Geometry } from 'geojson'
import countryCatalog from './countryCatalog.json'
import { additionalMapFlagRegions } from './additionalMapFlagRegions'
import { geographicEntities } from '../geography/entities'
import { hasFlagImageAsset } from './flagAssets'

function normalizeSourceFeatureId(sourceFeatureId: unknown): string | null {
  if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') return null

  const value = String(sourceFeatureId)
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : value
}

const entityById = new Map(geographicEntities.map((entity) => [entity.id, entity]))
const alpha2BySourceFeatureId = new Map<string, string>([
  ...countryCatalog.map((country) => [
    normalizeSourceFeatureId(country.sourceFeatureId)!,
    country.alpha2
  ] as const),
  ...additionalMapFlagRegions.map((region) => [
    normalizeSourceFeatureId(region.sourceFeatureId)!,
    region.alpha2
  ] as const)
])

function getFlagCodeForFeature(properties: Record<string, unknown>): string | null {
  const entity = typeof properties.entityId === 'string'
    ? entityById.get(properties.entityId)
    : undefined

  if (entity) {
    if (entity.kind !== 'territory') return entity.flagAlpha2 ?? entity.alpha2 ?? null

    const sovereign = entity.sovereignEntityId
      ? entityById.get(entity.sovereignEntityId)
      : undefined
    return entity.flagAlpha2 ?? sovereign?.alpha2 ?? entity.alpha2 ?? null
  }

  const normalizedSourceFeatureId = normalizeSourceFeatureId(properties.sourceId)
  return normalizedSourceFeatureId
    ? alpha2BySourceFeatureId.get(normalizedSourceFeatureId) ?? null
    : null
}

export function addFlagTerritoryProperties(
  dataset: FeatureCollection<Geometry>
): FeatureCollection<Geometry> {
  return {
    ...dataset,
    features: dataset.features.map((feature) => {
      const properties = (feature.properties ?? {}) as Record<string, unknown>
      const flagAlpha2 = getFlagCodeForFeature(properties)
      const usableFlagCode = flagAlpha2 && hasFlagImageAsset(flagAlpha2)
        ? flagAlpha2.toUpperCase()
        : null

      return {
        ...feature,
        properties: {
          ...properties,
          flagAlpha2: usableFlagCode
        }
      }
    })
  }
}
