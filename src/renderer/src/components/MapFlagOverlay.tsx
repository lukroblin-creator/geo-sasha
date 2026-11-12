import { useMemo } from 'react'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { getFlagImageSource } from '../data/quiz/flagAssets'

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

type FlagOverlayFeature = {
  key: string
  path: string
  bounds: Bounds
  alpha2: string | null
  sourceFeatureId: string | number | null
  entityId: string | null
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
}

const boundsCache = new WeakMap<object, Bounds | null>()

function getGeometryBounds(geometry: Geometry): Bounds | null {
  if (boundsCache.has(geometry)) return boundsCache.get(geometry) ?? null
  const polygons = geometry.type === 'Polygon'
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

function boundsIntersectViewport(bounds: Bounds, map: MapLibreMap): boolean {
  const viewport = map.getBounds()
  const west = viewport.getWest()
  const east = viewport.getEast()
  const longitudeIntersects = east - west >= 360 || (
    west <= east
      ? bounds[0] <= east && bounds[2] >= west
      : bounds[2] >= west || bounds[0] <= east
  )

  return longitudeIntersects && bounds[1] <= viewport.getNorth() && bounds[3] >= viewport.getSouth()
}

function geometryToScreenShape(
  geometry: Geometry,
  map: MapLibreMap
): { path: string; bounds: Bounds } | null {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  let west = Infinity
  let north = Infinity
  let east = -Infinity
  let south = -Infinity

  const path = polygons.flatMap((polygon) =>
    polygon.flatMap((ring) => {
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
  ).join(' ')

  if (!Number.isFinite(west + north + east + south)) return null
  return { path, bounds: [west, north, east, south] }
}

function getOverlayLabelSize(zoom: number): number {
  if (zoom <= 1) return 8
  if (zoom <= 3) return 8 + (zoom - 1) / 2
  if (zoom <= 5) return 9 + (zoom - 3) / 2
  return Math.min(11, 10 + ((zoom - 5) * 0.2))
}

let labelMeasureContext: CanvasRenderingContext2D | null | undefined

function getLabelMeasureContext(): CanvasRenderingContext2D | null {
  if (labelMeasureContext !== undefined) return labelMeasureContext
  labelMeasureContext = typeof document === 'undefined'
    ? null
    : document.createElement('canvas').getContext('2d')
  return labelMeasureContext
}

function normalizeId(value: string | number): string {
  const id = String(value)
  return /^\d+$/.test(id) ? String(Number(id)) : id
}

function readProperties(feature: Feature<Geometry>): Record<string, unknown> {
  return (feature.properties ?? {}) as Record<string, unknown>
}

export function MapFlagOverlay({
  map,
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
  selectionBoundaryOpacity
}: MapFlagOverlayProps): React.JSX.Element {
  const overlayFeatures = useMemo<FlagOverlayFeature[]>(() => {
    const dataset = zoom < 2.5 ? world110m : zoom < 4.5 ? world50m : world10m

    return dataset.features.flatMap((feature, index) => {
      const geometry = feature.geometry
      if (
        !geometry ||
        (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
      ) {
        return []
      }

      const geometryBounds = getGeometryBounds(geometry)
      if (!geometryBounds || !boundsIntersectViewport(geometryBounds, map)) return []

      const properties = readProperties(feature)
      const sourceFeatureId = typeof properties.sourceId === 'string' ||
        typeof properties.sourceId === 'number'
        ? properties.sourceId
        : null
      const entityId = typeof properties.entityId === 'string' ? properties.entityId : null
      const alpha2 = typeof properties.flagAlpha2 === 'string' ? properties.flagAlpha2 : null
      const rawKey = String(feature.id ?? `${sourceFeatureId ?? 'feature'}-${index}`)
      const key = rawKey.replace(/[^a-zA-Z0-9_-]/g, '-')

      const screenShape = geometryToScreenShape(geometry, map)
      if (!screenShape) return []

      return [{
        key,
        path: screenShape.path,
        bounds: screenShape.bounds,
        alpha2,
        sourceFeatureId,
        entityId
      }]
    })
  }, [map, revision, world10m, world110m, world50m, zoom])

  const overlayLabels = useMemo<FlagOverlayLabel[]>(() => {
    if (!showLabels) return []
    const textSize = getOverlayLabelSize(zoom)
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
        point.y > map.getCanvas().clientHeight + 40
      ) {
        return []
      }
      return [{
        key: `${properties.name}-${index}`,
        name: properties.name,
        x: point.x,
        y: point.y,
        priority: properties.priority
      }]
    })

    // La couche MapLibre évite normalement les chevauchements. Comme les
    // drapeaux sont dessinés au-dessus de sa carte, on reprend cette règle ici.
    candidates.sort((first, second) => first.priority - second.priority)
    const placed: FlagOverlayLabel[] = []
    const occupied: Bounds[] = []

    for (const candidate of candidates) {
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
      const collides = occupied.some((other) =>
        bounds[0] < other[2] && bounds[2] > other[0] &&
        bounds[1] < other[3] && bounds[3] > other[1]
      )
      if (collides) continue
      placed.push(candidate)
      occupied.push(bounds)
    }

    return placed
  }, [labels, map, revision, showLabels, zoom])

  const width = map.getCanvas().clientWidth
  const height = map.getCanvas().clientHeight
  if (width <= 0 || height <= 0) return <></>

  const textSize = getOverlayLabelSize(zoom)
  const selectionLineWidth = 1.2 + Math.min(zoom, 8) / 8 * 1.2

  const isSelected = (feature: FlagOverlayFeature): boolean => {
    const selectedFromMap = selectedEntityIds.length > 0
      ? feature.entityId !== null && selectedEntityIds.includes(feature.entityId)
      : feature.sourceFeatureId !== null &&
        selectedSourceFeatureId !== null &&
        normalizeId(feature.sourceFeatureId) === normalizeId(selectedSourceFeatureId)
    const selectedForQuiz = feature.sourceFeatureId !== null &&
      quizTargetFeatureId !== null &&
      Number(feature.sourceFeatureId) === Number(quizTargetFeatureId)
    return selectedFromMap || selectedForQuiz
  }

  const isHovered = (feature: FlagOverlayFeature): boolean => {
    if (!showBorders || !hoveredCountry) return false
    return hoveredCountry.entityId !== null
      ? feature.entityId === hoveredCountry.entityId
      : feature.sourceFeatureId !== null &&
        normalizeId(feature.sourceFeatureId) === normalizeId(hoveredCountry.sourceFeatureId)
  }

  return (
    <svg
      className="map-flag-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        {overlayFeatures.flatMap((feature) => feature.alpha2
          ? [
              <clipPath
                key={feature.key}
                id={`map-flag-clip-${feature.key}`}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={feature.path} fillRule="evenodd" />
              </clipPath>
            ]
          : [])}
      </defs>

      {overlayFeatures.map((feature) => (
        <g key={feature.key}>
          {feature.alpha2 && (
            <image
              href={getFlagImageSource(feature.alpha2)}
              x={feature.bounds[0]}
              y={feature.bounds[1]}
              width={Math.max(1, feature.bounds[2] - feature.bounds[0])}
              height={Math.max(1, feature.bounds[3] - feature.bounds[1])}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#map-flag-clip-${feature.key})`}
            />
          )}
          {isSelected(feature) && (
            <path d={feature.path} fill="#e5a63b" />
          )}
          {!isSelected(feature) && isHovered(feature) && (
            <path d={feature.path} fill="#34495b" />
          )}
          {showBorders && (
            <path
              d={feature.path}
              fill="none"
              stroke="#64748b"
              strokeWidth="0.7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {selectionBoundaryOpacity > 0 && isSelected(feature) && (
            <path
              d={feature.path}
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
    </svg>
  )
}
