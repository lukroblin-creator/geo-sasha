
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
import { getEntityById } from './registry'

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

function findBestLabelPoint(
  geometry: Polygon | MultiPolygon
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
      const result = polylabel(
        coordinates as [number, number][][],
        0.05
      )

      const longitude = result[0]
      const latitude = result[1]
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
  bbox: [number, number, number, number]
): FeatureCollection<Point, LabelProperties> {
  const labels: LabelFeature[] = []

  for (const country of countries.features) {
    if (!country.geometry) continue

    const properties = country.properties as CountryProperties | null
    const polygonEntityIds = properties?.polygonEntityIds ?? {}

    const addLabel = (
      geometry: Polygon | MultiPolygon,
      entityId: string | null,
      name: string,
      sourcePolygonIndex?: number
    ) => {
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
      const point = findBestLabelPoint(clipped.geometry)
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
        const unlinkedPolygons = [] as MultiPolygon['coordinates']

        geometry.coordinates.forEach((coordinates, sourcePolygonIndex) => {
          const entityId = polygonEntityIds[String(sourcePolygonIndex)]
          if (!entityId) {
            unlinkedPolygons.push(coordinates)
            return
          }
          const entityName =
            getEntityById(entityId)?.name ??
            String(properties?.name ?? 'Unknown')
          addLabel(
            { type: 'Polygon', coordinates },
            entityId,
            entityName,
            sourcePolygonIndex
          )
        })

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
        addLabel(geometry, properties?.entityId ?? null, String(properties?.name ?? 'Unknown'))
      }
    } catch {
      // Ignore les géométries impossibles à découper.
    }
  }

  return {
    type: 'FeatureCollection',
    features: labels
  }
}
