import type { Geometry, Position } from 'geojson'
import type { MapOpacityMask } from '../data/geography/mapLayerManager'

const MERCATOR_EARTH_RADIUS_KM = 6371
const MAX_MERCATOR_LATITUDE = 85.0511287798066

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

function projectMercator([longitude, latitude]: [number, number]): [number, number] {
  const clampedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude)
  )
  const latitudeRadians = (clampedLatitude * Math.PI) / 180
  return [
    (longitude * Math.PI * MERCATOR_EARTH_RADIUS_KM) / 180,
    MERCATOR_EARTH_RADIUS_KM * Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2))
  ]
}

function unprojectMercator([x, y]: [number, number]): [number, number] {
  return [
    wrapLongitude((x / MERCATOR_EARTH_RADIUS_KM) * (180 / Math.PI)),
    Math.max(
      -MAX_MERCATOR_LATITUDE,
      Math.min(
        MAX_MERCATOR_LATITUDE,
        (2 * Math.atan(Math.exp(y / MERCATOR_EARTH_RADIUS_KM)) - Math.PI / 2) * (180 / Math.PI)
      )
    )
  ]
}

export function createCircleMaskGeometry(center: [number, number], radiusKm: number): Geometry {
  const steps = 72
  const [centerX, centerY] = projectMercator(center)
  const radius = Math.max(1, radiusKm)
  const ring: Position[] = []

  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2
    ring.push(
      unprojectMercator([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius])
    )
  }

  return { type: 'Polygon', coordinates: [ring] }
}

export function createRectangleMaskGeometry(
  center: [number, number],
  widthKm: number,
  heightKm: number
): Geometry {
  const [centerX, centerY] = projectMercator(center)
  const west = wrapLongitude(((centerX - widthKm / 2) / MERCATOR_EARTH_RADIUS_KM) * (180 / Math.PI))
  const east = wrapLongitude(((centerX + widthKm / 2) / MERCATOR_EARTH_RADIUS_KM) * (180 / Math.PI))
  const south = unprojectMercator([centerX, centerY - heightKm / 2])[1]
  const north = unprojectMercator([centerX, centerY + heightKm / 2])[1]

  if (west <= east) {
    return {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south]
        ]
      ]
    }
  }

  return {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [west, south],
          [180, south],
          [180, north],
          [west, north],
          [west, south]
        ]
      ],
      [
        [
          [-180, south],
          [east, south],
          [east, north],
          [-180, north],
          [-180, south]
        ]
      ]
    ]
  }
}

export type OpacityMaskHandle = {
  kind: 'center' | 'radius' | 'width' | 'height'
  longitude: number
  latitude: number
}

export function getOpacityMaskHandles(mask: MapOpacityMask): OpacityMaskHandle[] {
  if (!mask.center || (mask.kind !== 'circle' && mask.kind !== 'rectangle')) return []
  const [longitude, latitude] = mask.center
  const [centerX, centerY] = projectMercator(mask.center)
  if (mask.kind === 'circle') {
    const radius = mask.radiusKm ?? 500
    const [handleLongitude, handleLatitude] = unprojectMercator([centerX + radius, centerY])
    return [
      { kind: 'center', longitude, latitude },
      { kind: 'radius', longitude: handleLongitude, latitude: handleLatitude }
    ]
  }
  const [widthLongitude, widthLatitude] = unprojectMercator([
    centerX + (mask.widthKm ?? 1000) / 2,
    centerY
  ])
  const [heightLongitude, heightLatitude] = unprojectMercator([
    centerX,
    centerY + (mask.heightKm ?? 700) / 2
  ])
  return [
    { kind: 'center', longitude, latitude },
    { kind: 'width', longitude: widthLongitude, latitude: widthLatitude },
    { kind: 'height', longitude: heightLongitude, latitude: heightLatitude }
  ]
}

function getProjectedDistanceKm(first: [number, number], second: [number, number]): number {
  const [firstX, firstY] = projectMercator(first)
  const [secondX, secondY] = projectMercator(second)
  const longitudeDelta =
    ((secondX - firstX + Math.PI * MERCATOR_EARTH_RADIUS_KM) %
      (2 * Math.PI * MERCATOR_EARTH_RADIUS_KM)) -
    Math.PI * MERCATOR_EARTH_RADIUS_KM
  return Math.hypot(longitudeDelta, secondY - firstY)
}

export function getOpacityMaskHandlePatch(
  mask: MapOpacityMask,
  handle: OpacityMaskHandle,
  position: [number, number]
): Partial<MapOpacityMask> | null {
  if (handle.kind === 'center') return { center: position }
  if (!mask.center) return null

  if (handle.kind === 'radius') {
    const radiusKm = Math.max(
      50,
      Math.round(getProjectedDistanceKm(mask.center, position) / 25) * 25
    )
    return { radiusKm }
  }
  if (handle.kind === 'width') {
    const [centerX] = projectMercator(mask.center)
    const [positionX] = projectMercator(position)
    const longitudeDelta =
      ((positionX - centerX + Math.PI * MERCATOR_EARTH_RADIUS_KM) %
        (2 * Math.PI * MERCATOR_EARTH_RADIUS_KM)) -
      Math.PI * MERCATOR_EARTH_RADIUS_KM
    const widthKm = Math.max(100, Math.round((Math.abs(longitudeDelta) * 2) / 100) * 100)
    return { widthKm }
  }
  const [, centerY] = projectMercator(mask.center)
  const [, positionY] = projectMercator(position)
  const heightKm = Math.max(100, Math.round((Math.abs(positionY - centerY) * 2) / 100) * 100)
  return { heightKm }
}
