import pointOnFeature from '@turf/point-on-feature'
import type { FeatureCollection, Geometry, Point, Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import countryExplorationData from '../data/quiz/countryExplorationData.json'
import { addFlagTerritoryProperties } from '../data/quiz/mapFlagTerritories'
import { world110mMap, world50mMap, world10mMap, world10mCountryNeighbors } from '../data/world'
import { normalizeSourceFeatureId } from '../data/geography/sourceFeatureIds'
import {
  chooseDirectionalCountryFeature,
  chooseCountryFeatureAtPoint,
  getLandNeighborHitRadius,
  getCountryFeatureHit,
  getCountryFeatureIdentity,
  getSmallIslandSeaHitRadius,
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

const MAX_KEYBOARD_CYCLE_COUNTRY_AREA_KM2 = 40_000

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

function isSurroundedBySea(feature: InteractiveCountryFeature): boolean {
  const sourceId = feature.properties?.sourceId
  if (typeof sourceId !== 'string' && typeof sourceId !== 'number') return false
  const neighbors = world10mCountryNeighbors.get(Number(sourceId))
  return !neighbors || neighbors.length === 0
}

function getLandNeighborAreasKm2(feature: InteractiveCountryFeature): number[] {
  const sourceId = feature.properties?.sourceId
  if (typeof sourceId !== 'string' && typeof sourceId !== 'number') return []
  return (world10mCountryNeighbors.get(Number(sourceId)) ?? []).flatMap((neighborId) => {
    const area = countryAreaBySourceFeatureId.get(normalizeSourceFeatureId(neighborId))
    return area === undefined ? [] : [area]
  })
}

function getCountryHitShapeScale(feature: InteractiveCountryFeature): number {
  const sourceId = feature.properties?.sourceId
  return normalizeSourceFeatureId(sourceId ?? '') === '438' ? 4 : 1.5
}

function isBritishIndianOceanTerritory(feature: InteractiveCountryFeature): boolean {
  return normalizeSourceFeatureId(feature.properties?.sourceId ?? '') === '86'
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
  const searchRadius = Math.max(
    getSmallIslandSeaHitRadius(map.getZoom()),
    getLandNeighborHitRadius(map.getZoom(), [200_001])
  )
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
    getCountryAreaKm2,
    (feature) => {
      const areaKm2 = getCountryAreaKm2(feature)
      if (isBritishIndianOceanTerritory(feature) || isSurroundedBySea(feature)) {
        return getSmallIslandSeaHitRadius(map.getZoom())
      }
      if (areaKm2 !== null && areaKm2 > 200_000) return 0
      return getLandNeighborHitRadius(map.getZoom(), getLandNeighborAreasKm2(feature))
    },
    getCountryHitShapeScale
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
    if (areaKm2 === null || areaKm2 > MAX_KEYBOARD_CYCLE_COUNTRY_AREA_KM2) continue
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
    const mainPolygon =
      geometry.type === 'Polygon'
        ? geometry.coordinates
        : geometry.coordinates.reduce((largest, candidate) => {
            const ring = (polygon: typeof candidate): number => {
              const outer = polygon[0] ?? []
              let area = 0
              for (let index = 0; index < outer.length; index += 1) {
                const current = outer[index]
                const next = outer[(index + 1) % outer.length]
                if (!current || !next) continue
                area += current[0] * next[1] - next[0] * current[1]
              }
              return Math.abs(area)
            }
            return ring(candidate) > ring(largest) ? candidate : largest
          })
    const point = pointOnFeature({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: mainPolygon }
    })
    const anchor: [number, number] = [point.geometry.coordinates[0], point.geometry.coordinates[1]]
    countryAnchorCache.set(geometry, anchor)
    return anchor
  } catch {
    return null
  }
}

const KEYBOARD_CYCLE_REGION_AREA_KM2 = 5_100_000
const KEYBOARD_CYCLE_EARTH_RADIUS_KM = 6_371.0088
const KEYBOARD_CYCLE_REGION_RADIUS_KM = Math.sqrt(KEYBOARD_CYCLE_REGION_AREA_KM2 / Math.PI)
const countryGeometryAreaCache = new WeakMap<Geometry, number>()

function estimateGeometryAreaKm2(geometry: Geometry): number | null {
  const cached = countryGeometryAreaCache.get(geometry)
  if (cached !== undefined) return cached
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  if (polygons.length === 0) return null

  const ringArea = (ring: Position[]): number => {
    let sum = 0
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index]
      const next = ring[(index + 1) % ring.length]
      if (!current || !next) continue
      const longitude = current[0]
      const nextLongitude = next[0]
      const latitude = current[1]
      const nextLatitude = next[1]
      if (
        typeof longitude !== 'number' ||
        typeof nextLongitude !== 'number' ||
        typeof latitude !== 'number' ||
        typeof nextLatitude !== 'number'
      ) {
        continue
      }
      let longitudeDelta = (nextLongitude - longitude) * (Math.PI / 180)
      if (longitudeDelta > Math.PI) longitudeDelta -= Math.PI * 2
      else if (longitudeDelta < -Math.PI) longitudeDelta += Math.PI * 2
      sum +=
        longitudeDelta *
        (2 +
          Math.sin(latitude * (Math.PI / 180)) +
          Math.sin(nextLatitude * (Math.PI / 180)))
    }
    return Math.abs((sum * KEYBOARD_CYCLE_EARTH_RADIUS_KM ** 2) / 2)
  }

  const area = polygons.reduce((total, polygon) => {
    const outerRing = polygon[0]
    if (!outerRing) return total
    const holesArea = polygon.slice(1).reduce((sum, hole) => sum + ringArea(hole), 0)
    return total + Math.max(0, ringArea(outerRing) - holesArea)
  }, 0)
  countryGeometryAreaCache.set(geometry, area)
  return area
}

function greatCircleDistanceKm(
  first: [number, number],
  second: [number, number]
): number {
  const radians = Math.PI / 180
  const firstLatitude = first[1] * radians
  const secondLatitude = second[1] * radians
  const latitudeDelta = (second[1] - first[1]) * radians
  const longitudeDelta = ((((second[0] - first[0]) % 360) + 540) % 360 - 180) * radians
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return (
    2 *
    KEYBOARD_CYCLE_EARTH_RADIUS_KM *
    Math.asin(Math.sqrt(Math.min(1, haversine)))
  )
}

/**
 * Small territories within a circular area whose surface equals roughly half
 * of Europe's land area, centered on the currently preselected territory.
 */
export function getSmallCountryFeaturesWithinCycleArea(
  centerFeature: InteractiveCountryFeature
): InteractiveCountryFeature[] {
  const center = getCountryAnchor(centerFeature.geometry)
  if (!center) return []

  return world10mFlagMap.features
    .flatMap((feature) => {
      const typedFeature = feature as unknown as InteractiveCountryFeature
      const areaKm2 = getCountryAreaKm2(typedFeature) ?? estimateGeometryAreaKm2(feature.geometry)
      if (areaKm2 === null || areaKm2 >= 40_000) return []
      const anchor = getCountryAnchor(feature.geometry)
      if (!anchor) return []
      const distance = greatCircleDistanceKm(center, anchor)
      if (distance > KEYBOARD_CYCLE_REGION_RADIUS_KM) return []
      return [{ feature: typedFeature, distance }]
    })
    .sort((first, second) => first.distance - second.distance)
    .map(({ feature }) => feature)
}

const SMALL_COUNTRY_HIGHLIGHT_AREA_KM2 = 10_000

export const smallCountryHighlightFeatureIds = new Set([
  ...(countryExplorationData.countries as CountryHitAreaRecord[]).flatMap((country) => {
    const sourceId = country.sourceFeatureId
    const area = country.metrics?.areaKm2
    return sourceId !== undefined &&
      area !== undefined &&
      area !== null &&
      area <= SMALL_COUNTRY_HIGHLIGHT_AREA_KM2
      ? [normalizeSourceFeatureId(sourceId)]
      : []
  }),
  // Natural Earth does not have a corresponding exploration metrics record
  // for the British Indian Ocean Territory, but its islands need the same
  // visual locator as other microterritories.
  '86',
  // The U.S. Minor Outlying Islands also lack a local exploration area record.
  '581'
])

const smallCountryHighlightFeatureIdentities = new Set(
  world10mFlagMap.features.flatMap((feature) => {
    const identity = getCountryFeatureIdentity(feature as unknown as InteractiveCountryFeature)
    const area = getCountryAreaKm2(feature as unknown as InteractiveCountryFeature)
    const sourceId = feature.properties?.sourceId
    return identity &&
      ((area !== undefined && area !== null && area <= SMALL_COUNTRY_HIGHLIGHT_AREA_KM2) ||
        (typeof sourceId === 'string' &&
          smallCountryHighlightFeatureIds.has(normalizeSourceFeatureId(sourceId))) ||
        (typeof sourceId === 'number' &&
          smallCountryHighlightFeatureIds.has(normalizeSourceFeatureId(sourceId))))
      ? [identity]
      : []
  })
)

/**
 * Selected microstates need a visible point highlight while their actual
 * polygon remains the authoritative shape and click target.
 */
export const smallCountryHighlightMarkers: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: world10mFlagMap.features.flatMap((feature) => {
    const sourceId = feature.properties?.sourceId
    if (
      (typeof sourceId !== 'string' && typeof sourceId !== 'number') ||
      !smallCountryHighlightFeatureIdentities.has(
        getCountryFeatureIdentity(feature as unknown as InteractiveCountryFeature) ?? ''
      )
    )
      return []
    const anchor = getCountryAnchor(feature.geometry)
    if (!anchor) return []
    const properties = feature.properties ?? {}
    const entityId = properties.entityId
    return [
      {
        type: 'Feature' as const,
        id: feature.id,
        properties: {
          ...properties,
          // Several overseas French territories reuse France's Natural Earth
          // source ID. Keep those markers selectable by entity without making
          // them react to a selection of metropolitan France.
          sourceId:
            typeof entityId === 'string' && entityId.startsWith('territory:') ? null : sourceId
        },
        geometry: { type: 'Point' as const, coordinates: anchor }
      }
    ]
  })
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

export function getAdjacentCountryFeatures(
  sourceFeatureId: string | number
): InteractiveCountryFeature[] {
  const sourceId = Number(sourceFeatureId)
  if (!Number.isFinite(sourceId)) return []
  const neighborIds = new Set(world10mCountryNeighbors.get(sourceId) ?? [])
  if (neighborIds.size === 0) return []
  return world10mFlagMap.features.flatMap((feature) => {
    const neighborSourceId = feature.properties?.sourceId
    const areaKm2 = getCountryAreaKm2(feature as unknown as InteractiveCountryFeature)
    if (
      (typeof neighborSourceId !== 'string' && typeof neighborSourceId !== 'number') ||
      !neighborIds.has(Number(neighborSourceId)) ||
      areaKm2 === null ||
      areaKm2 > MAX_KEYBOARD_CYCLE_COUNTRY_AREA_KM2
    ) {
      return []
    }
    return [
      {
        ...feature,
        layer: { id: 'countries-fill-10m' }
      } as unknown as InteractiveCountryFeature
    ]
  })
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
  dataset: FeatureCollection<Geometry>,
  isAuthoritative = false
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
            properties: {
              ...country.properties,
              ...(isAuthoritative ? { hitTestResolution: '10m' } : {})
            },
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
const highZoomFallbackCountryFeatures = createCountryHitTestFeatures(world10mFlagMap, true)
const britishIndianOceanHitTestFeatures = highZoomFallbackCountryFeatures.filter(({ feature }) =>
  isBritishIndianOceanTerritory(feature)
)

export const lowZoomMissingCountryMarkers: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: world50mFlagMap.features.flatMap((country) => {
    const sourceId = country.properties?.sourceId
    if (
      (typeof sourceId !== 'string' && typeof sourceId !== 'number') ||
      world110mSourceIds.has(normalizeSourceFeatureId(sourceId))
    )
      return []

    const anchor = getCountryAnchor(country.geometry)
    if (!anchor) return []
    return {
      type: 'Feature',
      id: country.id,
      properties: country.properties ?? {},
      geometry: { type: 'Point', coordinates: anchor }
    }
  })
}

const world50mSourceIds = new Set(
  world50mFlagMap.features
    .map((feature) => feature.properties?.sourceId)
    .filter(
      (sourceId): sourceId is string | number =>
        typeof sourceId === 'string' || typeof sourceId === 'number'
    )
    .map(normalizeSourceFeatureId)
)

export const mediumZoomMissingCountryMarkers: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: world10mFlagMap.features.flatMap((country) => {
    const sourceId = country.properties?.sourceId
    if (
      (typeof sourceId !== 'string' && typeof sourceId !== 'number') ||
      world50mSourceIds.has(normalizeSourceFeatureId(sourceId))
    )
      return []

    const anchor = getCountryAnchor(country.geometry)
    if (!anchor) return []
    return [
      {
        type: 'Feature' as const,
        id: country.id,
        properties: country.properties ?? {},
        geometry: { type: 'Point' as const, coordinates: anchor }
      }
    ]
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
    map.getZoom() < 4
      ? [...lowZoomFallbackCountryFeatures, ...highZoomFallbackCountryFeatures]
      : highZoomFallbackCountryFeatures
  const nearbyFeatures = features.filter(({ bounds }) =>
    isGeographicBoundsNearPointer(pointerSearch, bounds)
  )
  // The BIOT islands are exceptionally small and spread across the Indian
  // Ocean. Always test their detailed polygons so a coarse viewport/bounds
  // conversion cannot silently remove them from the click candidates.
  return [...new Set([...nearbyFeatures, ...britishIndianOceanHitTestFeatures])].map(
    ({ feature }) => feature
  )
}
