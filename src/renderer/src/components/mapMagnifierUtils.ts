export type MapMagnifierPoint = { x: number; y: number }
export type MapMagnifierSize = { width: number; height: number }
export type MapMagnifierBounds = { width: number; height: number }
export type MapMagnifierScrollPreference = 'natural' | 'inverted'

const MAP_MAGNIFIER_SCROLL_PREFERENCE_KEY = 'world-atlas:map-magnifier-scroll:v1'
const MAP_MAGNIFIER_SCROLL_PREFERENCE_EVENT = 'world-atlas:map-magnifier-scroll-change'
let fallbackScrollPreference: MapMagnifierScrollPreference = 'natural'

export const MAP_MAGNIFIER_BASE_SIZE: MapMagnifierSize = { width: 370, height: 205 }
export const MAP_MAGNIFIER_MIN_WIDTH = 220
export const MAP_MAGNIFIER_MAX_WIDTH = 560
export const MAP_MAGNIFIER_SLOWDOWN = 8
export const MAP_MAGNIFIER_SCALE = 8
export const MAP_MAGNIFIER_MAX_ZOOM = 22
export const MAP_MAGNIFIER_WHEEL_AXIS_DOMINANCE = 1.6

export function getMapMagnifierScrollPreference(): MapMagnifierScrollPreference {
  try {
    const saved = localStorage.getItem(MAP_MAGNIFIER_SCROLL_PREFERENCE_KEY)
    if (saved === 'natural' || saved === 'inverted') return saved
  } catch {
    return fallbackScrollPreference
  }
  return fallbackScrollPreference
}

export function saveMapMagnifierScrollPreference(preference: MapMagnifierScrollPreference): void {
  fallbackScrollPreference = preference
  try {
    localStorage.setItem(MAP_MAGNIFIER_SCROLL_PREFERENCE_KEY, preference)
  } catch {
    // The current session still uses the preference if storage is unavailable.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MAP_MAGNIFIER_SCROLL_PREFERENCE_EVENT))
  }
}

export function getMapMagnifierWheelAxis(
  deltaX: number,
  deltaY: number
): 'horizontal' | 'vertical' | null {
  const horizontal = Math.abs(deltaX)
  const vertical = Math.abs(deltaY)
  if (horizontal === 0 && vertical === 0) return null
  if (horizontal >= vertical * MAP_MAGNIFIER_WHEEL_AXIS_DOMINANCE) return 'horizontal'
  if (vertical >= horizontal * MAP_MAGNIFIER_WHEEL_AXIS_DOMINANCE) return 'vertical'
  return null
}

export const mapMagnifierScrollPreferenceEvent = MAP_MAGNIFIER_SCROLL_PREFERENCE_EVENT

export function getMapMagnifierZoom(zoom: number, maxZoom = 22): number {
  const safeZoom = Number.isFinite(zoom) ? zoom : 0
  return Math.min(maxZoom, safeZoom + Math.log2(MAP_MAGNIFIER_SCALE))
}

export function adjustMapMagnifierZoom(
  zoom: number,
  deltaY: number,
  minimumZoom: number,
  maximumZoom = MAP_MAGNIFIER_MAX_ZOOM
): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return zoom
  const nextZoom = zoom - deltaY * 0.004
  return Math.max(minimumZoom, Math.min(maximumZoom, nextZoom))
}

export function scaleMapMagnifierSize(size: MapMagnifierSize, deltaY: number): MapMagnifierSize {
  if (!Number.isFinite(deltaY) || deltaY === 0) return size
  const factor = Math.exp(-deltaY * 0.002)
  const width = Math.max(
    MAP_MAGNIFIER_MIN_WIDTH,
    Math.min(MAP_MAGNIFIER_MAX_WIDTH, size.width * factor)
  )
  return { width, height: (width / MAP_MAGNIFIER_BASE_SIZE.width) * MAP_MAGNIFIER_BASE_SIZE.height }
}

export function moveMapMagnifier(
  position: MapMagnifierPoint,
  previousPointer: MapMagnifierPoint,
  nextPointer: MapMagnifierPoint,
  size: MapMagnifierSize,
  bounds: MapMagnifierBounds
): MapMagnifierPoint {
  const halfWidth = Math.min(size.width / 2, bounds.width / 2)
  const halfHeight = Math.min(size.height / 2, bounds.height / 2)
  const x = position.x + (nextPointer.x - previousPointer.x) / MAP_MAGNIFIER_SLOWDOWN
  const y = position.y + (nextPointer.y - previousPointer.y) / MAP_MAGNIFIER_SLOWDOWN
  return {
    x: Math.max(halfWidth, Math.min(bounds.width - halfWidth, x)),
    y: Math.max(halfHeight, Math.min(bounds.height - halfHeight, y))
  }
}
