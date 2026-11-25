import type { Feature, FeatureCollection, Geometry, LineString, MultiPolygon } from 'geojson'

type MarineBoundaryProperties = { marineId: string }
type BoundaryRing = { coordinates: [number, number][]; lengths: number[]; length: number }

const EARTH_RADIUS_KM = 6371.0088
const preparedBoundaries = new WeakMap<object, { rings: BoundaryRing[]; totalLength: number }>()

function getRings(geometry: Geometry): [number, number][][] {
  if (geometry.type === 'Polygon') return geometry.coordinates as [number, number][][]
  if (geometry.type === 'MultiPolygon')
    return (geometry as MultiPolygon).coordinates.flat() as [number, number][][]
  return []
}

function getSegmentLength(from: [number, number], to: [number, number]): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to[1] - from[1])
  let longitudeDeltaDegrees = to[0] - from[0]
  if (longitudeDeltaDegrees > 180) longitudeDeltaDegrees -= 360
  if (longitudeDeltaDegrees < -180) longitudeDeltaDegrees += 360
  const longitudeDelta = toRadians(longitudeDeltaDegrees)
  const fromLatitude = toRadians(from[1])
  const toLatitude = toRadians(to[1])
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)))
}

function prepareRing(coordinates: [number, number][]): BoundaryRing | null {
  if (coordinates.length < 2) return null
  const lengths = [0]
  let length = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    length += getSegmentLength(coordinates[index - 1], coordinates[index])
    lengths.push(length)
  }
  return { coordinates, lengths, length }
}

function interpolateCoordinate(
  from: [number, number],
  to: [number, number],
  progress: number
): [number, number] {
  let longitudeDelta = to[0] - from[0]
  if (longitudeDelta > 180) longitudeDelta -= 360
  if (longitudeDelta < -180) longitudeDelta += 360
  let longitude = from[0] + longitudeDelta * progress
  if (longitude > 180) longitude -= 360
  if (longitude < -180) longitude += 360
  return [longitude, from[1] + (to[1] - from[1]) * progress]
}

/** Draws a polygon outline progressively by traveled distance, not vertex count. */
export function createMarineBoundaryAtProgress(
  geometry: Geometry,
  marineId: string,
  progress: number
): FeatureCollection<LineString, MarineBoundaryProperties> {
  let prepared = preparedBoundaries.get(geometry)
  if (!prepared) {
    const rings = getRings(geometry)
      .map(prepareRing)
      .filter((ring): ring is BoundaryRing => !!ring)
    prepared = { rings, totalLength: rings.reduce((sum, ring) => sum + ring.length, 0) }
    preparedBoundaries.set(geometry, prepared)
  }
  const { rings, totalLength } = prepared
  const targetLength = totalLength * Math.max(0, Math.min(1, progress))
  let traversedLength = 0
  const features: Feature<LineString, MarineBoundaryProperties>[] = []

  for (const ring of rings) {
    const remaining = targetLength - traversedLength
    if (remaining <= 0) break

    if (remaining >= ring.length) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: ring.coordinates },
        properties: { marineId }
      })
      traversedLength += ring.length
      continue
    }

    const coordinates: [number, number][] = [ring.coordinates[0]]
    let segmentIndex = 1
    while (segmentIndex < ring.lengths.length && ring.lengths[segmentIndex] < remaining) {
      coordinates.push(ring.coordinates[segmentIndex])
      segmentIndex += 1
    }
    if (segmentIndex < ring.lengths.length) {
      const segmentLength = ring.lengths[segmentIndex] - ring.lengths[segmentIndex - 1]
      const segmentProgress =
        segmentLength === 0 ? 0 : (remaining - ring.lengths[segmentIndex - 1]) / segmentLength
      coordinates.push(
        interpolateCoordinate(
          ring.coordinates[segmentIndex - 1],
          ring.coordinates[segmentIndex],
          segmentProgress
        )
      )
    }
    if (coordinates.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { marineId }
      })
    }
    break
  }

  return { type: 'FeatureCollection', features }
}
