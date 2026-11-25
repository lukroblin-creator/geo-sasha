import bboxClip from '@turf/bbox-clip'
import polylabel from 'polylabel'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon } from 'geojson'

import { getLabelPrecision } from './labelPrecision.ts'
import type { MarineAreaProperties } from './marineRegions'

export type MarineLabelProperties = Pick<MarineAreaProperties, 'name' | 'nameFr' | 'nameEs'> & {
  marineId: string
}

type Bounds = [number, number, number, number]
const MAX_MERCATOR_LATITUDE = 85.05112878
const stableAnchorCache = new WeakMap<object, Map<number, [number, number] | null>>()

function getBounds(geometry: Polygon | MultiPolygon): Bounds | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude)
        south = Math.min(south, latitude)
        east = Math.max(east, longitude)
        north = Math.max(north, latitude)
      }
    }
  }

  return Number.isFinite(west + south + east + north) ? [west, south, east, north] : null
}

function intersects(bounds: Bounds, viewport: Bounds): boolean {
  const longitudeIntersects =
    viewport[0] <= viewport[2]
      ? bounds[0] <= viewport[2] && bounds[2] >= viewport[0]
      : bounds[2] >= viewport[0] || bounds[0] <= viewport[2]
  return longitudeIntersects && bounds[1] <= viewport[3] && bounds[3] >= viewport[1]
}

function isInside(bounds: Bounds, viewport: Bounds): boolean {
  return (
    viewport[0] <= viewport[2] &&
    bounds[0] >= viewport[0] &&
    bounds[1] >= viewport[1] &&
    bounds[2] <= viewport[2] &&
    bounds[3] <= viewport[3]
  )
}

function toMercatorLatitude(latitude: number): number {
  const limited = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude))
  const radians = (limited * Math.PI) / 180
  return (Math.log(Math.tan(Math.PI / 4 + radians / 2)) * 180) / Math.PI
}

function fromMercatorLatitude(latitude: number): number {
  const radians = (latitude * Math.PI) / 180
  return ((2 * Math.atan(Math.exp(radians)) - Math.PI / 2) * 180) / Math.PI
}

function findAnchor(geometry: Polygon | MultiPolygon, precision: number): [number, number] | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let best: { coordinates: [number, number]; distance: number } | null = null

  for (const coordinates of polygons) {
    if (!coordinates[0] || coordinates[0].length < 4) continue
    try {
      const projected = coordinates.map((ring) =>
        ring.map(([longitude, latitude]) => [longitude, toMercatorLatitude(latitude)])
      )
      const result = polylabel(projected as [number, number][][], precision)
      if (Number.isFinite(result.distance) && (!best || result.distance > best.distance)) {
        best = {
          coordinates: [result[0], fromMercatorLatitude(result[1])],
          distance: result.distance
        }
      }
    } catch {
      continue
    }
  }

  return best?.coordinates ?? null
}

/** Places each marine name within the part of its source polygon visible in the viewport. */
export function createVisibleMarineLabels(
  areas: FeatureCollection<Geometry, MarineAreaProperties>,
  bbox: Bounds,
  zoom = 1.5
): FeatureCollection<Point, MarineLabelProperties> {
  const labels: Feature<Point, MarineLabelProperties>[] = []
  const precision = getLabelPrecision(zoom)

  for (const area of areas.features) {
    const geometry = area.geometry
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue
    if (area.properties.minZoom > zoom) continue

    const bounds = getBounds(geometry)
    if (!bounds || !intersects(bounds, bbox)) continue

    let visibleGeometry: Polygon | MultiPolygon = geometry
    if (!isInside(bounds, bbox)) {
      try {
        const clipped = bboxClip(area as Feature<Polygon | MultiPolygon>, bbox)
        if (
          !clipped.geometry ||
          (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon')
        )
          continue
        visibleGeometry = clipped.geometry
      } catch {
        continue
      }
    }

    let coordinates: [number, number] | null
    if (visibleGeometry === geometry) {
      let areaCache = stableAnchorCache.get(area)
      if (!areaCache) {
        areaCache = new Map()
        stableAnchorCache.set(area, areaCache)
      }
      if (areaCache.has(precision)) {
        coordinates = areaCache.get(precision) ?? null
      } else {
        coordinates = findAnchor(visibleGeometry, precision)
        areaCache.set(precision, coordinates)
      }
    } else {
      coordinates = findAnchor(visibleGeometry, precision)
    }
    if (!coordinates) continue

    labels.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: {
        marineId: area.properties.marineId ?? '',
        name: area.properties.name,
        nameFr: area.properties.nameFr,
        nameEs: area.properties.nameEs
      }
    })
  }

  return { type: 'FeatureCollection', features: labels }
}
