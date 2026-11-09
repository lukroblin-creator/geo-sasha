
import { useState, useRef } from 'react'

import Map, { Source, Layer } from 'react-map-gl/maplibre'
import type {
  MapLayerMouseEvent,
  MapRef
} from 'react-map-gl/maplibre'

import {
  world110m,
  world50m,
  world10m
} from '../data/world'

import { getRelatedEntityIds } from '../data/geography/registry'

import { createVisibleCountryLabels } from '../data/geography/labels'

import 'maplibre-gl/dist/maplibre-gl.css'

type WorldMapProps = {
  showBorders: boolean
  showLabels: boolean
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

function WorldMap({ showBorders, showLabels }: WorldMapProps) {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])

  const mapRef = useRef<MapRef>(null)

  const [visibleLabels, setVisibleLabels] = useState(() =>
    createVisibleCountryLabels(world10m, [-180, -85, 180, 85])
  )

  const updateVisibleLabels = () => {
    const map = mapRef.current

    if (!map) return

    const bounds = map.getMap().getBounds()

    const southwest = bounds.getSouthWest()
    const northeast = bounds.getNorthEast()

    const bbox: [number, number, number, number] = [
      southwest.lng,
      southwest.lat,
      northeast.lng,
      northeast.lat
    ]

    setVisibleLabels(
      createVisibleCountryLabels(world10m, bbox)
    )
  }

  const lastLabelUpdate = useRef(0)

  const handleMapMove = () => {
    const now = Date.now()

    // Limite les recalculs à environ 8 par seconde.
    if (now - lastLabelUpdate.current < 120) return

    lastLabelUpdate.current = now

    updateVisibleLabels()
  }

  const handleCountryClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const name = feature?.properties?.name
    const entityId = feature?.properties?.entityId

    if (name) {
      console.log(`Pays sélectionné : ${name}`)
    }

    if (entityId) {
      setSelectedEntityIds(getRelatedEntityIds(entityId))
    }
  }

  const fillColor = [
    'case',
    [
      'in',
      ['get', 'entityId'],
      ['literal', selectedEntityIds]
    ],
    '#e5a63b',
    '#263746'
  ] as const

  const fillPaint110m = {
    'fill-color': fillColor,
    'fill-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      2, 1,
      3, 0
    ]
  }

  const fillPaint50m = {
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

  const fillPaint10m = {
    'fill-color': fillColor,
    'fill-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4, 0,
      5, 1
    ]
  }

  const borderPaint110m = {
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

  const borderPaint50m = {
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

  const borderPaint10m = {
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

  const labelLayout = {
    'text-field': ['get', 'name'],
    'text-size': 10,
    'text-font': ['Open Sans Regular'],
    'text-allow-overlap': true,
    'text-ignore-placement': true
  }

  const labelPaint = {
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
