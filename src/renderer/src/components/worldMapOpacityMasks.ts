import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson'

import countryCatalog from '../data/quiz/countryCatalog.json'
import { getContinentIdForCountry } from '../data/quiz/countryContinents'
import type { MapOpacityMask } from '../data/geography/mapLayerManager'
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

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

function createCircleMaskGeometry(center: [number, number], radiusKm: number): Geometry {
  const steps = 72
  const angularDistance = Math.max(1, radiusKm) / 6371
  const centerLatitude = (center[1] * Math.PI) / 180
  const centerLongitude = (center[0] * Math.PI) / 180
  const ring: Position[] = []

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (index / steps) * Math.PI * 2
    const latitude = Math.asin(
      Math.sin(centerLatitude) * Math.cos(angularDistance) +
        Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing)
    )
    const longitude =
      centerLongitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
        Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(latitude)
      )
    ring.push([wrapLongitude((longitude * 180) / Math.PI), (latitude * 180) / Math.PI])
  }

  return { type: 'Polygon', coordinates: [ring] }
}

function createRectangleMaskGeometry(
  center: [number, number],
  widthKm: number,
  heightKm: number
): Geometry {
  const latitudeScale = Math.max(0.05, Math.cos((center[1] * Math.PI) / 180))
  const halfWidth = widthKm / (2 * 111.32 * latitudeScale)
  const halfHeight = heightKm / (2 * 110.574)
  const west = wrapLongitude(center[0] - halfWidth)
  const east = wrapLongitude(center[0] + halfWidth)
  const south = Math.max(-85, center[1] - halfHeight)
  const north = Math.min(85, center[1] + halfHeight)

  if (west <= east) {
    return {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south]
        ]
      ]
    }
  }

  return {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [west, south],
          [180, south],
          [180, north],
          [west, north],
          [west, south]
        ]
      ],
      [
        [
          [-180, south],
          [east, south],
          [east, north],
          [-180, north],
          [-180, south]
        ]
      ]
    ]
  }
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

export type OpacityMaskHandle = {
  kind: 'center' | 'radius' | 'width' | 'height'
  longitude: number
  latitude: number
}

export function getOpacityMaskHandles(mask: MapOpacityMask): OpacityMaskHandle[] {
  if (!mask.center || (mask.kind !== 'circle' && mask.kind !== 'rectangle')) return []
  const [longitude, latitude] = mask.center
  const longitudeScale = 111.32 * Math.max(0.15, Math.cos((latitude * Math.PI) / 180))
  if (mask.kind === 'circle') {
    return [
      { kind: 'center', longitude, latitude },
      {
        kind: 'radius',
        longitude: longitude + (mask.radiusKm ?? 500) / longitudeScale,
        latitude
      }
    ]
  }
  return [
    { kind: 'center', longitude, latitude },
    {
      kind: 'width',
      longitude: longitude + (mask.widthKm ?? 1000) / 2 / longitudeScale,
      latitude
    },
    {
      kind: 'height',
      longitude,
      latitude: Math.min(85, latitude + (mask.heightKm ?? 700) / 2 / 111.32)
    }
  ]
}

function getApproximateDistanceKm(first: [number, number], second: [number, number]): number {
  const latitude = (first[1] + second[1]) / 2
  const deltaLatitude = (second[1] - first[1]) * 111.32
  const deltaLongitude = (second[0] - first[0]) * 111.32 * Math.cos((latitude * Math.PI) / 180)
  return Math.hypot(deltaLatitude, deltaLongitude)
}

export function getOpacityMaskHandlePatch(
  mask: MapOpacityMask,
  handle: OpacityMaskHandle,
  position: [number, number]
): Partial<MapOpacityMask> | null {
  const [longitude, latitude] = position
  if (handle.kind === 'center') return { center: position }
  if (!mask.center) return null

  if (handle.kind === 'radius') {
    const radiusKm = Math.max(
      50,
      Math.round(getApproximateDistanceKm(mask.center, position) / 25) * 25
    )
    return { radiusKm }
  }
  if (handle.kind === 'width') {
    const longitudeScale = 111.32 * Math.max(0.15, Math.cos((mask.center[1] * Math.PI) / 180))
    const widthKm = Math.max(
      100,
      Math.round((Math.abs(longitude - mask.center[0]) * longitudeScale * 2) / 100) * 100
    )
    return { widthKm }
  }
  const heightKm = Math.max(
    100,
    Math.round((Math.abs(latitude - mask.center[1]) * 111.32 * 2) / 100) * 100
  )
  return { heightKm }
}
