
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CSSProperties, JSX, ReactNode } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre'
import { LngLat } from 'maplibre-gl'
import pointOnFeature from '@turf/point-on-feature'

import type {
  MapLayerMouseEvent,
  MapRef
} from 'react-map-gl/maplibre'

import type {
  Map as MapLibreMap,
  MapMouseEvent,
  CircleLayerSpecification,
  FillLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification
} from 'maplibre-gl'

import type {
  Feature,
  FeatureCollection,
  Geometry,
  Point,
  Position
} from 'geojson'

import {
  world110mMap,
  world50mMap,
  world10mMap,
  world10m
} from '../data/world'
import countryCatalog from '../data/quiz/countryCatalog.json'
import countryCapitals from '../data/quiz/countryCapitals.json'
import { getAcceptedCapitalNames, getLocalizedCapitalName } from '../data/quiz/capitalNames'
import { additionalMapFlagRegions } from '../data/quiz/additionalMapFlagRegions'
import { getFlagImageSource } from '../data/quiz/flagAssets'
import {
  getQuizRegionFocusBounds,
  type QuizRegion
} from '../data/quiz/countryContinents'
import {
  addFlagTerritoryProperties
} from '../data/quiz/mapFlagTerritories'
import type { MapProximityResult } from '../data/quiz/mapProximity'
import { MapFlagOverlay } from './MapFlagOverlay'
import { MapResourceOverlay } from './MapResourceOverlay'
import { getResourceIndustryFactsForMapFeature } from '../data/geography/resources'
import { getExplorationDetails } from '../data/geography/exploration'
import { fullMapLayerDensities, type MapLayerDensities } from '../data/geography/mapLayerDensity'
import earthDayTexture from '../assets/map-layers/earth-day-mercator.jpg'
import earthNightTexture from '../assets/map-layers/earth-night-mercator.jpg'
import earthCloudTexture from '../assets/map-layers/earth-clouds-mercator.jpg'
import {
  GLOBE_TRANSITION_END_ZOOM,
  GLOBE_TRANSITION_START_ZOOM,
  isGlobeLabelVisible
} from './mapProjectionUtils'
import { useLanguage } from '../data/i18n'
import { useSkin } from '../data/skin'

import {
  getEntityDisplayName,
  getEntityById,
  getRelatedEntityIds
} from '../data/geography/registry'
import { geographicEntities } from '../data/geography/entities'
import riverData from '../data/geography/physical/rivers.json'
import riverLabelData from '../data/geography/physical/riverLabels.json'
import mountainPeakData from '../data/geography/physical/mountainPeaks.json'
import {
  mountainRanges,
  mountainRangeHighPoints,
  type MountainRangeRecord
} from '../data/geography/physical/mountainRanges'

type RiverLineRecord = {
  properties: { name?: string; nameEn?: string; nameEs?: string }
  geometry:
    | { type: 'LineString'; coordinates: Position[] }
    | { type: 'MultiLineString'; coordinates: Position[][] }
}

function normalizePhysicalName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}

const riverCoordinatesByName = (() => {
  const byName = new globalThis.Map<string, Position[][]>()
  for (const feature of riverData.features as unknown as RiverLineRecord[]) {
    const paths = feature.geometry.type === 'LineString'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates
    for (const rawName of [feature.properties.name, feature.properties.nameEn, feature.properties.nameEs]) {
      if (!rawName) continue
      const key = normalizePhysicalName(rawName)
      const current = byName.get(key) ?? []
      current.push(...paths)
      byName.set(key, current)
    }
  }
  return byName
})()

function getRiverLabelCoordinate(
  map: MapLibreMap,
  name: string,
  fallback: [number, number]
): [number, number] {
  const canvas = map.getCanvas()
  const original = map.project(fallback)
  const margin = 56
  if (
    original.x >= margin && original.x <= canvas.clientWidth - margin &&
    original.y >= margin && original.y <= canvas.clientHeight - margin
  ) return fallback

  const paths = riverCoordinatesByName.get(normalizePhysicalName(name)) ?? []
  const targetX = Math.max(margin, Math.min(canvas.clientWidth - margin, original.x))
  const targetY = Math.max(margin, Math.min(canvas.clientHeight - margin, original.y))
  let nearest: { coordinate: [number, number]; distance: number } | null = null
  for (const path of paths) {
    const stride = Math.max(1, Math.floor(path.length / 180))
    for (let index = 0; index < path.length; index += stride) {
      const coordinate = path[index]
      const point = map.project([coordinate[0], coordinate[1]])
      if (
        point.x < margin || point.x > canvas.clientWidth - margin ||
        point.y < margin || point.y > canvas.clientHeight - margin
      ) continue
      const distance = Math.hypot(point.x - targetX, point.y - targetY)
      if (!nearest || distance < nearest.distance) {
        nearest = { coordinate: [coordinate[0], coordinate[1]], distance }
      }
    }
  }
  return nearest?.coordinate ?? fallback
}

import 'maplibre-gl/dist/maplibre-gl.css'

type WorldMapProps = {
  showBorders: boolean
  showLabels: boolean
  globeMode?: boolean
  onToggleGlobeMode: () => void
  showFlagTerritories?: boolean
  showResources?: boolean
  showRivers?: boolean
  showMountains?: boolean
  showSummits?: boolean
  layerDensities?: Partial<MapLayerDensities>
  selectedAlpha2s?: string[]
  territorySelectionMode?: boolean
  drawingStrokes?: [number, number][][]
  drawingTool?: 'draw' | 'erase' | 'pan' | null
  onDrawingStrokesChange?: (strokes: [number, number][][]) => void
  realLayer?: 'day' | 'night' | 'clouds' | null
  showSelectionFeedback?: boolean
  showWrongAnswerFeedback?: boolean
  quizTargetFeatureId?: string | number | null
  quizBaseRegion?: QuizRegion | null
  quizTargetMaxZoom?: number
  quizTargetViewKey?: string
  quizRevealCard?: ReactNode
  showQuizRevealCard?: boolean
  focusEntityRequest?: { entityId: string; sequence: number } | null
  interactionResetKey?: string | number
  onCompareCountries?: (alpha2s: string[]) => void
  perspectiveComparisonPortal?: HTMLElement | null
  countryAccuracyByAlpha2?: Record<string, {
    answered: number
    correct: number
    pointsEarned?: number
    pointsPossible?: number
  }>
  onCountryDeselected?: () => void
  onMapClick?: (position: [number, number]) => MapProximityResult | null
  onCountrySelected?: (
  sourceFeatureId: string | number,
  name: string,
  entityId: string | null
) => void | boolean
}

const world110mFlagMap = addFlagTerritoryProperties(world110mMap)
const world50mFlagMap = addFlagTerritoryProperties(world50mMap)
const world10mFlagMap = addFlagTerritoryProperties(world10mMap)

const mapStyle = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: {
        'background-color': '#101820'
      }
    }
  ]
}

const earthTextureCoordinates: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, 85.0511287798066],
  [180, 85.0511287798066],
  [180, -85.0511287798066],
  [-180, -85.0511287798066]
]

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
  sourceFeatureId?: string | number | null
}

type WorkerResponse = {
  type: 'ready' | 'labels'
  requestId?: number
  labels?: FeatureCollection<Point, LabelProperties>
}

type WrongAnswerTarget = {
  sourceFeatureId: string | number
  entityId: string | null
  id: number
  interactionResetKey: string | number | undefined
}

const wrongAnswerFillLayerIds = [
  'countries-wrong-answer-110m',
  'countries-wrong-answer-50m',
  'countries-wrong-answer-10m'
] as const

type LabelUpdateRequest = {
  type: 'update'
  bbox: [number, number, number, number]
  zoom: number
  requestId: number
}

type SearchableCountry = {
  kind: 'country'
  sourceFeatureId: string | number
  sourceName: string
  displayName: string
  alpha2: string | null
  entityId: string | null
  geometry: Geometry
}

type SearchableCapital = {
  kind: 'capital'
  country: SearchableCountry
  displayName: string
  searchNames: string[]
}

type SearchableMapResult = SearchableCountry | SearchableCapital

type MapInteractionState = {
  resetKey: string | number | undefined
  selectedEntityIds: string[]
  selectedSourceFeatureId: string | number | null
  searchIsOpen: boolean
  searchQuery: string
  selectionSource: 'map' | 'search' | null
  selectedSearchKind?: 'country' | 'capital' | null
}

type PerspectiveDrag = {
  geometry: Geometry
  center: { x: number; y: number }
  originLatitude: number
  startPointer: { x: number; y: number }
  pointer: { x: number; y: number }
  name: string
  sourceFeatureId: string | number
  entityId: string | null
  areaKm2: number | null
}

type PerspectiveOverlap = {
  name: string | null
  areaKm2: number | null
}

type ComparisonMapSelection = {
  alpha2: string
  sourceFeatureId: string | number
  entityId: string | null
  name: string
}

type PhysicalMapMarker = {
  id: string
  longitude: number
  latitude: number
  kind: 'river' | 'mountain' | 'range'
  name: string
  detail?: string
  rank: number
  tooltipAlignment?: 'left' | 'center' | 'right'
  tooltipBelow?: boolean
  rangeInfo?: {
    summitCount: number
    highestPeakName: string | null
    highestElevationMeters: number | null
    lengthKm: number | null
    landscape: string
    attendance: string
    hiking: string
    mountaineering: string
  }
}

type SelectedPhysicalFeature = {
  marker: PhysicalMapMarker
  territoryName: string | null
  popupSide: 'left' | 'right'
  popupVertical: 'top' | 'center' | 'bottom'
}

type PhysicalPointFeature = {
  name: string
  nameEn: string
  nameEs: string
  rank: number
  elevation?: number
  coordinates?: [number, number]
  geometry?: { type: 'Point'; coordinates: [number, number] }
}

type MountainPeakMapFeature = {
  properties: PhysicalPointFeature
  geometry: { coordinates: [number, number] }
}

const majorRiverFilter: FilterSpecification = ['<=', ['get', 'rank'], 3]
const countryFillLayerIds = [
  'countries-fill-110m',
  'countries-fill-50m',
  'countries-fill-10m'
]
type InteractiveCountryFeature = NonNullable<MapLayerMouseEvent['features']>[number]

type NearbyFeatureHit = {
  distance: number
  isTinyTerritory: boolean
}

function isCountryFillFeature(feature: InteractiveCountryFeature): boolean {
  const sourceFeatureId = feature.properties?.sourceId
  // Ignore map fragments without a country ID; the app cannot select those.
  return (
    feature.layer.id.startsWith('countries-fill-') &&
    (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
    (typeof sourceFeatureId === 'string' || typeof sourceFeatureId === 'number')
  )
}

function distanceToScreenSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
): number {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  const fraction = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared))
  return Math.hypot(point.x - (start.x + fraction * deltaX), point.y - (start.y + fraction * deltaY))
}

function isPointInsideScreenRing(
  point: { x: number; y: number },
  ring: Array<{ x: number; y: number }>
): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const first = ring[index]
    const second = ring[previous]
    if (!first || !second) continue
    const crossesRay = (first.y > point.y) !== (second.y > point.y)
    if (crossesRay && point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x) {
      inside = !inside
    }
  }
  return inside
}

function getTinyTerritoryHitRadius(zoom: number): number {
  // The pointer halo remains generous at overview scales and tightens as the map zooms in.
  const zoomProgress = Math.max(0, Math.min(1, (zoom - 3) / 5))
  return 20 - zoomProgress * 5
}

function getNearbyFeatureHit(
  map: MapLibreMap,
  geometry: Geometry,
  point: { x: number; y: number }
): NearbyFeatureHit | null {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  const tinyTerritoryHitRadius = getTinyTerritoryHitRadius(map.getZoom())
  let nearestHit: NearbyFeatureHit | null = null
  let nearestTinyTerritoryHit: NearbyFeatureHit | null = null

  for (const polygon of polygons) {
    const projectedRings = polygon.map((ring) => ring.map((coordinate) =>
      map.project([coordinate[0], coordinate[1]])
    ).filter((projectedPoint) => Number.isFinite(projectedPoint.x + projectedPoint.y)))
    const outerRing = projectedRings[0]
    if (!outerRing || outerRing.length < 3) continue

    let west = Infinity
    let east = -Infinity
    let north = Infinity
    let south = -Infinity
    for (const vertex of outerRing) {
      west = Math.min(west, vertex.x)
      east = Math.max(east, vertex.x)
      north = Math.min(north, vertex.y)
      south = Math.max(south, vertex.y)
    }

    const polygonWidth = Math.max(0, east - west)
    const polygonHeight = Math.max(0, south - north)
    const effectiveSize = Math.sqrt(polygonWidth * polygonHeight)
    const insideOuterRing = isPointInsideScreenRing(point, outerRing)
    const insideHole = projectedRings.slice(1).some((ring) => isPointInsideScreenRing(point, ring))
    let distance = insideOuterRing && !insideHole ? 0 : Number.POSITIVE_INFINITY

    if (distance !== 0) {
      for (const ring of projectedRings) {
        for (let index = 0; index < ring.length; index += 1) {
          const start = ring[index]
          const end = ring[(index + 1) % ring.length]
          if (!start || !end) continue
          distance = Math.min(distance, distanceToScreenSegment(point, start, end))
        }
      }
    }

    if (effectiveSize <= 18) {
      // A target may extend over neighboring land or water when the pointer halo
      // touches the territory's visible outline.
      const tinyTerritoryHitDistance = distance
      if (
        distance <= tinyTerritoryHitRadius &&
        (!nearestTinyTerritoryHit || tinyTerritoryHitDistance < nearestTinyTerritoryHit.distance)
      ) {
        nearestTinyTerritoryHit = {
          distance: tinyTerritoryHitDistance,
          isTinyTerritory: true
        }
      }
      continue
    }

    // Keep ordinary country edges more precise than the expanded island targets.
    const hitRadius = effectiveSize <= 38 ? 18 : 6
    if (distance <= hitRadius && (!nearestHit || distance < nearestHit.distance)) {
      nearestHit = { distance, isTinyTerritory: false }
    }
  }

  return nearestTinyTerritoryHit ?? nearestHit
}

function getCountryFeatureAtPoint(
  map: MapLibreMap,
  point: { x: number; y: number },
  eventFeatures?: InteractiveCountryFeature[]
): InteractiveCountryFeature | undefined {
  const directFeature = eventFeatures?.find(isCountryFillFeature)
  const layers = countryFillLayerIds.filter((layerId) => map.getLayer(layerId))
  if (!layers.length) return directFeature

  const searchRadius = getTinyTerritoryHitRadius(map.getZoom())
  const geographicPointerSearch = map.getZoom() < 2
    ? getGeographicPointerSearch(map, point, searchRadius)
    : null
  const nearbyLowZoomTerritories = map.getZoom() < 2
    ? lowZoomFallbackCountryFeatures
      .filter(({ bounds }) => geographicPointerSearch && isGeographicBoundsNearPointer(geographicPointerSearch, bounds))
      .map(({ feature }) => feature)
    : []
  const candidates = [
    ...(directFeature ? [directFeature] : []),
    ...map.queryRenderedFeatures(
      [
        [point.x - searchRadius, point.y - searchRadius],
        [point.x + searchRadius, point.y + searchRadius]
      ],
      { layers }
    ),
    ...nearbyLowZoomTerritories
  ]
  let nearest: { feature: InteractiveCountryFeature; distance: number } | null = null
  let nearestTinyTerritory: { feature: InteractiveCountryFeature; distance: number } | null = null
  for (const candidate of candidates) {
    if (!isCountryFillFeature(candidate as InteractiveCountryFeature)) continue
    const feature = candidate as InteractiveCountryFeature
    const hit = getNearbyFeatureHit(map, feature.geometry, point)
    if (!hit) continue
    if (hit.isTinyTerritory) {
      if (!nearestTinyTerritory || hit.distance < nearestTinyTerritory.distance) {
        nearestTinyTerritory = { feature, distance: hit.distance }
      }
    } else if (!nearest || hit.distance < nearest.distance) {
      nearest = { feature, distance: hit.distance }
    }
  }
  // An expanded tiny-territory target takes priority over the large fill beneath it.
  // This makes a deliberate pointer placement on a small island/selectable enclave win.
  return nearestTinyTerritory?.feature ?? directFeature ?? nearest?.feature
}

const physicalRiverLayerIds = [
  'physical-rivers-major',
  'physical-rivers-regional',
  'physical-rivers-local'
]
const regionalRiverFilter: FilterSpecification = [
  'all',
  ['>', ['get', 'rank'], 3],
  ['<=', ['get', 'rank'], 6]
]
const localRiverFilter: FilterSpecification = ['>', ['get', 'rank'], 6]
const majorPeakFilter: FilterSpecification = ['<=', ['get', 'rank'], 3]
const regionalPeakFilter: FilterSpecification = [
  'all',
  ['>', ['get', 'rank'], 3],
  ['<=', ['get', 'rank'], 6]
]
const localPeakFilter: FilterSpecification = ['>', ['get', 'rank'], 6]

const frenchRegionNames = new Intl.DisplayNames(['fr'], { type: 'region' })
function normalizeSourceFeatureId(sourceFeatureId: string | number): string {
  const value = String(sourceFeatureId)
  return /^\d+$/.test(value) ? String(Number(value)) : value
}

const frenchCountryNameBySourceId = new globalThis.Map<string, string | undefined>([
  ...countryCatalog.map((country) => [
    normalizeSourceFeatureId(country.sourceFeatureId),
    frenchRegionNames.of(country.alpha2)
  ] as const),
  ...additionalMapFlagRegions.map((region) => [
    normalizeSourceFeatureId(region.sourceFeatureId),
    frenchRegionNames.of(region.alpha2)
  ] as const)
])
const alpha2BySourceId = new globalThis.Map<string, string>([
  ...countryCatalog.map((country) => [
    normalizeSourceFeatureId(country.sourceFeatureId),
    country.alpha2
  ] as const),
  ...additionalMapFlagRegions.map((region) => [
    normalizeSourceFeatureId(region.sourceFeatureId),
    region.alpha2
  ] as const)
])

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim()
}

function getGeometryBounds(geometry: Geometry): [number, number, number, number] | null {
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

type LowZoomFallbackCountry = {
  feature: InteractiveCountryFeature
  bounds: [number, number, number, number]
}

const world110mSourceIds = new Set(
  world110mFlagMap.features
    .map((feature) => feature.properties?.sourceId)
    .filter((sourceId): sourceId is string | number =>
      typeof sourceId === 'string' || typeof sourceId === 'number'
    )
    .map(normalizeSourceFeatureId)
)
const lowZoomFallbackCountryFeatures: LowZoomFallbackCountry[] = world50mFlagMap.features.flatMap((country) => {
  const polygons = country.geometry.type === 'Polygon'
    ? [country.geometry.coordinates]
    : country.geometry.type === 'MultiPolygon'
      ? country.geometry.coordinates
      : []

  return polygons.flatMap((coordinates) => {
    const geometry: Geometry = { type: 'Polygon', coordinates }
    const bounds = getGeometryBounds(geometry)
    if (!bounds) return []
    return [{
      feature: {
        ...country,
        geometry,
        layer: { id: 'countries-fill-50m' }
      } as unknown as InteractiveCountryFeature,
      bounds
    }]
  })
})

const lowZoomMissingCountryMarkers: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: world50mFlagMap.features.flatMap((country) => {
    const sourceId = country.properties?.sourceId
    if (
      (typeof sourceId !== 'string' && typeof sourceId !== 'number') ||
      world110mSourceIds.has(normalizeSourceFeatureId(sourceId))
    ) return []

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
  return Math.abs((((first - second) + 540) % 360) - 180)
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
    getLongitudeDistance(boundsCenterLongitude, pointer.longitude) <= pointer.longitudeRadius + boundsHalfLongitude &&
    Math.abs(boundsCenterLatitude - pointer.latitude) <= pointer.latitudeRadius + boundsHalfLatitude
  )
}

function getPerspectiveGhostRings(
  geometry: Geometry,
  map: MapLibreMap,
  drag: PerspectiveDrag
): { x: number; y: number }[][] {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  const offsetX = drag.pointer.x - drag.startPointer.x
  const offsetY = drag.pointer.y - drag.startPointer.y
  const centerX = drag.center.x + offsetX
  const centerY = drag.center.y + offsetY
  const destinationLatitude = Math.max(
    -85.05,
    Math.min(85.05, map.unproject([centerX, centerY]).lat)
  )
  const originScale = Math.cos(drag.originLatitude * Math.PI / 180)
  const destinationScale = Math.cos(destinationLatitude * Math.PI / 180)
  // Keep the source's map distortion at the start; correct only for the latitude change.
  const scale = Math.max(0.12, Math.min(8, originScale / destinationScale))
  const rings: { x: number; y: number }[][] = []

  for (const polygon of polygons) {
    for (const ring of polygon) {
      const points = ring.map(([longitude, latitude]) => {
        const projected = map.project([longitude, latitude])
        return {
          x: centerX + (projected.x - drag.center.x) * scale,
          y: centerY + (projected.y - drag.center.y) * scale
        }
      })
      if (points.length >= 3) rings.push(points)
    }
  }

  return rings
}

function getPerspectiveGhostPath(
  geometry: Geometry,
  map: MapLibreMap,
  drag: PerspectiveDrag
): string {
  return getPerspectiveGhostRings(geometry, map, drag)
    .map((points) => `M ${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`)
    .join(' ')
}

function isPointInsidePerspectiveGhost(
  point: { x: number; y: number },
  rings: { x: number; y: number }[][]
): boolean {
  let inside = false
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const currentPoint = ring[index]
      const previousPoint = ring[previous]
      const crossesRay = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      if (
        crossesRay &&
        point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) + currentPoint.x
      ) {
        inside = !inside
      }
    }
  }
  return inside
}

function getPerspectiveAreaLabel(areaKm2: number | null, locale: string): string {
  if (areaKm2 === null || !Number.isFinite(areaKm2)) return 'ND'
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(areaKm2)} km²`
}

const searchableCountries: SearchableCountry[] = world10mMap.features.flatMap((feature) => {
  const properties = feature.properties as Record<string, unknown> | null
  const sourceName = typeof properties?.sourceName === 'string' ? properties.sourceName : ''
  const sourceFeatureId = properties?.sourceId
  const entityId = typeof properties?.entityId === 'string' ? properties.entityId : null
  const geometry = feature.geometry

  if (
    !sourceName ||
    (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') ||
    !geometry ||
    (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
  ) {
    return []
  }

  const sourceFeatureKey = normalizeSourceFeatureId(sourceFeatureId)
  const frenchName = frenchCountryNameBySourceId.get(sourceFeatureKey)
  const entity = entityId ? getEntityById(entityId) : undefined
  const entityAlpha2 = entity?.kind === 'territory'
    ? entity.flagAlpha2 ?? getEntityById(entity.sovereignEntityId ?? '')?.alpha2
    : entity?.alpha2

  return [{
    kind: 'country',
    sourceFeatureId,
    sourceName,
    displayName: entityId
      ? getEntityDisplayName(entityId) ?? sourceName
      : frenchName ?? sourceName,
    alpha2: entityAlpha2 ?? alpha2BySourceId.get(sourceFeatureKey) ?? null,
    entityId,
    geometry
  }]
})

const capitalRecordsBySourceId = new globalThis.Map(
  (countryCapitals as { sourceFeatureId: number; capitalName: string }[])
    .map((record) => [String(record.sourceFeatureId), record])
)

const searchableCapitalRecords: SearchableCapital[] = searchableCountries.flatMap((country) => {
  const capital = capitalRecordsBySourceId.get(String(country.sourceFeatureId))
  if (!capital) return []

  return [{
    kind: 'capital',
    country,
    displayName: capital.capitalName,
    searchNames: getAcceptedCapitalNames(country.alpha2 ?? '', capital.capitalName)
  }]
})

function haveSameLabels(
  previous: FeatureCollection<Point, LabelProperties>,
  next: FeatureCollection<Point, LabelProperties>
): boolean {
  if (previous.features.length !== next.features.length) return false

  return previous.features.every((label, index) => {
    const nextLabel = next.features[index]
    const [longitude, latitude] = label.geometry.coordinates
    const [nextLongitude, nextLatitude] = nextLabel.geometry.coordinates

    return (
      label.properties.name === nextLabel.properties.name &&
      label.properties.entityId === nextLabel.properties.entityId &&
      label.properties.priority === nextLabel.properties.priority &&
      Math.abs(longitude - nextLongitude) < 0.000001 &&
      Math.abs(latitude - nextLatitude) < 0.000001
    )
  })
}

function WorldMap({
  showBorders,
  showLabels,
  globeMode = false,
  onToggleGlobeMode,
  showFlagTerritories = false,
  showResources = false,
  showRivers = false,
  showMountains = false,
  showSummits = false,
  layerDensities,
  selectedAlpha2s = [],
  territorySelectionMode = false,
  drawingStrokes = [],
  drawingTool = null,
  onDrawingStrokesChange,
  realLayer = null,
  showSelectionFeedback = false,
  showWrongAnswerFeedback = false,
  quizTargetFeatureId = null,
  quizBaseRegion = null,
  quizTargetMaxZoom,
  quizTargetViewKey,
  quizRevealCard,
  showQuizRevealCard = false,
  focusEntityRequest,
  interactionResetKey,
  onCompareCountries,
  perspectiveComparisonPortal,
  countryAccuracyByAlpha2,
  onCountryDeselected,
  onMapClick,
  onCountrySelected
}: WorldMapProps): JSX.Element {
  const { language, t } = useLanguage()
  const { skin } = useSkin()
  const isMinimalSkin = skin === 'minimal'
  const isMatrixSkin = skin === 'matrix'
  const density = { ...fullMapLayerDensities, ...layerDensities }
  const mapBackgroundColor = realLayer === 'day'
    ? '#153a68'
    : realLayer === 'night' || realLayer === 'clouds'
      ? '#050713'
      : isMinimalSkin
        ? '#f2eee5'
        : isMatrixSkin
          ? 'rgba(1, 8, 3, 0.38)'
          : '#101820'
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null)
  const [mapZoom, setMapZoom] = useState(1.5)
  const [perspectiveCorrectionEnabled, setPerspectiveCorrectionEnabled] = useState(false)
  const [perspectiveDrag, setPerspectiveDrag] = useState<PerspectiveDrag | null>(null)
  const [perspectiveOverlap, setPerspectiveOverlap] = useState<PerspectiveOverlap | null>(null)
  const [perspectiveAdjusting, setPerspectiveAdjusting] = useState(false)
  const perspectiveDragRef = useRef<PerspectiveDrag | null>(null)
  const drawingPointerActiveRef = useRef(false)
  const [comparisonSelectedCountries, setComparisonSelectedCountries] = useState<ComparisonMapSelection[]>([])
  const [selectedPhysicalFeature, setSelectedPhysicalFeature] = useState<SelectedPhysicalFeature | null>(null)
  const [pointerCoordinates, setPointerCoordinates] = useState<{
    longitude: number
    latitude: number
  } | null>(null)
  const [mapViewRevision, setMapViewRevision] = useState(0)
  const [resourceOverlayRevision, setResourceOverlayRevision] = useState(0)
  const [flagProjectionRevision, setFlagProjectionRevision] = useState(0)
  const [savedQuizTargetView, setSavedQuizTargetView] = useState<{
    key: string
    center: [number, number]
    zoom: number
  } | null>(null)
  const savedQuizTargetViewRef = useRef<typeof savedQuizTargetView>(null)
  const [globeLabelRevision, setGlobeLabelRevision] = useState(0)
  const flagOverlayRafRef = useRef<number | null>(null)
  const lastGlobeOverlayUpdateRef = useRef(0)
  const [clickMarker, setClickMarker] = useState<{
    longitude: number
    latitude: number
    id: number
    interactionResetKey: string | number | undefined
  } | null>(null)
  const [proximityMarker, setProximityMarker] = useState<{
    longitude: number
    latitude: number
    proximity: MapProximityResult
    id: number
    interactionResetKey: string | number | undefined
  } | null>(null)
  const [selectionBoundaryResetKey, setSelectionBoundaryResetKey] = useState<
    string | number | undefined | null
  >(null)
  const [wrongAnswerTarget, setWrongAnswerTarget] = useState<WrongAnswerTarget | null>(null)
  const clickMarkerIdRef = useRef(0)
  const proximityMarkerIdRef = useRef(0)
  const proximityMarkerTimeoutRef = useRef<number | null>(null)
  const wrongAnswerAnimationFrameRef = useRef<number | null>(null)
  const wrongAnswerIdRef = useRef(0)
  const [interactionState, setInteractionState] = useState<MapInteractionState>(() => ({
    resetKey: interactionResetKey,
    selectedEntityIds: [],
    selectedSourceFeatureId: null,
    searchIsOpen: false,
    searchQuery: '',
    selectionSource: null
  }))
  const [hoveredCountry, setHoveredCountry] = useState<{
    entityId: string | null
    sourceFeatureId: string | number
  } | null>(null)
  const activeInteractionState = interactionState.resetKey === interactionResetKey
    ? interactionState
    : {
        resetKey: interactionResetKey,
        selectedEntityIds: [],
        selectedSourceFeatureId: null,
        searchIsOpen: false,
        searchQuery: '',
        selectionSource: null
      }
  const selectedEntityIds = activeInteractionState.selectedEntityIds
  const selectedSourceFeatureId = activeInteractionState.selectedSourceFeatureId
  const searchIsOpen = activeInteractionState.searchIsOpen
  const searchQuery = activeInteractionState.searchQuery
  const comparisonSelectedEntityIds = useMemo(
    () => comparisonSelectedCountries.flatMap((country) => country.entityId ? [country.entityId] : []),
    [comparisonSelectedCountries]
  )
  const comparisonSelectedSourceFeatureIds = useMemo(
    () => comparisonSelectedCountries.map((country) => country.sourceFeatureId),
    [comparisonSelectedCountries]
  )
  const selectedAlpha2SourceFeatureIds = useMemo(
    () => countryCatalog
      .filter((country) => selectedAlpha2s.includes(country.alpha2))
      .map((country) => country.sourceFeatureId),
    [selectedAlpha2s]
  )
  const mapOverlaySelectedEntityIds = useMemo(
    () => [...new Set([...selectedEntityIds, ...comparisonSelectedEntityIds])],
    [comparisonSelectedEntityIds, selectedEntityIds]
  )

  useEffect(() => {
    if (!mapInstance?.getLayer('background')) return
    mapInstance.setPaintProperty(
      'background',
      'background-color',
      mapBackgroundColor
    )
  }, [mapBackgroundColor, mapInstance])

  useEffect(() => {
    if (!mapInstance) {
      setPointerCoordinates(null)
      return
    }

    let latestPosition: { longitude: number; latitude: number } | null = null
    let frame: number | null = null
    const updatePosition = (event: MapMouseEvent): void => {
      latestPosition = {
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat
      }
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        const next = latestPosition
        if (!next) return
        setPointerCoordinates((current) =>
          current &&
          current.longitude.toFixed(4) === next.longitude.toFixed(4) &&
          current.latitude.toFixed(4) === next.latitude.toFixed(4)
            ? current
            : next
        )
      })
    }
    const clearPosition = (): void => {
      latestPosition = null
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
        frame = null
      }
      setPointerCoordinates(null)
    }

    mapInstance.on('mousemove', updatePosition)
    mapInstance.on('mouseout', clearPosition)
    return () => {
      mapInstance.off('mousemove', updatePosition)
      mapInstance.off('mouseout', clearPosition)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [mapInstance])

  useEffect(() => {
    if (!mapInstance || !perspectiveCorrectionEnabled) return

    let latestPointer: { x: number; y: number } | null = null
    let frame: number | null = null
    const movePointer = (event: PointerEvent): void => {
      if (!perspectiveDragRef.current) return
      const bounds = mapInstance.getCanvasContainer().getBoundingClientRect()
      latestPointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      }
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        const pointer = latestPointer
        if (!pointer || !perspectiveDragRef.current) return
        const next = { ...perspectiveDragRef.current, pointer }
        perspectiveDragRef.current = next
        setPerspectiveDrag(next)
      })
    }
    const endDrag = (): void => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
        frame = null
      }
      latestPointer = null
      perspectiveDragRef.current = null
      setPerspectiveDrag(null)
      setPerspectiveOverlap(null)
      setPerspectiveAdjusting(false)
    }

    window.addEventListener('pointermove', movePointer)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', movePointer)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [mapInstance, perspectiveCorrectionEnabled])

  const isPerspectiveDragging = perspectiveDrag !== null

  useEffect(() => {
    if (!mapInstance || !perspectiveCorrectionEnabled || !isPerspectiveDragging) {
      setPerspectiveOverlap(null)
      return
    }

    const layers = countryFillLayerIds.filter((layerId) => mapInstance.getLayer(layerId))
    let disposed = false
    const updateOverlap = (): void => {
      const drag = perspectiveDragRef.current
      if (disposed || !drag || !layers.length) return

      const rings = getPerspectiveGhostRings(drag.geometry, mapInstance, drag)
      let minX = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (const ring of rings) {
        for (const point of ring) {
          minX = Math.min(minX, point.x)
          maxX = Math.max(maxX, point.x)
          minY = Math.min(minY, point.y)
          maxY = Math.max(maxY, point.y)
        }
      }
      if (!Number.isFinite(minX + maxX + minY + maxY)) return
      const canvas = mapInstance.getCanvas()
      minX = Math.max(0, minX)
      maxX = Math.min(canvas.clientWidth, maxX)
      minY = Math.max(0, minY)
      maxY = Math.min(canvas.clientHeight, maxY)
      if (maxX <= minX || maxY <= minY) return

      const overlapCounts = new globalThis.Map<string, {
        feature: InteractiveCountryFeature
        count: number
      }>()
      const gridSize = 7
      for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
          const point = {
            x: minX + ((column + 0.5) / gridSize) * (maxX - minX),
            y: minY + ((row + 0.5) / gridSize) * (maxY - minY)
          }
          if (!isPointInsidePerspectiveGhost(point, rings)) continue

          const feature = mapInstance.queryRenderedFeatures([point.x, point.y], { layers })
            .find((candidate) => isCountryFillFeature(candidate as InteractiveCountryFeature)) as
              InteractiveCountryFeature | undefined
          if (!feature) continue

          const sourceFeatureId = feature.properties?.sourceId
          if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') continue
          const entityId = typeof feature.properties?.entityId === 'string'
            ? feature.properties.entityId
            : null
          if (
            normalizeSourceFeatureId(sourceFeatureId) === normalizeSourceFeatureId(drag.sourceFeatureId) ||
            (drag.entityId !== null && entityId === drag.entityId)
          ) continue

          const key = `${entityId ?? ''}:${normalizeSourceFeatureId(sourceFeatureId)}`
          const current = overlapCounts.get(key)
          overlapCounts.set(key, { feature, count: (current?.count ?? 0) + 1 })
        }
      }

      let bestOverlap: { feature: InteractiveCountryFeature; count: number } | null = null
      for (const overlap of overlapCounts.values()) {
        if (!bestOverlap || overlap.count > bestOverlap.count) bestOverlap = overlap
      }

      let nextOverlap: PerspectiveOverlap
      if (!bestOverlap) {
        nextOverlap = { name: null, areaKm2: null }
      } else {
        const feature = bestOverlap.feature
        const sourceFeatureId = feature.properties?.sourceId as string | number
        const entityId = typeof feature.properties?.entityId === 'string'
          ? feature.properties.entityId
          : null
        const fallbackName = String(feature.properties?.name ?? feature.properties?.sourceName ?? '')
        const name = entityId ? getEntityDisplayName(entityId) : undefined
        const details = getExplorationDetails(sourceFeatureId, fallbackName, entityId)
        nextOverlap = {
          name: name ?? details.name ?? fallbackName,
          areaKm2: details.metrics?.areaKm2 ?? null
        }
      }

      setPerspectiveOverlap((current) =>
        current?.name === nextOverlap.name && current.areaKm2 === nextOverlap.areaKm2
          ? current
          : nextOverlap
      )
    }

    updateOverlap()
    const interval = window.setInterval(updateOverlap, 100)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [mapInstance, perspectiveCorrectionEnabled, isPerspectiveDragging])

  useEffect(() => {
    if (!globeMode) return
    perspectiveDragRef.current = null
    setPerspectiveDrag(null)
    setPerspectiveOverlap(null)
    setPerspectiveAdjusting(false)
    setPerspectiveCorrectionEnabled(false)
  }, [globeMode])

  const updateInteractionState = (updates: Partial<MapInteractionState>): void => {
    setInteractionState((current) => ({
      ...(current.resetKey === interactionResetKey
        ? current
        : {
            resetKey: interactionResetKey,
            selectedEntityIds: [],
            selectedSourceFeatureId: null,
            searchIsOpen: false,
            searchQuery: '',
            selectionSource: null
          }),
      ...updates,
      resetKey: interactionResetKey
    }))
  }

  const mapRef = useRef<MapRef>(null)

  useEffect(() => {
    if (!focusEntityRequest) return
    const map = mapRef.current?.getMap()
    if (!map) return

    const territory = world10mMap.features.find((feature) =>
      feature.properties?.entityId === focusEntityRequest.entityId
    )
    const bounds = territory?.geometry ? getGeometryBounds(territory.geometry) : null
    if (!bounds) return

    map.fitBounds(
      [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
      { padding: 56, maxZoom: 8, duration: 700 }
    )
  }, [focusEntityRequest])

  const workerRef = useRef<Worker | null>(null)
  const workerReadyRef = useRef(false)
  const workerBusyRef = useRef(false)
  const pendingLabelUpdateRef = useRef<LabelUpdateRequest | null>(null)
  const latestLabelRequestId = useRef(0)
  const globeLabelsRequestedRef = useRef(false)

  const [visibleLabels, setVisibleLabels] = useState<
    FeatureCollection<Point, LabelProperties>
  >({
    type: 'FeatureCollection',
    features: []
  })

  const scheduleFlagOverlayUpdate = useCallback((): void => {
    if (
      (!showFlagTerritories && !showResources && !showRivers && !showMountains && !showSummits) ||
      flagOverlayRafRef.current !== null
    ) return
    flagOverlayRafRef.current = window.requestAnimationFrame(() => {
      flagOverlayRafRef.current = null
      const map = mapRef.current?.getMap()
      if (!map) return
      setMapZoom(map.getZoom())
      setMapViewRevision((current) => current + 1)
    })
  }, [showFlagTerritories, showResources, showRivers, showMountains, showSummits])

  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current?.getMap()
    if (!map) return

    const updateFlagProjectionRevision = (): void => {
      map.off('render', updateFlagProjectionRevision)
      setFlagProjectionRevision((current) => current + 1)
    }
    map.on('render', updateFlagProjectionRevision)

    const projection = globeMode
      ? {
          type: [
            'interpolate',
            ['linear'],
            ['zoom'],
            GLOBE_TRANSITION_END_ZOOM,
            // MapLibre interpolates through vertical-perspective; `globe` here
            // is treated as an already-complete projection and causes a snap.
            'vertical-perspective',
            GLOBE_TRANSITION_START_ZOOM,
            'mercator'
          ]
        }
      : { type: 'mercator' }

    map.setProjection(projection as Parameters<MapLibreMap['setProjection']>[0])
    scheduleFlagOverlayUpdate()
    setResourceOverlayRevision((current) => current + 1)

    return () => {
      map.off('render', updateFlagProjectionRevision)
    }
  }, [globeMode, mapLoaded, scheduleFlagOverlayUpdate])

  useEffect(() => () => {
    if (flagOverlayRafRef.current !== null) {
      window.cancelAnimationFrame(flagOverlayRafRef.current)
    }
  }, [])

  useEffect(() => () => {
    if (proximityMarkerTimeoutRef.current !== null) {
      window.clearTimeout(proximityMarkerTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!showBorders) return
    const timeoutId = window.setTimeout(() => {
      setProximityMarker(null)
      setClickMarker(null)
      if (proximityMarkerTimeoutRef.current !== null) {
        window.clearTimeout(proximityMarkerTimeoutRef.current)
        proximityMarkerTimeoutRef.current = null
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [showBorders])

  const activeClickMarker = clickMarker?.interactionResetKey === interactionResetKey
    && showSelectionFeedback
    && !showBorders
    ? clickMarker
    : null
  const activeProximityMarker = !showBorders &&
    proximityMarker?.interactionResetKey === interactionResetKey
    ? proximityMarker
    : null
  const activeWrongAnswerTarget = showWrongAnswerFeedback &&
    wrongAnswerTarget?.interactionResetKey === interactionResetKey
    ? wrongAnswerTarget
    : null
  const selectionBoundaryOpacity = selectionBoundaryResetKey === interactionResetKey ? 1 : 0

  const wrongAnswerFeatureFilter = (activeWrongAnswerTarget
    ? activeWrongAnswerTarget.entityId
      ? ['==', ['get', 'entityId'], activeWrongAnswerTarget.entityId]
      : ['==', ['to-string', ['get', 'sourceId']], String(activeWrongAnswerTarget.sourceFeatureId)]
    : ['==', 1, 0]) as unknown as FilterSpecification

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!mapLoaded || !map) return

    const setWrongAnswerFrame = (opacity: number, translate: [number, number]): void => {
      for (const layerId of wrongAnswerFillLayerIds) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-opacity', opacity, { validate: false })
          map.setPaintProperty(layerId, 'fill-translate', translate, { validate: false })
        }
      }
    }

    const target = activeWrongAnswerTarget
    if (!target) {
      setWrongAnswerFrame(0, [0, 0])
      return
    }

    setWrongAnswerFrame(1, [0, 0])
    const startedAt = performance.now()
    const holdDuration = 55
    const totalDuration = 500
    const movementDuration = 270
    const animate = (now: number): void => {
      const elapsed = now - startedAt
      const opacity = elapsed <= holdDuration
        ? 1
        : Math.max(0, 1 - (elapsed - holdDuration) / (totalDuration - holdDuration))
      const movementElapsed = elapsed - holdDuration
      const movementProgress = Math.min(1, Math.max(0, movementElapsed / movementDuration))
      const movementEnvelope = 1 - movementProgress
      const horizontalNudge = isMinimalSkin
        ? Math.sin(movementProgress * Math.PI * 4) * movementEnvelope * 4
        : 0
      setWrongAnswerFrame(opacity, [horizontalNudge, 0])

      if (elapsed >= totalDuration) {
        wrongAnswerAnimationFrameRef.current = null
        setWrongAnswerTarget((current) => current?.id === target.id ? null : current)
        return
      }

      wrongAnswerAnimationFrameRef.current = window.requestAnimationFrame(animate)
    }

    wrongAnswerAnimationFrameRef.current = window.requestAnimationFrame(animate)
    return () => {
      if (wrongAnswerAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(wrongAnswerAnimationFrameRef.current)
        wrongAnswerAnimationFrameRef.current = null
      }
      setWrongAnswerFrame(0, [0, 0])
    }
  }, [activeWrongAnswerTarget?.id, isMinimalSkin, mapLoaded])

  useEffect(() => {
    scheduleFlagOverlayUpdate()
  }, [
    hoveredCountry,
    mapLoaded,
    scheduleFlagOverlayUpdate,
    selectedEntityIds,
    selectedSourceFeatureId,
    showBorders,
    showLabels,
    visibleLabels,
    quizTargetFeatureId,
    selectionBoundaryOpacity
  ])

  const searchableCapitals = useMemo(
    () => searchableCapitalRecords.map((capital) => ({
      ...capital,
      displayName: capital.country.alpha2
        ? getLocalizedCapitalName(
            capital.country.alpha2,
            capital.displayName,
            language
          )
        : capital.displayName
    })),
    [language]
  )

  const searchResults = useMemo<SearchableMapResult[]>(() => {
    const query = normalizeSearchText(searchQuery)
    if (!query) return []

    const matchingCountries = searchableCountries
      .filter((country) =>
        [country.displayName, country.sourceName].some((name) =>
          normalizeSearchText(name).startsWith(query)
        )
      )
    const matchingCapitals = searchableCapitals.filter((capital) =>
      capital.searchNames.some((name) => normalizeSearchText(name).startsWith(query)) ||
      normalizeSearchText(capital.displayName).startsWith(query)
    )

    return [...matchingCountries, ...matchingCapitals].sort((first, second) => {
      const nameOrder = first.displayName.localeCompare(second.displayName, language)
      if (nameOrder !== 0) return nameOrder
      if (first.kind === second.kind) return 0
      return first.kind === 'country' ? -1 : 1
    })
  }, [language, searchQuery, searchableCapitals])

  const selectedCapitalWasChosen =
    activeInteractionState.selectionSource === 'search' &&
    activeInteractionState.selectedSearchKind === 'capital'
  const selectedSearchCountry = searchIsOpen ||
    (showSelectionFeedback && activeInteractionState.selectionSource === 'map') ||
    selectedCapitalWasChosen
    ? null
    : searchableCountries.find((country) => country.displayName === searchQuery)

  const selectedSearchCapital = searchIsOpen ||
    !selectedCapitalWasChosen
    ? null
    : searchableCapitals.find((capital) =>
        capital.displayName === searchQuery && (
          String(capital.country.sourceFeatureId) ===
            String(activeInteractionState.selectedSourceFeatureId) ||
          (capital.country.entityId !== null &&
            activeInteractionState.selectedEntityIds.includes(capital.country.entityId))
        )
      ) ?? null

  const sendLabelUpdate = (request: LabelUpdateRequest): void => {
    const worker = workerRef.current
    if (!worker || !workerReadyRef.current) return

    workerBusyRef.current = true
    worker.postMessage(request)
  }

  const selectSearchResult = (result: SearchableMapResult): void => {
    const country = result.kind === 'capital' ? result.country : result
    const accepted = onCountrySelected?.(
      country.sourceFeatureId,
      country.displayName,
      country.entityId
    )
    if (accepted === false) return

    const entity = country.entityId ? getEntityById(country.entityId) : undefined
    const nextSelectedEntityIds = country.entityId
      ? entity?.kind === 'territory'
        ? [country.entityId]
        : getRelatedEntityIds(country.entityId)
      : []
    updateInteractionState({
      selectedEntityIds: nextSelectedEntityIds,
      selectedSourceFeatureId: nextSelectedEntityIds.length
        ? null
        : country.sourceFeatureId,
      searchIsOpen: false,
      searchQuery: result.displayName,
      selectionSource: 'search',
      selectedSearchKind: result.kind
    })

    if (showSelectionFeedback) setSelectionBoundaryResetKey(interactionResetKey)
    const bounds = getGeometryBounds(country.geometry)
    const map = mapRef.current?.getMap()
    if (bounds && map) {
      map.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        { padding: 56, maxZoom: 7, duration: 700 }
      )
    }
  }

  const updateVisibleLabels = (): void => {
    const map = mapRef.current
    const worker = workerRef.current

    if (!map || !worker || !workerReadyRef.current) return

    const mapInstance = map.getMap()
    const canvas = mapInstance.getCanvas()
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width <= 0 || height <= 0) return

    const zoom = mapInstance.getZoom()
    let bbox: [number, number, number, number]
    if (globeMode && zoom < GLOBE_TRANSITION_START_ZOOM) {
      // Screen-corner unprojection is not a reliable viewport on a sphere:
      // it can leave out countries on the visible hemisphere. Load all anchors
      // once, then let the globe projection show the ones facing the camera.
      bbox = [-180, -90, 180, 90]
    } else {
      // Keep label anchors far enough from the canvas edge for their text to fit.
      const horizontalInset = Math.min(60, width * 0.1)
      const verticalInset = Math.min(24, height * 0.08)
      const corners = [
        mapInstance.unproject([horizontalInset, verticalInset]),
        mapInstance.unproject([width - horizontalInset, verticalInset]),
        mapInstance.unproject([
          width - horizontalInset,
          height - verticalInset
        ]),
        mapInstance.unproject([horizontalInset, height - verticalInset])
      ]
      const longitudes = corners.map((corner) => corner.lng)
      const latitudes = corners.map((corner) => corner.lat)

      bbox = [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes)
      ]
    }
    const requestId = latestLabelRequestId.current + 1
    latestLabelRequestId.current = requestId

    const request: LabelUpdateRequest = {
      type: 'update',
      bbox,
      // Stable precision avoids recomputing every country label at each globe
      // zoom step; their geographic anchors do not change while the globe moves.
      zoom: globeMode && zoom < GLOBE_TRANSITION_START_ZOOM
        ? GLOBE_TRANSITION_END_ZOOM
        : zoom,
      requestId
    }

    if (workerBusyRef.current) {
      pendingLabelUpdateRef.current = request
      return
    }

    sendLabelUpdate(request)
  }

  const focusOnQuizTarget = useCallback((moveToTarget = true): void => {
    const map = mapRef.current?.getMap()
    if (!map) return

    if (quizTargetFeatureId === null) return

    const target = world10m.features.find((feature) => {
      const properties = feature.properties as Record<string, unknown> | null
      const sourceFeatureId = properties?.sourceId
      return (
        (typeof sourceFeatureId === 'string' || typeof sourceFeatureId === 'number') &&
        normalizeSourceFeatureId(sourceFeatureId) ===
          normalizeSourceFeatureId(quizTargetFeatureId)
      )
    })
    const bounds = target?.geometry ? getGeometryBounds(target.geometry) : null

    if (bounds && map) {
      const viewKey = quizTargetViewKey ?? String(quizTargetFeatureId)
      const padding = showQuizRevealCard
        ? {
            top: 56,
            right: Math.min(350, map.getCanvas().clientWidth * 0.62),
            bottom: 56,
            left: 56
          }
        : quizTargetMaxZoom !== undefined
          ? 112
          : 64
      const maxZoom = showQuizRevealCard ? 7 : (quizTargetMaxZoom ?? 4.5)
      const targetBounds: [[number, number], [number, number]] = [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ]
      const targetCamera = map.cameraForBounds(targetBounds, { padding, maxZoom })
      if (targetCamera?.center && typeof targetCamera.zoom === 'number') {
        const center = LngLat.convert(targetCamera.center).toArray()
        const savedView = { key: viewKey, center, zoom: targetCamera.zoom }
        if (savedQuizTargetViewRef.current?.key !== viewKey) {
          savedQuizTargetViewRef.current = savedView
          setSavedQuizTargetView(savedView)
        }
      }
      if (moveToTarget) {
        map.fitBounds(targetBounds, {
          padding,
          maxZoom,
          duration: 650
        })
      }
    }
  }, [
    quizTargetFeatureId,
    quizTargetMaxZoom,
    quizTargetViewKey,
    showQuizRevealCard
  ])

  const focusOnQuizBaseView = useCallback((): void => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const regionBounds = quizBaseRegion
      ? getQuizRegionFocusBounds(quizBaseRegion)
      : null
    if (regionBounds) {
      // Keep the quick target-view button available while the base view frames
      // the whole continent.
      if (quizTargetFeatureId !== null) focusOnQuizTarget(false)
      const padding = Math.min(48, map.getCanvas().clientWidth * 0.04)
      map.fitBounds(regionBounds, {
        padding,
        maxZoom: 3.4,
        duration: 650
      })
      return
    }

    focusOnQuizTarget()
  }, [focusOnQuizTarget, quizBaseRegion, quizTargetFeatureId])

  useEffect(() => {
    if (interactionResetKey === undefined) return

    if (
      quizTargetFeatureId !== null ||
      (quizBaseRegion !== null && quizBaseRegion !== 'world')
    ) {
      focusOnQuizBaseView()
      return
    }

    mapRef.current?.getMap().easeTo({
      center: [0, 0],
      zoom: 1.5,
      duration: 650
    })
  }, [focusOnQuizBaseView, interactionResetKey, quizBaseRegion, quizTargetFeatureId])

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/labelWorker.ts', import.meta.url),
      { type: 'module' }
    )

    workerRef.current = worker

    
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data

      if (message.type === 'ready') {
        workerReadyRef.current = true
        updateVisibleLabels()
        return
      }

      if (message.type === 'labels' && message.labels) {
        workerBusyRef.current = false
        if (message.requestId === latestLabelRequestId.current) {
          setVisibleLabels((current) =>
            haveSameLabels(current, message.labels!) ? current : message.labels!
          )
        }

        const pendingUpdate = pendingLabelUpdateRef.current
        if (pendingUpdate) {
          pendingLabelUpdateRef.current = null
          sendLabelUpdate(pendingUpdate)
        }
      }
    }

    worker.onerror = (error) => {
      console.error('Erreur du Worker des étiquettes :', error)
    }

    worker.postMessage({
      type: 'init',
      countries: world10m
    })

    return () => {
      workerReadyRef.current = false
      workerBusyRef.current = false
      pendingLabelUpdateRef.current = null
      workerRef.current = null
      worker.terminate()
    }
  }, [])

  const showMapProximityFeedback = (longitude: number, latitude: number): void => {
    const proximity = onMapClick?.([longitude, latitude])
    if (proximity === null || proximity === undefined || showBorders) return

    proximityMarkerIdRef.current += 1
    const markerId = proximityMarkerIdRef.current
    setProximityMarker({
      longitude,
      latitude,
      proximity,
      id: markerId,
      interactionResetKey
    })

    if (proximityMarkerTimeoutRef.current !== null) {
      window.clearTimeout(proximityMarkerTimeoutRef.current)
    }
    proximityMarkerTimeoutRef.current = window.setTimeout(() => {
      setProximityMarker((current) => current?.id === markerId ? null : current)
      proximityMarkerTimeoutRef.current = null
    }, 1500)
  }

  const clearMapProximityFeedback = (): void => {
    setProximityMarker(null)
    if (proximityMarkerTimeoutRef.current !== null) {
      window.clearTimeout(proximityMarkerTimeoutRef.current)
      proximityMarkerTimeoutRef.current = null
    }
  }

  const selectCountryAtCoordinates = (longitude: number, latitude: number): string | null => {
    if (!mapInstance) return null
    const layers = countryFillLayerIds.filter((layerId) => Boolean(mapInstance.getLayer(layerId)))
    if (!layers.length) return null

    const point = mapInstance.project([longitude, latitude])
    const feature = mapInstance.queryRenderedFeatures(point, { layers }).find((candidate) =>
      candidate.geometry.type === 'Polygon' || candidate.geometry.type === 'MultiPolygon'
    )
    if (!feature) {
      updateInteractionState({
        selectedEntityIds: [],
        selectedSourceFeatureId: null,
        searchIsOpen: false,
        searchQuery: '',
        selectionSource: null
      })
      setSelectionBoundaryResetKey(null)
      onCountryDeselected?.()
      return null
    }

    const sourceFeatureId = feature.properties?.sourceId
    const entityId = typeof feature.properties?.entityId === 'string'
      ? feature.properties.entityId
      : null
    const sourceName = String(feature.properties?.name ?? feature.properties?.sourceName ?? '')
    if (
      (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') ||
      !sourceName
    ) {
      return null
    }

    const sourceKey = normalizeSourceFeatureId(sourceFeatureId)
    const entity = entityId ? getEntityById(entityId) : undefined
    const alpha2 = entity?.kind === 'territory'
      ? entity.flagAlpha2 ?? getEntityById(entity.sovereignEntityId ?? '')?.alpha2
      : entity?.alpha2 ?? alpha2BySourceId.get(sourceKey)
    const localizedCountryName = alpha2
      ? new Intl.DisplayNames([language], { type: 'region' }).of(alpha2)
      : undefined
    const frenchCountryName = entityId
      ? getEntityDisplayName(entityId)
      : frenchCountryNameBySourceId.get(sourceKey)
    const territoryName = language === 'fr'
      ? frenchCountryName ?? localizedCountryName ?? sourceName
      : localizedCountryName ?? frenchCountryName ?? sourceName
    const accepted = onCountrySelected?.(sourceFeatureId, territoryName, entityId)
    if (accepted === false) return territoryName

    clearMapProximityFeedback()
    setClickMarker(null)
    setHoveredCountry(null)
    updateInteractionState({
      selectedEntityIds: entityId ? [entityId] : [],
      selectedSourceFeatureId: entityId ? null : sourceFeatureId,
      searchIsOpen: false,
      searchQuery: territoryName,
      selectionSource: 'map'
    })
    setSelectionBoundaryResetKey(interactionResetKey)
    return territoryName
  }

  const openPhysicalFeatureDetails = (marker: PhysicalMapMarker): void => {
    if (selectedPhysicalFeature?.marker.id === marker.id) {
      setSelectedPhysicalFeature(null)
      return
    }

    const map = mapInstance
    const point = map?.project([marker.longitude, marker.latitude])
    const canvas = map?.getCanvas()
    const territoryName = selectCountryAtCoordinates(marker.longitude, marker.latitude)
    setSelectedPhysicalFeature({
      marker,
      territoryName,
      popupSide: point && canvas && point.x > canvas.clientWidth - 310 ? 'left' : 'right',
      popupVertical: point && canvas && point.y < 105
        ? 'top'
        : point && canvas && point.y > canvas.clientHeight - 105
          ? 'bottom'
          : 'center'
    })
  }

  const handlePerspectiveMouseDown = (event: MapLayerMouseEvent): void => {
    if (!perspectiveCorrectionEnabled || !mapInstance || globeMode) return
    if (event.originalEvent.button !== 0) return

    const feature = mapInstance.queryRenderedFeatures(event.point, {
      layers: countryFillLayerIds.filter((layerId) => mapInstance.getLayer(layerId))
    }).find((candidate) => isCountryFillFeature(candidate as InteractiveCountryFeature))
    if (!feature) return

    const sourceFeatureId = feature.properties?.sourceId
    if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') return
    const entityId = typeof feature.properties?.entityId === 'string'
      ? feature.properties.entityId
      : null
    const geometry = feature.geometry
    const bounds = getGeometryBounds(geometry)
    if (!bounds) return
    const [west, south, east, north] = bounds
    const originLatitude = (south + north) / 2
    const center = mapInstance.project([(west + east) / 2, originLatitude])
    const fallbackName = String(feature.properties?.name ?? feature.properties?.sourceName ?? '')
    const displayName = entityId ? getEntityDisplayName(entityId) : undefined
    const details = getExplorationDetails(sourceFeatureId, fallbackName, entityId)
    const name = displayName ?? details.name ?? fallbackName

    const pointer = { x: event.point.x, y: event.point.y }
    const next: PerspectiveDrag = {
      geometry,
      center,
      originLatitude,
      startPointer: pointer,
      pointer,
      name,
      sourceFeatureId,
      entityId,
      areaKm2: details.metrics?.areaKm2 ?? null
    }

    event.originalEvent.preventDefault()
    perspectiveDragRef.current = next
    setPerspectiveOverlap(null)
    setPerspectiveDrag(next)
    setPerspectiveAdjusting(true)
  }

  const handleDrawingPointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!mapInstance || !drawingTool || drawingTool === 'pan' || !onDrawingStrokesChange) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    const screenPoint: [number, number] = [event.clientX - bounds.left, event.clientY - bounds.top]
    if (drawingTool === 'erase') {
      let nearestStrokeIndex = -1
      let nearestDistance = Number.POSITIVE_INFINITY
      for (let strokeIndex = 0; strokeIndex < drawingStrokes.length; strokeIndex += 1) {
        const stroke = drawingStrokes[strokeIndex]
        for (const coordinate of stroke) {
          const point = mapInstance.project(coordinate)
          const distance = Math.hypot(point.x - screenPoint[0], point.y - screenPoint[1])
          if (distance < nearestDistance) {
            nearestStrokeIndex = strokeIndex
            nearestDistance = distance
          }
        }
      }
      if (nearestStrokeIndex >= 0 && nearestDistance < 26) {
        onDrawingStrokesChange(drawingStrokes.filter((_, index) => index !== nearestStrokeIndex))
      }
      return
    }

    const location = mapInstance.unproject(screenPoint)
    drawingPointerActiveRef.current = true
    onDrawingStrokesChange([...drawingStrokes, [[location.lng, location.lat]]])
  }

  const handleDrawingPointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drawingPointerActiveRef.current || !mapInstance || !onDrawingStrokesChange) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    const screenPoint: [number, number] = [event.clientX - bounds.left, event.clientY - bounds.top]
    const strokes = drawingStrokes
    const activeStroke = strokes[strokes.length - 1]
    const lastCoordinate = activeStroke?.[activeStroke.length - 1]
    if (!lastCoordinate) return
    const lastPoint = mapInstance.project(lastCoordinate)
    if (Math.hypot(lastPoint.x - screenPoint[0], lastPoint.y - screenPoint[1]) < 2.5) return
    const location = mapInstance.unproject(screenPoint)
    onDrawingStrokesChange([
      ...strokes.slice(0, -1),
      [...activeStroke, [location.lng, location.lat]]
    ])
  }

  const handleDrawingPointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    drawingPointerActiveRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleCountryClick = (event: MapLayerMouseEvent): void => {
    if (perspectiveCorrectionEnabled) return
    const isComparisonClick = event.originalEvent.metaKey || event.originalEvent.ctrlKey
    const riverFeature = event.features?.find((candidate) =>
      candidate.layer.id.startsWith('physical-rivers-')
    )
    if (riverFeature && !isComparisonClick) {
      const properties = riverFeature.properties as unknown as PhysicalPointFeature
      const name = language === 'fr'
        ? properties.name
        : language === 'es'
          ? properties.nameEs
          : properties.nameEn
      if (name) {
        openPhysicalFeatureDetails({
          id: `river:${name.toLocaleLowerCase()}`,
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          kind: 'river',
          name,
          rank: typeof properties.rank === 'number' ? properties.rank : 1
        })
        return
      }
    }

    setSelectedPhysicalFeature(null)
    const feature = mapInstance
      ? getCountryFeatureAtPoint(mapInstance, event.point, event.features)
      : event.features?.find(isCountryFillFeature)
    if (!feature) {
      showMapProximityFeedback(event.lngLat.lng, event.lngLat.lat)
      setHoveredCountry(null)
      setClickMarker(null)
      setSelectionBoundaryResetKey(null)
      updateInteractionState({
        selectedEntityIds: [],
        selectedSourceFeatureId: null,
        searchIsOpen: false,
        searchQuery: '',
        selectionSource: null
      })
      onCountryDeselected?.()
      return
    }

    const name = feature.properties?.name
    const sourceFeatureId = feature.properties?.sourceId
    const entityId = typeof feature.properties?.entityId === 'string'
      ? feature.properties.entityId
      : null

    if (
      (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') ||
      !name
    ) {
      return
    }

    const displayName = entityId
      ? getEntityDisplayName(entityId) ?? String(name)
      : frenchCountryNameBySourceId.get(normalizeSourceFeatureId(sourceFeatureId)) ?? String(name)

    if (territorySelectionMode) {
      const accepted = onCountrySelected?.(sourceFeatureId, displayName, entityId)
      if (accepted !== false) {
        clearMapProximityFeedback()
        updateInteractionState({
          selectedEntityIds: [],
          selectedSourceFeatureId: null,
          searchIsOpen: false,
          searchQuery: '',
          selectionSource: null
        })
      }
      return
    }

    if (onCompareCountries && isComparisonClick) {
      const clickedEntity = entityId ? getEntityById(entityId) : undefined
      const alpha2 = clickedEntity?.kind === 'country'
        ? clickedEntity.alpha2
        : clickedEntity
          ? undefined
          : alpha2BySourceId.get(normalizeSourceFeatureId(sourceFeatureId))
      const canCompare = alpha2 && countryCatalog.some((country) => country.alpha2 === alpha2)
      if (canCompare) {
        const accepted = onCountrySelected?.(sourceFeatureId, displayName, entityId)
        if (accepted === false) return
        const nextSelection: ComparisonMapSelection = {
          alpha2,
          sourceFeatureId,
          entityId,
          name: displayName
        }
        setComparisonSelectedCountries((current) => {
          const alreadySelected = current.some((country) => country.alpha2 === alpha2)
          if (alreadySelected) {
            return current.filter((country) => country.alpha2 !== alpha2)
          }
          return [...current, nextSelection]
        })
        setSelectionBoundaryResetKey(interactionResetKey)
        return
      }
    }

    const accepted = onCountrySelected?.(sourceFeatureId, displayName, entityId)
    if (accepted === false) {
      if (showWrongAnswerFeedback) {
        wrongAnswerIdRef.current += 1
        setWrongAnswerTarget({
          sourceFeatureId,
          entityId,
          id: wrongAnswerIdRef.current,
          interactionResetKey
        })
      }
      showMapProximityFeedback(event.lngLat.lng, event.lngLat.lat)
      return
    }
    if (accepted === true) {
      clearMapProximityFeedback()
      setWrongAnswerTarget(null)
    }

    updateInteractionState({
      selectedEntityIds: entityId ? [entityId] : [],
      selectedSourceFeatureId: entityId ? null : sourceFeatureId,
      searchIsOpen: false,
      searchQuery: displayName,
      selectionSource: 'map'
    })
    if (showSelectionFeedback && !showBorders) {
      clickMarkerIdRef.current += 1
      setClickMarker({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        id: clickMarkerIdRef.current,
        interactionResetKey
      })
      setSelectionBoundaryResetKey(interactionResetKey)
    }
  }

  const handleCountryHover = (event: MapLayerMouseEvent): void => {
    if (perspectiveCorrectionEnabled) {
      setHoveredCountry(null)
      return
    }

    const feature = mapInstance
      ? getCountryFeatureAtPoint(mapInstance, event.point, event.features)
      : event.features?.find(isCountryFillFeature)
    const sourceFeatureId = feature?.properties?.sourceId
    const entityId = feature?.properties?.entityId

    if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') {
      setHoveredCountry(null)
      return
    }

    const nextHoveredCountry = {
      entityId: typeof entityId === 'string' ? entityId : null,
      sourceFeatureId
    }
    setHoveredCountry((current) =>
      current?.entityId === nextHoveredCountry.entityId &&
      current.sourceFeatureId === nextHoveredCountry.sourceFeatureId
        ? current
        : nextHoveredCountry
    )
  }

  const selectedFeatureExpressions: unknown[] = []
  if (selectedAlpha2SourceFeatureIds.length > 0) {
    selectedFeatureExpressions.push([
      'in',
      ['to-string', ['get', 'sourceId']],
      ['literal', selectedAlpha2SourceFeatureIds.map(String)]
    ])
  }
  if (selectedEntityIds.length > 0) {
    selectedFeatureExpressions.push([
      'in',
      ['get', 'entityId'],
      ['literal', selectedEntityIds]
    ])
  } else if (selectedSourceFeatureId !== null) {
    selectedFeatureExpressions.push(['==', ['get', 'sourceId'], selectedSourceFeatureId])
  }
  for (const country of comparisonSelectedCountries) {
    selectedFeatureExpressions.push(country.entityId
      ? ['==', ['get', 'entityId'], country.entityId]
      : ['==', ['get', 'sourceId'], country.sourceFeatureId])
  }
  if (quizTargetFeatureId !== null) {
    selectedFeatureExpressions.push([
      '==',
      ['to-number', ['get', 'sourceId']],
      Number(quizTargetFeatureId)
    ])
  }
  if (selectedFeatureExpressions.length === 0) selectedFeatureExpressions.push(false)

  const hoveredFeatureExpressions: unknown[] = []
  if (hoveredCountry?.entityId) {
    hoveredFeatureExpressions.push([
      '==',
      ['get', 'entityId'],
      hoveredCountry.entityId
    ])
  } else if (hoveredCountry) {
    hoveredFeatureExpressions.push([
      '==',
      ['get', 'sourceId'],
      hoveredCountry.sourceFeatureId
    ])
  }
  if (quizTargetFeatureId !== null) {
    hoveredFeatureExpressions.push([
      '==',
      ['to-number', ['get', 'sourceId']],
      Number(quizTargetFeatureId)
    ])
  }
  if (hoveredFeatureExpressions.length === 0) hoveredFeatureExpressions.push(false)

  const selectedFeatureFilter = [
    'any',
    ...selectedFeatureExpressions
  ] as unknown as NonNullable<FillLayerSpecification['filter']>
  const hasMapSelection =
    selectedAlpha2SourceFeatureIds.length > 0 ||
    selectedEntityIds.length > 0 ||
    selectedSourceFeatureId !== null ||
    comparisonSelectedCountries.length > 0
  const shouldShowSelectedBoundary = showSelectionFeedback || hasMapSelection

  const selectedFillColor = [
    'case',
    ['any', ...selectedFeatureExpressions],
    isMinimalSkin ? (realLayer ? '#a17435' : '#20201d') : isMatrixSkin ? '#00d957' : '#e5a63b',
    ['any', ...hoveredFeatureExpressions],
    isMinimalSkin ? '#e9e3d7' : isMatrixSkin ? '#0a2a14' : '#34495b',
    isMinimalSkin ? '#f6f2e9' : isMatrixSkin ? '#04150a' : '#263746'
  ] as unknown as NonNullable<FillLayerSpecification['paint']>['fill-color']
  const accuracyBySourceId = countryCatalog.flatMap((country) => {
    const stats = countryAccuracyByAlpha2?.[country.alpha2]
    const pointsEarned = stats?.pointsEarned ?? stats?.correct ?? 0
    const pointsPossible = stats?.pointsPossible ?? stats?.answered ?? 0
    return pointsPossible > 0
      ? [country.sourceFeatureId, pointsEarned / pointsPossible]
      : []
  })
  const accuracyRateExpression = accuracyBySourceId.length
    ? [
        'match',
        ['to-number', ['get', 'sourceId']],
        ...accuracyBySourceId,
        -1
      ]
    : -1
  const territoryEntityIds = geographicEntities
    .filter((entity) => entity.kind === 'territory')
    .map((entity) => entity.id)
  const isTerritoryFeature = [
    'match',
    ['get', 'entityId'],
    ...territoryEntityIds.flatMap((entityId) => [entityId, true]),
    false
  ]
  const fillColor = countryAccuracyByAlpha2
    ? [
        'case',
        isTerritoryFeature,
        isMinimalSkin ? '#ded6c8' : isMatrixSkin ? '#071a0c' : '#344252',
        ['<', accuracyRateExpression, 0],
        isMinimalSkin ? '#ded6c8' : isMatrixSkin ? '#071a0c' : '#344252',
        [
          'interpolate',
          ['linear'],
          accuracyRateExpression,
          0, isMatrixSkin ? '#06210d' : '#ffffff',
          1, isMatrixSkin ? '#36ff72' : '#c62828'
        ]
      ] as unknown as NonNullable<FillLayerSpecification['paint']>['fill-color']
    : selectedFillColor

  const fillOpacity110m: NonNullable<FillLayerSpecification['paint']>['fill-opacity'] = [
    'interpolate',
    ['linear'],
    ['zoom'],
    2, 1,
    3, 0
  ]
  const fillOpacity50m: NonNullable<FillLayerSpecification['paint']>['fill-opacity'] = [
    'interpolate',
    ['linear'],
    ['zoom'],
    2, 0,
    3, 1,
    4, 1,
    4.5, 1,
    5, 0
  ]
  const fillOpacity10m: NonNullable<FillLayerSpecification['paint']>['fill-opacity'] = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4.5, 0,
    5, 1
  ]
  const getFillOpacity = (
    baseOpacity: NonNullable<FillLayerSpecification['paint']>['fill-opacity']
  ): NonNullable<FillLayerSpecification['paint']>['fill-opacity'] =>
    realLayer
      ? [
          'case',
          selectedFeatureFilter,
          0.58,
          ['*', baseOpacity, 0.18]
        ] as unknown as NonNullable<FillLayerSpecification['paint']>['fill-opacity']
      : baseOpacity

  const fillPaint110m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    // Crossfading resolutions can expose antialiased polygon edges as faint lines.
    'fill-antialias': showBorders,
    'fill-opacity': getFillOpacity(fillOpacity110m)
  }
  const fillPaint50m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-antialias': showBorders,
    'fill-opacity': getFillOpacity(fillOpacity50m)
  }
  const fillPaint10m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-antialias': showBorders,
    'fill-opacity': getFillOpacity(fillOpacity10m)
  }
  const borderPaint110m: LineLayerSpecification['paint'] = {
    'line-color': isMinimalSkin ? '#77736b' : isMatrixSkin ? '#176b34' : '#64748b',
    'line-width': 0.7,
    'line-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      2, 1,
      3, 0
    ]
  }

  const borderPaint50m: LineLayerSpecification['paint'] = {
    'line-color': isMinimalSkin ? '#77736b' : isMatrixSkin ? '#176b34' : '#64748b',
    'line-width': 0.7,
    'line-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      2, 0,
      3, 1,
      4, 1,
      4.5, 1,
      5, 0
    ]
  }

  const borderPaint10m: LineLayerSpecification['paint'] = {
    'line-color': isMinimalSkin ? '#77736b' : isMatrixSkin ? '#176b34' : '#64748b',
    'line-width': 0.7,
    'line-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4.5, 0,
      5, 1
    ]
  }

  const selectionBoundaryPaint = (minZoom: number, maxZoom: number): LineLayerSpecification['paint'] => ({
    'line-color': realLayer
      ? isMatrixSkin ? '#d8ffdf' : '#fff1c3'
      : isMinimalSkin ? '#20201d' : isMatrixSkin ? '#55ff82' : '#f4c45e',
    'line-width': ['interpolate', ['linear'], ['zoom'], minZoom, realLayer ? 2 : 1.2, maxZoom, realLayer ? 3.2 : 2.4],
    'line-opacity': hasMapSelection ? 1 : selectionBoundaryOpacity,
    'line-opacity-transition': { duration: 320, delay: 0 }
  })

  const globeLabelsActive = globeMode && mapZoom < GLOBE_TRANSITION_START_ZOOM
  const labelsForMap = useMemo(() => {
    if (!globeLabelsActive || !mapInstance) return visibleLabels

    return {
      ...visibleLabels,
      features: visibleLabels.features.filter((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates
        return isGlobeLabelVisible(
          mapInstance,
          [longitude, latitude],
          mapZoom,
          GLOBE_TRANSITION_START_ZOOM,
          GLOBE_TRANSITION_END_ZOOM
        )
      })
    }
  }, [globeLabelRevision, globeLabelsActive, mapInstance, mapZoom, visibleLabels])

  const labelsForMapDisplay = useMemo(() => {
    const features = labelsForMap.features.filter((feature) =>
      !showResources || !getResourceIndustryFactsForMapFeature(
        feature.properties.entityId,
        feature.properties.sourceFeatureId
      ).length
    ).sort((first, second) => first.properties.priority - second.properties.priority)
    return { ...labelsForMap, features: features.slice(0, Math.max(0, density.labels)) }
  }, [density.labels, labelsForMap, showResources])

  const displayedRiverData = useMemo(() => ({
    ...riverData,
    features: [...riverData.features]
      .sort((first, second) =>
        Number(first.properties?.rank ?? Number.MAX_SAFE_INTEGER) -
        Number(second.properties?.rank ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, Math.max(0, density.rivers))
  }), [density.rivers])

  const displayedMountainData = useMemo(() => ({
    ...mountainPeakData,
    features: [...mountainPeakData.features]
      .sort((first, second) => {
        const left = first.properties as { rank?: number; elevation?: number }
        const right = second.properties as { rank?: number; elevation?: number }
        return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
          (right.elevation ?? 0) - (left.elevation ?? 0)
      })
      .slice(0, Math.max(0, density.mountains))
  }), [density.mountains])

  const physicalMapMarkers = useMemo<PhysicalMapMarker[]>(() => {
    if (!mapInstance || !mapLoaded || (!showRivers && !showMountains && !showSummits)) return []

    const minimumSpacing = Math.max(28, 92 - mapZoom * 9)
    const canvas = mapInstance.getCanvas()
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const candidates: PhysicalMapMarker[] = []
    const localized = (properties: PhysicalPointFeature): string =>
      language === 'fr' ? properties.name : language === 'es' ? properties.nameEs : properties.nameEn
    const localizedRangeText = (text: MountainRangeRecord['landscape']): string =>
      text[language] ?? text.en

    if (showRivers && density.rivers > 0) {
      const rivers = [...riverLabelData.features as unknown as PhysicalPointFeature[]]
        .sort((first, second) => first.rank - second.rank)
        .slice(0, density.rivers)
      for (const feature of rivers) {
        const name = localized(feature)
        if (!name) continue
        const [baseLongitude, baseLatitude] = feature.coordinates ?? []
        if (baseLongitude === undefined || baseLatitude === undefined) continue
        const [longitude, latitude] = getRiverLabelCoordinate(
          mapInstance,
          name,
          [baseLongitude, baseLatitude]
        )
        candidates.push({
          id: `river:${name.toLocaleLowerCase()}`,
          longitude,
          latitude,
          kind: 'river',
          name,
          rank: feature.rank
        })
      }
    }

    if (showMountains) {
      const allPeaks = mountainPeakData.features as unknown as MountainPeakMapFeature[]
      for (const range of mountainRanges) {
        const [west, south, east, north] = range.catalogueBounds
        const cataloguedPeaks = allPeaks.filter(({ geometry }) => {
          const [longitude, latitude] = geometry.coordinates
          return longitude >= west && longitude <= east && latitude >= south && latitude <= north
        })
        const rangeName = localizedRangeText(range.name)
        const highestPeak = mountainRangeHighPoints[range.id]
        const highestPeakName = highestPeak
          ? localizedRangeText(highestPeak.name)
          : null
        const projectedRange = mapInstance.project(range.center)
        candidates.push({
          id: `range:${range.id}`,
          longitude: range.center[0],
          latitude: range.center[1],
          kind: 'range',
          name: rangeName,
          tooltipAlignment: projectedRange.x < 150
            ? 'left'
            : projectedRange.x > width - 150 ? 'right' : 'center',
          tooltipBelow: projectedRange.y < 140,
          detail: highestPeak?.elevationMeters
            ? `${highestPeak.elevationMeters.toLocaleString(language)} m`
            : undefined,
          rank: 0,
          rangeInfo: {
            summitCount: cataloguedPeaks.length,
            highestPeakName,
            highestElevationMeters: highestPeak?.elevationMeters ?? null,
            lengthKm: range.lengthKm,
            landscape: localizedRangeText(range.landscape),
            attendance: localizedRangeText(range.attendance),
            hiking: localizedRangeText(range.hiking),
            mountaineering: localizedRangeText(range.mountaineering)
          }
        })
      }
    }

    if (showSummits && density.mountains > 0) {
      const peaks = [...mountainPeakData.features as unknown as MountainPeakMapFeature[]]
        .sort((first, second) => first.properties.rank - second.properties.rank ||
        (second.properties.elevation ?? 0) - (first.properties.elevation ?? 0)
      ).slice(0, density.mountains)
      for (const feature of peaks) {
        const { properties } = feature
        if (!properties.name) continue
        const [longitude, latitude] = feature.geometry.coordinates
        candidates.push({
          id: `mountain:${properties.name.toLocaleLowerCase()}`,
          longitude,
          latitude,
          kind: 'mountain',
          name: localized(properties),
          detail: properties.elevation ? `${properties.elevation.toLocaleString(language)} m` : undefined,
          rank: properties.rank
        })
      }
    }

    candidates.sort((left, right) => left.rank - right.rank || left.kind.localeCompare(right.kind))
    const accepted: { marker: PhysicalMapMarker; x: number; y: number }[] = []
    const seen = new Set<string>()
    for (const marker of candidates) {
      const uniqueKey = `${marker.kind}:${marker.name}`
      if (seen.has(uniqueKey)) continue
      const point = mapInstance.project([marker.longitude, marker.latitude])
      if (point.x < 12 || point.y < 12 || point.x > width - 12 || point.y > height - 12) continue
      if (
        globeMode &&
        !isGlobeLabelVisible(
          mapInstance,
          [marker.longitude, marker.latitude],
          mapZoom,
          GLOBE_TRANSITION_START_ZOOM,
          GLOBE_TRANSITION_END_ZOOM
        )
      ) continue
      if (accepted.some(({ x, y }) => Math.hypot(point.x - x, point.y - y) < minimumSpacing)) continue
      accepted.push({ marker, x: point.x, y: point.y })
      seen.add(uniqueKey)
    }
    return accepted.map(({ marker }) => marker)
  }, [
    globeMode,
    language,
    mapInstance,
    mapLoaded,
    mapViewRevision,
    mapZoom,
    showMountains,
    showSummits,
    showRivers,
    density.mountains,
    density.rivers
  ])

  useEffect(() => {
    if (
      (selectedPhysicalFeature?.marker.kind === 'river' && !showRivers) ||
      (selectedPhysicalFeature?.marker.kind === 'mountain' && !showSummits) ||
      (selectedPhysicalFeature?.marker.kind === 'range' && !showMountains)
    ) {
      setSelectedPhysicalFeature(null)
    }
  }, [selectedPhysicalFeature, showMountains, showRivers, showSummits])

  const riverColor = realLayer ? '#5acbfa' : isMinimalSkin ? '#5f8296' : isMatrixSkin ? '#00d76b' : '#57b9df'
  const mountainColor = realLayer ? '#ffd36a' : isMinimalSkin ? '#827762' : isMatrixSkin ? '#62ff8c' : '#e6bd78'

  const labelLayout: SymbolLayerSpecification['layout'] = {
    'text-field': ['get', 'name'],
    'text-size': globeLabelsActive
      ? [
          'interpolate',
          ['linear'],
          ['zoom'],
          -1,
          6,
          GLOBE_TRANSITION_END_ZOOM,
          7,
          GLOBE_TRANSITION_START_ZOOM,
          9.25
        ]
      : ['interpolate', ['linear'], ['zoom'], 1, 8, 3, 9, 5, 10, 12, 11],
    'text-font': ['Open Sans Regular'],
    'symbol-sort-key': ['get', 'priority'],
    'text-padding': globeLabelsActive ? 0 : 2,
    'text-allow-overlap': globeLabelsActive,
    'text-ignore-placement': globeLabelsActive
  }

  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': realLayer ? '#ffffff' : isMinimalSkin ? '#20201d' : isMatrixSkin ? '#aaffbf' : '#ffffff',
    'text-halo-color': realLayer ? '#101820' : isMinimalSkin ? '#f2eee5' : isMatrixSkin ? '#010803' : '#101820',
    'text-halo-width': realLayer ? 1.35 : 1,
    'text-opacity': 1
  }

  const perspectiveAreaComparisonPanel = perspectiveDrag && (
    <aside
      className={`perspective-area-comparison${perspectiveComparisonPortal ? ' is-toolbar' : ''}`}
      aria-live="polite"
    >
      <div className="perspective-area-comparison-item">
        <span>{t('Territoire déplacé')}</span>
        <strong>{perspectiveDrag.name}</strong>
        <small>{t('Superficie')} · {getPerspectiveAreaLabel(
          perspectiveDrag.areaKm2,
          language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US'
        )}</small>
      </div>
      <div className="perspective-area-comparison-item">
        <span>{t('Sous le fantôme')}</span>
        <strong>{perspectiveOverlap === null
          ? '…'
          : perspectiveOverlap.name ?? t('Aucun territoire')}
        </strong>
        <small>{t('Superficie')} · {perspectiveOverlap?.name
          ? getPerspectiveAreaLabel(
            perspectiveOverlap.areaKm2,
            language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US'
          )
          : '—'}
        </small>
      </div>
    </aside>
  )

  return (
    <div
      className={`world-map-shell${perspectiveCorrectionEnabled ? ' perspective-correction-active' : ''}${perspectiveAdjusting ? ' is-adjusting-perspective' : ''}${drawingTool ? ' has-drawing-tool' : ''}${hoveredCountry && !drawingTool && !perspectiveCorrectionEnabled ? ' has-country-hover' : ''}`}
    >
      <Map
        ref={mapRef}
        onLoad={(event) => {
          event.target.setPaintProperty(
            'background',
            'background-color',
            mapBackgroundColor
          )
          setMapInstance(event.target)
          setMapLoaded(true)
          setMapZoom(event.target.getZoom())
          updateVisibleLabels()
          focusOnQuizBaseView()
          scheduleFlagOverlayUpdate()
          setResourceOverlayRevision((current) => current + 1)
        }}
        onMove={(event) => {
          if (
            !globeMode ||
            event.viewState.zoom >= GLOBE_TRANSITION_START_ZOOM
          ) {
            globeLabelsRequestedRef.current = false
            scheduleFlagOverlayUpdate()
            return
          }
          if (!globeLabelsRequestedRef.current) {
            globeLabelsRequestedRef.current = true
            updateVisibleLabels()
          }
          const now = performance.now()
          if (now - lastGlobeOverlayUpdateRef.current < 100) return
          lastGlobeOverlayUpdateRef.current = now
          setMapZoom(event.viewState.zoom)
          setGlobeLabelRevision((current) => current + 1)
          if (showFlagTerritories || showResources || showRivers || showMountains || showSummits) {
            scheduleFlagOverlayUpdate()
          }
        }}
        onMoveEnd={() => {
          const map = mapRef.current?.getMap()
          if (map) {
            setMapZoom(map.getZoom())
            setGlobeLabelRevision((current) => current + 1)
          }
          updateVisibleLabels()
          scheduleFlagOverlayUpdate()
          setResourceOverlayRevision((current) => current + 1)
          setMapViewRevision((current) => current + 1)
        }}
        onIdle={scheduleFlagOverlayUpdate}
        onResize={() => {
          updateVisibleLabels()
          scheduleFlagOverlayUpdate()
          setResourceOverlayRevision((current) => current + 1)
        }}
        onMouseMove={handleCountryHover}
        onMouseDown={handlePerspectiveMouseDown}
        onMouseLeave={() => setHoveredCountry(null)}
        initialViewState={{
          longitude: 0,
          latitude: 0,
          zoom: 1.5
        }}
        minZoom={0}
        maxZoom={12}
        mapStyle={mapStyle}
        dragPan={!perspectiveCorrectionEnabled}
        scrollZoom={!perspectiveCorrectionEnabled}
        doubleClickZoom={!perspectiveCorrectionEnabled}
        keyboard={!perspectiveCorrectionEnabled}
        boxZoom={!perspectiveCorrectionEnabled}
        dragRotate={!perspectiveCorrectionEnabled}
        touchZoomRotate={!perspectiveCorrectionEnabled}
        touchPitch={!perspectiveCorrectionEnabled}
        interactiveLayerIds={[
          ...countryFillLayerIds,
          ...(showRivers ? physicalRiverLayerIds : [])
        ]}
        onClick={handleCountryClick}
        style={{
          width: '100%',
          height: '100%'
        }}
      >

        {realLayer && (
          <Source
            id="real-earth-imagery"
            type="image"
            url={realLayer === 'day' ? earthDayTexture : realLayer === 'night' ? earthNightTexture : earthCloudTexture}
            coordinates={earthTextureCoordinates}
          >
            <Layer
              id="real-earth-imagery-raster"
              type="raster"
              beforeId="countries-fill-110m"
              paint={{
                'raster-opacity': realLayer === 'clouds' ? 0.88 : 1,
                'raster-resampling': 'linear'
              }}
            />
          </Source>
        )}

        {/* Résolution mondiale : 110m */}
        <Source
          id="countries-110m"
          type="geojson"
          data={world110mFlagMap}
        >
          <Layer
            id="countries-fill-110m"
            type="fill"
            minzoom={0}
            maxzoom={3}
            paint={fillPaint110m}
          />

          {showWrongAnswerFeedback && (
            <Layer
              id="countries-wrong-answer-110m"
              type="fill"
              minzoom={0}
              maxzoom={3}
              filter={wrongAnswerFeatureFilter}
              paint={{
                'fill-color': isMinimalSkin ? '#e6a3a6' : '#ef4444',
                'fill-translate': [0, 0],
                'fill-translate-anchor': 'viewport',
                'fill-antialias': false,
                'fill-opacity': 0
              }}
            />
          )}

          {showBorders && (
            <Layer
              id="countries-borders-110m"
              type="line"
              minzoom={0}
              maxzoom={3}
              paint={borderPaint110m}
            />
          )}

          {shouldShowSelectedBoundary && (
            <Layer
              id="countries-selected-boundary-110m"
              type="line"
              minzoom={0}
              maxzoom={3}
              filter={selectedFeatureFilter}
              paint={selectionBoundaryPaint(0, 3)}
            />
          )}
        </Source>

        {/* Résolution intermédiaire : 50m */}
        <Source
          id="countries-50m"
          type="geojson"
          data={world50mFlagMap}
        >
          <Layer
            id="countries-fill-50m"
            type="fill"
            minzoom={2}
            maxzoom={5}
            paint={fillPaint50m}
          />

          {showWrongAnswerFeedback && (
            <Layer
              id="countries-wrong-answer-50m"
              type="fill"
              minzoom={2}
              maxzoom={5}
              filter={wrongAnswerFeatureFilter}
              paint={{
                'fill-color': isMinimalSkin ? '#e6a3a6' : '#ef4444',
                'fill-translate': [0, 0],
                'fill-translate-anchor': 'viewport',
                'fill-antialias': false,
                'fill-opacity': 0
              }}
            />
          )}

          {showBorders && (
            <Layer
              id="countries-borders-50m"
              type="line"
              minzoom={2}
              maxzoom={5}
              paint={borderPaint50m}
            />
          )}

          {shouldShowSelectedBoundary && (
            <Layer
              id="countries-selected-boundary-50m"
              type="line"
              minzoom={2}
              maxzoom={5}
              filter={selectedFeatureFilter}
              paint={selectionBoundaryPaint(2, 5)}
            />
          )}
        </Source>

        {/* Résolution détaillée : 10m */}
        <Source
          id="countries-10m"
          type="geojson"
          data={world10mFlagMap}
        >
          <Layer
            id="countries-fill-10m"
            type="fill"
            minzoom={4}
            paint={fillPaint10m}
          />

          {showWrongAnswerFeedback && (
            <Layer
              id="countries-wrong-answer-10m"
              type="fill"
              minzoom={4}
              filter={wrongAnswerFeatureFilter}
              paint={{
                'fill-color': isMinimalSkin ? '#e6a3a6' : '#ef4444',
                'fill-translate': [0, 0],
                'fill-translate-anchor': 'viewport',
                'fill-antialias': false,
                'fill-opacity': 0
              }}
            />
          )}

          {showBorders && (
            <Layer
              id="countries-borders-10m"
              type="line"
              minzoom={4}
              paint={borderPaint10m}
            />
          )}

          {shouldShowSelectedBoundary && (
            <Layer
              id="countries-selected-boundary-10m"
              type="line"
              minzoom={4}
              filter={selectedFeatureFilter}
              paint={selectionBoundaryPaint(4, 8)}
            />
          )}
        </Source>

        <Source
          id="low-zoom-country-markers"
          type="geojson"
          data={lowZoomMissingCountryMarkers}
        >
          <Layer
            id="low-zoom-country-marker-circles"
            type="circle"
            minzoom={0}
            maxzoom={3}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.8, 2, 2.5, 3, 0],
              'circle-color': [
                'case',
                ['any', ...selectedFeatureExpressions],
                isMinimalSkin ? '#20201d' : isMatrixSkin ? '#00d957' : '#e5a63b',
                ['any', ...hoveredFeatureExpressions],
                isMinimalSkin ? '#e9e3d7' : isMatrixSkin ? '#0a2a14' : '#d6e5f1',
                isMinimalSkin ? '#8b6b38' : isMatrixSkin ? '#00d957' : '#f1bf62'
              ] as unknown as NonNullable<CircleLayerSpecification['paint']>['circle-color'],
              'circle-stroke-color': isMinimalSkin ? '#f6f2e9' : isMatrixSkin ? '#010803' : '#101820',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 2, 1.1, 3, 0],
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.72, 2, 0.9, 3, 0]
            }}
          />
        </Source>

        {showRivers && density.rivers > 0 && (
          <Source
            id="physical-rivers"
            type="geojson"
            data={displayedRiverData as unknown as FeatureCollection}
          >
            <Layer
              id="physical-rivers-major"
              type="line"
              minzoom={0}
              filter={majorRiverFilter}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': riverColor,
                'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.65, 5, 1.35, 10, 2.2],
                'line-opacity': 0.9
              }}
            />
            <Layer
              id="physical-rivers-regional"
              type="line"
              minzoom={0}
              filter={regionalRiverFilter}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': riverColor,
                'line-width': ['interpolate', ['linear'], ['zoom'], 2.5, 0.55, 7, 1.35],
                'line-opacity': 0.74
              }}
            />
            <Layer
              id="physical-rivers-local"
              type="line"
              minzoom={0}
              filter={localRiverFilter}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': riverColor,
                'line-width': ['interpolate', ['linear'], ['zoom'], 4.5, 0.5, 8, 1.25],
                'line-opacity': 0.6
              }}
            />
          </Source>
        )}

        {showSummits && density.mountains > 0 && (
          <Source
            id="physical-mountain-peaks"
            type="geojson"
            data={displayedMountainData as unknown as FeatureCollection}
          >
            <Layer
              id="physical-mountain-peaks-major"
              type="circle"
              minzoom={0}
              filter={majorPeakFilter}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 5, 3.6, 10, 5.5],
                'circle-color': mountainColor,
                'circle-stroke-color': isMinimalSkin ? '#f2eee5' : isMatrixSkin ? '#010803' : '#101820',
                'circle-stroke-width': 1,
                'circle-opacity': 0.95
              }}
            />
            <Layer
              id="physical-mountain-peaks-regional"
              type="circle"
              minzoom={0}
              filter={regionalPeakFilter}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3.5, 10, 5],
                'circle-color': mountainColor,
                'circle-stroke-color': isMinimalSkin ? '#f2eee5' : isMatrixSkin ? '#010803' : '#101820',
                'circle-stroke-width': 1,
                'circle-opacity': 0.9
              }}
            />
            <Layer
              id="physical-mountain-peaks-local"
              type="circle"
              minzoom={0}
              filter={localPeakFilter}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.8, 9, 3.6],
                'circle-color': mountainColor,
                'circle-stroke-color': isMinimalSkin ? '#f2eee5' : isMatrixSkin ? '#010803' : '#101820',
                'circle-stroke-width': 0.8,
                'circle-opacity': 0.82
              }}
            />
          </Source>
        )}

        {/* Étiquettes indépendantes des résolutions */}
        {showLabels && !showFlagTerritories && (
          <Source
            id="country-labels"
            type="geojson"
            data={labelsForMapDisplay}
          >
            <Layer
              id="countries-labels"
              type="symbol"
              layout={labelLayout}
              paint={labelPaint}
            />
          </Source>
        )}

        {physicalMapMarkers.map((marker) => {
          const isSelected = selectedPhysicalFeature?.marker.id === marker.id
          const featureType = marker.kind === 'river'
            ? 'Fleuve'
            : marker.kind === 'range' ? 'Chaîne de montagnes' : 'Sommet'
          const rangeFacts: [string, string][] = marker.rangeInfo ? [
            [t('Sommets recensés'), marker.rangeInfo.summitCount > 0
              ? `≈ ${marker.rangeInfo.summitCount.toLocaleString(language)}`
              : 'ND'],
            [t('Longueur approximative'), marker.rangeInfo.lengthKm
              ? `≈ ${marker.rangeInfo.lengthKm.toLocaleString(language)} km`
              : 'ND'],
            [t('Point culminant'), marker.rangeInfo.highestPeakName && marker.rangeInfo.highestElevationMeters
              ? `${marker.rangeInfo.highestPeakName} · ${marker.rangeInfo.highestElevationMeters.toLocaleString(language)} m`
              : 'ND'],
            [t('Paysage'), marker.rangeInfo.landscape],
            [t('Fréquentation'), marker.rangeInfo.attendance],
            [t('Randonnée'), marker.rangeInfo.hiking],
            [t('Alpinisme'), marker.rangeInfo.mountaineering]
          ] : []
          const rangeTooltipId = `mountain-range-tooltip-${marker.id.replace(/[^a-z0-9-]/gi, '-')}`
          const rangeDescription = rangeFacts.map(([label, value]) => `${label}: ${value}`).join('. ')
          return (
            <Marker
              key={marker.id}
              longitude={marker.longitude}
              latitude={marker.latitude}
              anchor="center"
              style={{ pointerEvents: 'auto', zIndex: isSelected ? 8 : 3 }}
            >
              <div className="map-physical-marker-anchor">
                {marker.kind === 'river' ? (
                  <button
                    className={`map-physical-label map-river-label${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    title={`${t(featureType)} — ${marker.name}`}
                    aria-label={`${t(featureType)}: ${marker.name}`}
                    aria-expanded={isSelected}
                    onClick={(event) => {
                      event.stopPropagation()
                      openPhysicalFeatureDetails(marker)
                    }}
                  >
                    {marker.name}
                  </button>
                ) : marker.kind === 'range' ? (
                  <>
                    <button
                      className={`map-mountain-range-marker${isSelected ? ' is-selected' : ''}`}
                      type="button"
                      aria-label={`${t('Chaîne de montagnes')}: ${marker.name}. ${rangeDescription}`}
                      aria-describedby={rangeTooltipId}
                      aria-expanded={isSelected}
                      onClick={(event) => {
                        event.stopPropagation()
                        openPhysicalFeatureDetails(marker)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.5 19.5 9 7.7l3.4 5.2 2.1-3.2 7 9.8H2.5Z" />
                        <path d="m6.4 12.4 2.7 1.1 1.6-2.7 2.1 3.2 1.6-1.2 3.1 4.2H6.4Z" />
                      </svg>
                    </button>
                    <div
                      className={`map-mountain-range-tooltip align-${marker.tooltipAlignment ?? 'center'}${marker.tooltipBelow ? ' is-below' : ''}`}
                      id={rangeTooltipId}
                      role="tooltip"
                    >
                      <strong>{marker.name}</strong>
                      <dl>
                        {rangeFacts.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <small>{t('Décompte indicatif du catalogue local dans une emprise approximative.')}</small>
                    </div>
                  </>
                ) : (
                  <button
                    className={`map-mountain-peak-marker${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    title={`${marker.name}${marker.detail ? ` · ${marker.detail}` : ''}`}
                    aria-label={`${t(featureType)}: ${marker.name}${marker.detail ? ` · ${marker.detail}` : ''}`}
                    aria-expanded={isSelected}
                    onClick={(event) => {
                      event.stopPropagation()
                      openPhysicalFeatureDetails(marker)
                    }}
                  >
                    <span aria-hidden="true">▲</span>
                    {mapZoom >= 4.5 && <span className="map-mountain-peak-name">{marker.name}</span>}
                  </button>
                )}
                {isSelected && selectedPhysicalFeature && (
                  <section
                    className={`map-resource-detail-popup map-physical-detail-popup open-${selectedPhysicalFeature.popupSide} align-${selectedPhysicalFeature.popupVertical}`}
                    role="dialog"
                    aria-label={`${t(featureType)} — ${marker.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="map-resource-popup-close"
                      aria-label={t('Fermer')}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedPhysicalFeature(null)
                      }}
                    >
                      ×
                    </button>
                    <span className="map-resource-popup-territory">{t(featureType)}</span>
                    <strong>{marker.name}</strong>
                    <div className="map-physical-detail-facts">
                      {marker.kind === 'mountain' && (
                        <div>
                          <span>{t('Altitude')}</span>
                          <strong>{marker.detail ?? 'ND'}</strong>
                        </div>
                      )}
                      {marker.kind === 'range' && rangeFacts.map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                      <div>
                        <span>{t('Pays ou territoire')}</span>
                        <strong>{selectedPhysicalFeature.territoryName ?? 'ND'}</strong>
                      </div>
                      <div>
                        <span>{t('Coordonnées')}</span>
                        <strong>
                          {marker.latitude.toLocaleString(language, { maximumFractionDigits: 3 })}°,
                          {' '}{marker.longitude.toLocaleString(language, { maximumFractionDigits: 3 })}°
                        </strong>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </Marker>
          )
        })}

        {showResources && density.resources > 0 && mapInstance && (
          <MapResourceOverlay
            map={mapInstance}
            labels={labelsForMap}
            zoom={mapZoom}
            revision={resourceOverlayRevision}
            maxItems={density.resources}
          />
        )}

        {showSelectionFeedback && activeClickMarker && (
          <Marker
            key={activeClickMarker.id}
            longitude={activeClickMarker.longitude}
            latitude={activeClickMarker.latitude}
            anchor="center"
            style={{ pointerEvents: 'none' }}
          >
            <div className="map-selection-marker" aria-hidden="true">
              <span className="map-selection-marker-ripple" />
              <span className="map-selection-marker-dot" />
            </div>
          </Marker>
        )}

        {activeProximityMarker && (
          <Marker
            key={`proximity-${activeProximityMarker.id}`}
            longitude={activeProximityMarker.longitude}
            latitude={activeProximityMarker.latitude}
            anchor="center"
            style={{ pointerEvents: 'none' }}
          >
            <div className="map-proximity-marker-anchor" aria-hidden="true">
              <span
                className="map-proximity-score"
                style={{ '--score-hue': `${activeProximityMarker.proximity.score * 1.2}deg` } as CSSProperties}
              >
                {activeProximityMarker.proximity.score}%
                {activeProximityMarker.proximity.distanceKm !== null && (
                  <> · {activeProximityMarker.proximity.distanceKm.toLocaleString(language)} km</>
                )}
              </span>
            </div>
          </Marker>
        )}

      </Map>

      {showFlagTerritories && density.flags > 0 && mapInstance && (
        <MapFlagOverlay
          map={mapInstance}
          globeMode={globeMode && mapZoom < GLOBE_TRANSITION_START_ZOOM}
          projectionRevision={flagProjectionRevision}
          revision={mapViewRevision}
          zoom={mapZoom}
          world110m={world110mFlagMap}
          world50m={world50mFlagMap}
          world10m={world10mFlagMap}
          labels={labelsForMap}
          maxFlags={density.flags}
          maxLabels={density.labels}
          showBorders={showBorders}
          showLabels={showLabels}
          selectedEntityIds={mapOverlaySelectedEntityIds}
          selectedSourceFeatureId={selectedSourceFeatureId}
          selectedSourceFeatureIds={[...comparisonSelectedSourceFeatureIds, ...selectedAlpha2SourceFeatureIds]}
          hoveredCountry={hoveredCountry}
          quizTargetFeatureId={quizTargetFeatureId}
          selectionBoundaryOpacity={selectionBoundaryOpacity}
          flagOpacity={realLayer ? 0.3 : 1}
          realLayerActive={Boolean(realLayer)}
          wrongAnswerTarget={activeWrongAnswerTarget}
        />
      )}

      {(drawingTool !== null || drawingStrokes.length > 0) && mapInstance && (
        <svg
          className="map-drawing-overlay"
          viewBox={`0 0 ${mapInstance.getCanvas().clientWidth} ${mapInstance.getCanvas().clientHeight}`}
          style={{ pointerEvents: drawingTool && drawingTool !== 'pan' ? 'auto' : 'none' }}
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
          onPointerCancel={handleDrawingPointerUp}
        >
          {drawingTool && drawingTool !== 'pan' && (
            <rect
              x="0"
              y="0"
              width={mapInstance.getCanvas().clientWidth}
              height={mapInstance.getCanvas().clientHeight}
              fill="transparent"
            />
          )}
          {drawingStrokes.map((stroke, index) => {
            if (!stroke.length) return null
            const path = stroke.map((coordinate, pointIndex) => {
              const point = mapInstance.project(coordinate)
              return `${pointIndex === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
            }).join(' ')
            return (
              <path
                key={`drawn-border-${index}`}
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )
          })}
        </svg>
      )}

      {perspectiveDrag && mapInstance && (
        <svg
          className="perspective-correction-overlay"
          viewBox={`0 0 ${mapInstance.getCanvas().clientWidth} ${mapInstance.getCanvas().clientHeight}`}
          aria-hidden="true"
        >
          <title>{`${perspectiveDrag.name} — ${t('Perspective corrigée')}`}</title>
          <path
            d={getPerspectiveGhostPath(perspectiveDrag.geometry, mapInstance, perspectiveDrag)}
            fillRule="evenodd"
          />
        </svg>
      )}

      {perspectiveAreaComparisonPanel && (
        perspectiveComparisonPortal
          ? createPortal(perspectiveAreaComparisonPanel, perspectiveComparisonPortal)
          : perspectiveAreaComparisonPanel
      )}

      {comparisonSelectedCountries.length > 0 && onCompareCountries && (
        <div className="map-comparison-actions">
          <button
            className="map-comparison-action"
            type="button"
            title={t('Ouvrir le comparateur avec les pays sélectionnés')}
            aria-label={`${t('Ouvrir le comparateur avec les pays sélectionnés')} (${comparisonSelectedCountries.length})`}
            onClick={() => onCompareCountries(comparisonSelectedCountries.map((country) => country.alpha2))}
          >
            {t('Comparer')} <span>{comparisonSelectedCountries.length}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button
            className="map-comparison-clear"
            type="button"
            title={t('Annuler la sélection de comparaison')}
            aria-label={t('Annuler la sélection de comparaison')}
            onClick={(event) => {
              event.stopPropagation()
              setComparisonSelectedCountries([])
              setSelectionBoundaryResetKey(null)
              setClickMarker(null)
              clearMapProximityFeedback()
              setWrongAnswerTarget(null)
              updateInteractionState({
                selectedEntityIds: [],
                selectedSourceFeatureId: null,
                searchIsOpen: false,
                searchQuery: '',
                selectionSource: null
              })
              onCountryDeselected?.()
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      <div className="map-controls world-map-controls" aria-label={t('Contrôles de la carte')}>
        <button
          className="map-control-button map-projection-control"
          type="button"
          title={t(globeMode ? 'Passer au plan' : 'Passer au globe')}
          aria-label={t(globeMode ? 'Passer au plan' : 'Passer au globe')}
          aria-pressed={globeMode}
          onClick={onToggleGlobeMode}
        >
          {globeMode ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M3 9h18M3 15h18M9 4v16M15 4v16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M5.5 6.5a14 14 0 0 0 13 11M18.5 6.5a14 14 0 0 1-13 11" />
            </svg>
          )}
        </button>
        {!globeMode && (
          <button
            className={`map-control-button map-perspective-control${perspectiveCorrectionEnabled ? ' is-active' : ''}`}
            type="button"
            title={t('Perspective corrigée')}
            aria-label={t('Perspective corrigée')}
            aria-pressed={perspectiveCorrectionEnabled}
            onClick={() => {
              const nextEnabled = !perspectiveCorrectionEnabled
              if (!nextEnabled) {
                perspectiveDragRef.current = null
                setPerspectiveDrag(null)
                setPerspectiveOverlap(null)
                setPerspectiveAdjusting(false)
              }
              setPerspectiveCorrectionEnabled(nextEnabled)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 5.5h7v13h-7zM13.5 8h7v8h-7z" />
              <path d="M10.5 8.5h3M10.5 15.5h3" />
            </svg>
          </button>
        )}
        <button
          className="map-control-button"
          type="button"
          title={t('Vue mondiale')}
          aria-label={t('Revenir à la vue mondiale')}
          onClick={() => mapRef.current?.getMap().easeTo({
            center: [0, 0],
            zoom: 1.5,
            duration: 450
          })}
        >
          ◎
        </button>
        {quizTargetFeatureId !== null &&
          savedQuizTargetView?.key === (quizTargetViewKey ?? String(quizTargetFeatureId)) && (
            <button
              className="map-control-button map-projection-control"
              type="button"
              title={t('Revenir à la vue de la question')}
              aria-label={t('Revenir à la vue de la question')}
              onClick={() => {
                const view = savedQuizTargetViewRef.current
                if (!view || view.key !== (quizTargetViewKey ?? String(quizTargetFeatureId))) return
                mapRef.current?.getMap().easeTo({
                  center: view.center,
                  zoom: view.zoom,
                  duration: 450
                })
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="6.5" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          )}
        <button
          className="map-control-button"
          type="button"
          title={t('Zoom avant')}
          aria-label={t('Zoom avant')}
          onClick={() => mapRef.current?.getMap().zoomIn({ duration: 250 })}
        >
          +
        </button>
        <button
          className="map-control-button"
          type="button"
          title={t('Zoom arrière')}
          aria-label={t('Zoom arrière')}
          onClick={() => mapRef.current?.getMap().zoomOut({ duration: 250 })}
        >
          −
        </button>
      </div>

      <div className="map-search">
        <label className="map-search-label" htmlFor="country-search">
          {t('Chercher un pays ou une capitale')}
        </label>
        <div className="map-search-input-row">
          <span aria-hidden="true" className="map-search-icon">⌕</span>
          <input
            id="country-search"
            className="map-search-input"
            type="search"
            placeholder={t('Ex. France, Paris, Canada…')}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchIsOpen && searchQuery.trim().length > 0}
            aria-controls="country-search-results"
            value={searchQuery}
            onChange={(event) => {
              updateInteractionState({
                searchQuery: event.target.value,
                searchIsOpen: true,
                selectedEntityIds: [],
                selectedSourceFeatureId: null,
                selectionSource: null,
                selectedSearchKind: null
              })
              onCountryDeselected?.()
            }}
            onFocus={() => updateInteractionState({ searchIsOpen: true })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') updateInteractionState({ searchIsOpen: false })
              if (event.key === 'Enter' && searchResults[0]) {
                event.preventDefault()
                selectSearchResult(searchResults[0])
              }
            }}
          />
          {searchQuery && (
            <button
              className="map-search-clear"
              type="button"
              aria-label={t('Effacer la recherche et la sélection')}
              onClick={() => {
                updateInteractionState({
                  searchQuery: '',
                  searchIsOpen: false,
                  selectedEntityIds: [],
                  selectedSourceFeatureId: null,
                  selectionSource: null,
                  selectedSearchKind: null
                })
                onCountryDeselected?.()
              }}
            >
              ×
            </button>
          )}
          {selectedSearchCapital && (
            <span
              className="map-search-selected-capital-icon"
              title={`${t('Capitale de')} ${selectedSearchCapital.country.displayName}`}
              aria-label={`${t('Capitale de')} ${selectedSearchCapital.country.displayName}`}
              role="img"
            >
              🏙️
            </span>
          )}
          {selectedSearchCountry?.alpha2 && (
            <img
              className="map-search-selected-flag"
              src={getFlagImageSource(selectedSearchCountry.alpha2)}
              alt={`${t('Drapeau de')} ${selectedSearchCountry.displayName}`}
            />
          )}
        </div>
        {searchIsOpen && searchQuery.trim() && (
          <div
            id="country-search-results"
            className="map-search-results"
            role="listbox"
            aria-label={t('Résultats de recherche')}
          >
            {searchResults.length ? (
              searchResults.map((country) => (
                <button
                  key={country.kind === 'capital'
                    ? `capital:${country.country.sourceFeatureId}:${country.displayName}`
                    : `country:${country.sourceFeatureId}:${country.displayName}`}
                  type="button"
                  className="map-search-result"
                  data-result-kind={country.kind}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectSearchResult(country)}
                >
                  {country.kind === 'capital' ? (
                    <>
                      <span className="map-search-result-capital-icon" aria-hidden="true">🏙️</span>
                      <span className="map-search-result-copy">
                        <span>{country.displayName}</span>
                        <small>{t('Capitale de')} {country.country.displayName}</small>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{country.displayName}</span>
                      {country.alpha2 && (
                        <img
                          className="map-search-result-flag"
                          src={getFlagImageSource(country.alpha2)}
                          alt=""
                        />
                      )}
                    </>
                  )}
                </button>
              ))
            ) : (
              <div className="map-search-empty">{t('Aucun pays ni capitale trouvé')}</div>
            )}
          </div>
        )}
      </div>
      {quizRevealCard && (
        <div className="quiz-reveal-card-anchor">
          {quizRevealCard}
        </div>
      )}
      {(pointerCoordinates || isMatrixSkin) && (
        <div className={`map-coordinate-readout${isMatrixSkin ? ' matrix-map-readout' : ''}`} aria-live="off">
          {pointerCoordinates ? (
            <>
              <span><i>LAT</i> {formatMapCoordinate(pointerCoordinates.latitude)}°</span>
              <span><i>LON</i> {formatMapCoordinate(pointerCoordinates.longitude)}°</span>
            </>
          ) : isMatrixSkin && (
            <span className="matrix-map-readout-idle">SURVOLE LA CARTE</span>
          )}
          {isMatrixSkin && (
            <small>
              PROJ {globeMode ? 'SPHERE' : 'PLAN'} · Z {mapZoom.toFixed(2)}
            </small>
          )}
        </div>
      )}
    </div>
  )
}

function formatMapCoordinate(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`
}

export default WorldMap
