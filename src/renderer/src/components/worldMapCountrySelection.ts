import pointOnFeature from '@turf/point-on-feature'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import countryExplorationData from '../data/quiz/countryExplorationData.json'
import { addFlagTerritoryProperties } from '../data/quiz/mapFlagTerritories'
import { world110mMap, world50mMap, world10mMap } from '../data/world'
import { normalizeSourceFeatureId } from '../data/geography/sourceFeatureIds'
import {
  chooseDirectionalCountryFeature,
  chooseCountryFeatureAtPoint,
  getCountryFeatureHit,
  getCountryFeatureIdentity,
  getTinyTerritoryHitRadius,
  isCountryFillFeature
} from '../data/geography/countryHitTesting'

export { normalizeSourceFeatureId } from '../data/geography/sourceFeatureIds'
export {
  getCountryFeatureIdentity,
  isCountryFillFeature
} from '../data/geography/countryHitTesting'

export const world110mFlagMap = addFlagTerritoryProperties(world110mMap)
export const world50mFlagMap = addFlagTerritoryProperties(world50mMap)
export const world10mFlagMap = addFlagTerritoryProperties(world10mMap)

export const countryFillLayerIds = [
  'countries-fill-110m',
  'countries-fill-50m',
  'countries-fill-10m'
]

export type InteractiveCountryFeature = NonNullable<MapLayerMouseEvent['features']>[number]

type CountryHitAreaRecord = {
  id?: string
  sourceFeatureId?: string | number
  alpha2?: string | null
  metrics?: { areaKm2?: number | null } | null
}

const countryAreaByFeatureIdentity = new globalThis.Map<string, number>([
  ...(countryExplorationData.countries as CountryHitAreaRecord[]).flatMap((country) => {
    const area = country.metrics?.areaKm2
    if (!Number.isFinite(area) || area === undefined || area === null) return []
    const identity = country.alpha2 ? `entity:country:${country.alpha2.toLowerCase()}` : null
    return identity ? [[identity, area] as [string, number]] : []
  }),
  ...(countryExplorationData.territories as CountryHitAreaRecord[]).flatMap((territory) => {
    const area = territory.metrics?.areaKm2
    return territory.id && Number.isFinite(area) && area !== undefined && area !== null
      ? [[`entity:${territory.id}`, area] as [string, number]]
      : []
  })
])

const countryAreaBySourceFeatureId = new globalThis.Map<string, number>(
  (countryExplorationData.countries as CountryHitAreaRecord[]).flatMap((country) => {
    const area = country.metrics?.areaKm2
    return country.sourceFeatureId !== undefined &&
      Number.isFinite(area) &&
      area !== undefined &&
      area !== null
      ? [[normalizeSourceFeatureId(country.sourceFeatureId), area] as [string, number]]
      : []
  })
)

function getCountryAreaKm2(feature: InteractiveCountryFeature): number | null {
  const identity = getCountryFeatureIdentity(feature)
  const entityArea = identity ? countryAreaByFeatureIdentity.get(identity) : undefined
  if (entityArea !== undefined) return entityArea
  const sourceId = feature.properties?.sourceId
  if (typeof sourceId !== 'string' && typeof sourceId !== 'number') return null
  return countryAreaBySourceFeatureId.get(normalizeSourceFeatureId(sourceId)) ?? null
}

export function getCountryFeatureAtPoint(
  map: MapLibreMap,
  point: { x: number; y: number },
  eventFeatures?: InteractiveCountryFeature[]
): InteractiveCountryFeature | undefined {
  const layers = countryFillLayerIds.filter((layerId) => map.getLayer(layerId))
  const eventCountryFeatures = eventFeatures?.filter(isCountryFillFeature) ?? []
  if (!layers.length) return eventCountryFeatures[0]

  // Query both the painted feature and nearby polygons from the geographic
  // source. At world scale the rendered boundary can cover tiny neighboring
  // countries, so exact containment in the more detailed data must win.
  const exactPointFeatures = map
    .queryRenderedFeatures([point.x, point.y], { layers })
    .filter((feature): feature is InteractiveCountryFeature =>
      isCountryFillFeature(feature as InteractiveCountryFeature)
    )
  const directFeature = eventCountryFeatures[0] ?? exactPointFeatures[0]
  const searchRadius = getTinyTerritoryHitRadius(map.getZoom())
  const candidates = [
    ...eventCountryFeatures,
    ...exactPointFeatures,
    ...map.queryRenderedFeatures(
      [
        [point.x - searchRadius, point.y - searchRadius],
        [point.x + searchRadius, point.y + searchRadius]
      ],
      { layers }
    ),
    ...getCountryHitTestFallbacks(map, point, searchRadius)
  ]
  return chooseCountryFeatureAtPoint(
    map,
    point,
    candidates as InteractiveCountryFeature[],
    directFeature,
    getCountryAreaKm2
  )
}

export function getSmallCountryFeaturesAroundPoint(
  map: MapLibreMap,
  point: { x: number; y: number },
  radius: number
): InteractiveCountryFeature[] {
  const layers = countryFillLayerIds.filter((layerId) => map.getLayer(layerId))
  const candidates: InteractiveCountryFeature[] = layers.length
    ? map.queryRenderedFeatures(
        [
          [point.x - radius, point.y - radius],
          [point.x + radius, point.y + radius]
        ],
        { layers }
      )
    : []
  candidates.push(...getCountryHitTestFallbacks(map, point, radius))

  const nearbyByCountry = new globalThis.Map<
    string,
    { feature: InteractiveCountryFeature; distance: number }
  >()
  for (const candidate of candidates) {
    if (!isCountryFillFeature(candidate)) continue
    const sourceId = candidate.properties?.sourceId
    if (typeof sourceId !== 'string' && typeof sourceId !== 'number') continue
    const areaKm2 = getCountryAreaKm2(candidate)
    if (areaKm2 !== null && areaKm2 > 200_000) continue
    const hit = getCountryFeatureHit(map, candidate, point, areaKm2, radius)
    if (!hit?.isTinyTerritory || hit.distance > radius) continue
    const key =
      getCountryFeatureIdentity(candidate) ?? `source:${normalizeSourceFeatureId(sourceId)}`
    const current = nearbyByCountry.get(key)
    if (!current || hit.distance < current.distance)
      nearbyByCountry.set(key, { feature: candidate, distance: hit.distance })
  }
  return [...nearbyByCountry.values()]
    .sort((first, second) => first.distance - second.distance)
    .map(({ feature }) => feature)
}

const countryAnchorCache = new WeakMap<Geometry, [number, number]>()

function getCountryAnchor(geometry: Geometry): [number, number] | null {
  const cached = countryAnchorCache.get(geometry)
  if (cached) return cached
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  try {
    const point = pointOnFeature({ type: 'Feature', properties: {}, geometry })
    const anchor: [number, number] = [point.geometry.coordinates[0], point.geometry.coordinates[1]]
    countryAnchorCache.set(geometry, anchor)
    return anchor
  } catch {
    return null
  }
}

export function getDirectionalCountryFeature(
  map: MapLibreMap,
  sourceFeatureId: string | number,
  entityId: string | null,
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
): InteractiveCountryFeature | null {
  const current = world10mFlagMap.features.find((feature) =>
    entityId
      ? feature.properties?.entityId === entityId
      : normalizeSourceFeatureId(String(feature.properties?.sourceId ?? '')) ===
          normalizeSourceFeatureId(sourceFeatureId) && !feature.properties?.entityId
  )
  if (!current) return null
  const currentAnchor = getCountryAnchor(current.geometry)
  if (!currentAnchor) return null
  const mapCenterLongitude = map.getCenter().lng
  const wrappedLongitude =
    currentAnchor[0] + 360 * Math.round((mapCenterLongitude - currentAnchor[0]) / 360)
  const origin = map.project([wrappedLongitude, currentAnchor[1]])
  const canvas = map.getCanvas()
  const maxDistance = Math.max(100, 240 - map.getZoom() * 10)
  const candidates: Array<{ feature: InteractiveCountryFeature; point: { x: number; y: number } }> =
    []

  for (const feature of world10mFlagMap.features) {
    const candidateId = feature.properties?.sourceId
    if (typeof candidateId !== 'string' && typeof candidateId !== 'number') continue
    const candidateIdentity = getCountryFeatureIdentity(feature)
    if (!candidateIdentity || candidateIdentity === getCountryFeatureIdentity(current)) continue
    const anchor = getCountryAnchor(feature.geometry)
    if (!anchor) continue
    const longitude = anchor[0] + 360 * Math.round((mapCenterLongitude - anchor[0]) / 360)
    const projected = map.project([longitude, anchor[1]])
    if (!Number.isFinite(projected.x + projected.y)) continue
    if (
      projected.x < -20 ||
      projected.x > canvas.clientWidth + 20 ||
      projected.y < -20 ||
      projected.y > canvas.clientHeight + 20
    )
      continue

    candidates.push({
      feature: {
        ...feature,
        layer: { id: 'countries-fill-10m' }
      } as unknown as InteractiveCountryFeature,
      point: projected
    })
  }
  return chooseDirectionalCountryFeature(origin, candidates, direction, maxDistance)
}

type LowZoomFallbackCountry = {
  feature: InteractiveCountryFeature
  bounds: [number, number, number, number]
}

export function getGeometryBounds(geometry: Geometry): [number, number, number, number] | null {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  const polygonBounds: [number, number, number, number][] = []

  for (const polygon of polygons) {
    let west = Infinity
    let south = Infinity
    let east = -Infinity
    let north = -Infinity

    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude)
        south = Math.min(south, latitude)
        east = Math.max(east, longitude)
        north = Math.max(north, latitude)
      }
    }

    if (Number.isFinite(west + south + east + north)) {
      polygonBounds.push([west, south, east, north])
    }
  }

  if (!polygonBounds.length) return null

  return polygonBounds.reduce((largest, current) => {
    const largestArea = (largest[2] - largest[0]) * (largest[3] - largest[1])
    const currentArea = (current[2] - current[0]) * (current[3] - current[1])
    return currentArea > largestArea ? current : largest
  })
}

function createCountryHitTestFeatures(
  dataset: FeatureCollection<Geometry>
): LowZoomFallbackCountry[] {
  return dataset.features.flatMap((country) => {
    const polygons =
      country.geometry.type === 'Polygon'
        ? [country.geometry.coordinates]
        : country.geometry.type === 'MultiPolygon'
          ? country.geometry.coordinates
          : []

    return polygons.flatMap((coordinates) => {
      const geometry: Geometry = { type: 'Polygon', coordinates }
      const bounds = getGeometryBounds(geometry)
      if (!bounds) return []
      return [
        {
          feature: {
            ...country,
            geometry,
            layer: { id: 'countries-fill-50m' }
          } as unknown as InteractiveCountryFeature,
          bounds
        }
      ]
    })
  })
}

const world110mSourceIds = new Set(
  world110mFlagMap.features
    .map((feature) => feature.properties?.sourceId)
    .filter(
      (sourceId): sourceId is string | number =>
        typeof sourceId === 'string' || typeof sourceId === 'number'
    )
    .map(normalizeSourceFeatureId)
)
const lowZoomFallbackCountryFeatures = createCountryHitTestFeatures(world50mFlagMap)
const highZoomFallbackCountryFeatures = createCountryHitTestFeatures(world10mFlagMap)

export const lowZoomMissingCountryMarkers: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: world50mFlagMap.features.flatMap((country) => {
    const sourceId = country.properties?.sourceId
    if (
      (typeof sourceId !== 'string' && typeof sourceId !== 'number') ||
      world110mSourceIds.has(normalizeSourceFeatureId(sourceId))
    )
      return []

    const location = pointOnFeature(country as unknown as Feature<Geometry>)
    return {
      type: 'Feature',
      id: country.id,
      properties: country.properties ?? {},
      geometry: location.geometry
    }
  })
}

function getLongitudeDistance(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180)
}

type GeographicPointerSearch = {
  longitude: number
  latitude: number
  longitudeRadius: number
  latitudeRadius: number
}

function getGeographicPointerSearch(
  map: MapLibreMap,
  point: { x: number; y: number },
  radius: number
): GeographicPointerSearch {
  const center = map.unproject([point.x, point.y])
  const horizontal = map.unproject([point.x + radius, point.y])
  const vertical = map.unproject([point.x, point.y + radius])
  return {
    longitude: center.lng,
    latitude: center.lat,
    longitudeRadius: getLongitudeDistance(horizontal.lng, center.lng),
    latitudeRadius: Math.abs(vertical.lat - center.lat)
  }
}

function isGeographicBoundsNearPointer(
  pointer: GeographicPointerSearch,
  bounds: [number, number, number, number]
): boolean {
  const boundsCenterLongitude = (bounds[0] + bounds[2]) / 2
  const boundsCenterLatitude = (bounds[1] + bounds[3]) / 2
  const boundsHalfLongitude = Math.min(180, (bounds[2] - bounds[0]) / 2)
  const boundsHalfLatitude = (bounds[3] - bounds[1]) / 2

  return (
    getLongitudeDistance(boundsCenterLongitude, pointer.longitude) <=
      pointer.longitudeRadius + boundsHalfLongitude &&
    Math.abs(boundsCenterLatitude - pointer.latitude) <= pointer.latitudeRadius + boundsHalfLatitude
  )
}

function getCountryHitTestFallbacks(
  map: MapLibreMap,
  point: { x: number; y: number },
  radius: number
): InteractiveCountryFeature[] {
  const pointerSearch = getGeographicPointerSearch(map, point, radius)
  const features =
    map.getZoom() < 4 ? lowZoomFallbackCountryFeatures : highZoomFallbackCountryFeatures
  return features
    .filter(({ bounds }) => isGeographicBoundsNearPointer(pointerSearch, bounds))
    .map(({ feature }) => feature)
}
