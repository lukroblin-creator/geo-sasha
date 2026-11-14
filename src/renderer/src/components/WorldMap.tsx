
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties, JSX, ReactNode } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre'
import { LngLat } from 'maplibre-gl'

import type {
  MapLayerMouseEvent,
  MapRef
} from 'react-map-gl/maplibre'

import type {
  Map as MapLibreMap,
  FillLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification
} from 'maplibre-gl'

import type {
  FeatureCollection,
  Geometry,
  Point
} from 'geojson'

import {
  world110mMap,
  world50mMap,
  world10mMap,
  world10m
} from '../data/world'
import countryCatalog from '../data/quiz/countryCatalog.json'
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
import {
  GLOBE_TRANSITION_END_ZOOM,
  GLOBE_TRANSITION_START_ZOOM,
  isGlobeLabelVisible
} from './mapProjectionUtils'
import { useLanguage } from '../data/i18n'

import {
  getEntityDisplayName,
  getEntityById,
  getRelatedEntityIds
} from '../data/geography/registry'
import { geographicEntities } from '../data/geography/entities'

import 'maplibre-gl/dist/maplibre-gl.css'

type WorldMapProps = {
  showBorders: boolean
  showLabels: boolean
  globeMode?: boolean
  onToggleGlobeMode: () => void
  showFlagTerritories?: boolean
  showSelectionFeedback?: boolean
  showWrongAnswerFeedback?: boolean
  quizTargetFeatureId?: string | number | null
  quizBaseRegion?: QuizRegion | null
  quizTargetMaxZoom?: number
  quizTargetViewKey?: string
  quizRevealCard?: ReactNode
  showQuizRevealCard?: boolean
  interactionResetKey?: string | number
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

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
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
  sourceFeatureId: string | number
  sourceName: string
  displayName: string
  alpha2: string | null
  entityId: string | null
  geometry: Geometry
}

type MapInteractionState = {
  resetKey: string | number | undefined
  selectedEntityIds: string[]
  selectedSourceFeatureId: string | number | null
  searchIsOpen: boolean
  searchQuery: string
  selectionSource: 'map' | 'search' | null
}

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
  showSelectionFeedback = false,
  showWrongAnswerFeedback = false,
  quizTargetFeatureId = null,
  quizBaseRegion = null,
  quizTargetMaxZoom,
  quizTargetViewKey,
  quizRevealCard,
  showQuizRevealCard = false,
  interactionResetKey,
  countryAccuracyByAlpha2,
  onCountryDeselected,
  onMapClick,
  onCountrySelected
}: WorldMapProps): JSX.Element {
  const { language, t } = useLanguage()
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null)
  const [mapZoom, setMapZoom] = useState(1.5)
  const [mapViewRevision, setMapViewRevision] = useState(0)
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
    if (!showFlagTerritories || flagOverlayRafRef.current !== null) return
    flagOverlayRafRef.current = window.requestAnimationFrame(() => {
      flagOverlayRafRef.current = null
      const map = mapRef.current?.getMap()
      if (!map) return
      setMapZoom(map.getZoom())
      setMapViewRevision((current) => current + 1)
    })
  }, [showFlagTerritories])

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

    const setWrongAnswerOpacity = (opacity: number): void => {
      for (const layerId of wrongAnswerFillLayerIds) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-opacity', opacity, { validate: false })
        }
      }
    }

    const target = activeWrongAnswerTarget
    if (!target) {
      setWrongAnswerOpacity(0)
      return
    }

    setWrongAnswerOpacity(1)
    const startedAt = performance.now()
    const holdDuration = 55
    const totalDuration = 500
    const animate = (now: number): void => {
      const elapsed = now - startedAt
      const opacity = elapsed <= holdDuration
        ? 1
        : Math.max(0, 1 - (elapsed - holdDuration) / (totalDuration - holdDuration))
      setWrongAnswerOpacity(opacity)

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
      setWrongAnswerOpacity(0)
    }
  }, [activeWrongAnswerTarget?.id, mapLoaded])

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

  const searchResults = useMemo(() => {
    const query = normalizeSearchText(searchQuery)
    if (!query) return []

    return searchableCountries
      .filter((country) =>
        [country.displayName, country.sourceName].some((name) =>
          normalizeSearchText(name).startsWith(query)
        )
      )
      .sort((first, second) => first.displayName.localeCompare(second.displayName, 'fr'))
  }, [searchQuery])

  const selectedSearchCountry = searchIsOpen ||
    (showSelectionFeedback && activeInteractionState.selectionSource === 'map')
    ? null
    : searchableCountries.find((country) => country.displayName === searchQuery)

  const sendLabelUpdate = (request: LabelUpdateRequest): void => {
    const worker = workerRef.current
    if (!worker || !workerReadyRef.current) return

    workerBusyRef.current = true
    worker.postMessage(request)
  }

  const selectSearchResult = (country: SearchableCountry): void => {
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
      searchQuery: country.displayName,
      selectionSource: 'search'
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

  const handleCountryClick = (event: MapLayerMouseEvent): void => {
    const feature = event.features?.[0]
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
    if (!showBorders) {
      setHoveredCountry(null)
      return
    }

    const feature = event.features?.[0]
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
  if (selectedEntityIds.length > 0) {
    selectedFeatureExpressions.push([
      'in',
      ['get', 'entityId'],
      ['literal', selectedEntityIds]
    ])
  } else if (selectedSourceFeatureId !== null) {
    selectedFeatureExpressions.push(['==', ['get', 'sourceId'], selectedSourceFeatureId])
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
  if (showBorders && hoveredCountry?.entityId) {
    hoveredFeatureExpressions.push([
      '==',
      ['get', 'entityId'],
      hoveredCountry.entityId
    ])
  } else if (showBorders && hoveredCountry) {
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

  const selectedFillColor = [
    'case',
    ['any', ...selectedFeatureExpressions],
    '#e5a63b',
    ['any', ...hoveredFeatureExpressions],
    '#34495b',
    '#263746'
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
        '#344252',
        ['<', accuracyRateExpression, 0],
        '#344252',
        [
          'interpolate',
          ['linear'],
          accuracyRateExpression,
          0, '#ffffff',
          1, '#c62828'
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

  const fillPaint110m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    // Crossfading resolutions can expose antialiased polygon edges as faint lines.
    'fill-antialias': showBorders,
    'fill-opacity': fillOpacity110m
  }
  const fillPaint50m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-antialias': showBorders,
    'fill-opacity': fillOpacity50m
  }
  const fillPaint10m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-antialias': showBorders,
    'fill-opacity': fillOpacity10m
  }
  const borderPaint110m: LineLayerSpecification['paint'] = {
    'line-color': '#64748b',
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
    'line-color': '#64748b',
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
    'line-color': '#64748b',
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
    'line-color': '#f4c45e',
    'line-width': ['interpolate', ['linear'], ['zoom'], minZoom, 1.2, maxZoom, 2.4],
    'line-opacity': selectionBoundaryOpacity,
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
    'text-color': '#ffffff',
    'text-halo-color': '#101820',
    'text-halo-width': 1,
    'text-opacity': 1
  }

  return (
    <div className="world-map-shell">
      <Map
        ref={mapRef}
        onLoad={(event) => {
          setMapInstance(event.target)
          setMapLoaded(true)
          setMapZoom(event.target.getZoom())
          updateVisibleLabels()
          focusOnQuizBaseView()
          scheduleFlagOverlayUpdate()
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
          if (showFlagTerritories) scheduleFlagOverlayUpdate()
        }}
        onMoveEnd={() => {
          const map = mapRef.current?.getMap()
          if (map) {
            setMapZoom(map.getZoom())
            setGlobeLabelRevision((current) => current + 1)
          }
          updateVisibleLabels()
          scheduleFlagOverlayUpdate()
        }}
        onIdle={scheduleFlagOverlayUpdate}
        onResize={scheduleFlagOverlayUpdate}
        onMouseMove={handleCountryHover}
        onMouseLeave={() => setHoveredCountry(null)}
        initialViewState={{
          longitude: 0,
          latitude: 0,
          zoom: 1.5
        }}
        minZoom={-1}
        maxZoom={12}
        mapStyle={mapStyle}
        scrollZoom={true}
        interactiveLayerIds={[
          'countries-fill-110m',
          'countries-fill-50m',
          'countries-fill-10m'
        ]}
        onClick={handleCountryClick}
        style={{
          width: '100%',
          height: '100%'
        }}
      >

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
                'fill-color': '#ef4444',
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

          {showSelectionFeedback && (
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
                'fill-color': '#ef4444',
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

          {showSelectionFeedback && (
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
                'fill-color': '#ef4444',
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

          {showSelectionFeedback && (
            <Layer
              id="countries-selected-boundary-10m"
              type="line"
              minzoom={4}
              filter={selectedFeatureFilter}
              paint={selectionBoundaryPaint(4, 8)}
            />
          )}
        </Source>

        {/* Étiquettes indépendantes des résolutions */}
        {showLabels && !showFlagTerritories && (
          <Source
            id="country-labels"
            type="geojson"
            data={labelsForMap}
          >
            <Layer
              id="countries-labels"
              type="symbol"
              layout={labelLayout}
              paint={labelPaint}
            />
          </Source>
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

      {showFlagTerritories && mapInstance && (
        <MapFlagOverlay
          map={mapInstance}
          globeMode={globeMode && mapZoom < GLOBE_TRANSITION_START_ZOOM}
          projectionRevision={flagProjectionRevision}
          revision={mapViewRevision}
          zoom={mapZoom}
          world110m={world110mFlagMap}
          world50m={world50mFlagMap}
          world10m={world10mFlagMap}
          labels={visibleLabels}
          showBorders={showBorders}
          showLabels={showLabels}
          selectedEntityIds={selectedEntityIds}
          selectedSourceFeatureId={selectedSourceFeatureId}
          hoveredCountry={hoveredCountry}
          quizTargetFeatureId={quizTargetFeatureId}
          selectionBoundaryOpacity={selectionBoundaryOpacity}
          wrongAnswerTarget={activeWrongAnswerTarget}
        />
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
          {t('Chercher un pays')}
        </label>
        <div className="map-search-input-row">
          <span aria-hidden="true" className="map-search-icon">⌕</span>
          <input
            id="country-search"
            className="map-search-input"
            type="search"
            placeholder={t('Ex. France, Japon, Canada…')}
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
                selectionSource: null
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
                  selectionSource: null
                })
                onCountryDeselected?.()
              }}
            >
              ×
            </button>
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
                  key={`${country.sourceFeatureId}:${country.displayName}`}
                  type="button"
                  className="map-search-result"
                  role="option"
                  aria-selected={false}
                  onClick={() => selectSearchResult(country)}
                >
                  {country.displayName}
                  {country.alpha2 && (
                    <img
                      className="map-search-result-flag"
                      src={getFlagImageSource(country.alpha2)}
                      alt=""
                    />
                  )}
                </button>
              ))
            ) : (
              <div className="map-search-empty">{t('Aucun pays trouvé')}</div>
            )}
          </div>
        )}
      </div>
      {quizRevealCard && (
        <div className="quiz-reveal-card-anchor">
          {quizRevealCard}
        </div>
      )}
    </div>
  )
}

export default WorldMap
