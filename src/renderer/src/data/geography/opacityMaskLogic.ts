import turfDifference from '@turf/difference'
import turfIntersect from '@turf/intersect'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

import type { MapOpacityMask, ManagedMapLayerId } from './mapLayerManager'
import { normalizeSourceFeatureId } from './sourceFeatureIds.ts'

type PolygonalGeometry = Polygon | MultiPolygon
type PolygonalFeature = Feature<PolygonalGeometry>

export type ResolvedTerritoryOpacityMask = {
  kind: MapOpacityMask['kind']
  opacity: number
  enabled?: boolean
  territoryIds: ReadonlySet<string>
  geometryFeatures: PolygonalFeature[]
}

type WeightedTerritoryPart = { geometry: PolygonalGeometry; opacity: number }

export function getOpacityMaskTarget(mask: MapOpacityMask): ManagedMapLayerId | null {
  return mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId
}

const opacityGeometryBoundsCache = new WeakMap<Geometry, [number, number, number, number]>()

function getOpacityGeometryBounds(geometry: Geometry): [number, number, number, number] {
  const cached = opacityGeometryBoundsCache.get(geometry)
  if (cached) return cached
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      bounds[0] = Math.min(bounds[0], value[0])
      bounds[1] = Math.min(bounds[1], value[1])
      bounds[2] = Math.max(bounds[2], value[0])
      bounds[3] = Math.max(bounds[3], value[1])
      return
    }
    value.forEach(visit)
  }
  if (geometry.type === 'GeometryCollection') {
    for (const item of geometry.geometries) {
      const itemBounds = getOpacityGeometryBounds(item)
      bounds[0] = Math.min(bounds[0], itemBounds[0])
      bounds[1] = Math.min(bounds[1], itemBounds[1])
      bounds[2] = Math.max(bounds[2], itemBounds[2])
      bounds[3] = Math.max(bounds[3], itemBounds[3])
    }
  } else if ('coordinates' in geometry) visit(geometry.coordinates)
  opacityGeometryBoundsCache.set(geometry, bounds)
  return bounds
}

function boundsOverlap(
  first: [number, number, number, number],
  second: [number, number, number, number]
): boolean {
  return (
    first[0] <= second[2] && first[2] >= second[0] && first[1] <= second[3] && first[3] >= second[1]
  )
}

export function applyResolvedTerritoryOpacityMasks(
  source: FeatureCollection<Geometry>,
  masks: ResolvedTerritoryOpacityMask[]
): FeatureCollection<Geometry> {
  const activeMasks = masks.filter(
    ({ enabled, opacity, territoryIds, geometryFeatures }) =>
      enabled !== false && opacity < 1 && (territoryIds.size > 0 || geometryFeatures.length > 0)
  )
  if (activeMasks.length === 0) return source

  const features = source.features.flatMap((feature) => {
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')
      return [feature]
    const territoryId =
      typeof feature.properties?.sourceId === 'string' ||
      typeof feature.properties?.sourceId === 'number'
        ? normalizeSourceFeatureId(feature.properties.sourceId)
        : null
    let parts: WeightedTerritoryPart[] = [{ geometry: feature.geometry, opacity: 1 }]

    for (const mask of activeMasks) {
      if (
        (mask.kind === 'country' || mask.kind === 'continent') &&
        territoryId &&
        mask.territoryIds.has(territoryId)
      ) {
        parts = parts.map((part) => ({ ...part, opacity: part.opacity * mask.opacity }))
        continue
      }
      if (mask.geometryFeatures.length === 0) continue

      for (const maskFeature of mask.geometryFeatures) {
        const maskBounds = getOpacityGeometryBounds(maskFeature.geometry)
        const nextParts: WeightedTerritoryPart[] = []
        for (const part of parts) {
          if (
            part.opacity <= 0 ||
            !boundsOverlap(getOpacityGeometryBounds(part.geometry), maskBounds)
          ) {
            nextParts.push(part)
            continue
          }
          const subject = {
            type: 'Feature',
            properties: feature.properties,
            geometry: part.geometry
          } as PolygonalFeature
          const pair: FeatureCollection<PolygonalGeometry> = {
            type: 'FeatureCollection',
            features: [subject, maskFeature]
          }
          try {
            const inside = turfIntersect(pair)
            if (!inside) {
              nextParts.push(part)
              continue
            }
            const outside = turfDifference(pair)
            if (outside) nextParts.push({ geometry: outside.geometry, opacity: part.opacity })
            if (mask.opacity > 0) {
              nextParts.push({ geometry: inside.geometry, opacity: part.opacity * mask.opacity })
            }
          } catch {
            nextParts.push(part)
          }
        }
        parts = nextParts
      }
    }

    return parts.map((part, index) => ({
      type: 'Feature' as const,
      id: `${String(feature.id ?? territoryId ?? 'territory')}:mask-part-${index}`,
      properties: { ...(feature.properties ?? {}), opacityMaskMultiplier: part.opacity },
      geometry: part.geometry
    }))
  })

  return { type: 'FeatureCollection', features }
}
