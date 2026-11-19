import type { Geometry, Position } from 'geojson'
import countryCatalog from './countryCatalog.json'
import { getContinentLabelForCountry, quizRegions, type ContinentId } from './countryContinents'
import { world10mMap } from '../world'

type CountryCatalogRow = { alpha2: string; sourceFeatureId: number }
type MapFeature = { geometry: Geometry | null; properties?: Record<string, unknown> | null }
type GeoPoint = [number, number]

const gridSize = 0.25
const earthRadiusKm = 6371.0088

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

function normalizeSourceFeatureId(sourceFeatureId: string | number): string {
  const value = String(sourceFeatureId)
  return /^\d+$/.test(value) ? String(Number(value)) : value
}

function cellX(longitude: number): number {
  return Math.floor((normalizeLongitude(longitude) + 180) / gridSize)
}

function cellY(latitude: number): number {
  return Math.floor((latitude + 90) / gridSize)
}

function cellKey(x: number, y: number): string {
  return `${x}:${y}`
}

function distanceKm(first: GeoPoint, second: GeoPoint): number {
  const latitudeA = (first[1] * Math.PI) / 180
  const latitudeB = (second[1] * Math.PI) / 180
  const deltaLatitude = latitudeB - latitudeA
  const deltaLongitude = (normalizeLongitude(second[0] - first[0]) * Math.PI) / 180
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2
  return earthRadiusKm * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

function indexPoints(points: GeoPoint[]): Map<string, GeoPoint[]> {
  const grid = new Map<string, GeoPoint[]>()
  const longitudeCellCount = Math.round(360 / gridSize)
  for (const point of points) {
    const x = ((cellX(point[0]) % longitudeCellCount) + longitudeCellCount) % longitudeCellCount
    const y = cellY(point[1])
    const key = cellKey(x, y)
    const bucket = grid.get(key) ?? []
    bucket.push(point)
    grid.set(key, bucket)
  }
  return grid
}

function hasNearbyPoint(
  point: GeoPoint,
  grid: Map<string, GeoPoint[]>,
  toleranceKm: number
): boolean {
  const longitudeCellCount = Math.round(360 / gridSize)
  const xRadius = Math.min(
    12,
    Math.ceil(
      toleranceKm / (111 * Math.max(0.15, Math.cos((point[1] * Math.PI) / 180)) * gridSize)
    ) + 1
  )
  const yRadius = Math.ceil(toleranceKm / (111 * gridSize)) + 1
  const centerX = cellX(point[0])
  const centerY = cellY(point[1])
  for (let deltaX = -xRadius; deltaX <= xRadius; deltaX += 1) {
    const x = (((centerX + deltaX) % longitudeCellCount) + longitudeCellCount) % longitudeCellCount
    for (let deltaY = -yRadius; deltaY <= yRadius; deltaY += 1) {
      const candidates = grid.get(cellKey(x, centerY + deltaY))
      if (candidates?.some((candidate) => distanceKm(point, candidate) <= toleranceKm)) return true
    }
  }
  return false
}

function getRingCoordinates(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

function getOuterRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates[0] ? [geometry.coordinates[0]] : []
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => (polygon[0] ? [polygon[0]] : []))
  }
  return []
}

function appendPathSamples(path: Position[], points: GeoPoint[]): void {
  for (let index = 0; index < path.length - 1; index += 1) {
    const rawFrom = path[index]
    const rawTo = path[index + 1]
    if (!rawFrom || !rawTo || !Number.isFinite(rawFrom[0] + rawFrom[1] + rawTo[0] + rawTo[1]))
      continue
    const from: GeoPoint = [normalizeLongitude(rawFrom[0]), rawFrom[1]]
    const to: GeoPoint = [normalizeLongitude(rawTo[0]), rawTo[1]]
    points.push(from)
    const distance = distanceKm(from, to)
    const steps = Math.max(1, Math.ceil(distance / 12))
    const deltaLongitude = normalizeLongitude(to[0] - from[0])
    for (let step = 1; step < steps; step += 1) {
      const fraction = step / steps
      points.push([
        normalizeLongitude(from[0] + deltaLongitude * fraction),
        from[1] + (to[1] - from[1]) * fraction
      ])
    }
  }
}

function coordinateKey(position: Position): string {
  return `${normalizeLongitude(position[0]).toFixed(5)},${position[1].toFixed(5)}`
}

function borderEdgeKey(first: Position, second: Position): string {
  const firstKey = coordinateKey(first)
  const secondKey = coordinateKey(second)
  return firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`
}

function extractReferencePoints(
  continentFilter: readonly ContinentId[],
  countryAlpha2: string | null
): GeoPoint[] {
  const catalog = countryCatalog as CountryCatalogRow[]
  const sourceIds = new Set(
    catalog
      .filter((country) =>
        countryAlpha2
          ? country.alpha2 === countryAlpha2
          : continentFilter.length === 0 ||
            continentFilter.some(
              (continent) =>
                getContinentLabelForCountry(country.alpha2) ===
                quizRegions.find((region) => region.id === continent)?.label
            )
      )
      .map((country) => normalizeSourceFeatureId(country.sourceFeatureId))
  )
  const countrySourceIds = new Set(
    catalog.map((country) => normalizeSourceFeatureId(country.sourceFeatureId))
  )

  if (countryAlpha2) {
    const points: GeoPoint[] = []
    for (const feature of world10mMap.features as unknown as MapFeature[]) {
      const sourceId = normalizeSourceFeatureId(String(feature.properties?.sourceId ?? ''))
      if (!sourceIds.has(sourceId) || !feature.geometry) continue
      for (const ring of getOuterRings(feature.geometry)) appendPathSamples(ring, points)
    }
    return points
  }

  const selectedEdges = new Map<string, { owners: Set<string>; from: Position; to: Position }>()
  for (const feature of world10mMap.features as unknown as MapFeature[]) {
    const sourceId = normalizeSourceFeatureId(String(feature.properties?.sourceId ?? ''))
    if (!countrySourceIds.has(sourceId) || !feature.geometry) continue
    for (const ring of getRingCoordinates(feature.geometry)) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const from = ring[index]
        const to = ring[index + 1]
        if (!from || !to || !Number.isFinite(from[0] + from[1] + to[0] + to[1])) continue
        const key = borderEdgeKey(from, to)
        const edge = selectedEdges.get(key) ?? { owners: new Set<string>(), from, to }
        edge.owners.add(sourceId)
        selectedEdges.set(key, edge)
      }
    }
  }

  const points: GeoPoint[] = []
  for (const edge of selectedEdges.values()) {
    if (edge.owners.size < 2 || ![...edge.owners].some((owner) => sourceIds.has(owner))) continue
    const from: GeoPoint = [normalizeLongitude(edge.from[0]), edge.from[1]]
    const to: GeoPoint = [normalizeLongitude(edge.to[0]), edge.to[1]]
    const distance = distanceKm(from, to)
    const steps = Math.max(1, Math.ceil(distance / 12))
    const deltaLongitude = normalizeLongitude(to[0] - from[0])
    for (let step = 0; step <= steps; step += 1) {
      const fraction = step / steps
      points.push([
        normalizeLongitude(from[0] + deltaLongitude * fraction),
        from[1] + (to[1] - from[1]) * fraction
      ])
    }
  }
  return points
}

function sampleDrawing(strokes: [number, number][][]): GeoPoint[] {
  const points: GeoPoint[] = []
  for (const stroke of strokes) {
    for (let index = 0; index < stroke.length; index += 1) {
      const from = stroke[index]
      const to = stroke[index + 1]
      if (!from || !Number.isFinite(from[0] + from[1])) continue
      points.push([normalizeLongitude(from[0]), from[1]])
      if (!to) continue
      const distance = distanceKm(from, to)
      const steps = Math.max(1, Math.ceil(distance / 12))
      const deltaLongitude = normalizeLongitude(to[0] - from[0])
      for (let step = 1; step < steps; step += 1) {
        const fraction = step / steps
        points.push([
          normalizeLongitude(from[0] + deltaLongitude * fraction),
          from[1] + (to[1] - from[1]) * fraction
        ])
      }
    }
  }
  return points
}

export function scoreDrawnBorders(
  strokes: [number, number][][],
  continentFilter: readonly ContinentId[],
  countryAlpha2: string | null = null
): number {
  const drawnPoints = sampleDrawing(strokes)
  const referencePoints = extractReferencePoints(continentFilter, countryAlpha2)
  if (drawnPoints.length === 0 || referencePoints.length === 0) return 0

  const toleranceKm = 35
  const referenceIndex = indexPoints(referencePoints)
  const drawnIndex = indexPoints(drawnPoints)
  const precision =
    drawnPoints.filter((point) => hasNearbyPoint(point, referenceIndex, toleranceKm)).length /
    drawnPoints.length
  const recall =
    referencePoints.filter((point) => hasNearbyPoint(point, drawnIndex, toleranceKm)).length /
    referencePoints.length
  return precision + recall === 0
    ? 0
    : Math.round(((2 * precision * recall) / (precision + recall)) * 100)
}
