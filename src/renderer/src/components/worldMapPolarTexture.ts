import { loadMapTextureSource, type MapTextureAssetKey } from './worldMapOpacityMasks'
import { createPolarBlendPixels } from './polarTextureBlend'

const POLAR_TEXTURE_LATITUDE = 89.9
const POLAR_TEXTURE_MAX_WIDTH = 2048
const POLAR_TEXTURE_QUALITY = 0.86

export const globeEarthTextureCoordinates: [
  [number, number],
  [number, number],
  [number, number],
  [number, number]
] = [
  [-180, POLAR_TEXTURE_LATITUDE],
  [180, POLAR_TEXTURE_LATITUDE],
  [180, -POLAR_TEXTURE_LATITUDE],
  [-180, -POLAR_TEXTURE_LATITUDE]
]

function mercatorY(latitude: number): number {
  return (
    (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))) / 360
  )
}

function putPolarBlend(
  context: CanvasRenderingContext2D,
  edgePixels: Uint8ClampedArray,
  y: number,
  rowCount: number,
  edgeAtBottom: boolean
): void {
  const width = Math.floor(edgePixels.length / 4)
  const imageData = context.createImageData(width, rowCount)
  imageData.data.set(createPolarBlendPixels(edgePixels, rowCount, edgeAtBottom))
  context.putImageData(imageData, 0, y)
}

export async function createPolarExtendedTextureUrl(
  sourceUrl: string,
  assetKey: MapTextureAssetKey
): Promise<string> {
  const image = await loadMapTextureSource(sourceUrl, assetKey)
  const scale = Math.min(1, POLAR_TEXTURE_MAX_WIDTH / image.naturalWidth)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * scale))
  const polarPadding = Math.max(
    1,
    Math.round(Math.abs(mercatorY(POLAR_TEXTURE_LATITUDE)) * sourceHeight)
  )
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = sourceHeight + polarPadding * 2
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponible')

  context.drawImage(image, 0, polarPadding, width, sourceHeight)
  const northEdge = context.getImageData(0, polarPadding, width, 1).data
  const southEdge = context.getImageData(0, polarPadding + sourceHeight - 1, width, 1).data
  putPolarBlend(context, northEdge, 0, polarPadding, true)
  putPolarBlend(context, southEdge, polarPadding + sourceHeight, polarPadding, false)

  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Impossible de prolonger la texture vers les pôles'))
          return
        }
        resolve(URL.createObjectURL(blob))
      },
      'image/webp',
      POLAR_TEXTURE_QUALITY
    )
  })
}
