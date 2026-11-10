const MAP_TILE_SIZE = 512
const MAX_LABEL_PRECISION = 0.05
const LABEL_PRECISION_PIXELS = 2

export function getLabelPrecision(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, zoom) : 0
  const degreesPerPixel = 360 / (MAP_TILE_SIZE * 2 ** safeZoom)
  return Math.min(
    MAX_LABEL_PRECISION,
    degreesPerPixel * LABEL_PRECISION_PIXELS
  )
}
