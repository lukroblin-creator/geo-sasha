import { memo, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { CSSProperties } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { Marker } from 'react-map-gl/maplibre'
import {
  getResourceIndustryFactsForMapFeature,
  type ResourceIndustryFact
} from '../data/geography/resources'
import { useLanguage } from '../data/i18n'
import { ResourceIndustryDescription } from './ResourceIndustryDescription'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
  sourceFeatureId?: string | number | null
}

type MapResourceOverlayProps = {
  map: MapLibreMap
  labels: FeatureCollection<Point, LabelProperties>
  zoom: number
  revision: number
  maxItems?: number
  opacity?: number
  overlayZIndex?: number
}

type ResourceMarker = {
  entityId: string
  industry: ResourceIndustryFact
  territoryName: string
  showTerritoryName: boolean
  longitude: number
  latitude: number
  popupSide: 'left' | 'right'
  popupVertical: 'top' | 'center' | 'bottom'
}

type ResourceCandidate = {
  entityId: string
  mapEntityId: string | null
  sourceFeatureId: string | number | null
  territoryName: string
  longitude: number
  latitude: number
  industries: ResourceIndustryFact[]
  priority: number
  resolution: string
}

const fillLayerIds = ['countries-fill-110m', 'countries-fill-50m', 'countries-fill-10m']

function stopMapEvent(event: SyntheticEvent): void {
  event.stopPropagation()
}

function ResourceIndustryIcon({
  industry,
  territoryName,
  showTerritoryName,
  selected,
  popupSide,
  popupVertical,
  onToggle
}: {
  industry: ResourceIndustryFact
  territoryName: string
  showTerritoryName: boolean
  selected: boolean
  popupSide: 'left' | 'right'
  popupVertical: 'top' | 'center' | 'bottom'
  onToggle: () => void
}): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <div
      className="map-resource-icon-anchor"
      onPointerMove={stopMapEvent}
      onPointerDown={stopMapEvent}
      onClick={stopMapEvent}
    >
      {showTerritoryName && (
        <span className="map-resource-territory-label" aria-hidden="true">
          {territoryName}
        </span>
      )}
      <button
        type="button"
        className="map-resource-industry"
        title={`${t(industry.label)} — ${territoryName}`}
        aria-label={`${t(industry.label)} — ${territoryName}`}
        aria-expanded={selected}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <span aria-hidden="true">{industry.icon}</span>
      </button>
      {selected && (
        <section
          className={`map-resource-detail-popup open-${popupSide} align-${popupVertical}`}
          role="dialog"
          aria-label={`${territoryName} — ${t(industry.label)}`}
        >
          <button
            type="button"
            className="map-resource-popup-close"
            aria-label={t('Fermer')}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            ×
          </button>
          <span className="map-resource-popup-territory">{territoryName}</span>
          <strong>{t(industry.label)}</strong>
          <ResourceIndustryDescription industry={industry} />
        </section>
      )}
    </div>
  )
}

function getResourceIconSize(zoom: number): number {
  const scale = Math.min(1, Math.max(0.5, 0.5 + (zoom - 1.5) / 8))
  return Math.round(31 * scale)
}

function getSpiralOffsets(iconSize: number, count: number): [number, number][] {
  const offsets: [number, number][] = [[0, 0]]
  const spacing = Math.ceil(iconSize * 1.35)
  const requiredRings = Math.max(1, Math.ceil((count - 1) / 6))

  for (let ring = 1; ring <= requiredRings; ring += 1) {
    for (let position = 0; position < 6; position += 1) {
      const angle = -Math.PI / 2 + position * (Math.PI / 3)
      offsets.push([
        Math.round(Math.cos(angle) * spacing * ring),
        Math.round(Math.sin(angle) * spacing * ring)
      ])
    }
  }

  return offsets
}

function isCandidateTerritoryAtPoint(
  map: MapLibreMap,
  layers: string[],
  point: [number, number],
  candidate: ResourceCandidate
): boolean {
  const features = map.queryRenderedFeatures(point, { layers })
  return features.some((feature) => {
    const properties = feature.properties as Record<string, unknown> | null
    if (!properties) return false

    if (candidate.mapEntityId) return properties.entityId === candidate.mapEntityId

    return (
      (properties.entityId === null || properties.entityId === undefined) &&
      String(properties.sourceId ?? '') === String(candidate.sourceFeatureId ?? '')
    )
  })
}

function isIconWithinCandidateTerritory(
  map: MapLibreMap,
  layers: string[],
  x: number,
  y: number,
  size: number,
  candidate: ResourceCandidate
): boolean {
  const radius = size / 2 - 1
  const samplePoints: [number, number][] = [
    [x, y],
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius]
  ]
  return samplePoints.every((point) => isCandidateTerritoryAtPoint(map, layers, point, candidate))
}

export const MapResourceOverlay = memo(function MapResourceOverlay({
  map,
  labels,
  zoom,
  revision,
  maxItems = Number.POSITIVE_INFINITY,
  opacity = 1,
  overlayZIndex = 1
}: MapResourceOverlayProps): React.JSX.Element {
  const [selectedIndustryKey, setSelectedIndustryKey] = useState<string | null>(null)
  const layoutZoom = Math.round(zoom * 2) / 2
  const iconSize = getResourceIconSize(zoom)
  const markers = useMemo(() => {
    const canvas = map.getCanvas()
    const layers = fillLayerIds.filter((layerId) => Boolean(map.getLayer(layerId)))
    if (!layers.length) return []

    const candidates: ResourceCandidate[] = []
    const seenEntities = new Set<string>()

    for (const label of labels.features) {
      const entityId =
        label.properties.entityId ??
        (label.properties.sourceFeatureId === null || label.properties.sourceFeatureId === undefined
          ? null
          : `feature:${label.properties.sourceFeatureId}`)
      if (!entityId || seenEntities.has(entityId)) continue

      const industries = getResourceIndustryFactsForMapFeature(
        label.properties.entityId,
        label.properties.sourceFeatureId
      )
      if (!industries.length) continue

      const [longitude, latitude] = label.geometry.coordinates
      const point = map.project([longitude, latitude])
      if (
        point.x < 16 ||
        point.x > canvas.clientWidth - 16 ||
        point.y < 16 ||
        point.y > canvas.clientHeight - 16
      ) {
        continue
      }

      seenEntities.add(entityId)
      candidates.push({
        entityId,
        mapEntityId: label.properties.entityId,
        sourceFeatureId: label.properties.sourceFeatureId ?? null,
        territoryName: label.properties.name,
        longitude,
        latitude,
        industries,
        priority: label.properties.priority,
        resolution: label.properties.resolution
      })
    }

    // Each source label is calculated from the portion of its territory that
    // is visible in the viewport. Test every icon position against the actual
    // rendered fill so markers cannot drift over neighboring countries.
    candidates.sort((first, second) => first.priority - second.priority)
    const allowedIndustries = new Set(
      candidates
        .flatMap((candidate) =>
          candidate.industries.map((industry, industryIndex) => ({
            key: `${candidate.entityId}:${industry.id}`,
            priority: candidate.priority,
            industryIndex
          }))
        )
        .sort(
          (first, second) =>
            first.priority - second.priority || first.industryIndex - second.industryIndex
        )
        .slice(0, Math.max(0, Math.floor(maxItems)))
        .map((industry) => industry.key)
    )
    const placed: Array<{ x: number; y: number; size: number }> = []
    const markers: ResourceMarker[] = []
    const maxIndustries = Math.max(0, ...candidates.map((candidate) => candidate.industries.length))
    const layoutIconSize = getResourceIconSize(layoutZoom)
    const offsets = getSpiralOffsets(layoutIconSize, maxIndustries)
    const blockedEntities = new Set<string>()

    for (let rank = 0; rank < maxIndustries; rank += 1) {
      for (const candidate of candidates) {
        if (blockedEntities.has(candidate.entityId)) continue
        const industry = candidate.industries[rank]
        if (!industry || !allowedIndustries.has(`${candidate.entityId}:${industry.id}`)) continue

        const anchor = map.project([candidate.longitude, candidate.latitude])
        const size = layoutIconSize
        let position: [number, number] | null = null

        for (const offset of offsets) {
          const x = anchor.x + offset[0]
          const y = anchor.y + offset[1]
          if (
            x < size / 2 ||
            x > canvas.clientWidth - size / 2 ||
            y < size / 2 ||
            y > canvas.clientHeight - size / 2
          ) {
            continue
          }

          const overlaps = placed.some(
            (other) =>
              Math.abs(x - other.x) < (size + other.size) / 2 + 3 &&
              Math.abs(y - other.y) < (size + other.size) / 2 + 3
          )
          const trustVisibleLabelAnchor =
            rank === 0 && offset[0] === 0 && offset[1] === 0 && candidate.resolution !== 'gazetteer'
          if (
            overlaps ||
            (!trustVisibleLabelAnchor &&
              !isIconWithinCandidateTerritory(map, layers, x, y, size, candidate))
          )
            continue

          position = [x, y]
          placed.push({ x, y, size })
          break
        }

        if (!position) {
          // Lower source-listed industries must not displace the more prominent
          // activities when the visible territory has no room for another icon.
          blockedEntities.add(candidate.entityId)
          continue
        }

        const coordinate = map.unproject(position)
        markers.push({
          entityId: candidate.entityId,
          territoryName: candidate.territoryName,
          industry,
          longitude: coordinate.lng,
          latitude: coordinate.lat,
          popupSide: position[0] > canvas.clientWidth - 300 ? 'left' : 'right',
          popupVertical:
            position[1] < 125
              ? 'top'
              : position[1] > canvas.clientHeight - 125
                ? 'bottom'
                : 'center',
          showTerritoryName: rank === 0
        })
      }
    }

    return markers
    // MapLibre mutates the camera in place; revision refreshes projected marker positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is an external camera invalidation signal.
  }, [labels, layoutZoom, map, maxItems, revision])

  return (
    <>
      {markers.map((marker) => {
        const markerKey = `${marker.entityId}:${marker.industry.id}`
        return (
          <Marker
            key={markerKey}
            longitude={marker.longitude}
            latitude={marker.latitude}
            anchor="center"
            style={{
              zIndex: selectedIndustryKey === markerKey ? 10000 : overlayZIndex,
              opacity,
              pointerEvents: opacity > 0 ? 'auto' : 'none'
            }}
          >
            <div
              className="map-resource-marker"
              style={
                {
                  '--resource-marker-size': `${iconSize}px`,
                  '--resource-icon-font-size': `${Math.max(8, iconSize * 0.48)}px`,
                  '--resource-label-font-size': `${Math.max(7, Math.min(9, iconSize * 0.29))}px`,
                  '--resource-marker-radius': `${Math.max(4, iconSize * 0.32)}px`
                } as CSSProperties
              }
            >
              <ResourceIndustryIcon
                industry={marker.industry}
                territoryName={marker.territoryName}
                showTerritoryName={marker.showTerritoryName}
                selected={selectedIndustryKey === markerKey}
                popupSide={marker.popupSide}
                popupVertical={marker.popupVertical}
                onToggle={() =>
                  setSelectedIndustryKey((current) => (current === markerKey ? null : markerKey))
                }
              />
            </div>
          </Marker>
        )
      })}
    </>
  )
})
