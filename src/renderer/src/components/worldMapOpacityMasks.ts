import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson'

import countryCatalog from '../data/quiz/countryCatalog.json'
import { getContinentIdForCountry } from '../data/quiz/countryContinents'
import type { MapOpacityMask } from '../data/geography/mapLayerManager'
import {
  createCircleMaskGeometry,
  createRectangleMaskGeometry,
  getOpacityMaskHandlePatch,
  getOpacityMaskHandles,
  type OpacityMaskHandle
} from './worldMapMaskGeometry'
export { getOpacityMaskHandlePatch, getOpacityMaskHandles }
export type { OpacityMaskHandle }
import { normalizeSourceFeatureId, world10mFlagMap } from './worldMapCountrySelection'
import {
  applyResolvedTerritoryOpacityMasks,
  type ResolvedTerritoryOpacityMask
} from '../data/geography/opacityMaskLogic'

export { getOpacityMaskTarget } from '../data/geography/opacityMaskLogic'

type PolygonalGeometry = Polygon | MultiPolygon
type PolygonalFeature = Feature<PolygonalGeometry>
type TerritoryOpacityMask = { mask: MapOpacityMask; data: FeatureCollection<Geometry> }

function selectedTerritoryIds(mask: MapOpacityMask): Set<string> {
  if (mask.kind === 'country') {
    const ids =
      mask.sourceFeatureIds ?? (mask.sourceFeatureId !== undefined ? [mask.sourceFeatureId] : [])
    return new Set(ids.map(normalizeSourceFeatureId))
  }
  if (mask.kind === 'continent') {
    const continents = mask.continents ?? (mask.continent ? [mask.continent] : [])
    return new Set(
      countryCatalog
        .filter((country) => {
          const continent = getContinentIdForCountry(country.alpha2)
          return continent !== undefined && continents.includes(continent)
        })
        .map((country) => normalizeSourceFeatureId(country.sourceFeatureId))
    )
  }
  return new Set()
}

export function applyOpacityMasksToTerritories(
  source: FeatureCollection<Geometry>,
  masks: TerritoryOpacityMask[]
): FeatureCollection<Geometry> {
  const activeMasks = masks.filter(
    ({ mask, data }) => mask.enabled !== false && mask.opacity < 100 && data.features.length > 0
  )
  if (activeMasks.length === 0) return source

  const resolvedMasks: ResolvedTerritoryOpacityMask[] = activeMasks.map(({ mask, data }) => ({
    kind: mask.kind,
    opacity: Math.max(0, Math.min(100, mask.opacity)) / 100,
    enabled: mask.enabled,
    territoryIds: selectedTerritoryIds(mask),
    geometryFeatures:
      mask.kind === 'circle' || mask.kind === 'rectangle'
        ? data.features.flatMap((feature): PolygonalFeature[] =>
            feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
              ? [{ ...feature, geometry: feature.geometry } as PolygonalFeature]
              : []
          )
        : []
  }))
  return applyResolvedTerritoryOpacityMasks(source, resolvedMasks)
}

export function getOpacityMaskFeatureCollection(mask: MapOpacityMask): FeatureCollection<Geometry> {
  if (mask.kind === 'circle' && mask.center) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { maskId: mask.id },
          geometry: createCircleMaskGeometry(mask.center, mask.radiusKm ?? 500)
        }
      ]
    }
  }
  if (mask.kind === 'rectangle' && mask.center) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { maskId: mask.id },
          geometry: createRectangleMaskGeometry(
            mask.center,
            mask.widthKm ?? 1000,
            mask.heightKm ?? 700
          )
        }
      ]
    }
  }

  const selectedCountryIds =
    mask.sourceFeatureIds ?? (mask.sourceFeatureId !== undefined ? [mask.sourceFeatureId] : [])
  const selectedContinents = mask.continents ?? (mask.continent ? [mask.continent] : [])
  const sourceFeatureIds =
    mask.kind === 'country'
      ? new Set(selectedCountryIds.map(normalizeSourceFeatureId))
      : mask.kind === 'continent'
        ? new Set(
            countryCatalog
              .filter((country) => {
                const continentId = getContinentIdForCountry(country.alpha2)
                return continentId !== undefined && selectedContinents.includes(continentId)
              })
              .map((country) => normalizeSourceFeatureId(country.sourceFeatureId))
          )
        : new Set<string>()
  const features = world10mFlagMap.features.filter((feature) => {
    const sourceFeatureId = feature.properties?.sourceId
    return (
      (typeof sourceFeatureId === 'string' || typeof sourceFeatureId === 'number') &&
      sourceFeatureIds.has(normalizeSourceFeatureId(sourceFeatureId))
    )
  })

  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      id: `${mask.id}:${String(feature.properties?.sourceId ?? 'region')}`,
      properties: { maskId: mask.id },
      geometry: feature.geometry
    }))
  }
}

export type OpacityMaskGeometryBounds = [west: number, south: number, east: number, north: number]
const opacityMaskGeometryBoundsCache = new WeakMap<Geometry, OpacityMaskGeometryBounds[]>()

export function getOpacityMaskGeometryBounds(geometry: Geometry): OpacityMaskGeometryBounds[] {
  const cachedBounds = opacityMaskGeometryBoundsCache.get(geometry)
  if (cachedBounds) return cachedBounds

  let bounds: OpacityMaskGeometryBounds[]
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    if (!ring?.length) bounds = []
    else {
      const polygonBounds = ring.reduce<OpacityMaskGeometryBounds>(
        ([west, south, east, north], [longitude, latitude]) => [
          Math.min(west, longitude),
          Math.min(south, latitude),
          Math.max(east, longitude),
          Math.max(north, latitude)
        ],
        [Infinity, Infinity, -Infinity, -Infinity]
      )
      bounds = polygonBounds.every(Number.isFinite) ? [polygonBounds] : []
    }
  } else if (geometry.type === 'MultiPolygon') {
    bounds = geometry.coordinates.flatMap((coordinates) => {
      const polygon = { type: 'Polygon', coordinates } as const
      return getOpacityMaskGeometryBounds(polygon)
    })
  } else if (geometry.type === 'GeometryCollection') {
    bounds = geometry.geometries.flatMap(getOpacityMaskGeometryBounds)
  } else bounds = []

  opacityMaskGeometryBoundsCache.set(geometry, bounds)
  return bounds
}

export function isPositionInsideMaskBounds(
  position: [number, number],
  bounds: OpacityMaskGeometryBounds
): boolean {
  const [rawLongitude, latitude] = position
  const longitude = ((((rawLongitude + 180) % 360) + 360) % 360) - 180
  const [west, south, east, north] = bounds
  if (latitude < south || latitude > north) return false
  if (east - west >= 350) return true
  return longitude >= west && longitude <= east
}

function isPositionInRing(position: [number, number], ring: Position[]): boolean {
  if (ring.length < 3) return false
  const [positionLongitude, latitude] = position
  const unwrappedLongitudes: number[] = []
  ring.forEach(([rawLongitude], index) => {
    let longitude = rawLongitude
    const previousLongitude = unwrappedLongitudes[index - 1]
    if (previousLongitude !== undefined) {
      while (longitude - previousLongitude > 180) longitude -= 360
      while (longitude - previousLongitude < -180) longitude += 360
    }
    unwrappedLongitudes.push(longitude)
  })
  const referenceLongitude = unwrappedLongitudes[0]
  let longitude = positionLongitude
  while (longitude - referenceLongitude > 180) longitude -= 360
  while (longitude - referenceLongitude < -180) longitude += 360
  let inside = false

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [, ringLatitude] = ring[index]
    const [, previousLatitude] = ring[previous]
    const currentLongitude = unwrappedLongitudes[index]
    let previousLongitude = unwrappedLongitudes[previous]
    while (previousLongitude - currentLongitude > 180) previousLongitude -= 360
    while (previousLongitude - currentLongitude < -180) previousLongitude += 360

    const crossesLatitude = ringLatitude > latitude !== previousLatitude > latitude
    const intersectionLongitude =
      ((previousLongitude - currentLongitude) * (latitude - ringLatitude)) /
        (previousLatitude - ringLatitude) +
      currentLongitude
    if (crossesLatitude && longitude < intersectionLongitude) inside = !inside
  }

  return inside
}

function isPositionInPolygon(position: [number, number], rings: Position[][]): boolean {
  return (
    rings.length > 0 &&
    isPositionInRing(position, rings[0]) &&
    !rings.slice(1).some((ring) => isPositionInRing(position, ring))
  )
}

export function isPositionInsideMaskGeometry(
  geometry: Geometry,
  position: [number, number]
): boolean {
  if (geometry.type === 'Polygon') return isPositionInPolygon(position, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => isPositionInPolygon(position, polygon))
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.some((item) => isPositionInsideMaskGeometry(item, position))
  }
  return false
}

export type RasterOpacityMask = {
  geometry: Geometry
  opacity: number
}

function drawMaskGeometryOnTexture(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  width: number,
  height: number
): void {
  const drawPolygon = (rings: Position[][]): void => {
    for (const ring of rings) {
      ring.forEach(([longitude, latitude], index) => {
        const clampedLatitude = Math.max(-85.0511287798066, Math.min(85.0511287798066, latitude))
        const radians = (clampedLatitude * Math.PI) / 180
        const x = ((longitude + 180) / 360) * width
        const y =
          (0.5 - Math.log((1 + Math.sin(radians)) / (1 - Math.sin(radians))) / (4 * Math.PI)) *
          height
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.closePath()
    }
  }

  if (geometry.type === 'Polygon') {
    context.beginPath()
    drawPolygon(geometry.coordinates)
    context.fill('evenodd')
  } else if (geometry.type === 'MultiPolygon') {
    context.beginPath()
    geometry.coordinates.forEach(drawPolygon)
    context.fill('evenodd')
  } else if (geometry.type === 'GeometryCollection') {
    context.beginPath()
    const append = (item: Geometry): void => {
      if (item.type === 'Polygon') drawPolygon(item.coordinates)
      else if (item.type === 'MultiPolygon') item.coordinates.forEach(drawPolygon)
      else if (item.type === 'GeometryCollection') item.geometries.forEach(append)
    }
    geometry.geometries.forEach(append)
    context.fill('evenodd')
  }
}

export type MapTextureAssetKey =
  | 'earth-day-mercator'
  | 'earth-night-mercator'
  | 'earth-clouds-mercator'
  | 'earth-topography-mercator'

const maskedTextureSourceCache = new globalThis.Map<string, Promise<HTMLImageElement>>()
const MAX_CACHED_MASK_TEXTURES = 2
export const PREVIEW_MASKED_TEXTURE_DIMENSION = 1024
export const MAX_MASKED_TEXTURE_DIMENSION = 4096

async function loadMaskedTextureSource(
  sourceUrl: string,
  assetKey: MapTextureAssetKey
): Promise<HTMLImageElement> {
  const cacheKey = window.location.protocol === 'file:' ? assetKey : sourceUrl
  const cached = maskedTextureSourceCache.get(cacheKey)
  if (cached) return cached

  const imagePromise = (async (): Promise<HTMLImageElement> => {
    let imageUrl = sourceUrl
    let objectUrl: string | null = null
    if (window.location.protocol === 'file:') {
      const bytes = await window.api.readMapTexture(assetKey)
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer
      objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: 'image/jpeg' }))
      imageUrl = objectUrl
    }

    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Impossible de charger la texture de la carte'))
        image.src = imageUrl
      })
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  })()

  maskedTextureSourceCache.set(cacheKey, imagePromise)
  while (maskedTextureSourceCache.size > MAX_CACHED_MASK_TEXTURES) {
    const oldestKey = maskedTextureSourceCache.keys().next().value
    if (oldestKey === undefined) break
    maskedTextureSourceCache.delete(oldestKey)
  }

  try {
    return await imagePromise
  } catch (error) {
    if (maskedTextureSourceCache.get(cacheKey) === imagePromise) {
      maskedTextureSourceCache.delete(cacheKey)
    }
    throw error
  }
}

export async function createMaskedTextureUrl(
  sourceUrl: string,
  assetKey: MapTextureAssetKey,
  masks: RasterOpacityMask[],
  maxDimension = MAX_MASKED_TEXTURE_DIMENSION,
  quality = 0.84
): Promise<string> {
  const image = await loadMaskedTextureSource(sourceUrl, assetKey)
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponible')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const mask of masks) {
    const removedOpacity = 1 - Math.max(0, Math.min(100, mask.opacity)) / 100
    if (removedOpacity <= 0) continue
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.globalAlpha = removedOpacity
    drawMaskGeometryOnTexture(context, mask.geometry, canvas.width, canvas.height)
    context.restore()
  }

  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Impossible de générer la texture masquée'))
          return
        }
        resolve(URL.createObjectURL(blob))
      },
      'image/webp',
      quality
    )
  })
}
