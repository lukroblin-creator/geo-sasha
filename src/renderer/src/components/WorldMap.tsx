
import { useState, useRef, useEffect, useMemo } from 'react'
import type { JSX } from 'react'

import Map, { Source, Layer } from 'react-map-gl/maplibre'

import type {
  MapLayerMouseEvent,
  MapRef
} from 'react-map-gl/maplibre'

import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification
} from 'maplibre-gl'

import type {
  FeatureCollection,
  Geometry,
  Point
} from 'geojson'

import {
  world110m,
  world50m,
  world10m
} from '../data/world'
import countryCatalog from '../data/quiz/countryCatalog.json'
import { additionalMapFlagRegions } from '../data/quiz/additionalMapFlagRegions'
import { flagEmojiFromAlpha2 } from '../data/quiz/flagEmoji'

import {
  getEntityDisplayName,
  getRelatedEntityIds
} from '../data/geography/registry'

import 'maplibre-gl/dist/maplibre-gl.css'

type WorldMapProps = {
  showBorders: boolean
  showLabels: boolean
  quizTargetFeatureId?: string | number | null
  interactionResetKey?: string | number
  onCountrySelected?: (sourceFeatureId: string | number, name: string) => void
}

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

const searchableCountries: SearchableCountry[] = world10m.features.flatMap((feature) => {
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

  return [{
    sourceFeatureId,
    sourceName,
    displayName: entityId
      ? getEntityDisplayName(entityId) ?? sourceName
      : frenchName ?? sourceName,
    alpha2: alpha2BySourceId.get(sourceFeatureKey) ?? null,
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
  quizTargetFeatureId = null,
  interactionResetKey,
  onCountrySelected
}: WorldMapProps): JSX.Element {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
  const [selectedSourceFeatureId, setSelectedSourceFeatureId] = useState<
    string | number | null
  >(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIsOpen, setSearchIsOpen] = useState(false)

  const mapRef = useRef<MapRef>(null)

  const workerRef = useRef<Worker | null>(null)
  const workerReadyRef = useRef(false)
  const workerBusyRef = useRef(false)
  const pendingLabelUpdateRef = useRef<LabelUpdateRequest | null>(null)
  const latestLabelRequestId = useRef(0)

  const [visibleLabels, setVisibleLabels] = useState<
    FeatureCollection<Point, LabelProperties>
  >({
    type: 'FeatureCollection',
    features: []
  })

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

  const selectedSearchCountry = searchIsOpen
    ? null
    : searchableCountries.find((country) => country.displayName === searchQuery)

  const sendLabelUpdate = (request: LabelUpdateRequest): void => {
    const worker = workerRef.current
    if (!worker || !workerReadyRef.current) return

    workerBusyRef.current = true
    worker.postMessage(request)
  }

  const selectSearchResult = (country: SearchableCountry): void => {
    setSearchQuery(country.displayName)
    setSearchIsOpen(false)
    setSelectedEntityIds(
      country.entityId ? getRelatedEntityIds(country.entityId) : []
    )
    setSelectedSourceFeatureId(country.sourceFeatureId)

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

    const bbox: [number, number, number, number] = [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes)
    ]
    const requestId = latestLabelRequestId.current + 1
    latestLabelRequestId.current = requestId

    const request: LabelUpdateRequest = {
      type: 'update',
      bbox,
      zoom: map.getZoom(),
      requestId
    }

    if (workerBusyRef.current) {
      pendingLabelUpdateRef.current = request
      return
    }

    sendLabelUpdate(request)
  }

  const focusOnQuizTarget = (): void => {
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
    const map = mapRef.current?.getMap()

    if (bounds && map) {
      map.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        { padding: 64, maxZoom: 4.5, duration: 650 }
      )
    }
  }

  useEffect(() => {
    focusOnQuizTarget()
  }, [quizTargetFeatureId])

  useEffect(() => {
    setSelectedEntityIds([])
    setSelectedSourceFeatureId(null)
    setSearchIsOpen(false)
  }, [interactionResetKey])

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

  const handleCountryClick = (event: MapLayerMouseEvent): void => {
    setSearchIsOpen(false)
    const feature = event.features?.[0]
    const name = feature?.properties?.name
    const entityId = feature?.properties?.entityId
    const sourceFeatureId = feature?.properties?.sourceId

    if (name) {
      console.log(`Pays sélectionné : ${name}`)
    }

    setSelectedEntityIds(
      entityId ? getRelatedEntityIds(entityId) : []
    )
    setSelectedSourceFeatureId(sourceFeatureId ?? null)
    if (sourceFeatureId !== undefined && name) {
      onCountrySelected?.(sourceFeatureId, String(name))
    }
  }

  const selectedFeatureExpressions: unknown[] = []
  if (selectedEntityIds.length > 0) {
    selectedFeatureExpressions.push([
      'in',
      ['get', 'entityId'],
      ['literal', selectedEntityIds]
    ])
  }
  if (selectedSourceFeatureId !== null) {
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

  const fillColor = [
    'case',
    ['any', ...selectedFeatureExpressions],
    '#e5a63b',
    '#263746'
  ] as unknown as NonNullable<FillLayerSpecification['paint']>['fill-color']

  const fillPaint110m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      2, 1,
      3, 0
    ]
  }

  const fillPaint50m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      2, 0,
      3, 1,
      4, 1,
      5, 0
    ]
  }

  const fillPaint10m: FillLayerSpecification['paint'] = {
    'fill-color': fillColor,
    'fill-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4, 0,
      5, 1
    ]
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
      4, 0,
      5, 1
    ]
  }

  const labelLayout: SymbolLayerSpecification['layout'] = {
    'text-field': ['get', 'name'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 1, 8, 3, 9, 5, 10, 12, 11],
    'text-font': ['Open Sans Regular'],
    'symbol-sort-key': ['get', 'priority'],
    'text-padding': 2,
    'text-allow-overlap': false,
    'text-ignore-placement': false
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
        onLoad={() => {
          updateVisibleLabels()
          focusOnQuizTarget()
        }}
        onMoveEnd={updateVisibleLabels}
        initialViewState={{
          longitude: 0,
          latitude: 20,
          zoom: 1.5
        }}
        minZoom={1}
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
          data={world110m}
        >
          <Layer
            id="countries-fill-110m"
            type="fill"
            minzoom={0}
            maxzoom={3}
            paint={fillPaint110m}
          />

          {showBorders && (
            <Layer
              id="countries-borders-110m"
              type="line"
              minzoom={0}
              maxzoom={3}
              paint={borderPaint110m}
            />
          )}
        </Source>

        {/* Résolution intermédiaire : 50m */}
        <Source
          id="countries-50m"
          type="geojson"
          data={world50m}
        >
          <Layer
            id="countries-fill-50m"
            type="fill"
            minzoom={2}
            maxzoom={5}
            paint={fillPaint50m}
          />

          {showBorders && (
            <Layer
              id="countries-borders-50m"
              type="line"
              minzoom={2}
              maxzoom={5}
              paint={borderPaint50m}
            />
          )}
        </Source>

        {/* Résolution détaillée : 10m */}
        <Source
          id="countries-10m"
          type="geojson"
          data={world10m}
        >
          <Layer
            id="countries-fill-10m"
            type="fill"
            minzoom={4}
            paint={fillPaint10m}
          />

          {showBorders && (
            <Layer
              id="countries-borders-10m"
              type="line"
              minzoom={4}
              paint={borderPaint10m}
            />
          )}
        </Source>

        {/* Étiquettes indépendantes des résolutions */}
        {showLabels && (
          <Source
            id="country-labels"
            type="geojson"
            data={visibleLabels}
          >
            <Layer
              id="countries-labels"
              type="symbol"
              layout={labelLayout}
              paint={labelPaint}
            />
          </Source>
        )}

      </Map>

      <div className="map-search">
        <label className="map-search-label" htmlFor="country-search">
          Chercher un pays
        </label>
        <div className="map-search-input-row">
          <span aria-hidden="true" className="map-search-icon">⌕</span>
          <input
            id="country-search"
            className="map-search-input"
            type="search"
            placeholder="Ex. France, Japon, Canada…"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchIsOpen && searchQuery.trim().length > 0}
            aria-controls="country-search-results"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setSearchIsOpen(true)
              if (!event.target.value.trim()) {
                setSelectedEntityIds([])
                setSelectedSourceFeatureId(null)
              }
            }}
            onFocus={() => setSearchIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchIsOpen(false)
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
              aria-label="Effacer la recherche et la sélection"
              onClick={() => {
                setSearchQuery('')
                setSearchIsOpen(false)
                setSelectedEntityIds([])
                setSelectedSourceFeatureId(null)
              }}
            >
              ×
            </button>
          )}
          {selectedSearchCountry?.alpha2 && (
            <span
              className="map-search-selected-flag"
              role="img"
              aria-label={`Drapeau : ${selectedSearchCountry.displayName}`}
            >
              {flagEmojiFromAlpha2(selectedSearchCountry.alpha2)}
            </span>
          )}
        </div>
        {searchIsOpen && searchQuery.trim() && (
          <div
            id="country-search-results"
            className="map-search-results"
            role="listbox"
            aria-label="Résultats de recherche"
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
                    <span className="map-search-result-flag" aria-hidden="true">
                      {flagEmojiFromAlpha2(country.alpha2)}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="map-search-empty">Aucun pays trouvé</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorldMap
