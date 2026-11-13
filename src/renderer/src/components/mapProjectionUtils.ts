import type { Map as MapLibreMap } from 'maplibre-gl'

export const GLOBE_TRANSITION_START_ZOOM = 3.5
export const GLOBE_TRANSITION_END_ZOOM = 1

/** Filters label anchors gradually as the flat world folds onto its visible globe face. */
export function isGlobeLabelVisible(
  map: MapLibreMap,
  coordinates: [number, number],
  zoom: number,
  transitionStartZoom: number,
  transitionEndZoom: number
): boolean {
  const progress = Math.max(
    0,
    Math.min(1, (transitionStartZoom - zoom) / (transitionStartZoom - transitionEndZoom))
  )
  const center = map.getCenter()
  const latitude = (coordinates[1] * Math.PI) / 180
  const centerLatitude = (center.lat * Math.PI) / 180
  const longitudeDifference = ((coordinates[0] - center.lng) * Math.PI) / 180
  const visibleHemisphereDot =
    Math.sin(centerLatitude) * Math.sin(latitude) +
    Math.cos(centerLatitude) * Math.cos(latitude) * Math.cos(longitudeDifference)

  // At the start, the full flat map is visible. As it bends, progressively
  // more of the far side is hidden, reaching the front hemisphere at the end.
  if (visibleHemisphereDot < -1 + progress) return false

  const point = map.project(coordinates)
  const canvas = map.getCanvas()
  return point.x >= 0 && point.x <= canvas.clientWidth &&
    point.y >= 0 && point.y <= canvas.clientHeight
}
