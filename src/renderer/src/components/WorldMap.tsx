
import { useState, useRef, useEffect } from 'react'
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
  Point
} from 'geojson'

import {
  world110m,
  world50m,
  world10m
} from '../data/world'

import { getRelatedEntityIds } from '../data/geography/registry'

import 'maplibre-gl/dist/maplibre-gl.css'

type WorldMapProps = {
  showBorders: boolean
  showLabels: boolean
  onCountrySelected?: (sourceFeatureId: string | number, name: string) => void
}

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
}

type WorkerResponse = {
  type: 'ready' | 'labels'
  requestId?: number
  labels?: FeatureCollection<Point, LabelProperties>
}

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

function WorldMap({ showBorders, showLabels, onCountrySelected }: WorldMapProps): JSX.Element {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
  const [selectedSourceFeatureId, setSelectedSourceFeatureId] = useState<
    string | number | null
  >(null)

  const mapRef = useRef<MapRef>(null)

  const workerRef = useRef<Worker | null>(null)
  const workerReadyRef = useRef(false)
  const latestLabelRequestId = useRef(0)

  const [visibleLabels, setVisibleLabels] = useState<
    FeatureCollection<Point, LabelProperties>
  >({
    type: 'FeatureCollection',
    features: []
  })

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

    worker.postMessage({
      type: 'update',
      bbox,
      zoom: map.getZoom(),
      requestId
    })
  }

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
        if (message.requestId !== latestLabelRequestId.current) return
        setVisibleLabels(message.labels)
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
      workerRef.current = null
      worker.terminate()
    }
  }, [])

  const lastLabelUpdate = useRef(0)

  const handleMapMove = (): void => {
    const now = Date.now()

    // Limite les demandes de recalcul à environ 8 par seconde.
    if (now - lastLabelUpdate.current < 120) return


    lastLabelUpdate.current = now

    updateVisibleLabels()
  }

  const handleCountryClick = (event: MapLayerMouseEvent): void => {
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

  const fillColor = [
    'case',
    [
      'any',
      ['in', ['get', 'entityId'], ['literal', selectedEntityIds]],
      ['==', ['get', 'sourceId'], selectedSourceFeatureId]
    ],
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
    'text-size': 10,
    'text-font': ['Open Sans Regular'],
    'text-allow-overlap': true,
    'text-ignore-placement': true
  }

  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': '#ffffff',
    'text-halo-color': '#101820',
    'text-halo-width': 1,
    'text-opacity': 1
  }

  return (
    <>
      <Map
        ref={mapRef}
        onLoad={updateVisibleLabels}
        onMove={handleMapMove}
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
    </>
  )
}

export default WorldMap
