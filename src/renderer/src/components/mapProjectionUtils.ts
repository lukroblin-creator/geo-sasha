import type { Map as MapLibreMap } from 'maplibre-gl'

export const GLOBE_TRANSITION_START_ZOOM = 3.5
export const GLOBE_TRANSITION_END_ZOOM = 2.5

export function getGlobeTransitionProgress(
  zoom: number,
  transitionStartZoom: number,
  transitionEndZoom: number
): number {
  return Math.max(
    0,
    Math.min(1, (transitionStartZoom - zoom) / (transitionStartZoom - transitionEndZoom))
  )
}

export function getGlobeVisibilityThreshold(
  zoom: number,
  transitionStartZoom: number,
  transitionEndZoom: number
): number {
  // The flat map is fully visible at the start. The globe shows only its front
  // hemisphere once the projection transition is complete.
  return -1 + getGlobeTransitionProgress(zoom, transitionStartZoom, transitionEndZoom)
}

/** Filters label anchors gradually as the flat world folds onto its visible globe face. */
export function isGlobeLabelVisible(
  map: MapLibreMap,
  coordinates: [number, number],
  zoom: number,
  transitionStartZoom: number,
  transitionEndZoom: number
): boolean {
  const center = map.getCenter()
  const latitude = (coordinates[1] * Math.PI) / 180
  const centerLatitude = (center.lat * Math.PI) / 180
  const longitudeDifference = ((coordinates[0] - center.lng) * Math.PI) / 180
  const visibleHemisphereDot =
    Math.sin(centerLatitude) * Math.sin(latitude) +
    Math.cos(centerLatitude) * Math.cos(latitude) * Math.cos(longitudeDifference)

  if (
    visibleHemisphereDot < getGlobeVisibilityThreshold(zoom, transitionStartZoom, transitionEndZoom)
  )
    return false

  const point = map.project(coordinates)
  const canvas = map.getCanvas()
  return (
    point.x >= 0 && point.x <= canvas.clientWidth && point.y >= 0 && point.y <= canvas.clientHeight
  )
}
