import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Geometry, Point, Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { getFlagEdgeImages, getFlagImageLayers, subscribeToFlagImage } from './mapFlagImage'
import {
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
type MapCameraSnapshot = {
  longitude: number
  latitude: number
  zoom: number
  width: number
  height: number
}

type FlagOverlayFeature = {
  key: string
  paths: string[]
  bounds: Bounds
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
const polygonBoundsCache = new WeakMap<object, Bounds | null>()

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

function geometryToScreenShape(
  geometry: Geometry,
  map: MapLibreMap
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

  const path = polygons
    .flatMap((polygon) =>
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
    )
    .join(' ')

  if (!Number.isFinite(west + north + east + south)) return null
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

function unionBounds(first: Bounds, second: Bounds): Bounds {
  return [
    Math.min(first[0], second[0]),
    Math.min(first[1], second[1]),
    Math.max(first[2], second[2]),
    Math.max(first[3], second[3])
  ]
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
  const overlayViewportRef = useRef<HTMLDivElement>(null)
  const overlaySvgRef = useRef<SVGSVGElement>(null)
  const baselineSvgRef = useRef<SVGSVGElement>(null)
  const baseCameraRef = useRef<MapCameraSnapshot | null>(null)
  const baselineCameraRef = useRef<MapCameraSnapshot | null>(null)
  const fallbackCameraFrameRef = useRef<number | null>(null)
  const [cameraRevision, setCameraRevision] = useState(0)
  const width = map.getCanvas().clientWidth
  const height = map.getCanvas().clientHeight

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

      const screenShape = geometryToScreenShape(geometry, map)
      if (!screenShape) return []

      const sourceFeatureId =
        typeof properties.sourceId === 'string' || typeof properties.sourceId === 'number'
          ? properties.sourceId
          : null
      const entityId = typeof properties.entityId === 'string' ? properties.entityId : null
      const rawKey = String(feature.id ?? `${sourceFeatureId ?? 'feature'}-${index}`)

      return [
        {
          key: `baseline-${rawKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
          paths: [screenShape.path],
          bounds: screenShape.bounds,
          alpha2,
          sourceFeatureIds: sourceFeatureId === null ? [] : [sourceFeatureId],
          entityId
        }
      ]
    })

    return { camera: getCameraSnapshot(map), features }
  }, [height, map, width, world110m])

  useLayoutEffect(() => {
    baselineCameraRef.current = baseline.camera
    if (baselineSvgRef.current) baselineSvgRef.current.style.transform = 'none'
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

          const screenShape = geometryToScreenShape({ type: 'Polygon', coordinates: polygon }, map)
          if (!screenShape) continue
          const visibleBounds = getVisibleScreenBounds(screenShape.bounds, map)
          if (!visibleBounds) continue

          let group = groupedFeatures.get(key)
          if (!group) {
            group = {
              key,
              paths: [],
              bounds: visibleBounds,
              alpha2,
              sourceFeatureIds: [],
              entityId
            }
            groupedFeatures.set(key, group)
          } else group.bounds = unionBounds(group.bounds, visibleBounds)
          if (!group.alpha2 && alpha2) group.alpha2 = alpha2

          if (!group.paths.includes(screenShape.path)) group.paths.push(screenShape.path)
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
  }, [cameraRevision, map, revision, world10m, world110m, world50m, zoom])

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
                  getFlagImageLayers(
                    feature.alpha2,
                    feature.bounds,
                    getFlagEdgeImages(feature.alpha2)
                  )
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
        (globeMode && !isGlobeLabelVisible(
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
          {baseline.features.map((feature) => (
            <clipPath
              key={feature.key}
              id={`map-flag-clip-${feature.key}`}
              clipPathUnits="userSpaceOnUse"
            >
              {feature.paths.map((path, index) => (
                <path
                  key={`${feature.key}-${index}`}
                  d={path}
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              ))}
            </clipPath>
          ))}
        </defs>

        {baseline.features.map((feature) => (
          <g key={feature.key} clipPath={`url(#map-flag-clip-${feature.key})`}>
            {(flagImageLayers.get(feature.key) ?? []).map((layer) => (
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
          {overlayFeatures.flatMap((feature) =>
            feature.alpha2
              ? [
                  <clipPath
                    key={feature.key}
                    id={`map-flag-clip-${feature.key}`}
                    clipPathUnits="userSpaceOnUse"
                  >
                    {feature.paths.map((path, index) => (
                      <path
                        key={`${feature.key}-${index}`}
                        d={path}
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    ))}
                  </clipPath>
                ]
              : []
          )}
        </defs>

        {overlayFeatures.map((feature) => (
          <g key={feature.key}>
            {feature.alpha2 && (
              <g clipPath={`url(#map-flag-clip-${feature.key})`}>
                {(flagImageLayers.get(feature.key) ?? []).map((layer) => (
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
            )}
            {feature.paths.map((path, index) => (
              <g key={`${feature.key}-shape-${index}`}>
                {isSelected(feature) && <path d={path} fill="#e5a63b" />}
                {!isSelected(feature) && isHovered(feature) && (
                  <path d={path} fill="#ffffff" fillOpacity={0.24} />
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
      </svg>
    </div>
  )
})
