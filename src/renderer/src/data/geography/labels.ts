
import bboxClip from '@turf/bbox-clip'
import pointOnFeature from '@turf/point-on-feature'

import type {
  Feature,
  FeatureCollection,
  Geometry,
  Point
} from 'geojson'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
}

type LabelFeature = Feature<Point, LabelProperties>

/**
 * Génère un point d'étiquette à l'intérieur de la partie visible
 * de chaque territoire.
 */
export function createVisibleCountryLabels(
  countries: FeatureCollection<Geometry>,
  bbox: [number, number, number, number]
): FeatureCollection<Point, LabelProperties> {
  const labels: LabelFeature[] = []

  for (const country of countries.features) {
    if (!country.geometry) continue

    try {
      const clippedCountry = bboxClip(country, bbox)

      if (!clippedCountry.geometry) continue

      const point = pointOnFeature(clippedCountry)

      labels.push({
        type: 'Feature',
        geometry: point.geometry,
        properties: {
          name: String(country.properties?.name ?? 'Unknown'),
          sourceName: String(country.properties?.sourceName ?? ''),
          entityId: country.properties?.entityId ?? null,
          resolution: String(country.properties?.resolution ?? '')
        }
      })
    } catch {
      // Ignore les géométries impossibles à découper.
    }
  }

  return {
    type: 'FeatureCollection',
    features: labels
  }
}
