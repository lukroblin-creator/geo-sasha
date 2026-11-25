import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { FillLayerSpecification, LineLayerSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import type { MapRef } from 'react-map-gl/maplibre'

import { world10mFlagMap } from './worldMapCountrySelection'
import type { MapMagnifierPoint, MapMagnifierSize } from './mapMagnifierUtils'

const magnifierMapStyle = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: 'magnifier-background',
      type: 'background' as const,
      paint: { 'background-color': '#101820' }
    }
  ]
}

type MapMagnifierProps = {
  center: [number, number]
  zoom: number
  position: MapMagnifierPoint
  size: MapMagnifierSize
  zoomScale: number
  onMapReady: (map: MapLibreMap | null) => void
  globeProjection: boolean
  bearing: number
  pitch: number
  roll: number
  backgroundColor: string
  fillColor: NonNullable<FillLayerSpecification['paint']>['fill-color']
  borderColor: NonNullable<LineLayerSpecification['paint']>['line-color']
  showBorders: boolean
  labelData?: FeatureCollection<Point> | null
  labelColor: string
  haloColor: string
}

export function MapMagnifier({
  center,
  zoom,
  position,
  size,
  zoomScale,
  onMapReady,
  globeProjection,
  bearing,
  pitch,
  roll,
  backgroundColor,
  fillColor,
  borderColor,
  showBorders,
  labelData,
  labelColor,
  haloColor
}: MapMagnifierProps): JSX.Element {
  const mapRef = useRef<MapRef>(null)
  useEffect(() => {
    mapRef.current?.getMap().jumpTo({ center })
  }, [center])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map && map.getZoom() !== zoom) map.setZoom(zoom, { duration: 0 })
  }, [zoom])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map?.isStyleLoaded()) return
    map.setProjection({ type: globeProjection ? 'globe' : 'mercator' })
    map.jumpTo({ bearing, pitch, roll })
  }, [bearing, globeProjection, pitch, roll])

  useEffect(() => () => onMapReady(null), [onMapReady])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map?.getLayer('magnifier-background')) {
      map.setPaintProperty('magnifier-background', 'background-color', backgroundColor)
    }
  }, [backgroundColor])

  return (
    <div
      className="map-magnifier"
      aria-hidden="true"
      style={{
        left: position.x - size.width / 2,
        top: position.y - size.height / 2,
        width: size.width,
        height: size.height
      }}
    >
      <Map
        ref={mapRef}
        initialViewState={{ longitude: center[0], latitude: center[1], zoom }}
        mapStyle={magnifierMapStyle}
        attributionControl={false}
        logoPosition="bottom-right"
        dragPan={false}
        scrollZoom={false}
        boxZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoomRotate={false}
        touchPitch={false}
        interactiveLayerIds={[]}
        style={{ width: '100%', height: '100%' }}
        onLoad={(event) => {
          event.target.setPaintProperty('magnifier-background', 'background-color', backgroundColor)
          event.target.setProjection({ type: globeProjection ? 'globe' : 'mercator' })
          event.target.jumpTo({ center, zoom, bearing, pitch, roll })
          onMapReady(event.target)
        }}
      >
        <Source id="map-magnifier-countries" type="geojson" data={world10mFlagMap}>
          <Layer
            id="map-magnifier-country-fill"
            type="fill"
            paint={{
              'fill-color': fillColor,
              'fill-opacity': 1,
              'fill-antialias': showBorders
            }}
          />
          {showBorders && (
            <Layer
              id="map-magnifier-country-borders"
              type="line"
              paint={{ 'line-color': borderColor, 'line-width': 0.7, 'line-opacity': 1 }}
            />
          )}
        </Source>
        {labelData && (
          <Source id="map-magnifier-labels" type="geojson" data={labelData}>
            <Layer
              id="map-magnifier-country-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 11,
                'text-max-width': 9,
                'text-allow-overlap': false
              }}
              paint={{
                'text-color': labelColor,
                'text-halo-color': haloColor,
                'text-halo-width': 1.2
              }}
            />
          </Source>
        )}
      </Map>
      <svg className="map-magnifier-filter-defs" aria-hidden="true">
        <filter
          id="map-magnifier-displacement"
          x="-12%"
          y="-12%"
          width="124%"
          height="124%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035 0.048"
            numOctaves="2"
            seed="7"
            result="glass-ripple"
          />
          <feMorphology in="SourceAlpha" operator="erode" radius="7" result="inner-edge" />
          <feComposite in="SourceAlpha" in2="inner-edge" operator="out" result="edge-band" />
          <feGaussianBlur in="edge-band" stdDeviation="4" result="edge-falloff" />
          <feComponentTransfer in="edge-falloff" result="edge-strength">
            <feFuncA type="gamma" amplitude="1" exponent="0.62" offset="0" />
          </feComponentTransfer>
          <feComposite in="glass-ripple" in2="edge-strength" operator="in" result="edge-ripple" />
          <feFlood floodColor="#808080" result="neutral-displacement" />
          <feComposite
            in="edge-ripple"
            in2="neutral-displacement"
            operator="over"
            result="edge-displacement-map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="edge-displacement-map"
            scale="62"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <div className="map-magnifier-reticle" aria-hidden="true">
        <span className="map-magnifier-reticle-line is-vertical is-left" />
        <span className="map-magnifier-reticle-line is-vertical is-right" />
        <span className="map-magnifier-reticle-line is-horizontal is-top" />
        <span className="map-magnifier-reticle-line is-horizontal is-bottom" />
        <i className="map-magnifier-reticle-dot" />
      </div>
      <div className="map-magnifier-scale">×{zoomScale.toFixed(1)}</div>
    </div>
  )
}
