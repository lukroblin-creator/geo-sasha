import type { Geometry } from 'geojson'
import { getGeometryInteriorPoint } from '../geography/labels'
import { world10m } from '../world'

const EARTH_RADIUS_KM = 6371.0088
const ZERO_SCORE_RADIUS_KM = 5000
const anchorCache = new WeakMap<Geometry, [number, number] | null>()

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

function normalizeSourceFeatureId(sourceFeatureId: string | number): string {
  const value = String(sourceFeatureId)
  return /^-?\d+$/.test(value) ? String(Number(value)) : value
}

function getInteriorPoint(geometry: Geometry): [number, number] | null {
  if (anchorCache.has(geometry)) return anchorCache.get(geometry) ?? null
  const point = getGeometryInteriorPoint(geometry)
  anchorCache.set(geometry, point)
  return point
}

function getDistanceKm(
  first: [number, number],
  second: [number, number]
): number {
  const firstLatitude = (first[1] * Math.PI) / 180
  const secondLatitude = (second[1] * Math.PI) / 180
  const latitudeDifference = secondLatitude - firstLatitude
  const longitudeDifference = (normalizeLongitude(second[0] - first[0]) * Math.PI) / 180
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2
  const boundedHaversine = Math.max(0, Math.min(1, haversine))

  return 2 * EARTH_RADIUS_KM * Math.atan2(
    Math.sqrt(boundedHaversine),
    Math.sqrt(1 - boundedHaversine)
  )
}

/**
 * Gives a continuous, concentric proximity estimate around the target
 * country's interior anchor. The score is guidance only and never reaches
 * 100 for a wrong answer.
 */
export function getMapProximityScore(
  sourceFeatureId: string | number,
  longitude: number,
  latitude: number
): number {
  const sourceFeatureKey = normalizeSourceFeatureId(sourceFeatureId)
  const feature = world10m.features.find((candidate) => {
    const properties = candidate.properties as Record<string, unknown> | null
    const candidateId = properties?.sourceId
    return (
      (typeof candidateId === 'string' || typeof candidateId === 'number') &&
      normalizeSourceFeatureId(candidateId) === sourceFeatureKey
    )
  })
  const geometry = feature?.geometry

  if (
    !geometry ||
    (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return 0
  }

  const countryCenter = getInteriorPoint(geometry)
  if (!countryCenter) return 0

  const distanceKm = getDistanceKm(countryCenter, [normalizeLongitude(longitude), latitude])
  const remainingScore = 100 * (1 - distanceKm / ZERO_SCORE_RADIUS_KM)

  return Math.max(0, Math.min(99, Math.round(remainingScore)))
}
