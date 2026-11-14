import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Geometry, Point, Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { getFlagEdgeImages, getFlagImageLayers, subscribeToFlagImage } from './mapFlagImage'
import {
  getGlobeVisibilityThreshold,
  GLOBE_TRANSITION_END_ZOOM,
  GLOBE_TRANSITION_START_ZOOM,
  isGlobeLabelVisible
} from './mapProjectionUtils'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
}

type HoveredCountry = {
  entityId: string | null
  sourceFeatureId: string | number
} | null

type Bounds = [number, number, number, number]
type GlobeClipContext = {
  centerLongitudeRadians: number
  sinCenterLatitude: number
  cosCenterLatitude: number
  visibilityThreshold: number
}
type SphericalCoordinate = {
  longitudeRadians: number
  sinLatitude: number
  cosLatitude: number
}
type MapCameraSnapshot = {
  longitude: number
  latitude: number
  zoom: number
  width: number
  height: number
}

type FlagOverlayFeature = {
  key: string
  polygons: Array<{ path: string; imageBounds: Bounds; opacity: number }>
  alpha2: string | null
  sourceFeatureIds: Array<string | number>
  entityId: string | null
}

type FlagOverlayBaseline = {
  camera: MapCameraSnapshot
  features: FlagOverlayFeature[]
}

type FlagOverlayLabel = {
  key: string
  name: string
  x: number
  y: number
  priority: number
}

type MapFlagOverlayProps = {
  map: MapLibreMap
  globeMode: boolean
  projectionRevision: number
  revision: number
  zoom: number
  world110m: FeatureCollection<Geometry>
  world50m: FeatureCollection<Geometry>
  world10m: FeatureCollection<Geometry>
  labels: FeatureCollection<Point, LabelProperties>
  showBorders: boolean
  showLabels: boolean
  selectedEntityIds: string[]
  selectedSourceFeatureId: string | number | null
  hoveredCountry: HoveredCountry
  quizTargetFeatureId: string | number | null
  selectionBoundaryOpacity: number
  wrongAnswerTarget: {
    sourceFeatureId: string | number
    entityId: string | null
    id: number
  } | null
}

const boundsCache = new WeakMap<object, Bounds | null>()
const polygonBoundsCache = new WeakMap<object, Bounds | null>()
const sphericalCoordinateCache = new WeakMap<Position, SphericalCoordinate>()

function mercatorY(latitude: number): number {
  const clampedLatitude = Math.max(-85.051129, Math.min(85.051129, latitude))
  const radians = (clampedLatitude * Math.PI) / 180
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI)
}

function getCameraSnapshot(map: MapLibreMap): MapCameraSnapshot {
  const center = map.getCenter()
  const canvas = map.getCanvas()
  return {
    longitude: center.lng,
    latitude: center.lat,
    zoom: map.getZoom(),
    width: canvas.clientWidth,
    height: canvas.clientHeight
  }
}

function getGeometryBounds(geometry: Geometry): Bounds | null {
  if (boundsCache.has(geometry)) return boundsCache.get(geometry) ?? null
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude)
        south = Math.min(south, latitude)
        east = Math.max(east, longitude)
        north = Math.max(north, latitude)
      }
    }
  }

  const bounds: Bounds | null = Number.isFinite(west + south + east + north)
    ? [west, south, east, north]
    : null
  boundsCache.set(geometry, bounds)
  return bounds
}

function getPolygonBounds(polygon: Position[][]): Bounds | null {
  if (polygonBoundsCache.has(polygon)) return polygonBoundsCache.get(polygon) ?? null

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

  const bounds: Bounds | null = Number.isFinite(west + south + east + north)
    ? [west, south, east, north]
    : null
  polygonBoundsCache.set(polygon, bounds)
  return bounds
}

function boundsIntersectViewport(bounds: Bounds, viewport: Bounds): boolean {
  const [west, south, east, north] = viewport
  const unwrappedEast = east < west ? east + 360 : east
  const viewportCenter = (west + unwrappedEast) / 2
  const geometryCenter = (bounds[0] + bounds[2]) / 2
  const worldShift = Math.round((viewportCenter - geometryCenter) / 360) * 360
  const longitudeIntersects =
    unwrappedEast - west >= 360 ||
    [-1, 0, 1].some((copy) => {
      const shift = worldShift + copy * 360
      return bounds[0] + shift <= unwrappedEast && bounds[2] + shift >= west
    })

  return longitudeIntersects && bounds[1] <= north && bounds[3] >= south
}

function createGlobeClipContext(map: MapLibreMap, visibilityThreshold: number): GlobeClipContext {
  const center = map.getCenter()
  const centerLatitude = (center.lat * Math.PI) / 180
  return {
    centerLongitudeRadians: (center.lng * Math.PI) / 180,
    sinCenterLatitude: Math.sin(centerLatitude),
    cosCenterLatitude: Math.cos(centerLatitude),
    visibilityThreshold
  }
}

function getHemisphereDot(coordinate: Position, context: GlobeClipContext): number {
  let sphericalCoordinate = sphericalCoordinateCache.get(coordinate)
  if (!sphericalCoordinate) {
    const latitude = (coordinate[1] * Math.PI) / 180
    sphericalCoordinate = {
      longitudeRadians: (coordinate[0] * Math.PI) / 180,
      sinLatitude: Math.sin(latitude),
      cosLatitude: Math.cos(latitude)
    }
    sphericalCoordinateCache.set(coordinate, sphericalCoordinate)
  }

  return (
    context.sinCenterLatitude * sphericalCoordinate.sinLatitude +
    context.cosCenterLatitude * sphericalCoordinate.cosLatitude *
      Math.cos(sphericalCoordinate.longitudeRadians - context.centerLongitudeRadians)
  )
}

function isPointInsideRing(point: Position, ring: Position[]): boolean {
  if (ring.length < 4) return false

  const pointLongitude = point[0]
  const pointLatitude = point[1]
  let inside = false
  let previousLongitude = pointLongitude + getShortestLongitudeDelta(pointLongitude, ring[0][0])
  const queryLongitude =
    previousLongitude + getShortestLongitudeDelta(previousLongitude, pointLongitude)
  let previousLatitude = ring[0][1]

  for (let index = 1; index < ring.length; index += 1) {
    const longitude = previousLongitude + getShortestLongitudeDelta(
      previousLongitude,
      ring[index][0]
    )
    const latitude = ring[index][1]
    const crossesLatitude = (latitude > pointLatitude) !== (previousLatitude > pointLatitude)
    if (
      crossesLatitude &&
      queryLongitude <
        ((longitude - previousLongitude) * (pointLatitude - previousLatitude)) /
          (latitude - previousLatitude) +
          previousLongitude
    ) {
      inside = !inside
    }
    previousLongitude = longitude
    previousLatitude = latitude
  }

  return inside
}

function getGlobeBoundaryCoordinate(angle: number, context: GlobeClipContext): Position {
  const centerLongitude = context.centerLongitudeRadians
  const center = [
    context.cosCenterLatitude * Math.cos(centerLongitude),
    context.cosCenterLatitude * Math.sin(centerLongitude),
    context.sinCenterLatitude
  ]
  const east = [-Math.sin(centerLongitude), Math.cos(centerLongitude), 0]
  const north = [
    -context.sinCenterLatitude * Math.cos(centerLongitude),
    -context.sinCenterLatitude * Math.sin(centerLongitude),
    context.cosCenterLatitude
  ]
  const boundaryDot = context.visibilityThreshold
  const boundaryRadius = Math.sqrt(Math.max(0, 1 - boundaryDot * boundaryDot))
  const x =
    boundaryDot * center[0] +
    boundaryRadius * (east[0] * Math.cos(angle) + north[0] * Math.sin(angle))
  const y =
    boundaryDot * center[1] +
    boundaryRadius * (east[1] * Math.cos(angle) + north[1] * Math.sin(angle))
  const z =
    boundaryDot * center[2] +
    boundaryRadius * (east[2] * Math.cos(angle) + north[2] * Math.sin(angle))

  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(z) * 180) / Math.PI]
}

function getGlobeBoundaryAngle(coordinate: Position, context: GlobeClipContext): number {
  const longitude = (coordinate[0] * Math.PI) / 180
  const latitude = (coordinate[1] * Math.PI) / 180
  const centerLongitude = context.centerLongitudeRadians
  const centerX = context.cosCenterLatitude * Math.cos(centerLongitude)
  const centerY = context.cosCenterLatitude * Math.sin(centerLongitude)
  const centerZ = context.sinCenterLatitude
  const x = Math.cos(latitude) * Math.cos(longitude)
  const y = Math.cos(latitude) * Math.sin(longitude)
  const z = Math.sin(latitude)
  const tangentX = x - context.visibilityThreshold * centerX
  const tangentY = y - context.visibilityThreshold * centerY
  const tangentZ = z - context.visibilityThreshold * centerZ
  const east = -Math.sin(centerLongitude) * tangentX + Math.cos(centerLongitude) * tangentY
  const north =
    -context.sinCenterLatitude * Math.cos(centerLongitude) * tangentX -
    context.sinCenterLatitude * Math.sin(centerLongitude) * tangentY +
    context.cosCenterLatitude * tangentZ

  return Math.atan2(north, east)
}

function getGlobeBoundaryScreenPath(map: MapLibreMap, context: GlobeClipContext): string {
  const steps = 180
  const points = Array.from({ length: steps }, (_, index) => {
    const coordinate = getGlobeBoundaryCoordinate((index / steps) * Math.PI * 2, context)
    const point = map.project([coordinate[0], coordinate[1]])
    return [point.x, point.y] as const
  })

  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return ''
  return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`
}

function getVisibleBoundaryArc(
  from: Position,
  to: Position,
  ring: Position[],
  context: GlobeClipContext
): Position[] {
  const startAngle = getGlobeBoundaryAngle(from, context)
  const endAngle = getGlobeBoundaryAngle(to, context)
  const positiveDelta = ((endAngle - startAngle + Math.PI * 2) % (Math.PI * 2))
  const negativeDelta = positiveDelta - Math.PI * 2
  const positiveMidpoint = getGlobeBoundaryCoordinate(startAngle + positiveDelta / 2, context)
  const negativeMidpoint = getGlobeBoundaryCoordinate(startAngle + negativeDelta / 2, context)
  const positiveIsInside = isPointInsideRing(positiveMidpoint, ring)
  const negativeIsInside = isPointInsideRing(negativeMidpoint, ring)
  const delta =
    positiveIsInside !== negativeIsInside
      ? positiveIsInside
        ? positiveDelta
        : negativeDelta
      : Math.abs(positiveDelta) <= Math.abs(negativeDelta)
        ? positiveDelta
        : negativeDelta
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 24)))

  return Array.from({ length: steps }, (_, index) =>
    index === steps - 1
      ? to
      : getGlobeBoundaryCoordinate(startAngle + (delta * (index + 1)) / steps, context)
  )
}

function getShortestLongitudeDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

function findVisibilityIntersection(
  from: Position,
  to: Position,
  fromIsVisible: boolean,
  fromDot: number,
  toDot: number,
  context: GlobeClipContext
): Position {
  const longitudeDelta = getShortestLongitudeDelta(from[0], to[0])
  let lower = 0
  let upper = 1
  const dotDelta = toDot - fromDot
  const estimate = Math.max(
    0,
    Math.min(1, dotDelta === 0 ? 0.5 : (context.visibilityThreshold - fromDot) / dotDelta)
  )
  const estimatedCoordinate: Position = [
    from[0] + longitudeDelta * estimate,
    from[1] + (to[1] - from[1]) * estimate
  ]
  const estimatedDot = getHemisphereDot(estimatedCoordinate, context)
  if (Math.abs(estimatedDot - context.visibilityThreshold) < 0.0005) {
    return estimatedCoordinate
  }

  const estimateIsVisible = estimatedDot >= context.visibilityThreshold
  if (estimateIsVisible === fromIsVisible) lower = estimate
  else upper = estimate

  // Refine a linear estimate with a few steps, avoiding the longer search that
  // made each redraw during globe movement expensive.
  for (let step = 0; step < 8; step += 1) {
    const middle = (lower + upper) / 2
    const coordinate: Position = [
      from[0] + longitudeDelta * middle,
      from[1] + (to[1] - from[1]) * middle
    ]
    const middleIsVisible = getHemisphereDot(coordinate, context) >= context.visibilityThreshold
    if (middleIsVisible === fromIsVisible) lower = middle
    else upper = middle
  }

  const fraction = (lower + upper) / 2
  return [from[0] + longitudeDelta * fraction, from[1] + (to[1] - from[1]) * fraction]
}

function clipRingToVisibleGlobe(ring: Position[], context: GlobeClipContext): Position[][] {
  if (ring.length < 4) return []
  if (context.visibilityThreshold <= -1) return [ring]

  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const vertices = isClosed ? ring.slice(0, -1) : ring
  if (vertices.length < 3) return []

  const dots = vertices.map((coordinate) => getHemisphereDot(coordinate, context))
  const isVisible = dots.map((dot) => dot >= context.visibilityThreshold)
  if (isVisible.every(Boolean)) return [isClosed ? ring : [...vertices, vertices[0]]]
  if (isVisible.every((visible) => !visible)) return []

  const visibleParts: Position[][] = []
  for (let startIndex = 0; startIndex < vertices.length; startIndex += 1) {
    const previousIndex = (startIndex + vertices.length - 1) % vertices.length
    if (!isVisible[startIndex] || isVisible[previousIndex]) continue

    const part: Position[] = [
      findVisibilityIntersection(
        vertices[previousIndex],
        vertices[startIndex],
        false,
        dots[previousIndex],
        dots[startIndex],
        context
      )
    ]
    let currentIndex = startIndex

    while (isVisible[currentIndex]) {
      part.push(vertices[currentIndex])
      const nextIndex = (currentIndex + 1) % vertices.length
      if (!isVisible[nextIndex]) {
        part.push(
          findVisibilityIntersection(
            vertices[currentIndex],
            vertices[nextIndex],
            true,
            dots[currentIndex],
            dots[nextIndex],
            context
          )
        )
        break
      }
      currentIndex = nextIndex
    }

    if (part.length >= 3) {
      const exit = part[part.length - 1]
      const boundaryArc = getVisibleBoundaryArc(exit, part[0], ring, context)
      visibleParts.push([...part, ...boundaryArc, part[0]])
    }
  }

  return visibleParts
}

function geometryToScreenShape(
  geometry: Geometry,
  map: MapLibreMap,
  globeClipContext?: GlobeClipContext
): { path: string; bounds: Bounds } | null {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let west = Infinity
  let north = Infinity
  let east = -Infinity
  let south = -Infinity

  const paths: string[] = []
  for (const polygon of polygons) {
    const outerRings = globeClipContext
      ? clipRingToVisibleGlobe(polygon[0] ?? [], globeClipContext)
      : polygon[0]
        ? [polygon[0]]
        : []
    if (outerRings.length === 0) continue

    const rings = [
      ...outerRings,
      ...polygon.slice(1).flatMap((ring) =>
        globeClipContext ? clipRingToVisibleGlobe(ring, globeClipContext) : [ring]
      )
    ]
    const polygonPaths = rings.flatMap((ring) => {
      if (ring.length < 4) return []
      const points = ring.map(([longitude, latitude]) => {
        const point = map.project([longitude, latitude])
        west = Math.min(west, point.x)
        north = Math.min(north, point.y)
        east = Math.max(east, point.x)
        south = Math.max(south, point.y)
        return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
      })
      return [`M ${points.join(' L ')} Z`]
    })
    if (polygonPaths.length > 0) paths.push(polygonPaths.join(' '))
  }

  const path = paths.join(' ')

  if (!path || !Number.isFinite(west + north + east + south)) return null
  return { path, bounds: [west, north, east, south] }
}

function getVisibleScreenBounds(bounds: Bounds, map: MapLibreMap): Bounds | null {
  const visible: Bounds = [
    Math.max(0, bounds[0]),
    Math.max(0, bounds[1]),
    Math.min(map.getCanvas().clientWidth, bounds[2]),
    Math.min(map.getCanvas().clientHeight, bounds[3])
  ]
  return visible[0] < visible[2] && visible[1] < visible[3] ? visible : null
}

function getResolutionOpacity(resolution: '110m' | '50m' | '10m', zoom: number): number {
  if (resolution === '110m') return Math.max(0, Math.min(1, 3 - zoom))
  if (resolution === '50m') return Math.max(0, Math.min(1, zoom < 3 ? zoom - 2 : 5 - zoom))
  return Math.max(0, Math.min(1, zoom - 4))
}

function getOverlayLabelSize(zoom: number): number {
  if (zoom <= 1) return 8
  if (zoom <= 3) return 8 + (zoom - 1) / 2
  if (zoom <= 5) return 9 + (zoom - 3) / 2
  return Math.min(11, 10 + (zoom - 5) * 0.2)
}

function getGlobeOverlayLabelSize(zoom: number): number {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (GLOBE_TRANSITION_START_ZOOM - zoom) /
        (GLOBE_TRANSITION_START_ZOOM - GLOBE_TRANSITION_END_ZOOM)
    )
  )
  const regularSize = getOverlayLabelSize(zoom)
  const globeSize = Math.min(7, getOverlayLabelSize(GLOBE_TRANSITION_END_ZOOM))
  return regularSize + (globeSize - regularSize) * progress
}

let labelMeasureContext: CanvasRenderingContext2D | null | undefined

function getLabelMeasureContext(): CanvasRenderingContext2D | null {
  if (labelMeasureContext !== undefined) return labelMeasureContext
  labelMeasureContext =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  return labelMeasureContext
}

function normalizeId(value: string | number): string {
  const id = String(value)
  return /^\d+$/.test(id) ? String(Number(id)) : id
}

function readProperties(feature: Feature<Geometry>): Record<string, unknown> {
  return (feature.properties ?? {}) as Record<string, unknown>
}

export const MapFlagOverlay = memo(function MapFlagOverlay({
  map,
  globeMode,
  projectionRevision,
  revision,
  zoom,
  world110m,
  world50m,
  world10m,
  labels,
  showBorders,
  showLabels,
  selectedEntityIds,
  selectedSourceFeatureId,
  hoveredCountry,
  quizTargetFeatureId,
  selectionBoundaryOpacity,
  wrongAnswerTarget
}: MapFlagOverlayProps): React.JSX.Element {
  const overlayViewportRef = useRef<HTMLDivElement>(null)
  const overlaySvgRef = useRef<SVGSVGElement>(null)
  const baselineSvgRef = useRef<SVGSVGElement>(null)
  const baseCameraRef = useRef<MapCameraSnapshot | null>(null)
  const baselineCameraRef = useRef<MapCameraSnapshot | null>(null)
  const fallbackCameraFrameRef = useRef<number | null>(null)
  const [cameraRevision, setCameraRevision] = useState(0)
  const width = map.getCanvas().clientWidth
  const height = map.getCanvas().clientHeight
  const globeClipContext = useMemo(
    () =>
      globeMode
        ? createGlobeClipContext(
            map,
            getGlobeVisibilityThreshold(zoom, GLOBE_TRANSITION_START_ZOOM, GLOBE_TRANSITION_END_ZOOM)
          )
        : undefined,
    [cameraRevision, globeMode, map, revision, zoom]
  )
  const globeBoundaryPath = useMemo(
    () =>
      globeClipContext && globeClipContext.visibilityThreshold >= 0
        ? getGlobeBoundaryScreenPath(map, globeClipContext)
        : '',
    [globeClipContext, height, map, width]
  )

  // Le rendu mondial 110m sert de fond temporaire pendant le déplacement.
  // Le calque détaillé le recouvre après le recalcul limité à la zone visible.
  const baseline = useMemo<FlagOverlayBaseline>(() => {
    const features = world110m.features.flatMap((feature, index) => {
      const geometry = feature.geometry
      if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
        return []
      }

      const properties = readProperties(feature)
      const alpha2 = typeof properties.flagAlpha2 === 'string' ? properties.flagAlpha2 : null
      if (!alpha2) return []

      const sourceFeatureId =
        typeof properties.sourceId === 'string' || typeof properties.sourceId === 'number'
          ? properties.sourceId
          : null
      const entityId = typeof properties.entityId === 'string' ? properties.entityId : null
      const rawKey = String(feature.id ?? `${sourceFeatureId ?? 'feature'}-${index}`)

      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

      return polygons.flatMap((polygon, polygonIndex) => {
        const screenShape = geometryToScreenShape(
          { type: 'Polygon', coordinates: polygon },
          map
        )
        if (!screenShape) return []

        return [
          {
            key: `baseline-${rawKey.replace(/[^a-zA-Z0-9_-]/g, '-')}-${polygonIndex}`,
            polygons: [{ path: screenShape.path, imageBounds: screenShape.bounds, opacity: 1 }],
            alpha2,
            sourceFeatureIds: sourceFeatureId === null ? [] : [sourceFeatureId],
            entityId
          }
        ]
      })
    })

    return { camera: getCameraSnapshot(map), features }
  }, [globeMode, height, map, projectionRevision, width, world110m])

  useLayoutEffect(() => {
    baselineCameraRef.current = baseline.camera
    if (baselineSvgRef.current) {
      baselineSvgRef.current.style.transform = 'none'
      baselineSvgRef.current.style.opacity = '0'
    }
  }, [baseline])

  useLayoutEffect(() => {
    baseCameraRef.current = getCameraSnapshot(map)
    if (overlaySvgRef.current) overlaySvgRef.current.style.transform = 'none'
    if (baselineSvgRef.current) baselineSvgRef.current.style.opacity = '0'
  }, [cameraRevision, map, revision, zoom])

  useEffect(() => {
    const updateOverlayTransform = (): void => {
      const overlaySvg = overlaySvgRef.current
      const baseCamera = baseCameraRef.current
      const baselineSvg = baselineSvgRef.current
      const baselineCamera = baselineCameraRef.current
      if (!overlaySvg || !baseCamera) return

      const camera = getCameraSnapshot(map)
      if (globeMode && zoom < GLOBE_TRANSITION_START_ZOOM) {
        // Les transformations affines ne suivent pas la courbure du globe.
        // Le calque détaillé est recalculé régulièrement pendant le déplacement.
        overlaySvg.style.transform = 'none'
        if (baselineSvg) {
          baselineSvg.style.transform = 'none'
          baselineSvg.style.opacity = '0'
        }
        return
      }

      const updateSvgTransform = (
        svg: SVGSVGElement | null,
        referenceCamera: MapCameraSnapshot | null
      ): void => {
        if (!svg || !referenceCamera) return

        if (
          camera.width !== referenceCamera.width ||
          camera.height !== referenceCamera.height ||
          Math.abs(map.getBearing()) > 0.00001 ||
          Math.abs(map.getPitch()) > 0.00001
        ) {
          svg.style.transform = 'none'
          return
        }

        const scale = 2 ** (camera.zoom - referenceCamera.zoom)
        const worldSize = 512 * 2 ** camera.zoom
        const translateX = ((referenceCamera.longitude - camera.longitude) / 360) * worldSize
        const translateY =
          (mercatorY(referenceCamera.latitude) - mercatorY(camera.latitude)) * worldSize
        const transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(6)})`
        if (svg.style.transform !== transform) svg.style.transform = transform
      }

      if (map.isMoving() && baselineSvg && baselineSvg.style.opacity !== '1') {
        baselineSvg.style.opacity = '1'
      }
      updateSvgTransform(baselineSvg, baselineCamera)

      if (
        camera.width !== baseCamera.width ||
        camera.height !== baseCamera.height ||
        Math.abs(map.getBearing()) > 0.00001 ||
        Math.abs(map.getPitch()) > 0.00001
      ) {
        overlaySvg.style.transform = 'none'
        if (
          camera.width === baseCamera.width &&
          camera.height === baseCamera.height &&
          (Math.abs(map.getBearing()) > 0.00001 || Math.abs(map.getPitch()) > 0.00001) &&
          fallbackCameraFrameRef.current === null
        ) {
          fallbackCameraFrameRef.current = window.requestAnimationFrame(() => {
            fallbackCameraFrameRef.current = null
            setCameraRevision((current) => current + 1)
          })
        }
        return
      }

      updateSvgTransform(overlaySvg, baseCamera)
    }

    map.on('render', updateOverlayTransform)
    return () => {
      map.off('render', updateOverlayTransform)
      if (fallbackCameraFrameRef.current !== null) {
        window.cancelAnimationFrame(fallbackCameraFrameRef.current)
      }
    }
  }, [globeMode, map, zoom])

  const overlayFeatures = useMemo<FlagOverlayFeature[]>(() => {
    // Le calque reste limité à la zone visible pour éviter de reprojeter des milliers
    // de sommets inutiles après chaque déplacement de la carte.
    const resolutions = [
      ...(zoom < 3 ? [{ dataset: world110m, id: '110m' }] : []),
      ...(zoom > 2 && zoom < 5 ? [{ dataset: world50m, id: '50m' }] : []),
      ...(zoom > 4 ? [{ dataset: world10m, id: '10m' }] : [])
    ]

    const mapBounds = map.getBounds()
    const viewport: Bounds = [
      mapBounds.getWest(),
      mapBounds.getSouth(),
      mapBounds.getEast(),
      mapBounds.getNorth()
    ]
    const groupedFeatures = new Map<string, FlagOverlayFeature>()

    for (const { dataset, id: resolutionId } of resolutions) {
      const resolutionOpacity = getResolutionOpacity(
        resolutionId as '110m' | '50m' | '10m',
        zoom
      )
      if (resolutionOpacity <= 0) continue
      dataset.features.forEach((feature, index) => {
        const geometry = feature.geometry
        if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
          return
        }

        const geometryBounds = getGeometryBounds(geometry)
        if (!geometryBounds || !boundsIntersectViewport(geometryBounds, viewport)) return

        const properties = readProperties(feature)
        const sourceFeatureId =
          typeof properties.sourceId === 'string' || typeof properties.sourceId === 'number'
            ? properties.sourceId
            : null
        const entityId = typeof properties.entityId === 'string' ? properties.entityId : null
        const alpha2 = typeof properties.flagAlpha2 === 'string' ? properties.flagAlpha2 : null
        const rawKey = String(feature.id ?? `${sourceFeatureId ?? 'feature'}-${index}`)
        const groupId = entityId
          ? `entity:${entityId}`
          : sourceFeatureId !== null
            ? `source:${normalizeId(sourceFeatureId)}`
            : `${resolutionId}:${rawKey}`
        const key = groupId.replace(/[^a-zA-Z0-9_-]/g, '-')

        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

        for (const polygon of polygons) {
          const polygonBounds = getPolygonBounds(polygon)
          if (!polygonBounds || !boundsIntersectViewport(polygonBounds, viewport)) continue

          const screenShape = geometryToScreenShape(
            { type: 'Polygon', coordinates: polygon },
            map,
            globeClipContext
          )
          if (!screenShape) continue
          const visibleBounds = getVisibleScreenBounds(screenShape.bounds, map)
          if (!visibleBounds) continue

          let group = groupedFeatures.get(key)
          if (!group) {
            group = {
              key,
              polygons: [],
              alpha2,
              sourceFeatureIds: [],
              entityId
            }
            groupedFeatures.set(key, group)
          }
          if (!group.alpha2 && alpha2) group.alpha2 = alpha2

          if (!group.polygons.some((polygon) => polygon.path === screenShape.path)) {
            group.polygons.push({
              path: screenShape.path,
              imageBounds: visibleBounds,
              opacity: resolutionOpacity
            })
          }
          if (
            sourceFeatureId !== null &&
            !group.sourceFeatureIds.some((id) => normalizeId(id) === normalizeId(sourceFeatureId))
          ) {
            group.sourceFeatureIds.push(sourceFeatureId)
          }
        }
      })
    }

    return Array.from(groupedFeatures.values())
  }, [cameraRevision, globeMode, map, revision, world10m, world110m, world50m, zoom])

  const allFlagFeatures = useMemo(
    () => [...baseline.features, ...overlayFeatures],
    [baseline.features, overlayFeatures]
  )
  const visibleFlagCodes = useMemo(
    () =>
      Array.from(
        new Set(allFlagFeatures.flatMap((feature) => (feature.alpha2 ? [feature.alpha2] : [])))
      ),
    [allFlagFeatures]
  )
  const [flagImageRevision, setFlagImageRevision] = useState(0)
  const flagImageRefreshFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const refreshFlagImages = (): void => {
      if (flagImageRefreshFrameRef.current !== null) return
      flagImageRefreshFrameRef.current = window.requestAnimationFrame(() => {
        flagImageRefreshFrameRef.current = null
        setFlagImageRevision((current) => current + 1)
      })
    }
    const unsubscribe = visibleFlagCodes.map((alpha2) =>
      subscribeToFlagImage(alpha2, refreshFlagImages)
    )

    return () => unsubscribe.forEach((removeListener) => removeListener())
  }, [visibleFlagCodes])

  useEffect(
    () => () => {
      if (flagImageRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(flagImageRefreshFrameRef.current)
      }
    },
    []
  )

  const flagImageLayers = useMemo(
    () =>
      new Map(
        allFlagFeatures.flatMap((feature) =>
          feature.alpha2
            ? [
                [
                  feature.key,
                  feature.polygons.map((polygon, index) => ({
                    clipId: `${feature.key}-${index}`,
                    opacity: polygon.opacity,
                    layers: getFlagImageLayers(
                      feature.alpha2!,
                      polygon.imageBounds,
                      getFlagEdgeImages(feature.alpha2!)
                    )
                  }))
                ] as const
              ]
            : []
        )
      ),
    [allFlagFeatures, flagImageRevision]
  )

  const overlayLabels = useMemo<FlagOverlayLabel[]>(() => {
    if (!showLabels) return []
    const textSize = globeMode ? getGlobeOverlayLabelSize(zoom) : getOverlayLabelSize(zoom)
    const context = getLabelMeasureContext()
    if (context) context.font = `${textSize}px "Open Sans", Arial, sans-serif`

    const candidates = labels.features.flatMap((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates
      const point = map.project([longitude, latitude])
      const properties = feature.properties
      if (
        point.x < -100 ||
        point.y < -40 ||
        point.x > map.getCanvas().clientWidth + 100 ||
        point.y > map.getCanvas().clientHeight + 40 ||
        (globeMode &&
          !isGlobeLabelVisible(
            map,
            [longitude, latitude],
            zoom,
            GLOBE_TRANSITION_START_ZOOM,
            GLOBE_TRANSITION_END_ZOOM
          ))
      ) {
        return []
      }
      return [
        {
          key: `${properties.name}-${index}`,
          name: properties.name,
          x: point.x,
          y: point.y,
          priority: properties.priority
        }
      ]
    })

    // La couche MapLibre évite normalement les chevauchements. Comme les
    // drapeaux sont dessinés au-dessus de sa carte, on reprend cette règle ici.
    candidates.sort((first, second) => first.priority - second.priority)
    const placed: FlagOverlayLabel[] = []
    const occupied: Bounds[] = []

    for (const candidate of candidates) {
      if (globeMode) {
        placed.push(candidate)
        continue
      }

      const textWidth = context
        ? context.measureText(candidate.name).width
        : candidate.name.length * textSize * 0.58
      const halfWidth = (textWidth + 6) / 2
      const halfHeight = (textSize + 4) / 2
      const bounds: Bounds = [
        candidate.x - halfWidth,
        candidate.y - halfHeight,
        candidate.x + halfWidth,
        candidate.y + halfHeight
      ]
      const collides = occupied.some(
        (other) =>
          bounds[0] < other[2] &&
          bounds[2] > other[0] &&
          bounds[1] < other[3] &&
          bounds[3] > other[1]
      )
      if (collides) continue
      placed.push(candidate)
      occupied.push(bounds)
    }

    return placed
  }, [cameraRevision, labels, map, revision, showLabels, zoom])

  if (width <= 0 || height <= 0) return <></>

  const textSize = globeMode ? getGlobeOverlayLabelSize(zoom) : getOverlayLabelSize(zoom)
  const selectionLineWidth = 1.2 + (Math.min(zoom, 8) / 8) * 1.2

  const isSelected = (feature: FlagOverlayFeature): boolean => {
    const selectedFromMap =
      selectedEntityIds.length > 0
        ? feature.entityId !== null && selectedEntityIds.includes(feature.entityId)
        : feature.sourceFeatureIds.some(
            (sourceFeatureId) =>
              selectedSourceFeatureId !== null &&
              normalizeId(sourceFeatureId) === normalizeId(selectedSourceFeatureId)
          )
    const selectedForQuiz = feature.sourceFeatureIds.some(
      (sourceFeatureId) =>
        quizTargetFeatureId !== null && Number(sourceFeatureId) === Number(quizTargetFeatureId)
    )
    return selectedFromMap || selectedForQuiz
  }

  const isHovered = (feature: FlagOverlayFeature): boolean => {
    if (!showBorders || !hoveredCountry) return false
    return hoveredCountry.entityId !== null
      ? feature.entityId === hoveredCountry.entityId
      : feature.sourceFeatureIds.some(
          (sourceFeatureId) =>
            normalizeId(sourceFeatureId) === normalizeId(hoveredCountry.sourceFeatureId)
        )
  }

  const isWrongAnswer = (feature: FlagOverlayFeature): boolean => {
    if (!wrongAnswerTarget) return false
    return wrongAnswerTarget.entityId !== null
      ? feature.entityId === wrongAnswerTarget.entityId
      : feature.sourceFeatureIds.some(
          (sourceFeatureId) =>
            normalizeId(sourceFeatureId) === normalizeId(wrongAnswerTarget.sourceFeatureId)
        )
  }

  return (
    <div ref={overlayViewportRef} className="map-flag-overlay-viewport">
      <svg
        ref={baselineSvgRef}
        className="map-flag-overlay map-flag-overlay-baseline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        style={{ opacity: 0 }}
      >
        <defs>
          {globeBoundaryPath && (
            <clipPath id="map-flag-globe-boundary-baseline" clipPathUnits="userSpaceOnUse">
              <path d={globeBoundaryPath} />
            </clipPath>
          )}
          {baseline.features.flatMap((feature) =>
            feature.polygons.map(({ path }, index) => (
              <clipPath
                key={`${feature.key}-${index}`}
                id={`map-flag-clip-baseline-${feature.key}-${index}`}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={path} fillRule="evenodd" clipRule="evenodd" />
              </clipPath>
            ))
          )}
        </defs>

        <g
          clipPath={
            globeBoundaryPath ? 'url(#map-flag-globe-boundary-baseline)' : undefined
          }
        >
          {baseline.features.map((feature) => (
            <g key={feature.key}>
              {(flagImageLayers.get(feature.key) ?? []).map(({ clipId, layers }) => (
                <g key={clipId} clipPath={`url(#map-flag-clip-baseline-${clipId})`}>
                  {layers.map((layer) => (
                    <image
                      key={layer.key}
                      href={layer.href}
                      x={layer.x}
                      y={layer.y}
                      width={layer.width}
                      height={layer.height}
                      preserveAspectRatio="none"
                    />
                  ))}
                </g>
              ))}
              {isWrongAnswer(feature) && feature.polygons.map(({ path }, index) => (
                <path
                  key={`wrong-answer-${wrongAnswerTarget?.id}-${feature.key}-${index}`}
                  className="map-wrong-answer-highlight"
                  d={path}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>

      <svg
        ref={overlaySvgRef}
        className="map-flag-overlay"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <defs>
          {globeBoundaryPath && (
            <clipPath id="map-flag-globe-boundary" clipPathUnits="userSpaceOnUse">
              <path d={globeBoundaryPath} />
            </clipPath>
          )}
          {overlayFeatures.flatMap((feature) =>
            feature.alpha2
              ? [
                  ...feature.polygons.map(({ path }, index) => (
                    <clipPath
                      key={`${feature.key}-${index}`}
                      id={`map-flag-clip-detail-${feature.key}-${index}`}
                      clipPathUnits="userSpaceOnUse"
                    >
                      <path
                        d={path}
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </clipPath>
                  ))
                ]
              : []
          )}
        </defs>

        <g clipPath={globeBoundaryPath ? 'url(#map-flag-globe-boundary)' : undefined}>
          {overlayFeatures.map((feature) => (
            <g key={feature.key}>
              {feature.alpha2 && (
                <g>
                  {(flagImageLayers.get(feature.key) ?? []).map(({ clipId, layers, opacity }) => (
                    <g
                      key={clipId}
                      clipPath={`url(#map-flag-clip-detail-${clipId})`}
                      opacity={opacity}
                    >
                      {layers.map((layer) => (
                        <image
                          key={layer.key}
                          href={layer.href}
                          x={layer.x}
                          y={layer.y}
                          width={layer.width}
                          height={layer.height}
                          preserveAspectRatio="none"
                        />
                      ))}
                    </g>
                  ))}
                </g>
              )}
              {feature.polygons.map(({ path }, index) => (
                <g key={`${feature.key}-shape-${index}`}>
                  {isSelected(feature) && <path d={path} fill="#e5a63b" />}
                  {!isSelected(feature) && isHovered(feature) && (
                    <path d={path} fill="#ffffff" fillOpacity={0.24} />
                  )}
                  {isWrongAnswer(feature) && (
                    <path
                      key={`wrong-answer-${wrongAnswerTarget?.id}`}
                      className="map-wrong-answer-highlight"
                      d={path}
                    />
                  )}
                  {showBorders && (
                    <path
                      d={path}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="0.7"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {selectionBoundaryOpacity > 0 && isSelected(feature) && (
                    <path
                      d={path}
                      fill="none"
                      stroke="#f4c45e"
                      strokeWidth={selectionLineWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={selectionBoundaryOpacity}
                    />
                  )}
                </g>
              ))}
            </g>
          ))}

          {overlayLabels.map((label) => (
            <text
              key={label.key}
              x={label.x}
              y={label.y}
              fill="#ffffff"
              stroke="#101820"
              strokeWidth="2"
              strokeLinejoin="round"
              paintOrder="stroke"
              fontFamily="Open Sans, Arial, sans-serif"
              fontSize={textSize}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label.name}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
})
