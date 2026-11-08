
import Map, { Source, Layer } from 'react-map-gl/maplibre'

import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import countries from '../data/world'

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
  const handleCountryClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const name = feature?.properties?.name

    if (name) {
      console.log(`Pays sélectionné : ${name}`)
    }
  }

  return (
    <Map
      initialViewState={{
        longitude: 0,
        latitude: 20,
        zoom: 1.5
      }}
      minZoom={1}
      maxZoom={12}
      mapStyle={mapStyle}
      scrollZoom={true}
      interactiveLayerIds={['countries-fill']}
      onClick={handleCountryClick}
      style={{
        width: '100%',
        height: '100%'
      }}
    >
      <Source
        id="countries"
        type="geojson"
        data={countries}
      >
        <Layer
          id="countries-fill"
          type="fill"
          paint={{
            'fill-color': '#263746',
            'fill-opacity': 1
          }}
        />

        {showBorders && (
          <Layer
            id="countries-borders"
            type="line"
            paint={{
              'line-color': '#64748b',
              'line-width': 0.7
            }}
          />
        )}

        {showLabels && (
          <Layer
            id="countries-labels"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 10,
              'text-font': ['Open Sans Regular']
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#101820',
              'text-halo-width': 1
            }}
          />
        )}
      </Source>
    </Map>
  )
}

export default WorldMap
