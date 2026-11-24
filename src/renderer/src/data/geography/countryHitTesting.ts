import type { Geometry } from 'geojson'

import { normalizeSourceFeatureId } from './sourceFeatureIds.ts'

export type ScreenPoint = { x: number; y: number }

export type CountryHitFeature = {
  geometry: Geometry
  layer: { id: string }
  properties?: Record<string, unknown> | null
}

export type CountryHitProjection = {
  getZoom(): number
  project(coordinate: [number, number]): ScreenPoint
}

export type NearbyCountryHit = {
  distance: number
  isTinyTerritory: boolean
  isGhostHit?: boolean
  effectiveSize: number
}

export type CountryDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export function getNextCountryFeature<T extends CountryHitFeature>(
  candidates: T[],
  currentIdentity: string | null
): T | undefined {
  if (candidates.length === 0) return undefined
  const currentIndex = currentIdentity
    ? candidates.findIndex((feature) => getCountryFeatureIdentity(feature) === currentIdentity)
    : -1
  return candidates[(currentIndex + 1) % candidates.length]
}

export function chooseDirectionalCountryFeature<T>(
  origin: ScreenPoint,
  candidates: Array<{ feature: T; point: ScreenPoint }>,
  direction: CountryDirection,
  maxDistance: number
): T | null {
  let best: { feature: T; score: number } | null = null
  for (const candidate of candidates) {
    const deltaX = candidate.point.x - origin.x
    const deltaY = candidate.point.y - origin.y
    const forward =
      direction === 'ArrowRight'
        ? deltaX
        : direction === 'ArrowLeft'
          ? -deltaX
          : direction === 'ArrowDown'
            ? deltaY
            : -deltaY
    if (forward <= 1) continue
    const distance = Math.hypot(deltaX, deltaY)
    if (distance > maxDistance) continue
    const perpendicular =
      direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(deltaY) : Math.abs(deltaX)
    const score = perpendicular / forward + distance * 0.002
    if (!best || score < best.score) best = { feature: candidate.feature, score }
  }
  return best?.feature ?? null
}

export function getKeyboardActivationFeature<T>(
  preselectedFeature: T | null,
  isSubmittingSearch: boolean
): T | null {
  return isSubmittingSearch ? null : preselectedFeature
}

export { normalizeSourceFeatureId }

export function isCountryFillFeature(feature: CountryHitFeature): boolean {
  const sourceFeatureId = feature.properties?.sourceId
  // Ignore map fragments without a country ID; the app cannot select those.
  return (
    feature.layer.id.startsWith('countries-fill-') &&
    (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
    (typeof sourceFeatureId === 'string' || typeof sourceFeatureId === 'number')
  )
}

export function getCountryFeatureIdentity(feature: {
  properties?: Record<string, unknown> | null
}): string | null {
  const entityId = feature.properties?.entityId
  if (typeof entityId === 'string') return `entity:${entityId}`
  const sourceId = feature.properties?.sourceId
  return typeof sourceId === 'string' || typeof sourceId === 'number'
    ? `source:${normalizeSourceFeatureId(sourceId)}`
    : null
}

export function distanceToScreenSegment(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint
): number {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared)
        )
  return Math.hypot(
    point.x - (start.x + fraction * deltaX),
    point.y - (start.y + fraction * deltaY)
  )
}

export function isPointInsideScreenRing(point: ScreenPoint, ring: ScreenPoint[]): boolean {
  let inside = false
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const first = ring[index]
    const second = ring[previous]
    if (!first || !second) continue
    const crossesRay = first.y > point.y !== second.y > point.y
    if (
      crossesRay &&
      point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x
    ) {
      inside = !inside
    }
  }
  return inside
}

function scaleScreenRing(ring: ScreenPoint[], center: ScreenPoint, scale: number): ScreenPoint[] {
  return ring.map((vertex) => ({
    x: center.x + (vertex.x - center.x) * scale,
    y: center.y + (vertex.y - center.y) * scale
  }))
}

export function getTinyTerritoryHitRadius(
  zoom: number,
  surroundedByLargeCountries = false
): number {
  // Tiny territories need a larger target at world scale. Exact geographic
  // containment is resolved first, so this halo only helps where the map
  // renderer has reduced or omitted the small polygon.
  const zoomProgress = Math.max(0, Math.min(1, zoom / 6))
  const standardRadius = 14 - zoomProgress * 10
  if (!surroundedByLargeCountries) return standardRadius

  // Enclaves and other small territories with only large land neighbors can
  // safely use a wider target: large countries are never selected outside
  // their actual geometry.
  const expandedZoomProgress = Math.max(0, Math.min(1, zoom / 8))
  return Math.max(standardRadius, 24 - expandedZoomProgress * 16)
}

export function hasOnlyLargeLandNeighbors(
  neighborAreasKm2: readonly (number | null)[],
  largeCountryAreaKm2 = 20_000
): boolean {
  return (
    neighborAreasKm2.length > 0 &&
    neighborAreasKm2.every(
      (areaKm2) => areaKm2 !== null && Number.isFinite(areaKm2) && areaKm2 > largeCountryAreaKm2
    )
  )
}

export function getCountryFeatureHit(
  map: CountryHitProjection,
  feature: CountryHitFeature,
  point: ScreenPoint,
  areaKm2: number | null,
  seaHitRadius = 0
): NearbyCountryHit | null {
  const geometry = feature.geometry
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let nearestHit: NearbyCountryHit | null = null
  let nearestTinyTerritoryHit: NearbyCountryHit | null = null
  let nearestGhostTerritoryHit: NearbyCountryHit | null = null

  for (const polygon of polygons) {
    const projectedRings = polygon.map((ring) =>
      ring
        .map((coordinate) => map.project([coordinate[0], coordinate[1]]))
        .filter((projectedPoint) => Number.isFinite(projectedPoint.x + projectedPoint.y))
    )
    const outerRing = projectedRings[0]
    if (!outerRing || outerRing.length < 3) continue

    let west = Infinity
    let east = -Infinity
    let north = Infinity
    let south = -Infinity
    for (const vertex of outerRing) {
      west = Math.min(west, vertex.x)
      east = Math.max(east, vertex.x)
      north = Math.min(north, vertex.y)
      south = Math.max(south, vertex.y)
    }

    const polygonWidth = Math.max(0, east - west)
    const polygonHeight = Math.max(0, south - north)
    const effectiveSize = Math.sqrt(polygonWidth * polygonHeight)
    const center = { x: (west + east) / 2, y: (north + south) / 2 }
    const insideOuterRing = isPointInsideScreenRing(point, outerRing)
    const insideHole = projectedRings.slice(1).some((ring) => isPointInsideScreenRing(point, ring))
    let distance = insideOuterRing && !insideHole ? 0 : Number.POSITIVE_INFINITY
    let insideGhost = false

    if (effectiveSize <= 18 && (areaKm2 === null || areaKm2 <= 10_000)) {
      const expandedOuterRing = scaleScreenRing(outerRing, center, 1.5)
      const insideExpandedOuter = isPointInsideScreenRing(point, expandedOuterRing)
      const insideExpandedHole = projectedRings
        .slice(1)
        .some((ring) => isPointInsideScreenRing(point, scaleScreenRing(ring, center, 1.5)))
      insideGhost = insideExpandedOuter && !insideExpandedHole && distance !== 0
    }

    if (distance !== 0) {
      for (const ring of projectedRings) {
        for (let index = 0; index < ring.length; index += 1) {
          const start = ring[index]
          const end = ring[(index + 1) % ring.length]
          if (!start || !end) continue
          distance = Math.min(distance, distanceToScreenSegment(point, start, end))
        }
      }
    }

    // Large countries remain selectable from their actual fill. They do not
    // receive an expanded hit target that can cover smaller neighbors.
    if (distance !== 0 && areaKm2 !== null && areaKm2 > 200_000) continue

    if (effectiveSize <= 18 && (areaKm2 === null || areaKm2 <= 10_000)) {
      const insideSeaHitArea = distance > 0 && distance <= seaHitRadius
      if (insideGhost) {
        if (!nearestGhostTerritoryHit || distance < nearestGhostTerritoryHit.distance) {
          nearestGhostTerritoryHit = {
            distance,
            isTinyTerritory: true,
            isGhostHit: true,
            effectiveSize
          }
        }
      } else if (insideSeaHitArea) {
        if (!nearestGhostTerritoryHit || distance < nearestGhostTerritoryHit.distance) {
          nearestGhostTerritoryHit = {
            distance,
            isTinyTerritory: true,
            isGhostHit: true,
            effectiveSize
          }
        }
      } else if (
        distance === 0 &&
        (!nearestTinyTerritoryHit || effectiveSize < nearestTinyTerritoryHit.effectiveSize)
      ) {
        nearestTinyTerritoryHit = { distance, isTinyTerritory: true, effectiveSize }
      }
      continue
    }

    // Keep ordinary country edges more precise than the expanded island targets.
    const hitRadius = Math.min(6, Math.max(2, effectiveSize * 0.14))
    if (distance <= hitRadius && (!nearestHit || distance < nearestHit.distance)) {
      nearestHit = { distance, isTinyTerritory: false, effectiveSize }
    }
  }

  const exactHits = [nearestTinyTerritoryHit, nearestHit]
    .filter((hit): hit is NearbyCountryHit => hit !== null && hit.distance === 0)
    .sort((first, second) => first.effectiveSize - second.effectiveSize)
  if (exactHits[0]) return exactHits[0]
  return nearestTinyTerritoryHit ?? nearestGhostTerritoryHit ?? nearestHit
}

export function chooseCountryFeatureAtPoint<T extends CountryHitFeature>(
  map: CountryHitProjection,
  point: ScreenPoint,
  candidates: T[],
  directFeature: T | undefined,
  getAreaKm2: (feature: T) => number | null,
  getSeaHitRadius: (feature: T) => number = () => 0
): T | undefined {
  let nearest: { feature: T; distance: number } | null = null
  let nearestTinyTerritory: { feature: T; distance: number } | null = null
  let nearestExact: { feature: T; effectiveSize: number } | null = null
  let nearestExactTinyTerritory: { feature: T; effectiveSize: number } | null = null
  let nearestExpandedTinyTerritory: { feature: T; distance: number } | null = null

  for (const feature of candidates) {
    if (!isCountryFillFeature(feature)) continue
    const hit = getCountryFeatureHit(
      map,
      feature,
      point,
      getAreaKm2(feature),
      getSeaHitRadius(feature)
    )
    if (!hit) continue
    if (
      hit.distance === 0 &&
      !hit.isGhostHit &&
      (!nearestExact || hit.effectiveSize < nearestExact.effectiveSize)
    ) {
      nearestExact = { feature, effectiveSize: hit.effectiveSize }
    }
    if (
      hit.distance === 0 &&
      hit.isTinyTerritory &&
      !hit.isGhostHit &&
      (!nearestExactTinyTerritory || hit.effectiveSize < nearestExactTinyTerritory.effectiveSize)
    ) {
      nearestExactTinyTerritory = { feature, effectiveSize: hit.effectiveSize }
    }
    if (hit.isTinyTerritory) {
      if (
        hit.isGhostHit &&
        (!nearestExpandedTinyTerritory || hit.distance < nearestExpandedTinyTerritory.distance)
      ) {
        nearestExpandedTinyTerritory = { feature, distance: hit.distance }
      }
      if (!nearestTinyTerritory || hit.distance < nearestTinyTerritory.distance) {
        nearestTinyTerritory = { feature, distance: hit.distance }
      }
    } else if (!nearest || hit.distance < nearest.distance) {
      nearest = { feature, distance: hit.distance }
    }
  }

  // Exact containment always wins over expanded halos. This keeps a large
  // neighboring country selectable even when a nearby microstate has a broad
  // target at world scale.
  return (
    nearestExactTinyTerritory?.feature ??
    nearestExact?.feature ??
    nearestExpandedTinyTerritory?.feature ??
    directFeature ??
    nearestTinyTerritory?.feature ??
    nearest?.feature
  )
}
