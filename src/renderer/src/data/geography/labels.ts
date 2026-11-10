
import bboxClip from '@turf/bbox-clip'
import polylabel from 'polylabel'

import type {
  Feature,
  FeatureCollection,
  Geometry,
  Polygon,
  MultiPolygon,
  Point
} from 'geojson'
import { getEntityDisplayName } from './registry'
import { getLabelPrecision } from './labelPrecision'
import { overseasIslandLabels } from './overseasIslandLabels'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  sourcePolygonIndex?: number
}

type CountryProperties = {
  name?: string
  sourceName?: string
  entityId?: string | null
  resolution?: string
  polygonEntityIds?: Record<string, string>
}

type LabelFeature = Feature<Point, LabelProperties>

const MAX_MERCATOR_LATITUDE = 85.05112878

function toMercatorLatitude(latitude: number): number {
  const limitedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude)
  )
  const radians = (limitedLatitude * Math.PI) / 180
  return (Math.log(Math.tan(Math.PI / 4 + radians / 2)) * 180) / Math.PI
}

function fromMercatorLatitude(latitude: number): number {
  const radians = (latitude * Math.PI) / 180
  return ((2 * Math.atan(Math.exp(radians)) - Math.PI / 2) * 180) / Math.PI
}

function findBestLabelPoint(
  geometry: Polygon | MultiPolygon,
  precision: number
): [number, number] | null {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.coordinates

  let bestPoint: [number, number] | null = null
  let bestDistance = -1
  for (const coordinates of polygons) {
    if (
      !coordinates[0] ||
      coordinates[0].length < 4
    ) {
      continue
    }

    try {
      const projectedCoordinates = coordinates.map((ring) =>
        ring.map(([longitude, latitude]) => [
          longitude,
          toMercatorLatitude(latitude)
        ])
      )
      const result = polylabel(
        projectedCoordinates as [number, number][][],
        precision
      )

      const longitude = result[0]
      const latitude = fromMercatorLatitude(result[1])
      const distance = result.distance

      if (
        Number.isFinite(longitude) &&
        Number.isFinite(latitude) &&
        Number.isFinite(distance) &&
        distance > bestDistance
      ) {
        bestDistance = distance
        bestPoint = [longitude, latitude]
      }
    } catch {
      continue
    }
  }

  return bestPoint
}

export function createVisibleCountryLabels(
  countries: FeatureCollection<Geometry>,
  bbox: [number, number, number, number],
  zoom = 1.5
): FeatureCollection<Point, LabelProperties> {
  const labels: LabelFeature[] = []
  const precision = getLabelPrecision(zoom)

  for (const country of countries.features) {
    if (!country.geometry) continue

    const properties = country.properties as CountryProperties | null
    const polygonEntityIds = properties?.polygonEntityIds ?? {}

    const addLabel = (
      geometry: Polygon | MultiPolygon,
      entityId: string | null,
      name: string,
      sourcePolygonIndex?: number
    ): void => {
      const clipped = bboxClip(
        { ...country, geometry } as Feature<Polygon | MultiPolygon>,
        bbox
      )
      if (
        !clipped.geometry ||
        (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon')
      ) {
        return
      }
      const point = findBestLabelPoint(clipped.geometry, precision)
      if (!point) return
      labels.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: point
        },
        properties: {
          name,
          sourceName: String(properties?.sourceName ?? ''),
          entityId,
          resolution: String(properties?.resolution ?? ''),
          ...(sourcePolygonIndex === undefined ? {} : { sourcePolygonIndex })
        }
      })
    }

    try {
      const geometry = country.geometry
      if (
        Object.keys(polygonEntityIds).length > 0 &&
        geometry.type === 'MultiPolygon'
      ) {
        const polygonsByEntity = new Map<string, MultiPolygon['coordinates']>()
        const unlinkedPolygons: MultiPolygon['coordinates'] = []

        geometry.coordinates.forEach((coordinates, sourcePolygonIndex) => {
          const entityId = polygonEntityIds[String(sourcePolygonIndex)]
          if (!entityId) {
            unlinkedPolygons.push(coordinates)
            return
          }

          const entityPolygons = polygonsByEntity.get(entityId) ?? []
          entityPolygons.push(coordinates)
          polygonsByEntity.set(entityId, entityPolygons)
        })

        // Une entité peut être constituée de plusieurs îles. On calcule un
        // seul point d'étiquette pour l'ensemble de ses polygones visibles.
        for (const [entityId, polygons] of polygonsByEntity) {
          const entityName =
            getEntityDisplayName(entityId) ??
            String(properties?.name ?? 'Unknown')
          addLabel(
            { type: 'MultiPolygon', coordinates: polygons },
            entityId,
            entityName
          )
        }

        // Les polygones sans lien détaillé gardent l'étiquette habituelle du pays.
        if (unlinkedPolygons.length) {
          addLabel(
            { type: 'MultiPolygon', coordinates: unlinkedPolygons },
            properties?.entityId ?? null,
            String(properties?.name ?? 'Unknown')
          )
        }
      } else {
        if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
        const entityId = properties?.entityId ?? null
        const entityName = entityId ? getEntityDisplayName(entityId) : undefined
        addLabel(
          geometry,
          entityId,
          entityName ?? String(properties?.name ?? 'Unknown')
        )
      }
    } catch {
      // Ignore les géométries impossibles à découper.
    }
  }

  // Les points d'îles apportent les noms qui manquent aux frontières
  // nationales, surtout pour les archipels ultramarins.
  for (const island of overseasIslandLabels) {
    if (zoom < island.minZoom) continue
    const [longitude, latitude] = [island.longitude, island.latitude]
    const isLongitudeVisible =
      bbox[0] <= bbox[2]
        ? longitude >= bbox[0] && longitude <= bbox[2]
        : longitude >= bbox[0] || longitude <= bbox[2]
    if (!isLongitudeVisible || latitude < bbox[1] || latitude > bbox[3]) continue

    labels.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      properties: {
        name: island.name,
        sourceName: 'GeoNames',
        entityId: island.territoryEntityId,
        resolution: 'gazetteer'
      }
    })
  }

  return {
    type: 'FeatureCollection',
    features: labels
  }
}
